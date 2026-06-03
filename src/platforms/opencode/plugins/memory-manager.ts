import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { access, appendFile, readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { config } from "../../../../config"

/**
 * Memory Manager Plugin
 *
 * Automatically evaluates each primary session when it becomes idle and delegates memory extraction to the memory agent.
 * - Fires on session.idle for sessions with no parentID (primary sessions only)
 * - Sanitizes conversation: strips tool outputs, keeps user/assistant text and tool call signals
 * - Passes sanitized transcript + existing Memory.md to memory agent, which writes new items directly
 * - Injects Memory.md into system prompt on session start
 */

const MEMORY_FILE_PATH = config.memoryFilePath.startsWith("~/")
  ? join(homedir(), config.memoryFilePath.replace("~/", ""))
  : config.memoryFilePath

const DEBUG_ENABLED = process.env.OPENCODE_MEMORY_DEBUG === "1"
const DEBUG_LOG_PATH = process.env.OPENCODE_MEMORY_LOG
  || join(process.env.XDG_STATE_HOME || join(homedir(), ".local/state"), "opencode", "memory-manager.log")
const MEMORY_EVALUATION_TURN_INTERVAL = Number(process.env.OPENCODE_MEMORY_TURN_INTERVAL || 5)
const MEMORY_EVALUATION_IDLE_TIMEOUT_MS = Number(process.env.OPENCODE_MEMORY_IDLE_TIMEOUT_MS || 1 * 60 * 1000)
const IDLE_DEDUP_MS = 500

const PROMPTS = {
  systemInjection: (memoryContent: string) => `# Working Memory Context

Below is your short-term working memory across all projects. Items follow the format \`[tag] project: description\` where tags mean: \`[decision]\` a choice was made, \`[work]\` significant work was completed, \`[research]\` a topic was researched, \`[kb-enrichment]\` a knowledge base enrichment run was completed.

${memoryContent}`,
}

// Track memory agent session IDs to prevent hook recursion
const memoryAgentSessions = new Set<string>()

// Per-session memory snapshot — captured once on first LLM call, stable for entire session
// Ensures identical system prompt prefix on every call → Anthropic prompt cache hits
const sessionMemorySnapshots = new Map<string, string>()

// Track evaluated primary sessions so repeated idle events do not re-run on the same transcript
const evaluatedMessageCounts = new Map<string, number>()
const evaluatedAssistantCounts = new Map<string, number>()
const idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
const lastIdleEventAt = new Map<string, number>()
const evaluatingSessions = new Set<string>()

function normalizeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack || "" }
  }
  return { message: String(error) }
}

