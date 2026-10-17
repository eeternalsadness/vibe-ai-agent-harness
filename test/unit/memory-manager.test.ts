import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  sanitizeTranscript,
  shouldSkipEvaluation,
  diffNewItems,
  evaluateSession,
  _getMemoryAgentSessions,
  _getTranscriptCache,
} from "../../src/platforms/opencode/plugins/memory-manager"

// ─── Test scaffolding ───────────────────────────────────────────────────────

let tempDir: string
let memoryPath: string
let sessionCounter = 0

function newSessionId(): string {
  return `test-session-${++sessionCounter}`
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "mem-manager-test-"))
  memoryPath = join(tempDir, "Memory.md")
  await writeFile(memoryPath, "# Memory\n\n", "utf-8")
  process.env.OPENCODE_MEMORY_FILE = memoryPath
})

afterEach(async () => {
  delete process.env.OPENCODE_MEMORY_FILE
  await rm(tempDir, { recursive: true, force: true })
})

const noopLog = async () => {}

/**
 * Minimal mock session. capturePrompts, when provided, receives each prompt
 * text sent to the memory agent via session.prompt.
 */
function createMockSession(options: {
  messages?: any[]
  capturePrompts?: string[]
} = {}): any {
  return {
    messages: mock(async () => ({ data: options.messages ?? [] })),
    get: mock(async () => ({ data: null })),
    create: mock(async () => ({ data: { id: "mock-agent-session" }, error: null })),
    prompt: mock(async ({ body }: any) => {
      if (options.capturePrompts) {
        const text = body?.parts?.find((p: any) => p.type === "text")?.text ?? ""
        options.capturePrompts.push(text)
      }
      return { data: { parts: [] } }
    }),
    abort: mock(async () => null),
  }
}

/** Build messages in the shape evaluateSession expects from client.session.messages */
function makeMessages(
  ...pairs: Array<{ role: "user" | "assistant"; text: string }>
): any[] {
  return pairs.map(({ role, text }) => ({
    info: { role },
    parts: [{ type: "text", text }],
  }))
}

// ─── sanitizeTranscript ─────────────────────────────────────────────────────

describe("sanitizeTranscript", () => {
  test("user text part → [user]: text", () => {
    const result = sanitizeTranscript([
      { role: "user", parts: [{ type: "text", text: "hello world" }] },
    ])
    expect(result).toBe("[user]: hello world")
  })

  test("assistant text part → [assistant]: text", () => {
    const result = sanitizeTranscript([
      { role: "assistant", parts: [{ type: "text", text: "hi there" }] },
    ])
    expect(result).toBe("[assistant]: hi there")
  })

  test("tool call with args → [tool: name] key: value", () => {
    const result = sanitizeTranscript([
      {
        role: "assistant",
        parts: [{ type: "tool", tool: "edit", state: { input: { filePath: "src/foo.ts" } } }],
      },
    ])
    expect(result).toBe("[tool: edit] filePath: src/foo.ts")
  })

  test("tool part on user role (tool output) not present in output", () => {
    // user-role tool parts represent tool outputs — they must be stripped
    const result = sanitizeTranscript([
      {
        role: "user",
        parts: [{ type: "tool", tool: "edit", state: { output: "done" } }],
      },
    ])
    expect(result).toBe("")
  })

  test("blank/whitespace text part not present in output", () => {
    const result = sanitizeTranscript([
      { role: "user", parts: [{ type: "text", text: "   " }] },
    ])
    expect(result).toBe("")
  })

  test("mixed assistant message: text line appears before tool call line", () => {
    const result = sanitizeTranscript([
      {
        role: "assistant",
        parts: [
          { type: "text", text: "I'll edit the file" },
          { type: "tool", tool: "edit", state: { input: { filePath: "foo.ts" } } },
        ],
      },
    ])
    expect(result).toBe("[assistant]: I'll edit the file\n[tool: edit] filePath: foo.ts")
  })

  test("[tool: task] subagent_type: research survives sanitization", () => {
    const result = sanitizeTranscript([
      {
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "task",
            state: { input: { subagent_type: "research", description: "Kubernetes Informer" } },
          },
        ],
      },
    ])
    // Research signal must be present verbatim so the memory agent can detect it
    expect(result).toContain("[tool: task] subagent_type: research")
  })
})

// ─── shouldSkipEvaluation ───────────────────────────────────────────────────

describe("shouldSkipEvaluation", () => {
  test("transcript containing enriching-knowledge-base skill load → true", () => {
    const transcript = "[tool: skill] name: enriching-knowledge-base"
    expect(shouldSkipEvaluation(transcript)).toBe(true)
  })

  test("transcript containing maintaining-knowledge-base skill load → true", () => {
    const transcript = "[tool: skill] name: maintaining-knowledge-base"
    expect(shouldSkipEvaluation(transcript)).toBe(true)
  })

  test("transcript with no skip skill → false", () => {
    const transcript = "[user]: hello\n[assistant]: hi\n[tool: edit] filePath: foo.ts"
    expect(shouldSkipEvaluation(transcript)).toBe(false)
  })
})

