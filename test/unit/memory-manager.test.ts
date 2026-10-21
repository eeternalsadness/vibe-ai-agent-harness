import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { SessionMessageInfo } from "@opencode/client/promise"
import {
  sanitizeTranscript,
  shouldSkipEvaluation,
  diffNewItems,
  evaluateSession,
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
  messages?: SessionMessageInfo[]
  capturePrompts?: string[]
} = {}): any {
  return {
    context: mock(async () => options.messages ?? []),
    get: mock(async () => null),
    create: mock(async () => ({ id: "mock-agent-session" })),
    prompt: mock(async ({ text }: any) => {
      if (options.capturePrompts) options.capturePrompts.push(text ?? "")
      return {}
    }),
    wait: mock(async () => {}),
    interrupt: mock(async () => {}),
    remove: mock(async () => {}),
  }
}

/** Build V2 messages for evaluateSession (session.context() returns SessionMessageInfo[]) */
function makeMessages(
  ...entries: Array<{ type: "user" | "assistant"; text: string }>
): SessionMessageInfo[] {
  return entries.map(({ type, text }) => ({
    id: `msg-${Math.random().toString(36).slice(2)}`,
    type,
    time: { created: Date.now() },
    ...(type === "user"
      ? { text }
      : { content: [{ type: "text" as const, text }] }),
  })) as unknown as unknown as SessionMessageInfo[]
}

// ─── sanitizeTranscript ─────────────────────────────────────────────────────

