import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  sanitizeTranscript,
  shouldSkipEvaluation,
  evaluateSession,
  MemoryManagerPlugin,
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
 * Minimal mock client. capturePrompts, when provided, receives each prompt
 * text sent to the memory agent via session.prompt.
 */
function createMockClient(options: {
  messages?: any[]
  capturePrompts?: string[]
} = {}): any {
  return {
    session: {
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
    },
    app: {
      log: mock(async () => null),
    },
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

// ─── System prompt injection ────────────────────────────────────────────────

describe("system prompt injection", () => {
  test("first LLM call on primary session → Memory.md content appears in system output", async () => {
    await writeFile(memoryPath, "# Memory\n\n- [2026-01-01] [decision] test: use bun\n", "utf-8")
    const plugin = await MemoryManagerPlugin({ client: createMockClient() })
    const transform = (plugin as any)["experimental.chat.system.transform"]

    const sessionID = newSessionId()
    const output = { system: [] as string[] }
    await transform({ sessionID }, output)

    expect(output.system).toHaveLength(1)
    expect(output.system[0]).toContain("use bun")
  })

  test("second LLM call on same session uses snapshot — no re-read", async () => {
    await writeFile(memoryPath, "# Memory\n\n- [2026-01-01] [decision] test: original item\n", "utf-8")
    const plugin = await MemoryManagerPlugin({ client: createMockClient() })
    const transform = (plugin as any)["experimental.chat.system.transform"]

    const sessionID = newSessionId()
    const out1 = { system: [] as string[] }
    await transform({ sessionID }, out1)

    // Modify file — second call must NOT reflect this change
    await writeFile(memoryPath, "# Memory\n\n- [2026-01-01] [decision] test: modified item\n", "utf-8")
    const out2 = { system: [] as string[] }
    await transform({ sessionID }, out2)

    expect(out1.system[0]).toBe(out2.system[0])
    expect(out2.system[0]).toContain("original item")
    expect(out2.system[0]).not.toContain("modified item")
  })

  test("session in memoryAgentSessions → system output unchanged", async () => {
    const plugin = await MemoryManagerPlugin({ client: createMockClient() })
    const transform = (plugin as any)["experimental.chat.system.transform"]

    const sessionID = newSessionId()
    _getMemoryAgentSessions().add(sessionID)
    try {
      const output = { system: [] as string[] }
      await transform({ sessionID }, output)
      expect(output.system).toHaveLength(0)
    } finally {
      _getMemoryAgentSessions().delete(sessionID)
    }
  })

  test("session with agent field → system output unchanged", async () => {
    const plugin = await MemoryManagerPlugin({ client: createMockClient() })
    const transform = (plugin as any)["experimental.chat.system.transform"]

    const sessionID = newSessionId()
    const output = { system: [] as string[] }
    await transform({ sessionID, agent: "memory" }, output)
    expect(output.system).toHaveLength(0)
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

    await evaluateSession(createMockClient({ messages, capturePrompts: prompts }), sessionId, noopLog)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain("[user]: hello")
    expect(prompts[0]).toContain("[assistant]: hi")
    expect(prompts[0]).toContain("[user]: proceed")

    const cache = _getTranscriptCache().get(sessionId)
    expect(cache?.messageCount).toBe(3)
  })

  test("second evaluateSession with M new messages: full transcript contains all N+M messages", async () => {
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

    // First evaluation — 2 messages
    await evaluateSession(createMockClient({ messages: initial, capturePrompts: prompts }), sessionId, noopLog)

    // Second evaluation — 4 messages total
    const allMessages = [...initial, ...additional]
    await evaluateSession(createMockClient({ messages: allMessages, capturePrompts: prompts }), sessionId, noopLog)

    expect(prompts).toHaveLength(2)
    // Second prompt must contain full transcript of all 4 messages
    expect(prompts[1]).toContain("[user]: first message")
    expect(prompts[1]).toContain("[assistant]: first response")
    expect(prompts[1]).toContain("[user]: second message")
    expect(prompts[1]).toContain("[assistant]: second response")

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
    await evaluateSession(createMockClient({ messages }), sessionId, noopLog)
    expect(_getTranscriptCache().has(sessionId)).toBe(true)

    // Fire session.deleted via the plugin event handler
    const plugin = await MemoryManagerPlugin({ client: createMockClient() })
    await (plugin as any).event({
      event: { type: "session.deleted", properties: { sessionID: sessionId } },
    })

    expect(_getTranscriptCache().has(sessionId)).toBe(false)
  })
})