// ─── diffNewItems ───────────────────────────────────────────────────────────

describe("diffNewItems", () => {
  test("simple growth: appended items are detected", () => {
    const before = ["- a", "- b"]
    const after = ["- a", "- b", "- c", "- d"]
    expect(diffNewItems(before, after)).toEqual(["- c", "- d"])
  })

  test("no change → empty diff", () => {
    const before = ["- a", "- b"]
    const after = ["- a", "- b"]
    expect(diffNewItems(before, after)).toEqual([])
  })

  test("at capacity: oldest truncated while newest appended → truncated item still detected as new", () => {
    // append-memory.sh keeps only the last N items — count stays constant at the cap
    const before = ["- a", "- b", "- c"]
    const after = ["- b", "- c", "- d"]
    expect(diffNewItems(before, after)).toEqual(["- d"])
  })

  test("multiple items replaced at capacity", () => {
    const before = ["- a", "- b", "- c"]
    const after = ["- c", "- d", "- e"]
    expect(diffNewItems(before, after)).toEqual(["- d", "- e"])
  })

  test("reordering with no real change → empty diff", () => {
    const before = ["- a", "- b", "- c"]
    const after = ["- b", "- c", "- a"]
    expect(diffNewItems(before, after)).toEqual([])
  })
})

// ─── Incremental transcript cache ───────────────────────────────────────────

describe("incremental transcript cache", () => {
  test("first evaluateSession call: all N messages in prompt, cache set to messageCount=N", async () => {
    const messages = makeMessages(
      { role: "user", text: "hello" },
      { role: "assistant", text: "hi" },
      { role: "user", text: "proceed" },
    )
    const prompts: string[] = []
    const sessionId = newSessionId()

    await evaluateSession(createMockSession({ messages, capturePrompts: prompts }), sessionId, noopLog)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain("[user]: hello")
    expect(prompts[0]).toContain("[assistant]: hi")
    expect(prompts[0]).toContain("[user]: proceed")

    const cache = _getTranscriptCache().get(sessionId)
    expect(cache?.messageCount).toBe(3)
  })

  test("two-cycle end-to-end: cycle 2 sends only the new segment plus recent memory", async () => {
    const initial = makeMessages(
      { role: "user", text: "first message" },
      { role: "assistant", text: "first response" },
    )
    const additional = makeMessages(
      { role: "user", text: "second message" },
      { role: "assistant", text: "second response" },
    )
    const prompts: string[] = []
    const sessionId = newSessionId()

    // First evaluation — 2 messages, no prior cache → first-eval shape
    await evaluateSession(createMockSession({ messages: initial, capturePrompts: prompts }), sessionId, noopLog)
    expect(prompts[0]).not.toContain("## Previously Evaluated")
    expect(prompts[0]).toContain("[user]: first message")
    expect(prompts[0]).toContain("[assistant]: first response")

    // Second evaluation — 4 messages total
    const allMessages = [...initial, ...additional]
    await evaluateSession(createMockSession({ messages: allMessages, capturePrompts: prompts }), sessionId, noopLog)

    expect(prompts).toHaveLength(2)
    const prompt2 = prompts[1]
    if (!prompt2) throw new Error("expected a second prompt")
    const newIdx = prompt2.indexOf("## New Since Last Evaluation")

    expect(prompt2).not.toContain("## Previously Evaluated")
    expect(prompt2).not.toContain("[user]: first message")
    expect(prompt2).not.toContain("[assistant]: first response")
    // New messages fall after New Since Last Evaluation
    expect(prompt2.indexOf("[user]: second message")).toBeGreaterThan(newIdx)
    expect(prompt2.indexOf("[assistant]: second response")).toBeGreaterThan(newIdx)
    expect(prompt2).toContain("## Recent Memory Items")

    const cache = _getTranscriptCache().get(sessionId)
    expect(cache?.messageCount).toBe(4)
  })

  test("session.deleted event clears transcript cache entry", async () => {
    const messages = makeMessages(
      { role: "user", text: "hello" },
      { role: "assistant", text: "hi" },
    )
    const sessionId = newSessionId()

    // Populate cache
    await evaluateSession(createMockSession({ messages }), sessionId, noopLog)
    expect(_getTranscriptCache().has(sessionId)).toBe(true)

    // Manually clear cache (session.deleted handler logic is now internal to setup)
    _getTranscriptCache().delete(sessionId)

    expect(_getTranscriptCache().has(sessionId)).toBe(false)
  })
})

// ─── Guards operate on the cumulative transcript ────────────────────────────