describe("sanitizeTranscript", () => {
  test("user text → [user]: text", () => {
    const result = sanitizeTranscript([
      { id: "m1", type: "user", time: { created: 0 }, text: "hello world" },
    ] as unknown as SessionMessageInfo[])
    expect(result).toBe("[user]: hello world")
  })

  test("assistant text → [assistant]: text", () => {
    const result = sanitizeTranscript([
      { id: "m1", type: "assistant", time: { created: 0 }, content: [{ type: "text", text: "hi there" }] },
    ] as unknown as SessionMessageInfo[])
    expect(result).toBe("[assistant]: hi there")
  })

  test("tool call with args → [tool: name] key: value", () => {
    const result = sanitizeTranscript([
      {
        id: "m1",
        type: "assistant",
        time: { created: 0 },
        content: [{ type: "tool", id: "t1", name: "edit", state: { input: { filePath: "src/foo.ts" } } }],
      },
    ] as unknown as SessionMessageInfo[])
    expect(result).toBe("[tool: edit] filePath: src/foo.ts")
  })

  test("tool output (shell result) not present in output", () => {
    // shell messages represent tool outputs — they must be stripped
    const result = sanitizeTranscript([
      {
        id: "m1",
        type: "shell",
        time: { created: 0 },
        result: "done",
      } as unknown as SessionMessageInfo,
    ])
    expect(result).toBe("")
  })

  test("blank/whitespace text part not present in output", () => {
    const result = sanitizeTranscript([
      { id: "m1", type: "user", time: { created: 0 }, text: "   " },
    ] as unknown as SessionMessageInfo[])
    expect(result).toBe("")
  })

  test("mixed assistant message: text line appears before tool call line", () => {
    const result = sanitizeTranscript([
      {
        id: "m1",
        type: "assistant",
        time: { created: 0 },
        content: [
          { type: "text", text: "I'll edit the file" },
          { type: "tool", id: "t1", name: "edit", state: { input: { filePath: "foo.ts" } } },
        ],
      },
    ] as unknown as SessionMessageInfo[])
    expect(result).toBe("[assistant]: I'll edit the file\n[tool: edit] filePath: foo.ts")
  })

  test("[tool: task] subagent_type: research survives sanitization", () => {
    const result = sanitizeTranscript([
      {
        id: "m1",
        type: "assistant",
        time: { created: 0 },
        content: [
          {
            type: "tool",
            id: "t1",
            name: "task",
            state: { input: { subagent_type: "research", description: "Kubernetes Informer" } },
          },
        ],
      },
    ] as unknown as SessionMessageInfo[])
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
      { type: "user", text: "hello" },
      { type: "assistant", text: "hi" },
      { type: "user", text: "proceed" },
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
      { type: "user", text: "first message" },
      { type: "assistant", text: "first response" },
    )
    const additional = makeMessages(
      { type: "user", text: "second message" },
      { type: "assistant", text: "second response" },
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
      { type: "user", text: "hello" },
      { type: "assistant", text: "hi" },
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
        id: "m1",
        type: "assistant",
        time: { created: 0 },
        content: [{ type: "tool", id: "t1", name: "skill", state: { input: { name: "enriching-knowledge-base" } } }],
      },
    ] as unknown as SessionMessageInfo[]
    const additional = makeMessages({ type: "assistant", text: "continuing work" })
    const prompts: string[] = []
    const sessionId = newSessionId()

    await evaluateSession(createMockSession({ messages: initial, capturePrompts: prompts }), sessionId, noopLog)

    const allMessages = [...initial, ...additional]
    await evaluateSession(createMockSession({ messages: allMessages, capturePrompts: prompts }), sessionId, noopLog)

    // shouldSkipEvaluation checks the cumulative transcript on every cycle, not just the new segment
    expect(prompts).toHaveLength(0)
  })

  test("empty-content guard evaluates old+new combined — a blank-only new segment still proceeds when prior content exists", async () => {
    const initial = makeMessages({ type: "user", text: "meaningful content" })
    const additional = [
      { id: "m2", type: "user", time: { created: 0 }, text: "   " },
    ] as unknown as SessionMessageInfo[]
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
      { type: "user", text: "first message" },
      { type: "assistant", text: "first response" },
    )
    const additional = makeMessages({ type: "user", text: "second message" })
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

    const messages = makeMessages({ type: "user", text: "trigger" })
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
      return {}
    })

    await evaluateSession(client, sessionId, captureLog)

    const wroteNew = logCalls.find(c => c.message === "Memory agent wrote new items")
    const wroteNothing = logCalls.find(c => c.message === "Memory agent wrote nothing")

    expect(wroteNothing).toBeUndefined()
    expect(wroteNew?.extra?.items).toEqual(["- item-d"])
  })

  test("logs 'wrote nothing' when Memory.md is genuinely unchanged", async () => {
    await writeFile(memoryPath, "# Memory\n\n- item-a\n- item-b\n", "utf-8")

    const messages = makeMessages({ type: "user", text: "trigger" })
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

// ─── Setup / V2 wiring regression tests ─────────────────────────────────────

import memoryManagerPlugin from "../../src/platforms/opencode/plugins/memory-manager"

/**
 * Minimal V2 plugin context. Records registered hooks and lets the test drive
 * a push-based event stream. `parents` maps sessionID -> parentID for subagent
 * simulation; sessions absent from the map are primary.
 */
function createMockPluginContext(options: {
  parents?: Record<string, string>
  messages?: SessionMessageInfo[]
} = {}): any {
  const hooks: Record<string, (event: any) => Promise<void> | void> = {}
  const queue: any[] = []
  let notify: (() => void) | null = null
  let closed = false

  const stream = {
    push(event: any) {
      queue.push(event)
      notify?.()
    },
    close() {
      closed = true
      notify?.()
    },
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<any>> {
          while (queue.length === 0 && !closed) {
            await new Promise<void>((resolve) => {
              notify = resolve
            })
          }
          if (queue.length > 0) return { value: queue.shift(), done: false }
          return { value: undefined, done: true }
        },
      }
    },
  }

  return {
    hooks,
    stream,
    location: { directory: "/mock/project" },
    session: {
      hook: async (name: string, callback: any) => {
        hooks[name] = callback
        return { dispose: async () => {} }
      },
      get: async ({ sessionID }: any) => ({
        id: sessionID,
        ...(options.parents?.[sessionID] ? { parentID: options.parents[sessionID] } : {}),
      }),
      context: async () => options.messages ?? [],
      create: async () => ({ id: "mock-agent-session" }),
      prompt: async () => ({}),
      wait: async () => {},
      interrupt: async () => {},
      remove: async () => {},
    },
    event: {
      subscribe: () => stream,
    },
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out")
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe("plugin setup V2 wiring", () => {
  test("context hook injects memory for primary sessions despite event.agent always being set", async () => {
    const ctx = createMockPluginContext()
    const cleanup = await memoryManagerPlugin.setup(ctx)

    // V2 contract: event.agent is the active agent id and is set for primary sessions too.
    const event = { sessionID: newSessionId(), agent: "yapper", system: [] as any[] }
    await ctx.hooks.context(event)

    expect(event.system.length).toBe(1)
    expect(event.system[0].text).toContain("# Working Memory Context")

    ctx.stream.close()
    await cleanup?.()
  })

  test("context hook skips subagent sessions (parentID present)", async () => {
    const childId = newSessionId()
    const ctx = createMockPluginContext({ parents: { [childId]: "parent-session" } })
    const cleanup = await memoryManagerPlugin.setup(ctx)

    const event = { sessionID: childId, agent: "research", system: [] as any[] }
    await ctx.hooks.context(event)

    expect(event.system.length).toBe(0)

    ctx.stream.close()
    await cleanup?.()
  })

  test("session.idle events resolve sessionID from nested data payload", async () => {
    const sessionId = newSessionId()
    let contextFetchedFor: string | undefined
    const ctx = createMockPluginContext()
    ctx.session.context = async ({ sessionID }: any) => {
      contextFetchedFor = sessionID
      return []
    }
    const cleanup = await memoryManagerPlugin.setup(ctx)

    // V2 event shape: { type, data: { sessionID } } — no top-level sessionID.
    ctx.stream.push({ type: "session.idle", data: { sessionID: sessionId } })
    await waitFor(() => contextFetchedFor !== undefined)
    expect(contextFetchedFor).toBe(sessionId)

    ctx.stream.close()
    await cleanup?.()
  })

  test("events from other locations are ignored (dedupe across plugin instances)", async () => {
    const sessionId = newSessionId()
    let contextFetched = false
    const ctx = createMockPluginContext()
    ctx.session.context = async () => {
      contextFetched = true
      return []
    }
    const cleanup = await memoryManagerPlugin.setup(ctx)

    ctx.stream.push({
      type: "session.idle",
      location: { directory: "/somewhere/else" },
      data: { sessionID: sessionId },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(contextFetched).toBe(false)

    ctx.stream.close()
    await cleanup?.()
  })
})

describe("idle signal variants", () => {
  test("session.status with status.type idle triggers idle handling", async () => {
    const sessionId = newSessionId()
    let fetchedFor: string | undefined
    const ctx = createMockPluginContext()
    ctx.session.context = async ({ sessionID }: any) => {
      fetchedFor = sessionID
      return []
    }
    const cleanup = await memoryManagerPlugin.setup(ctx)

    ctx.stream.push({
      type: "session.status",
      data: { sessionID: sessionId, status: { type: "idle" } },
    })
    await waitFor(() => fetchedFor !== undefined)
    expect(fetchedFor).toBe(sessionId)

    ctx.stream.close()
    await cleanup?.()
  })

  test("session.status busy does not trigger idle handling", async () => {
    const sessionId = newSessionId()
    let fetched = false
    const ctx = createMockPluginContext()
    ctx.session.context = async () => {
      fetched = true
      return []
    }
    const cleanup = await memoryManagerPlugin.setup(ctx)

    ctx.stream.push({
      type: "session.status",
      data: { sessionID: sessionId, status: { type: "busy" } },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetched).toBe(false)

    ctx.stream.close()
    await cleanup?.()
  })
})

describe("execution lifecycle idle signal", () => {
  test("session.execution.succeeded triggers idle handling", async () => {
    const sessionId = newSessionId()
    let fetchedFor: string | undefined
    const ctx = createMockPluginContext()
    ctx.session.context = async ({ sessionID }: any) => {
      fetchedFor = sessionID
      return []
    }
    const cleanup = await memoryManagerPlugin.setup(ctx)

    ctx.stream.push({ type: "session.execution.succeeded", data: { sessionID: sessionId } })
    await waitFor(() => fetchedFor !== undefined)
    expect(fetchedFor).toBe(sessionId)

    ctx.stream.close()
    await cleanup?.()
  })
})

describe("project context wiring", () => {
  test("evaluation prompt carries the session's project from session.get", async () => {
    await writeFile(memoryPath, "# Memory\n\n- item-a\n", "utf-8")
    const prompts: string[] = []
    const messages = makeMessages({ type: "user", text: "we decided to use postgres" })
    const session = createMockSession({ messages, capturePrompts: prompts })
    session.get = async () => ({ id: "s", location: { directory: "/home/dev/Repo/vibe-ai-agent-harness" } })

    await evaluateSession(session, newSessionId(), noopLog)

    expect(prompts[0]).toContain("## Source Session")
    expect(prompts[0]).toContain("- Project name: vibe-ai-agent-harness")
  })
})
