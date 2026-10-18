import { Plugin } from "@opencode/plugin"
import type { SessionMessageInfo } from "@opencode/client/promise"
import { readFileSync } from "node:fs"
import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { config } from "../../../../config"
import { buildEvaluationPrompt } from "./prompt-builder"

/**
 * Memory Manager Plugin
 *
 * Automatically evaluates each primary session when it becomes idle and delegates memory extraction to the memory agent.
 * - Fires on session.idle for sessions with no parentID (primary sessions only)
 * - Sanitizes conversation: strips tool outputs, keeps user/assistant text and tool call signals
 * - Passes sanitized transcript + existing Memory.md to memory agent, which writes new items directly
 * - Injects Memory.md into system prompt on session start
 */

/**
 * Returns the resolved memory file path, checking OPENCODE_MEMORY_FILE env override first.
 * Called at use time (not module load) so tests can override via process.env.
 */
function getMemoryFilePath(): string {
  const envOverride = process.env.OPENCODE_MEMORY_FILE
  if (envOverride) return envOverride
  return config.memoryFilePath.startsWith("~/")
    ? join(homedir(), config.memoryFilePath.replace("~/", ""))
    : config.memoryFilePath
}

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

// Incremental transcript cache — avoids re-sanitizing already-processed messages
const transcriptCache = new Map<string, { transcript: string; messageCount: number }>()

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

// biome-ignore lint/suspicious/noExplicitAny: V2 event types not available
function getEventSessionId(event: any): string | undefined {
  return event.sessionID
}

async function getSessionParentId(
  // biome-ignore lint/suspicious/noExplicitAny: V2 session API types not exported from @opencode/plugin
  session: any,
  sessionId: string,
  // biome-ignore lint/suspicious/noExplicitAny: V2 event types not available
  event: any
): Promise<string | undefined> {
  if (event.properties?.info && "parentID" in event.properties.info) return event.properties.info.parentID

  // V2: get() returns SessionInfo directly (no { data } envelope)
  const sessionInfo = await session.get({ sessionID: sessionId }).catch(() => null)
  return sessionInfo?.parentID
}

function countAssistantMessages(messages: SessionMessageInfo[]): number {
  return messages.filter((m) => m.type === "assistant").length
}

function clearIdleTimer(sessionId: string): void {
  const timer = idleTimers.get(sessionId)
  if (timer) clearTimeout(timer)
  idleTimers.delete(sessionId)
}

async function ensureMemoryFile(): Promise<void> {
  try {
    await access(getMemoryFilePath())
  } catch {
    await mkdir(dirname(getMemoryFilePath()), { recursive: true })
    await writeFile(getMemoryFilePath(), "# Memory\n\n", "utf-8")
  }
}

async function readMemory(): Promise<string> {
  await ensureMemoryFile()
  return await readFile(getMemoryFilePath(), "utf-8")
}

function readMemorySync(): string {
  try {
    return readFileSync(getMemoryFilePath(), "utf-8")
  } catch {
    return "# Memory\n\n"
  }
}

/**
 * Sanitizes a session's messages into a transcript string.
 * V2 format: each message has `type` discriminator, user has `text`,
 * assistant has `content` array, tool has `result`.
 * Keeps: user text, assistant text, tool call signals (name + input args).
 * Strips: tool outputs, reasoning parts, step markers, snapshots.
 */
