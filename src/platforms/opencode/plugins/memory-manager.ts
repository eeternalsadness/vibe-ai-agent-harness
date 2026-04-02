import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { config } from "../../../../config"

/**
 * Memory Manager Plugin
 *
 * Manages a global, cross-project working memory file with:
 * - FIFO truncation at 50 items
 * - 150-char limit per item with validation
 * - File locking for concurrent access
 * - Automatic context injection on session start
 *
 * The primary agent evaluates significance and calls remember().
 * The memory subagent formats content into valid memory items.
 */

// Safely expand ~ to home directory — only if path starts with ~ (guard against silent corruption)
const MEMORY_FILE_PATH = config.memoryFilePath.startsWith("~/")
  ? join(homedir(), config.memoryFilePath.replace("~/", ""))
  : config.memoryFilePath
const MAX_ITEMS = 50
const MAX_CHAR_LIMIT = 150
const MAX_RETRIES = 1

// Configurable prompts — edit these to adjust agent behavior without touching business logic
const PROMPTS = {
  // Injected into the system prompt to guide memory usage
  systemInjection: (memoryContent: string) => `# Working Memory Context

Below is your short-term working memory. This contains recent work context across all projects.

**How to use this memory:**
- Check here FIRST for recent decisions, preferences, and high-level context
- For details and implementation specifics, check the knowledge base at ${config.knowledgeBasePath}/ (start at Index.md)
- Only delegate to agents or use external tools if neither memory nor knowledge base has the answer

${memoryContent}`,

  // Sent to memory agent when items exceed the character limit
  retryViolations: (originalPrompt: string, violationMessage: string) => `${originalPrompt}

These items exceed 150 chars - shorten or split them:

${violationMessage}`,
}

// File locking using promise-based mutex
const locks = new Map<string, Promise<void>>()

// Track memory agent session IDs to prevent hook recursion (oh-my-openagent pattern)
const memoryAgentSessions = new Set<string>()

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
 * Parses agent output to extract bullet points
 */
function parseAgentOutput(output: string): string[] {
  const lines = output.trim().split("\n")
  return lines
    .filter(line => line.trim().startsWith("- "))
    .map(line => line.trim())
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
 * Invokes memory agent using new session approach (oh-my-openagent pattern)
 */
async function invokeMemoryAgent(
  client: PluginInput["client"],
  parentSessionId: string,
  summary: string,
  retryPrompt?: string,
  log?: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, any>) => Promise<void>
): Promise<string> {
  let sessionId: string | null = null

  try {
    const prompt = retryPrompt || summary

    await log?.("info", "Invoking memory agent", { promptLength: prompt.length })

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
        agent: "memory",
        parts: [{ type: "text", text: prompt }]
      }
    })

    // Log the full response structure for debugging
    await log?.("info", "Memory agent raw response", {
      sessionId,
      hasData: !!response.data,
      hasParts: !!response.data?.parts,
      partsCount: response.data?.parts?.length || 0,
      // NOTE: Using 'any' for SDK part types that aren't in official type definitions
      // If SDK updates these types, this will need updating - watch for breakage
      partsTypes: response.data?.parts?.map((p: any) => p.type) || [],
      fullResponse: JSON.stringify(response.data, null, 2)
    })

    // Extract the text result from the response
    // session.prompt() returns parts in response.data.parts (not response.data.message.parts)
    // NOTE: Using 'any' for SDK part types that aren't in official type definitions
    const textPart = response.data?.parts?.find((p: any) => p.type === "text")
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

    await log?.("info", "Memory agent invocation successful", { sessionId })

    return result
  } catch (error) {
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

      memoryAgentSessions.delete(sessionId)
    }

    throw error
  }
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
    let agentOutput = await invokeMemoryAgent(client, sessionId, summary, undefined, log)
    let items = parseAgentOutput(agentOutput)

    await log?.("info", "Agent output parsed", { itemCount: items.length })

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
      const retryPromptText = PROMPTS.retryViolations(summary, violationMessage)

      agentOutput = await invokeMemoryAgent(client, sessionId, summary, retryPromptText, log)
      items = parseAgentOutput(agentOutput)

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
    // Tool for explicit memory saves
    tool: {
      remember: tool({
        description: "Save information to persistent working memory. Use this when the user explicitly asks to remember something or when capturing important context that should persist across sessions.",
        args: {
          content: tool.schema.string().describe("The information to save to memory. Should be clear, specific, and self-contained."),
        },
        async execute(args, context) {
          try {
            await log("info", "remember tool invoked", {
              sessionID: context.sessionID,
              contentLength: args.content.length,
              contentPreview: args.content.slice(0, 100)
            })

            // Invoke memory agent
            const result = await updateMemory(client, context.sessionID, args.content, log)

            // Invalidate cache after update
            if (result.success) {
              invalidateCache()
            }

            return JSON.stringify({
              success: result.success,
              message: result.message
            })
          } catch (error) {
            await log("error", "remember tool error", {
              sessionID: context.sessionID,
              error: (error as Error).message,
              stack: (error as Error).stack
            })
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      })
    },

    // Inject memory into system prompt (invisible to user, only for primary agent)
    "experimental.chat.system.transform": async (input, output) => {
      // CRITICAL: Skip memory injection for memory agent sessions (oh-my-openagent pattern)
      // NOTE: Using 'any' for SDK sessionID property not in official type definitions
      // sessionID is used for memory agent session tracking - if SDK removes this, the
      // memory injection will silently break for all sessions. Watch for SDK changes.
      const sessionID = (input as any).sessionID
      if (memoryAgentSessions.has(sessionID)) {
        await log("info", "Skipping memory injection for tracked memory agent session", { sessionID })
        return
      }

      // Also check agent field as backup (in case session tracking missed it)
      // NOTE: Using 'any' for SDK agent property not in official type definitions
      const agent = (input as any).agent || (input as any).body?.agent
      if (agent === "memory" || agent?.includes("memory")) {
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
        output.system.push(PROMPTS.systemInjection(memoryContent))

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
      // Handle session.deleted - cleanup tracking
      if (event.type === "session.deleted") {
        const sessionId = event.properties.info?.id
        if (sessionId) {
          if (memoryAgentSessions.has(sessionId)) {
            memoryAgentSessions.delete(sessionId)
            await log("info", "Cleaned up deleted memory agent session from tracking", { sessionId })
          }
        }
      }
    }
  }
}

export default MemoryManagerPlugin


