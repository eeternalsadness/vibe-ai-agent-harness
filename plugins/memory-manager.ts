import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"

/**
 * Memory Manager Plugin
 * 
 * Manages a global, cross-project working memory file with:
 * - FIFO truncation at 50 items
 * - 150-char limit per item with validation
 * - File locking for concurrent access
 * - Automatic context injection on session start
 * - Automatic memory updates on session idle
 * 
 * Subagent Invocation Strategy:
 * - Creates NEW independent session for memory agent (not subtask in parent session)
 * - Tracks subagent session IDs to prevent hook recursion (oh-my-openagent pattern)
 * - Tools are explicitly disabled via tools config
 * - Session is aborted after getting result to clean up resources
 * - Follows oh-my-openagent background-agent pattern
 */

const MEMORY_FILE_PATH = join(homedir(), "Repo/vibe-coding/vibe-context/memory/Memory.md")
const MAX_ITEMS = 50
const MAX_CHAR_LIMIT = 150
const MAX_RETRIES = 1

// Model fallback chain for memory agent invocation (small models only)
const FALLBACK_MODELS = [
  { providerID: "github-copilot", modelID: "gpt-5-mini" },
  { providerID: "ollama", modelID: "qwen2.5:7b" },
  { providerID: "ollama", modelID: "llama3.2:3b" },
]

// Prompt templates - customize these to improve memory agent behavior
const PROMPTS = {
  /**
   * Template for initial memory evaluation prompt
   * Available variables: {conversationContext}
   */
  evaluation: (conversationContext: string) =>
    `Review the most recent exchange below and evaluate if any information is significant enough to add to memory.

Most recent exchange:

${conversationContext}`,

  /**
   * Template for explicit memory save (when user says "remember this")
   * Available variables: {conversationContext}
   */
  explicitSave: (conversationContext: string) =>
    `The user has EXPLICITLY requested to save information to memory. You MUST extract and save the key information.

Recent conversation:

${conversationContext}

Extract the most important information and output it as bullet points (starting with "- "). Do NOT output SKIP.`,

  /**
   * Template for retry prompt when items exceed character limit
   * Available variables: {originalPrompt}, {violationMessage}
   */
  retry: (originalPrompt: string, violationMessage: string) =>
    `${originalPrompt}

The following items exceed the 150-character limit. Please shorten or split them:

${violationMessage}

Output only the corrected items as bullet points (starting with "- "), or SKIP if you decide not to add them.`
}

// File locking using promise-based mutex
const locks = new Map<string, Promise<void>>()

// Track memory agent session IDs to prevent hook recursion (oh-my-openagent pattern)
const memoryAgentSessions = new Set<string>()

// Keywords that trigger explicit memory save (without agent evaluation)
const MEMORY_KEYWORDS = ["remember", "save this", "don't forget", "memorize", "add to memory"]
const MEMORY_KEYWORD_PATTERN = new RegExp(`\\b(${MEMORY_KEYWORDS.join("|")})\\b`, "i")

