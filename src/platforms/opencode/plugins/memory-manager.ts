import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { access, readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { config } from "../../../../config"

/**
 * Memory Manager Plugin
 *
 * Automatically evaluates each primary session on close and delegates memory extraction to the memory agent.
 * - Fires on session.deleted for sessions with no parentID (primary sessions only)
 * - Sanitizes conversation: strips tool outputs, keeps user/assistant text and tool call signals
 * - Passes sanitized transcript + existing Memory.md to memory agent, which writes new items directly
 * - Injects Memory.md into system prompt on session start
 */

const MEMORY_FILE_PATH = config.memoryFilePath.startsWith("~/")
  ? join(homedir(), config.memoryFilePath.replace("~/", ""))
  : config.memoryFilePath

const PROMPTS = {
  systemInjection: (memoryContent: string) => `# Working Memory Context

Below is your short-term working memory across all projects. Items follow the format \`[tag] project: description\` where tags mean: \`[decision]\` a choice was made, \`[work]\` significant work was completed, \`[research]\` a topic was researched, \`[kb-enrichment]\` a knowledge base enrichment run was completed.

${memoryContent}`,
}

// Track memory agent session IDs to prevent hook recursion
const memoryAgentSessions = new Set<string>()

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
    const parentSession = await client.session.get({
      path: { id: parentSessionId }
    }).catch(() => null)
    const directory = parentSession?.data?.directory

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

    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: "memory",
        parts: [{ type: "text", text: prompt }]
      }
    })

    const result = extractResponseText(response)

    await client.session.abort({ path: { id: sessionId } }).catch(() => {})
    memoryAgentSessions.delete(sessionId)

    return result
  } catch (error) {
    if (sessionId) {
      await client.session.abort({ path: { id: sessionId } }).catch(() => {})
      memoryAgentSessions.delete(sessionId)
    }
    throw error
  }
}

// Skills that indicate autonomous agent sessions — skip memory evaluation for these
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
): Promise<void> {
  const messagesResult = await client.session.messages({ path: { id: sessionId } }).catch(() => null)
  if (!messagesResult?.data) {
    await log("warn", "Could not fetch session messages", { sessionId })
    return
  }

  const messages = messagesResult.data.map((m: any) => ({
    role: m.info.role,
    parts: m.parts,
  }))

  if (messages.length === 0) {
    await log("info", "Empty session, skipping memory evaluation", { sessionId })
    return
  }

  const transcript = sanitizeTranscript(messages)
  if (!transcript.trim()) {
    await log("info", "No meaningful content in transcript, skipping", { sessionId })
    return
  }

  if (shouldSkipEvaluation(transcript)) {
    await log("info", "Autonomous agent session detected, skipping memory evaluation", { sessionId })
    return
  }

  const memoryContent = await readMemory()
  const prompt = `## Conversation\n\n${transcript}\n\n## Existing Memory\n\n${memoryContent}`

  await log("info", "Invoking memory agent", { sessionId, transcriptLength: transcript.length })
  await invokeMemoryAgent(client, sessionId, prompt, log)
  await log("info", "Memory agent evaluation complete", { sessionId })
}

/**
 * Memory Manager Plugin Entry Point
 */
export const MemoryManagerPlugin: Plugin = async (ctx: PluginInput) => {
  const { client } = ctx

  async function log(level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) {
    await client.app.log({
      body: { service: "memory-manager", level, message, extra }
    }).catch((err) => console.error("Failed to log:", err))
  }

  // Cache memory content to avoid repeated file reads
  let memoryCache: string | null = null
  let lastCacheTime = 0
  const CACHE_TTL_MS = 5000

  async function getCachedMemory(): Promise<string> {
    const now = Date.now()
    if (memoryCache && (now - lastCacheTime) < CACHE_TTL_MS) return memoryCache
    memoryCache = await readMemory()
    lastCacheTime = now
    return memoryCache
  }

  return {
    // Inject memory into system prompt (primary agent only)
    "experimental.chat.system.transform": async (input, output) => {
      const sessionID = (input as any).sessionID
      if (memoryAgentSessions.has(sessionID)) return

      const agent = (input as any).agent || (input as any).body?.agent
      if (agent) return // skip all subagents

      try {
        const memoryContent = await getCachedMemory()
        output.system.push(PROMPTS.systemInjection(memoryContent))
        await log("info", "Memory context injected", { sessionID })
      } catch (error) {
        await log("error", "Failed to inject memory context", { error: (error as Error).message })
      }
    },

    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const session = event.properties.info
        if (!session?.id) return

        // Skip memory agent child sessions
        if (memoryAgentSessions.has(session.id)) {
          memoryAgentSessions.delete(session.id)
          await log("info", "Cleaned up deleted memory agent session", { sessionId: session.id })
          return
        }

        // Skip subagent sessions (any session with a parentID)
        if (session.parentID) {
          await log("info", "Skipping memory evaluation for subagent session", { sessionId: session.id })
          return
        }

        // Evaluate primary session memory on close
        try {
          await evaluateSession(client, session.id, log)
          // Invalidate cache so next session gets fresh memory
          memoryCache = null
          lastCacheTime = 0
        } catch (error) {
          await log("error", "Memory evaluation failed", {
            sessionId: session.id,
            error: (error as Error).message
          })
        }
      }
    }
  }
}

export default MemoryManagerPlugin