export function sanitizeTranscript(messages: SessionMessageInfo[]): string {
  const lines: string[] = []

  for (const msg of messages) {
    if (msg.type === "user" && msg.text?.trim()) {
      lines.push(`[user]: ${msg.text.trim()}`)
    } else if (msg.type === "assistant") {
      const content = msg.content
      if (!content) continue
      for (const part of content) {
        if (part.type === "text" && part.text?.trim()) {
          lines.push(`[assistant]: ${part.text.trim()}`)
        } else if (part.type === "tool" && part.tool) {
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
    // Skip system, shell (tool output), compaction, idle, etc.
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
 * Extracts text content from the last assistant message in session context.
 * V2 session.context() returns SessionMessageInfo[] with discriminated union types.
 * Assistant messages have `content` array with { type: "text", text: string } entries.
 */
function extractResponseText(messages: SessionMessageInfo[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.type === "assistant") {
      const textEntry = msg.content?.find((c) => c.type === "text")
      if (textEntry?.text) return textEntry.text
    }
  }
  return ""
}

const MEMORY_AGENT_TIMEOUT_MS = Number(process.env.OPENCODE_MEMORY_AGENT_TIMEOUT_MS || 5 * 60 * 1000)

/**
 * Waits for the memory agent session to go idle, with a hard timeout so a stuck
 * agent cannot block evaluation of the parent session forever.
 */
async function waitForMemoryAgent(
  // biome-ignore lint/suspicious/noExplicitAny: V2 session API types not exported from @opencode/plugin
  session: any,
  sessionId: string
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      session.wait({ sessionID: sessionId }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Memory agent timed out after ${MEMORY_AGENT_TIMEOUT_MS}ms`)),
          MEMORY_AGENT_TIMEOUT_MS
        )
        timer.unref?.()
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Invokes memory agent with the given prompt.
 *
 * V2 flow: create child session bound to the memory agent → prompt → wait for idle
 * → read response from context → cleanup.
 * V2's session.prompt() is fire-and-forget (returns admission result only), so we
 * block on session.wait() until the agent goes idle before reading its reply.
 * V2 APIs return values directly and reject on failure — no { data, error } envelope.
 */
async function invokeMemoryAgent(
  // biome-ignore lint/suspicious/noExplicitAny: V2 session API types not exported from @opencode/plugin
  session: any,
  parentSessionId: string,
  prompt: string,
  log: (
    level: "debug" | "info" | "warn" | "error",
    message: string,
    extra?: Record<string, unknown>
  ) => Promise<void>
): Promise<string> {
  let sessionId: string | null = null

  try {
    await log("debug", "Fetching parent session", { parentSessionId })

    const parentSession = await session.get({ sessionID: parentSessionId }).catch(() => null)
    const directory = parentSession?.location?.directory

    await log("debug", "Creating memory agent session", { parentSessionId, directory })

    const newSession = await session.create({
      parentID: parentSessionId,
      agent: "memory",
      ...(directory ? { location: { directory } } : {}),
    })

    sessionId = newSession.id
    if (!sessionId) {
      throw new Error("Memory agent session created without an ID")
    }
    memoryAgentSessions.add(sessionId)

    await log("info", "Memory agent session created", { parentSessionId, sessionId })

    await log("debug", "Prompting memory agent", { parentSessionId, sessionId, promptLength: prompt.length })

    // V2 prompt() is fire-and-forget — wait() resolves once the agent goes idle
    await session.prompt({ sessionID: sessionId, text: prompt })
    await waitForMemoryAgent(session, sessionId)

    const messages = await session.context({ sessionID: sessionId }).catch(() => [])
    const result = extractResponseText(messages)

    await log("debug", "Memory agent response received", { parentSessionId, sessionId, responseLength: result.length, response: result })

    // Cleanup: interrupt defensively (in case of timeout) and remove the session
    await session.interrupt({ sessionID: sessionId }).catch(() => { })
    await session.remove({ sessionID: sessionId }).catch(() => { })
    memoryAgentSessions.delete(sessionId)

    return result
  } catch (error) {
    if (sessionId) {
      await session.interrupt({ sessionID: sessionId }).catch(() => { })
      await session.remove({ sessionID: sessionId }).catch(() => { })
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
export function shouldSkipEvaluation(transcript: string): boolean {
  return SKIP_SKILLS.some(skill => transcript.includes(`[tool: skill] name: ${skill}`))
}

/**
 * Returns items present in `after` but not accounted for in `before`, as a multiset diff.
 *
 * A plain `after.slice(before.length)` breaks once Memory.md is at its item cap: append-memory.sh
 * truncates the oldest item for every new one appended, so the total count stays constant and the
 * positional slice sees no growth even though items were genuinely added.
 */
export function diffNewItems(before: string[], after: string[]): string[] {
  const remaining = new Map<string, number>()
  for (const item of before) {
    remaining.set(item, (remaining.get(item) ?? 0) + 1)
  }

  const added: string[] = []
  for (const item of after) {
    const count = remaining.get(item) ?? 0
    if (count > 0) {
      remaining.set(item, count - 1)
    } else {
      added.push(item)
    }
  }

  return added
}

/**
 * Main evaluation workflow: sanitize → build prompt → invoke memory agent (which writes Memory.md)
 */
export async function evaluateSession(
  // biome-ignore lint/suspicious/noExplicitAny: V2 session API types not exported from @opencode/plugin
  session: any,
  sessionId: string,
  log: (
    level: "debug" | "info" | "warn" | "error",
    message: string,
    extra?: Record<string, unknown>
  ) => Promise<void>
): Promise<number> {
  // V2: session.context() returns SessionMessageInfo[] directly (not wrapped in { data })
  const messages = await session.context({ sessionID: sessionId }).catch(() => null)
  if (!messages) {
    await log("warn", "Could not fetch session messages", { sessionId })
    return 0
  }

  if (messages.length === 0) {
    await log("info", "Skipping evaluation — empty session", { sessionId })
    return 0
  }

  // Incremental cache: only sanitize messages added since last evaluation
  const cache = transcriptCache.get(sessionId)
  const previousCount = cache?.messageCount ?? 0
  const newMessages = messages.slice(previousCount)

  if (newMessages.length === 0) {
    await log("debug", "Skipping evaluation — no new messages since last evaluation", { sessionId, messageCount: messages.length })
    return messages.length
  }

  const newSegment = sanitizeTranscript(newMessages)
  const fullTranscript = cache
    ? cache.transcript + (newSegment ? `\n${newSegment}` : "")
    : newSegment

  transcriptCache.set(sessionId, { transcript: fullTranscript, messageCount: messages.length })

  if (!fullTranscript.trim()) {
    await log("info", "Skipping evaluation — no meaningful content", { sessionId })
    return messages.length
  }

  if (shouldSkipEvaluation(fullTranscript)) {
    await log("info", "Skipping evaluation — autonomous agent session", { sessionId })
    return messages.length
  }

  const memoryContentBefore = await readMemory()
  const itemsBefore = memoryContentBefore.split("\n").filter(l => l.trim().startsWith("- "))

  const prompt = buildEvaluationPrompt(cache?.transcript ?? "", newSegment, memoryContentBefore)

  await log("info", "Invoking memory agent", {
    sessionId,
    previouslyEvaluated: summarizeTranscript(cache?.transcript ?? ""),
    newSinceLastEvaluation: summarizeTranscript(newSegment),
  })
  await invokeMemoryAgent(session, sessionId, prompt, log)

  const memoryContentAfter = await readMemory()
  const itemsAfter = memoryContentAfter.split("\n").filter(l => l.trim().startsWith("- "))
  const newItems = diffNewItems(itemsBefore, itemsAfter)

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
export default Plugin.define({
  id: "memory-manager",
  async setup(ctx) {
    async function log(level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) {
      await debugLog({ level, message, extra })
    }

    await log("info", "Memory manager plugin initialized", {
      memoryFilePath: getMemoryFilePath(),
      debugEnabled: DEBUG_ENABLED,
      debugLogPath: DEBUG_ENABLED ? DEBUG_LOG_PATH : undefined,
      interactiveMode: isInteractiveMode(),
      turnInterval: MEMORY_EVALUATION_TURN_INTERVAL,
      idleTimeoutMs: MEMORY_EVALUATION_IDLE_TIMEOUT_MS,
    })

    // Inject memory into system prompt (primary agent only)
    await ctx.session.hook("context", (event) => {
      const sessionID = event.sessionID
      if (memoryAgentSessions.has(sessionID)) return

      const agent = event.agent
      if (agent) return // skip all subagents

      try {
        // Use session snapshot to ensure identical system prompt prefix on every LLM call within the session
        // — same content = Anthropic prompt cache hits throughout the session
        let memoryContent = sessionMemorySnapshots.get(sessionID)
        if (!memoryContent) {
          memoryContent = readMemorySync()
          sessionMemorySnapshots.set(sessionID, memoryContent)
          const itemCount = memoryContent.split("\n").filter(l => l.trim().startsWith("- ")).length
          log("info", "Memory snapshot captured", { sessionID, itemCount })
        }
        event.system.push({ type: "text" as const, text: PROMPTS.systemInjection(memoryContent) })
      } catch (error) {
        log("error", "Failed to inject memory context", { error: (error as Error).message })
      }
    })

    // Subscribe to server events
    const controller = new AbortController()

    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        if (event.type === "session.deleted") {
          const sessionId = getEventSessionId(event)
          if (!sessionId) continue

          memoryAgentSessions.delete(sessionId)
          evaluatedMessageCounts.delete(sessionId)
          evaluatedAssistantCounts.delete(sessionId)
          lastIdleEventAt.delete(sessionId)
          evaluatingSessions.delete(sessionId)
          sessionMemorySnapshots.delete(sessionId)
          transcriptCache.delete(sessionId)
          clearIdleTimer(sessionId)
          // biome-ignore lint/suspicious/noExplicitAny: SessionDeleted uses metadata, not properties
          log("info", "Cleaned up deleted session state", { sessionId, parentID: (event as any).metadata?.parentID })
          continue
        }

        if (event.type === "session.idle") {
          if (!isInteractiveMode()) {
            log("debug", "Skipping idle memory evaluation outside interactive mode", { argv: process.argv })
            continue
          }

          const sessionId = getEventSessionId(event)
          if (!sessionId) {
            log("warn", "session.idle event missing session id", { eventType: event.type })
            continue
          }

          const now = Date.now()
          const previousIdleAt = lastIdleEventAt.get(sessionId) || 0
          lastIdleEventAt.set(sessionId, now)

          if (now - previousIdleAt < IDLE_DEDUP_MS) {
            log("debug", "Skipping duplicate idle event", { sessionId, elapsedMs: now - previousIdleAt })
            continue
          }

          // Skip memory agent child sessions
          if (memoryAgentSessions.has(sessionId)) {
            log("debug", "Skipping idle event for memory agent session", { sessionId })
            continue
          }

          if (evaluatingSessions.has(sessionId)) {
            log("debug", "Skipping re-entrant idle evaluation", { sessionId })
            continue
          }

          // Skip subagent sessions (any session with a parentID)
          const parentID = await getSessionParentId(ctx.session, sessionId, event)
          if (parentID) {
            log("debug", "Skipping memory evaluation for subagent idle event", { sessionId, parentID })
            continue
          }

          async function runEvaluation(sessionId: string, trigger: "turn-interval" | "idle-timeout") {
            if (evaluatingSessions.has(sessionId)) {
              log("debug", "Skipping memory evaluation already in progress", { sessionId, trigger })
              return
            }

            evaluatingSessions.add(sessionId)
            clearIdleTimer(sessionId)

            try {
              // V2: session.context() returns SessionMessageInfo[] directly
              const messages = await ctx.session.context({ sessionID: sessionId }).catch(() => [])
              const messageCount = messages.length
              const assistantCount = countAssistantMessages(messages)
              const previousMessageCount = evaluatedMessageCounts.get(sessionId) || 0

              if (messageCount <= previousMessageCount) {
                log("debug", "Skipping duplicate idle evaluation", { sessionId, trigger, messageCount, previousMessageCount })
                return
              }

              const evaluatedCount = await evaluateSession(ctx.session, sessionId, log)
              evaluatedMessageCounts.set(sessionId, Math.max(messageCount, evaluatedCount))
              evaluatedAssistantCounts.set(sessionId, assistantCount)
            } catch (error) {
              log("error", "Memory evaluation failed", {
                sessionId,
                trigger,
                error: normalizeError(error)
              })
            } finally {
              evaluatingSessions.delete(sessionId)
            }
          }

          try {
            // V2: session.context() returns SessionMessageInfo[] directly
            const messages = await ctx.session.context({ sessionID: sessionId }).catch(() => [])
            const assistantCount = countAssistantMessages(messages)
            const previousAssistantCount = evaluatedAssistantCounts.get(sessionId) || 0
            const turnsSinceEvaluation = assistantCount - previousAssistantCount

            if (turnsSinceEvaluation >= MEMORY_EVALUATION_TURN_INTERVAL) {
              log("info", "Memory turn interval reached", { sessionId, assistantCount, previousAssistantCount, turnsSinceEvaluation })
              runEvaluation(sessionId, "turn-interval")
              continue
            }

            clearIdleTimer(sessionId)
            const timer = setTimeout(() => {
              runEvaluation(sessionId, "idle-timeout").catch((error) => {
                log("error", "Scheduled memory evaluation failed", { sessionId, error: normalizeError(error) })
              })
            }, MEMORY_EVALUATION_IDLE_TIMEOUT_MS)
            ; (timer as any).unref?.()
            idleTimers.set(sessionId, timer)
            log("info", "Scheduled idle-timeout evaluation", {
              sessionId,
              idleTimeoutMs: MEMORY_EVALUATION_IDLE_TIMEOUT_MS,
              assistantCount,
              previousAssistantCount,
              turnsSinceEvaluation,
            })
          } catch (error) {
            log("error", "Memory evaluation failed", {
              sessionId,
              error: normalizeError(error)
            })
          }
        }
      }
    })()

    // Cleanup: abort event subscription and clear timers
    return () => {
      controller.abort()
      for (const timer of idleTimers.values()) {
        clearTimeout(timer)
      }
    }
  },
})

// Test-only exports — allow unit tests to inspect and manipulate module-level state
// Exported as getter functions (not values) so opencode's plugin loader doesn't
// mistake them for plugin initializers when iterating named exports.
export function _getMemoryAgentSessions() { return memoryAgentSessions }
export function _getTranscriptCache() { return transcriptCache }
