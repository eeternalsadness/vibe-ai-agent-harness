# Implementation: memory-plugin-v4

## Task 1: Write tests

**File:** `test/unit/memory-manager.test.ts`

Export the following from `memory-manager.ts` so they are testable:
- `sanitizeTranscript`
- `shouldSkipEvaluation`

Use a real temp dir (via `os.tmpdir()`) for Memory.md file operations. Mock the plugin client with `vi.fn()`.

### sanitizeTranscript

- User text part → `[user]: text`
- Assistant text part → `[assistant]: text`
- Tool call with args → `[tool: name] key: value`
- Tool output part → not present in output
- Blank/whitespace text part → not present in output
- Mixed assistant message (text + tool call) → both lines present, text before tool call
- `[tool: task] subagent_type: research` → present verbatim (research signal survives sanitization)

### shouldSkipEvaluation

- Transcript containing a skip-skill load → returns true
- Transcript with no skip-skill → returns false

### System prompt injection

- First LLM call on primary session → Memory.md content appears in system output
- Second LLM call on same session → identical content (snapshot, no re-read)
- Session in `memoryAgentSessions` → system output unchanged
- Session with `agent` field set → system output unchanged

### Incremental transcript cache

For these tests, mock `invokeMemoryAgent` to be a no-op (focus is on cache behavior, not memory agent invocation).

- First `evaluateSession` call: all N messages sanitized, cache entry set with `messageCount = N`
- Second `evaluateSession` call with M new messages appended: only M new messages sanitized, full transcript is concatenation of both segments
- Session deleted event: cache entry removed

---

## Task 2: Incremental transcript cache (plugin)

**File:** `src/platforms/opencode/plugins/memory-manager.ts`

Add a module-level cache map alongside the existing state maps:

```ts
const transcriptCache = new Map<string, { transcript: string; messageCount: number }>()
```

Modify `evaluateSession`:
- After fetching and mapping messages, get `cache = transcriptCache.get(sessionId)`
- `previousCount = cache?.messageCount ?? 0`
- `newMessages = messages.slice(previousCount)`
- If `newMessages.length === 0`: log and return `messages.length` early (shouldn't occur in practice — `runEvaluation` guards this)
- `newSegment = sanitizeTranscript(newMessages)`
- `fullTranscript = cache ? cache.transcript + (newSegment ? '\n' + newSegment : '') : newSegment`
- `transcriptCache.set(sessionId, { transcript: fullTranscript, messageCount: messages.length })`
- Use `fullTranscript` in the prompt (replacing the current `transcript` variable)

In the `session.deleted` handler, add:
```ts
transcriptCache.delete(sessionId)
```

**Acceptance criteria:**
- Second evaluation on a long session does not re-sanitize already-processed messages
- Cache is cleared when session is deleted
- All Task 1 cache tests pass

---

## Task 3: Update evaluating-memory skill

**File:** `src/global/skills/evaluating-memory/SKILL.md.ts`

In the `[research]` tag section, replace the current detection rule with:

> `[tool: task] subagent_type: research` appears in the transcript — one occurrence = one `[research]` item. Topic is inferred from conversation context surrounding that line.

**Acceptance criteria:**
- Memory agent only emits `[research]` when the research agent was invoked
- Topic is inferred from context, not the tool call line itself

---

## Task 4: Build and verify

```bash
./install.sh
npx vitest
```

All tests pass including the new `memory-manager.test.ts`.
