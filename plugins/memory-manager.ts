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
 * - This provides clean context isolation - agent doesn't inherit parent AGENTS.md
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
  { providerID: "github-copilot", modelID: "claude-haiku-4.5" },
  { providerID: "ollama", modelID: "qwen2.5:7b" },
  { providerID: "ollama", modelID: "llama3.2:3b" },
]

// File locking using promise-based mutex
const locks = new Map<string, Promise<void>>()

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
  retryPrompt?: string
): Promise<string> {
  let lastError: Error | null = null

  for (const model of FALLBACK_MODELS) {
    let sessionId: string | null = null
    
    try {
      const prompt = retryPrompt || summary

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

      // Step 3: Clean up - abort the session after getting result
      await client.session.abort({
        path: { id: sessionId }
      }).catch((error) => {
        console.error("Failed to abort memory agent session:", error)
      })

      return result
    } catch (error) {
      lastError = error as Error
      
      // CRITICAL: Clean up session if it was created but failed
      if (sessionId) {
        await client.session.abort({
          path: { id: sessionId }
        }).catch((abortError) => {
          console.error("Failed to abort failed memory agent session:", abortError)
        })
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
  summary: string
): Promise<{ success: boolean; message: string }> {
  try {
    // First invocation
    let agentOutput = await invokeMemoryAgent(client, sessionId, summary)
    let items = parseAgentOutput(agentOutput)

    // Check if agent decided to skip
    if (items === null) {
      return { success: true, message: "Memory agent decided not to add items (SKIP)" }
    }

    // Validate item lengths
    let violations = validateItemLengths(items)

    // If violations, retry once with feedback
    if (violations.length > 0) {
      const violationMessage = formatViolations(violations)
      const retryPrompt = `${summary}

The following items exceed the 150-character limit. Please shorten or split them:

${violationMessage}

Output only the corrected items as bullet points (starting with "- "), or SKIP if you decide not to add them.`

      agentOutput = await invokeMemoryAgent(client, sessionId, summary, retryPrompt)
      items = parseAgentOutput(agentOutput)

      // Check if agent skipped after retry
      if (items === null) {
        return { success: true, message: "Memory agent decided not to add items after retry (SKIP)" }
      }

      // Validate again
      violations = validateItemLengths(items)

      // If still have violations, fail and report to user
      if (violations.length > 0) {
        const violationMessage = formatViolations(violations)
        return {
          success: false,
          message: `Memory update failed: items still exceed 150-char limit after retry.\n\n${violationMessage}\n\nPlease add these items manually.`
        }
      }
    }

    // All validations passed, append to memory
    await appendToMemory(items)

    return {
      success: true,
      message: `Added ${items.length} item(s) to memory`
    }
  } catch (error) {
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
    // Inject memory into system prompt (invisible to user, only for primary agent)
    "experimental.chat.system.transform": async (input, output) => {
      // Only inject for primary agent (not subagents)
      // Subagents are identified by having an agent property
      const agent = (input as any).agent
      if (agent) {
        // This is a subagent - skip memory injection
        return
      }

      try {
        const memoryContent = await getCachedMemory()

        // Add memory context to system prompt
        output.system.push(`# Working Memory Context\n\nBelow is your short-term working memory. This contains recent work context across all projects.\n\n${memoryContent}`)
      } catch (error) {
        console.error("Failed to inject memory context:", error)
      }
    },

    event: async ({ event }) => {
      // Handle session.idle - automatic memory update
      if (event.type === "session.idle") {
        const sessionId = event.properties.sessionID

        try {
          // Get recent conversation context for the summary
          // Note: In a real implementation, you'd extract recent messages
          // For now, we'll invoke with a generic prompt
          const summary = "Review the recent conversation and evaluate if any information is significant enough to add to memory. Consider decisions, patterns, blockers, or context that would be valuable across sessions."

          const result = await updateMemory(client, sessionId, summary)

          // Invalidate cache after successful update
          if (result.success) {
            invalidateCache()
          }

          // Log result (in production, you might want to report to user differently)
          if (!result.success) {
            console.error(result.message)
          }
        } catch (error) {
          console.error("Failed to update memory on idle:", error)
        }
      }
    }
  }
}

export default MemoryManagerPlugin