async function debugLog(entry: Record<string, unknown>): Promise<void> {
  if (!DEBUG_ENABLED) return

  try {
    await mkdir(dirname(DEBUG_LOG_PATH), { recursive: true })
    await appendFile(DEBUG_LOG_PATH, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`, "utf-8")
  } catch (error) {
    console.error("Failed to write memory debug log:", error)
  }
}

function isInteractiveMode(): boolean {
  // OpenCode does not document a plugin API for mode detection. `opencode run` is the known
  // non-interactive path, so skip automatic memory evaluation there.
  return !process.argv.includes("run")
}

function getEventSessionId(event: any): string | undefined {
  return event.properties?.sessionID
    || event.properties?.sessionId
    || event.properties?.info?.id
    || event.sessionID
    || event.sessionId
    || event.session_id
}

async function getSessionParentId(client: PluginInput["client"], sessionId: string, event: any): Promise<string | undefined> {
  if (event.properties?.info && "parentID" in event.properties.info) return event.properties.info.parentID

  const sessionResult = await client.session.get({ path: { id: sessionId } }).catch(() => null)
  return sessionResult?.data?.parentID
}

function countAssistantMessages(messages: any[]): number {
  return messages.filter((m: any) => m.info?.role === "assistant").length
}

function clearIdleTimer(sessionId: string): void {
  const timer = idleTimers.get(sessionId)
  if (timer) clearTimeout(timer)
  idleTimers.delete(sessionId)
}

async function ensureMemoryFile(): Promise<void> {
  try {
    await access(MEMORY_FILE_PATH)
  } catch {
    await mkdir(dirname(MEMORY_FILE_PATH), { recursive: true })
    await writeFile(MEMORY_FILE_PATH, "# Memory\n\n", "utf-8")
  }
}

async function readMemory(): Promise<string> {
  await ensureMemoryFile()
  return await readFile(MEMORY_FILE_PATH, "utf-8")
}

/**
 * Sanitizes a session's messages into a transcript string.
 * Keeps: user text, assistant text, tool call signals (name + input args).
 * Strips: tool outputs, reasoning parts, step markers, snapshots.
 */
function sanitizeTranscript(messages: Array<{ role: string; parts: any[] }>): string {
  const lines: string[] = []

  for (const message of messages) {
    const role = message.role === "user" ? "user" : "assistant"

    for (const part of message.parts) {
      if (part.type === "text" && part.text?.trim()) {
        lines.push(`[${role}]: ${part.text.trim()}`)
      } else if (part.type === "tool" && role === "assistant") {
        const tool = part.tool as string
        const input = part.state?.input as Record<string, unknown> | undefined
        if (!input) continue

        // Format key args as compact signals — omit large or complex values
        const args = Object.entries(input)
          .filter(([, v]) => (typeof v === "string" && (v as string).length < 200) || typeof v === "number" || typeof v === "boolean")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")

        lines.push(`[tool: ${tool}]${args ? ` ${args}` : ""}`)
      }
    }
  }

  return lines.join("\n")
}

/**
 * Returns a compact summary of a sanitized transcript for logging
 */
function summarizeTranscript(transcript: string): { userMessages: number; assistantMessages: number; toolCalls: string[] } {
  const lines = transcript.split("\n").filter(l => l.trim())
  const userMessages = lines.filter(l => l.startsWith("[user]:")).length
  const assistantMessages = lines.filter(l => l.startsWith("[assistant]:")).length
  const toolCalls = lines
    .filter(l => l.startsWith("[tool:"))
    .map(l => l.match(/^\[tool: ([^\]]+)\]/)?.[1] ?? "unknown")
  return { userMessages, assistantMessages, toolCalls }
}

/**
 * Extracts text content from session.prompt() response
 */
function extractResponseText(response: any): string {
  const textPart = response.data?.parts?.find((p: any) => p.type === "text")
  return textPart?.text || ""
}

/**
 * Invokes memory agent with the given prompt
 */
async function invokeMemoryAgent(
  client: PluginInput["client"],
  parentSessionId: string,
  prompt: string,
  log: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) => Promise<void>
): Promise<string> {
  let sessionId: string | null = null

  try {
    await log("debug", "Fetching parent session", { parentSessionId })

    const parentSession = await client.session.get({
      path: { id: parentSessionId }
    }).catch(() => null)
    const directory = parentSession?.data?.directory

    await log("debug", "Creating memory agent session", { parentSessionId, directory })

    const createResult = await client.session.create({
      body: { parentID: parentSessionId },
      ...(directory ? { query: { directory } } : {}),
    })

    if (createResult.error) {
      throw new Error(`Failed to create memory agent session: ${createResult.error}`)
    }

    sessionId = createResult.data.id
    memoryAgentSessions.add(sessionId)

    await log("info", "Memory agent session created", { parentSessionId, sessionId })

    await log("debug", "Prompting memory agent", { parentSessionId, sessionId, promptLength: prompt.length })

    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: "memory",
        parts: [{ type: "text", text: prompt }]
      }
    })

    const result = extractResponseText(response)

    await log("debug", "Memory agent response received", { parentSessionId, sessionId, responseLength: result.length, response: result })

    await client.session.abort({ path: { id: sessionId } }).catch(() => { })
    memoryAgentSessions.delete(sessionId)

    return result
  } catch (error) {
    if (sessionId) {
      await client.session.abort({ path: { id: sessionId } }).catch(() => { })
      memoryAgentSessions.delete(sessionId)
    }
    await log("error", "Memory agent invocation failed", { parentSessionId, sessionId, error: normalizeError(error) })
    throw error
  }
}

// Workaround: opencode does not expose the main agent name for a session here.
// These skills run autonomous maintenance workflows, so skip evaluating their
// orchestrating transcript.
const SKIP_SKILLS = ["enriching-knowledge-base", "maintaining-knowledge-base"]

/**
 * Returns true if the transcript contains a skill load that should skip evaluation
 */
function shouldSkipEvaluation(transcript: string): boolean {
  return SKIP_SKILLS.some(skill => transcript.includes(`[tool: skill] name: ${skill}`))
}

/**
 * Main evaluation workflow: sanitize → build prompt → invoke memory agent (which writes Memory.md)
 */
async function evaluateSession(
  client: PluginInput["client"],
  sessionId: string,
  log: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) => Promise<void>
): Promise<number> {
  const messagesResult = await client.session.messages({ path: { id: sessionId } }).catch(() => null)
  if (!messagesResult?.data) {
    await log("warn", "Could not fetch session messages", { sessionId })
    return 0
  }

  const messages = messagesResult.data.map((m: any) => ({
    role: m.info.role,
    parts: m.parts,
  }))

  if (messages.length === 0) {
    await log("info", "Skipping evaluation — empty session", { sessionId })
    return 0
  }

  const transcript = sanitizeTranscript(messages)
  if (!transcript.trim()) {
    await log("info", "Skipping evaluation — no meaningful content", { sessionId })
    return messages.length
  }

  if (shouldSkipEvaluation(transcript)) {
    await log("info", "Skipping evaluation — autonomous agent session", { sessionId })
    return messages.length
  }

  const transcriptSummary = summarizeTranscript(transcript)
  const memoryContentBefore = await readMemory()
  const itemsBefore = memoryContentBefore.split("\n").filter(l => l.trim().startsWith("- "))

  const prompt = `## Conversation\n\n${transcript}\n\n## Existing Memory\n\n${memoryContentBefore}`

  await log("info", "Invoking memory agent", { sessionId, transcript: transcriptSummary })
  await invokeMemoryAgent(client, sessionId, prompt, log)

  const memoryContentAfter = await readMemory()
  const itemsAfter = memoryContentAfter.split("\n").filter(l => l.trim().startsWith("- "))
  const newItems = itemsAfter.slice(itemsBefore.length)

  if (newItems.length > 0) {
    await log("info", "Memory agent wrote new items", { sessionId, count: newItems.length, items: newItems })
  } else {
    await log("info", "Memory agent wrote nothing", { sessionId })
  }

  return messages.length
}

/**
 * Memory Manager Plugin Entry Point
 */
export const MemoryManagerPlugin: Plugin = async (ctx: PluginInput) => {
  const { client } = ctx

  async function log(level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) {
    await debugLog({ level, message, extra })
    await client.app.log({
      body: { service: "memory-manager", level, message, extra }
    }).catch((err) => console.error("Failed to log:", err))
  }

  await log("info", "Memory manager plugin initialized", {
    memoryFilePath: MEMORY_FILE_PATH,
    debugEnabled: DEBUG_ENABLED,
    debugLogPath: DEBUG_ENABLED ? DEBUG_LOG_PATH : undefined,
    interactiveMode: isInteractiveMode(),
    turnInterval: MEMORY_EVALUATION_TURN_INTERVAL,
    idleTimeoutMs: MEMORY_EVALUATION_IDLE_TIMEOUT_MS,
  })

  return {
    // Inject memory into system prompt (primary agent only)
    "experimental.chat.system.transform": async (input, output) => {
      const sessionID = (input as any).sessionID
      if (memoryAgentSessions.has(sessionID)) return

      const agent = (input as any).agent || (input as any).body?.agent
      if (agent) return // skip all subagents

      try {
        // Use session snapshot to ensure identical system prompt prefix on every LLM call within the session
        // — same content = Anthropic prompt cache hits throughout the session
        let memoryContent = sessionMemorySnapshots.get(sessionID)
        if (!memoryContent) {
          memoryContent = await readMemory()
          sessionMemorySnapshots.set(sessionID, memoryContent)
          const itemCount = memoryContent.split("\n").filter(l => l.trim().startsWith("- ")).length
          await log("info", "Memory snapshot captured", { sessionID, itemCount })
        }
        output.system.push(PROMPTS.systemInjection(memoryContent))
      } catch (error) {
        await log("error", "Failed to inject memory context", { error: (error as Error).message })
      }
    },

    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const sessionId = getEventSessionId(event)
        if (!sessionId) return

        memoryAgentSessions.delete(sessionId)
        evaluatedMessageCounts.delete(sessionId)
        evaluatedAssistantCounts.delete(sessionId)
        lastIdleEventAt.delete(sessionId)
        evaluatingSessions.delete(sessionId)
        sessionMemorySnapshots.delete(sessionId)
        clearIdleTimer(sessionId)
        await log("info", "Cleaned up deleted session state", { sessionId, parentID: event.properties?.info?.parentID })
        return
      }

      if (event.type === "session.idle") {
        if (!isInteractiveMode()) {
          await log("debug", "Skipping idle memory evaluation outside interactive mode", { argv: process.argv })
          return
        }

        const sessionId = getEventSessionId(event)
        if (!sessionId) {
          await log("warn", "session.idle event missing session id", { eventType: event.type })
          return
        }

        const now = Date.now()
        const previousIdleAt = lastIdleEventAt.get(sessionId) || 0
        lastIdleEventAt.set(sessionId, now)

        if (now - previousIdleAt < IDLE_DEDUP_MS) {
          await log("debug", "Skipping duplicate idle event", { sessionId, elapsedMs: now - previousIdleAt })
          return
        }

        // Skip memory agent child sessions
        if (memoryAgentSessions.has(sessionId)) {
          await log("debug", "Skipping idle event for memory agent session", { sessionId })
          return
        }

        if (evaluatingSessions.has(sessionId)) {
          await log("debug", "Skipping re-entrant idle evaluation", { sessionId })
          return
        }

        // Skip subagent sessions (any session with a parentID)
        const parentID = await getSessionParentId(client, sessionId, event)
        if (parentID) {
          await log("debug", "Skipping memory evaluation for subagent idle event", { sessionId, parentID })
          return
        }

        async function runEvaluation(trigger: "turn-interval" | "idle-timeout") {
          if (evaluatingSessions.has(sessionId)) {
            await log("debug", "Skipping memory evaluation already in progress", { sessionId, trigger })
            return
          }

          evaluatingSessions.add(sessionId)
          clearIdleTimer(sessionId)

          try {
            const messagesResult = await client.session.messages({ path: { id: sessionId } }).catch(() => null)
            const messages = messagesResult?.data || []
            const messageCount = messages.length
            const assistantCount = countAssistantMessages(messages)
            const previousMessageCount = evaluatedMessageCounts.get(sessionId) || 0

            if (messageCount <= previousMessageCount) {
              await log("debug", "Skipping duplicate idle evaluation", { sessionId, trigger, messageCount, previousMessageCount })
              return
            }

            const evaluatedCount = await evaluateSession(client, sessionId, log)
            evaluatedMessageCounts.set(sessionId, Math.max(messageCount, evaluatedCount))
            evaluatedAssistantCounts.set(sessionId, assistantCount)
          } catch (error) {
            await log("error", "Memory evaluation failed", {
              sessionId,
              trigger,
              error: normalizeError(error)
            })
          } finally {
            evaluatingSessions.delete(sessionId)
          }
        }

        try {
          const messagesResult = await client.session.messages({ path: { id: sessionId } }).catch(() => null)
          const messages = messagesResult?.data || []
          const assistantCount = countAssistantMessages(messages)
          const previousAssistantCount = evaluatedAssistantCounts.get(sessionId) || 0
          const turnsSinceEvaluation = assistantCount - previousAssistantCount

          if (turnsSinceEvaluation >= MEMORY_EVALUATION_TURN_INTERVAL) {
            await log("info", "Memory turn interval reached", { sessionId, assistantCount, previousAssistantCount, turnsSinceEvaluation })
            await runEvaluation("turn-interval")
            return
          }

          clearIdleTimer(sessionId)
          const timer = setTimeout(() => {
            runEvaluation("idle-timeout").catch((error) => {
              log("error", "Scheduled memory evaluation failed", { sessionId, error: normalizeError(error) })
            })
          }, MEMORY_EVALUATION_IDLE_TIMEOUT_MS)
            ; (timer as any).unref?.()
          idleTimers.set(sessionId, timer)
          await log("info", "Scheduled idle-timeout evaluation", {
            sessionId,
            idleTimeoutMs: MEMORY_EVALUATION_IDLE_TIMEOUT_MS,
            assistantCount,
            previousAssistantCount,
            turnsSinceEvaluation,
          })
        } catch (error) {
          await log("error", "Memory evaluation failed", {
            sessionId,
            error: normalizeError(error)
          })
        }
      }
    }
  }
}

export default MemoryManagerPlugin