// Code block patterns for filtering
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
const INLINE_CODE_PATTERN = /`[^`]+`/g

/**
 * Detect if user is explicitly asking to remember something
 */
function detectMemoryKeyword(text: string): boolean {
  const cleaned = text
    .replace(CODE_BLOCK_PATTERN, "")
    .replace(INLINE_CODE_PATTERN, "")
  return MEMORY_KEYWORD_PATTERN.test(cleaned)
}

/**
 * Acquires a lock on a file path and executes callback
 */
async function withLock<T>(filePath: string, callback: () => Promise<T>): Promise<T> {
  // Wait for existing lock if any
  while (locks.has(filePath)) {
    await locks.get(filePath)
  }

  // Create new lock
  let resolve: () => void
  const lockPromise = new Promise<void>((r) => { resolve = r })
  locks.set(filePath, lockPromise)

  try {
    return await callback()
  } finally {
    // Release lock
    locks.delete(filePath)
    resolve!()
  }
}

/**
 * Ensures Memory.md exists with proper header
 */
async function ensureMemoryFile(): Promise<void> {
  try {
    await readFile(MEMORY_FILE_PATH, "utf-8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist, create it
      await mkdir(dirname(MEMORY_FILE_PATH), { recursive: true })
      await writeFile(MEMORY_FILE_PATH, "# Memory\n\n", "utf-8")
    } else {
      throw error
    }
  }
}

/**
 * Reads memory file and returns content
 */
async function readMemory(): Promise<string> {
  await ensureMemoryFile()
  return await readFile(MEMORY_FILE_PATH, "utf-8")
}

/**
 * Parses memory file and extracts items (lines starting with "- ")
 */
function parseMemoryItems(content: string): string[] {
  const lines = content.split("\n")
  return lines
    .filter(line => line.trim().startsWith("- "))
    .map(line => line.trim())
}

/**
 * Reconstructs Memory.md content from items
 */
function buildMemoryContent(items: string[]): string {
  return "# Memory\n\n" + items.join("\n") + "\n"
}

/**
 * Parses agent output to extract bullet points or detect SKIP
 */
function parseAgentOutput(output: string): string[] | null {
  const trimmed = output.trim()

  // Check for SKIP
  if (trimmed === "SKIP") {
    return null
  }

  // Extract lines starting with "- "
  const lines = trimmed.split("\n")
  const items = lines
    .filter(line => line.trim().startsWith("- "))
    .map(line => line.trim())

  return items.length > 0 ? items : null
}

/**
 * Validates items against 150-char limit
 * Returns array of violations: { index, length, excess }
 */
function validateItemLengths(items: string[]): Array<{ index: number; length: number; excess: number }> {
  const violations: Array<{ index: number; length: number; excess: number }> = []

  items.forEach((item, index) => {
    const length = item.length
    if (length > MAX_CHAR_LIMIT) {
      violations.push({
        index: index + 1, // 1-indexed for user readability
        length,
        excess: length - MAX_CHAR_LIMIT
      })
    }
  })

  return violations
}

/**
 * Formats violations for re-prompting agent
 */
function formatViolations(violations: Array<{ index: number; length: number; excess: number }>): string {
  return violations
    .map(v => `Item ${v.index} was ${v.length} chars (${v.excess} over limit)`)
    .join("\n")
}

/**
 * Invokes memory agent with fallback logic using new session approach
 */
async function invokeMemoryAgent(
  client: PluginInput["client"],
  parentSessionId: string,
  summary: string,
  retryPrompt?: string,
  log?: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) => Promise<void>
): Promise<string> {
  let lastError: Error | null = null

  for (const model of FALLBACK_MODELS) {
    let sessionId: string | null = null

    try {
      const prompt = retryPrompt || summary

      await log?.("info", "Attempting memory agent with model", {
        providerID: model.providerID,
        modelID: model.modelID,
        promptLength: prompt.length
      })

      // Get parent session's directory (optional, for context)
      const parentSession = await client.session.get({
        path: { id: parentSessionId }
      }).catch(() => null)
      const directory = parentSession?.data?.directory

      // Step 1: Create a new independent session for the memory agent
      const createResult = await client.session.create({
        body: {
          parentID: parentSessionId,
        },
        ...(directory ? { query: { directory } } : {}),
      })

      if (createResult.error) {
        throw new Error(`Failed to create memory agent session: ${createResult.error}`)
      }

      sessionId = createResult.data.id

      // CRITICAL: Mark this session as a memory agent session to prevent hook recursion
      memoryAgentSessions.add(sessionId)

      await log?.("info", "Memory agent session created and tracked", {
        parentSessionId,
        sessionId,
        directory
      })

      // Step 2: Prompt the new session with the memory agent
      const response = await client.session.prompt({
        path: { id: sessionId },
        body: {
          agent: "memory/memory",
          model: {
            providerID: model.providerID,
            modelID: model.modelID
          },
          tools: {
            task: false,
            write: false,
            edit: false,
            read: false,
            glob: false,
            grep: false,
            webfetch: false,
            bash: false,
          },
          parts: [{ type: "text", text: prompt }]
        }
      })

      // Extract the text result from the response
      const textPart = response.data?.message?.parts?.find((p: any) => p.type === "text")
      const result = textPart?.text || ""

      await log?.("info", "Memory agent response received", {
        sessionId,
        resultLength: result.length,
        resultPreview: result.slice(0, 100)
      })

      // Step 3: Clean up - abort the session after getting result
      await client.session.abort({
        path: { id: sessionId }
      }).catch((error) => {
        log?.("warn", "Failed to abort memory agent session", {
          sessionId,
          error: (error as Error).message
        })
      })

      // Remove from tracking after cleanup
      memoryAgentSessions.delete(sessionId)

      await log?.("info", "Memory agent invocation successful", {
        sessionId,
        providerID: model.providerID,
        modelID: model.modelID
      })

      return result
    } catch (error) {
      lastError = error as Error

      await log?.("warn", "Memory agent model attempt failed", {
        providerID: model.providerID,
        modelID: model.modelID,
        error: lastError.message,
        sessionId
      })

      // CRITICAL: Clean up session if it was created but failed
      if (sessionId) {
        await client.session.abort({
          path: { id: sessionId }
        }).catch((abortError) => {
          log?.("error", "Failed to abort failed memory agent session", {
            sessionId,
            error: (abortError as Error).message
          })
        })

        // Remove from tracking on failure too
        memoryAgentSessions.delete(sessionId)
      }

      // Continue to next model in fallback chain
    }
  }

  throw new Error(`Memory agent failed with all models: ${lastError?.message}`)
}

/**
 * Appends items to memory with FIFO truncation
 */
async function appendToMemory(items: string[]): Promise<void> {
  await withLock(MEMORY_FILE_PATH, async () => {
    const content = await readMemory()
    const existingItems = parseMemoryItems(content)

    // Add new items
    const allItems = [...existingItems, ...items]

    // Apply FIFO truncation if over limit
    const finalItems = allItems.length > MAX_ITEMS
      ? allItems.slice(allItems.length - MAX_ITEMS)
      : allItems

    // Write back to file
    const newContent = buildMemoryContent(finalItems)
    await writeFile(MEMORY_FILE_PATH, newContent, "utf-8")
  })
}

/**
 * Main memory update workflow with validation retry
 */
async function updateMemory(
  client: PluginInput["client"],
  sessionId: string,
  summary: string,
  log?: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) => Promise<void>
): Promise<{ success: boolean; message: string }> {
  try {
    // First invocation
    let agentOutput = await invokeMemoryAgent(client, sessionId, summary, undefined, log)
    let items = parseAgentOutput(agentOutput)

    await log?.("info", "Agent output parsed", {
      itemCount: items?.length ?? 0,
      skipped: items === null
    })

    // Check if agent decided to skip
    if (items === null) {
      return { success: true, message: "Memory agent decided not to add items (SKIP)" }
    }

    // Validate item lengths with retry loop
    let violations = validateItemLengths(items)
    let retryCount = 0

    if (violations.length > 0) {
      await log?.("warn", "Item length violations detected", {
        violationCount: violations.length,
        violations
      })
    }

    while (violations.length > 0 && retryCount < MAX_RETRIES) {
      retryCount++

      await log?.("info", "Retrying memory agent due to violations", {
        retryCount,
        violationCount: violations.length
      })

      const violationMessage = formatViolations(violations)
      const retryPrompt = PROMPTS.retry(summary, violationMessage)

      agentOutput = await invokeMemoryAgent(client, sessionId, summary, retryPrompt, log)
      items = parseAgentOutput(agentOutput)

      // Check if agent skipped after retry
      if (items === null) {
        return { success: true, message: `Memory agent decided not to add items after retry ${retryCount} (SKIP)` }
      }

      // Validate again
      violations = validateItemLengths(items)
    }

    // If still have violations after all retries, fail and report to user
    if (violations.length > 0) {
      const violationMessage = formatViolations(violations)
      await log?.("error", "Items still violate length limit after retries", {
        retryCount,
        violations
      })
      return {
        success: false,
        message: `Memory update failed: items still exceed 150-char limit after ${MAX_RETRIES} retry(ies).\n\n${violationMessage}\n\nPlease add these items manually.`
      }
    }

    // All validations passed, append to memory
    await appendToMemory(items)

    await log?.("info", "Items appended to memory", {
      itemCount: items.length,
      items: items.map(i => i.slice(0, 50) + (i.length > 50 ? "..." : ""))
    })

    return {
      success: true,
      message: `Added ${items.length} item(s) to memory`
    }
  } catch (error) {
    await log?.("error", "Memory update error", {
      error: (error as Error).message,
      stack: (error as Error).stack
    })
    return {
      success: false,
      message: `Memory update error: ${(error as Error).message}`
    }
  }
}

/**
 * Memory Manager Plugin Entry Point
 */
export const MemoryManagerPlugin: Plugin = async (ctx: PluginInput) => {
  const { client } = ctx

  // Helper function for logging
  async function log(level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) {
    await client.app.log({
      body: {
        service: "memory-manager",
        level,
        message,
        extra
      }
    }).catch((err) => {
      // Fallback to console if logging fails
      console.error("Failed to log:", err)
    })
  }

  // Cache memory content to avoid repeated file reads
  let memoryCache: string | null = null
  let lastCacheTime = 0
  const CACHE_TTL_MS = 5000 // 5 seconds

  /**
   * Get cached memory or read fresh from file
   */
  async function getCachedMemory(): Promise<string> {
    const now = Date.now()
    if (memoryCache && (now - lastCacheTime) < CACHE_TTL_MS) {
      return memoryCache
    }

    memoryCache = await readMemory()
    lastCacheTime = now
    return memoryCache
  }

  /**
   * Invalidate cache after memory updates
   */
  function invalidateCache(): void {
    memoryCache = null
    lastCacheTime = 0
  }

  return {
    // Intercept user messages to detect explicit "remember" commands
    "chat.message": async (input, output) => {
      const textParts = output.parts.filter((p: any) => p.type === "text")
      const userMessage = textParts.map((p: any) => p.text).join("\n")

      // Skip for memory agent sessions
      if (memoryAgentSessions.has(input.sessionID)) {
        return
      }

      // Detect if user is asking to remember something
      if (detectMemoryKeyword(userMessage)) {
        await log("info", "Explicit memory save request detected", {
          sessionID: input.sessionID,
          messagePreview: userMessage.slice(0, 100)
        })

        try {
          // Get last 4 messages for context (2 exchanges) - lightweight context
          const response = await client.session.messages({
            path: { id: input.sessionID }
          })

          const messages = response.data ?? []
          const recentMessages = messages.slice(-4)

          // Format conversation context
          const conversationContext = recentMessages
            .map(msg => {
              const role = msg.role === "user" ? "User" : "Assistant"
              const textParts = msg.parts
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n")
              return `${role}: ${textParts}`
            })
            .join("\n\n")

          // Create MANDATORY save prompt (no SKIP allowed)
          const summary = PROMPTS.explicitSave(conversationContext)

          await log("info", "Processing explicit memory save", {
            sessionId: input.sessionID,
            messageCount: recentMessages.length,
            contextLength: conversationContext.length,
            conversationPreview: conversationContext.slice(0, 200) + (conversationContext.length > 200 ? "..." : "")
          })

          // Invoke memory agent in background
          updateMemory(client, input.sessionID, summary, log).then(result => {
            invalidateCache()
            log("info", result.success ? "Explicit memory save completed" : "Explicit memory save failed", {
              sessionId: input.sessionID,
              message: result.message
            })
          }).catch(error => {
            log("error", "Explicit memory save error", {
              sessionId: input.sessionID,
              error: (error as Error).message
            })
          })

        } catch (error) {
          await log("error", "Failed to process explicit memory save", {
            sessionID: input.sessionID,
            error: (error as Error).message
          })
        }

        // Add synthetic nudge to acknowledge the save
        const nudgePart = {
          id: `memory-nudge-${Date.now()}`,
          sessionID: input.sessionID,
          messageID: output.message.id,
          type: "text",
          text: `[MEMORY TRIGGER] The user has requested to save information to memory. Acknowledge that you're saving it and briefly summarize what key points you're capturing.`,
          synthetic: true
        }

        output.parts.push(nudgePart)
      }
    },

    // Inject memory into system prompt (invisible to user, only for primary agent)
    "experimental.chat.system.transform": async (input, output) => {
      // CRITICAL: Skip memory injection for memory agent sessions (oh-my-openagent pattern)
      const sessionID = (input as any).sessionID
      if (memoryAgentSessions.has(sessionID)) {
        await log("info", "Skipping memory injection for tracked memory agent session", { sessionID })
        return
      }

      // Also check agent field as backup (in case session tracking missed it)
      const agent = (input as any).agent || (input as any).body?.agent
      if (agent === "memory/memory" || agent?.includes("memory")) {
        await log("info", "Skipping memory injection for memory agent session (by agent field)", { agent })
        return
      }

      // Skip for all subagents (non-primary sessions)
      if (agent) {
        await log("info", "Skipping memory injection for subagent", { agent })
        return
      }

      try {
        const memoryContent = await getCachedMemory()

        // Add memory context to system prompt
        output.system.push(`# Working Memory Context\n\nBelow is your short-term working memory. This contains recent work context across all projects.\n\n${memoryContent}`)

        await log("info", "Memory context injected into system prompt", {
          sessionID,
          contentLength: memoryContent.length,
          cached: memoryCache !== null
        })
      } catch (error) {
        await log("error", "Failed to inject memory context", {
          error: (error as Error).message,
          stack: (error as Error).stack
        })
      }
    },

    event: async ({ event }) => {
      // Handle session.idle - automatic memory update
      if (event.type === "session.idle") {
        const sessionId = event.properties.sessionID

        // CRITICAL: Do not trigger memory updates for memory agent sessions (prevent recursion)
        if (memoryAgentSessions.has(sessionId)) {
          await log("info", "Skipping memory update for tracked memory agent session (idle event)", {
            sessionId
          })
          return
        }

        // Also check session info as backup
        try {
          const session = await client.session.get({
            path: { id: sessionId }
          }).catch(() => null)

          const agent = session?.data?.agent
          if (agent === "memory/memory" || agent?.includes("memory")) {
            await log("info", "Skipping memory update for memory agent idle event (by agent field)", {
              sessionId,
              agent
            })
            return
          }
        } catch (error) {
          await log("warn", "Could not check session agent type", {
            sessionId,
            error: (error as Error).message
          })
        }

        await log("info", "Session idle event received, starting memory update", { sessionId })

        try {
          // Get the session messages (not metadata)
          const response = await client.session.messages({
            path: { id: sessionId }
          })

          const messages = response.data ?? []

          if (messages.length === 0) {
            await log("info", "No messages in session, skipping memory update", { sessionId })
            return
          }

          // Get the last 2 messages (user request + assistant response)
          const lastMessages = messages.slice(-2)

          // Format the last exchange for the memory agent
          const conversationContext = lastMessages
            .map(msg => {
              const role = msg.role === "user" ? "User" : "Assistant"
              const textParts = msg.parts
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n")
              return `${role}: ${textParts}`
            })
            .join("\n\n")

          const summary = PROMPTS.evaluation(conversationContext)

          await log("info", "Invoking memory agent", {
            sessionId,
            summaryLength: summary.length,
            messageCount: lastMessages.length,
            conversationPreview: conversationContext.slice(0, 200) + (conversationContext.length > 200 ? "..." : "")
          })

          const result = await updateMemory(client, sessionId, summary, log)

          // Invalidate cache after successful update
          if (result.success) {
            invalidateCache()
            await log("info", "Memory update completed", {
              sessionId,
              message: result.message
            })
          } else {
            await log("error", "Memory update failed", {
              sessionId,
              message: result.message
            })
          }
        } catch (error) {
          await log("error", "Failed to update memory on idle", {
            sessionId,
            error: (error as Error).message,
            stack: (error as Error).stack
          })
        }
      }

      // Handle session.deleted - cleanup tracking
      if (event.type === "session.deleted") {
        const sessionId = event.properties.info?.id
        if (sessionId && memoryAgentSessions.has(sessionId)) {
          memoryAgentSessions.delete(sessionId)
          await log("info", "Cleaned up deleted memory agent session from tracking", { sessionId })
        }
      }
    }
  }
}

export default MemoryManagerPlugin