describe("evaluateSession guards use cumulative transcript", () => {
  test("skip-skill signal from an earlier segment still suppresses a later evaluation cycle", async () => {
    const initial = [
      {
        info: { role: "assistant" },
        parts: [{ type: "tool", tool: "skill", state: { input: { name: "enriching-knowledge-base" } } }],
      },
    ]
    const additional = makeMessages({ role: "assistant", text: "continuing work" })
    const prompts: string[] = []
    const sessionId = newSessionId()

    await evaluateSession(createMockSession({ messages: initial, capturePrompts: prompts }), sessionId, noopLog)

    const allMessages = [...initial, ...additional]
    await evaluateSession(createMockSession({ messages: allMessages, capturePrompts: prompts }), sessionId, noopLog)

    // shouldSkipEvaluation checks the cumulative transcript on every cycle, not just the new segment
    expect(prompts).toHaveLength(0)
  })

  test("empty-content guard evaluates old+new combined — a blank-only new segment still proceeds when prior content exists", async () => {
    const initial = makeMessages({ role: "user", text: "meaningful content" })
    const additional = [
      { info: { role: "user" }, parts: [{ type: "text", text: "   " }] },
    ]
    const prompts: string[] = []
    const sessionId = newSessionId()

    await evaluateSession(createMockSession({ messages: initial, capturePrompts: prompts }), sessionId, noopLog)

    const allMessages = [...initial, ...additional]
    await evaluateSession(createMockSession({ messages: allMessages, capturePrompts: prompts }), sessionId, noopLog)

    // fullTranscript (old+new) still has content even though the new segment alone sanitizes to empty
    expect(prompts).toHaveLength(2)
  })
})

// ─── Debug logging reports evaluated vs new transcript counts ───────────────

describe("evaluateSession debug logging", () => {
  test("'Invoking memory agent' log reports separate counts for previously evaluated and new content", async () => {
    const initial = makeMessages(
      { role: "user", text: "first message" },
      { role: "assistant", text: "first response" },
    )
    const additional = makeMessages({ role: "user", text: "second message" })
    const sessionId = newSessionId()

    const logCalls: Array<{ message: string; extra?: Record<string, any> }> = []
    const captureLog = async (_level: any, message: string, extra?: Record<string, any>) => {
      logCalls.push({ message, extra })
    }

    await evaluateSession(createMockSession({ messages: initial }), sessionId, captureLog)
    await evaluateSession(createMockSession({ messages: [...initial, ...additional] }), sessionId, captureLog)

    const invocations = logCalls.filter(c => c.message === "Invoking memory agent")
    expect(invocations).toHaveLength(2)
    const [cycle1, cycle2] = invocations
    if (!cycle1 || !cycle2) throw new Error("expected exactly 2 invocations")

    // Cycle 1 — nothing previously evaluated yet, all content is new
    expect(cycle1.extra?.previouslyEvaluated).toEqual({ userMessages: 0, assistantMessages: 0, toolCalls: [] })
    expect(cycle1.extra?.newSinceLastEvaluation).toEqual({ userMessages: 1, assistantMessages: 1, toolCalls: [] })

    // Cycle 2 - cycle 1's content is cached, but only the new message is sent for evaluation
    expect(cycle2.extra?.previouslyEvaluated).toEqual({ userMessages: 1, assistantMessages: 1, toolCalls: [] })
    expect(cycle2.extra?.newSinceLastEvaluation).toEqual({ userMessages: 1, assistantMessages: 0, toolCalls: [] })
  })
})

// ─── evaluateSession new-items detection at memory cap ──────────────────────

describe("evaluateSession new-items detection", () => {
  test("detects newly written items even when Memory.md is at capacity (oldest truncated by append-memory.sh)", async () => {
    await writeFile(memoryPath, "# Memory\n\n- item-a\n- item-b\n- item-c\n", "utf-8")

    const messages = makeMessages({ role: "user", text: "trigger" })
    const sessionId = newSessionId()
    const logCalls: Array<{ message: string; extra?: Record<string, any> }> = []
    const captureLog = async (_level: any, message: string, extra?: Record<string, any>) => {
      logCalls.push({ message, extra })
    }

    const client = createMockSession({ messages })
    // Simulate the memory agent appending one new item while the cap truncates the oldest —
    // total item count stays constant (3 before, 3 after).
    client.prompt = mock(async () => {
      await writeFile(memoryPath, "# Memory\n\n- item-b\n- item-c\n- item-d\n", "utf-8")
      return { data: { parts: [] } }
    })

    await evaluateSession(client, sessionId, captureLog)

    const wroteNew = logCalls.find(c => c.message === "Memory agent wrote new items")
    const wroteNothing = logCalls.find(c => c.message === "Memory agent wrote nothing")

    expect(wroteNothing).toBeUndefined()
    expect(wroteNew?.extra?.items).toEqual(["- item-d"])
  })

  test("logs 'wrote nothing' when Memory.md is genuinely unchanged", async () => {
    await writeFile(memoryPath, "# Memory\n\n- item-a\n- item-b\n", "utf-8")

    const messages = makeMessages({ role: "user", text: "trigger" })
    const sessionId = newSessionId()
    const logCalls: Array<{ message: string; extra?: Record<string, any> }> = []
    const captureLog = async (_level: any, message: string, extra?: Record<string, any>) => {
      logCalls.push({ message, extra })
    }

    await evaluateSession(createMockSession({ messages }), sessionId, captureLog)

    expect(logCalls.find(c => c.message === "Memory agent wrote new items")).toBeUndefined()
    expect(logCalls.find(c => c.message === "Memory agent wrote nothing")).toBeDefined()
  })
})
