# Memory Plugin Architecture Plan

## Overview

**Separation of concerns:**
- **Memory Agent:** Evaluates significance, formats items
- **Memory Plugin:** File I/O, truncation, locking

## Core Principles

### Single Global Memory

Memory is **global and cross-project**:
- Single Memory.md shared across all OpenCode instances
- Captures your work context, not project state
- **50-item FIFO window** maintains recent context

### Memory Contains Context, Not Details

Memory items are **signposts, not documentation:**
- Memory: `- Refactored agent permissions; see [[OpenCode Agent Permissions]]`
- Details: In Knowledge Base or project files

This enables wiki-link references and enforces conciseness (**150 chars/item**).

## Key Decisions

### 1. Programmatic Truncation (No LLM)

Use FIFO truncation instead of LLM summarization. Faster, predictable, no token cost.

**Implementation:** Plugin enforces 50-item hard limit, deletes oldest items when capacity reached.

### 2. Agent Only Evaluates

Agent evaluates significance and formats items. No file writes.

**Rationale:** File operations don't need LLM intelligence. Simpler, faster.

**Output format:** Agent outputs markdown bullets or `SKIP`, nothing else.

```
- item one
- item two
```

Or if not significant:

```
SKIP
```

**Parsing:** Plugin extracts lines matching `^- `, ignores everything else. Agent instructed to output only bullets or SKIP; plugin parses defensively as fallback.

**Implementation:**
- Agent reads Memory.md, outputs memory items or skips
- Agent has no write/edit permissions (plugin handles all file I/O)
- Plugin parses output, handles all file writes
- Primary agent gets injected snapshot at session start (may be stale mid-session)
- Memory subagent always reads fresh file content (source of truth)

### 3. Small Model Usage

Use small models for memory evaluation with simple fallback. Task is simple (evaluate + format), small models are fast and cheap.

**Implementation:**
- Hardcoded fallback array in plugin code
- Sequential try-catch loop through models
- Reports error to user if all models fail
- NOT using full session-scoped fallback pattern (see [[OpenCode Plugin Model Fallback Chains]])

```typescript
const fallbackModels = ["model1", "model2", "model3"]

async function invokeMemoryAgent(summary: string): Promise<string> {
  let lastError: Error | null = null
  
  for (const model of fallbackModels) {
    try {
      const result = await client.task({
        subagent_type: "memory/memory",
        prompt: summary,
        model: model
      })
      return result
    } catch (error) {
      lastError = error
    }
  }
  
  throw new Error(`Memory agent failed: ${lastError?.message}`)
}
```

### 4. 150 Character Hard Limit

Each memory item must contain **one piece of information** (one task, decision, or fact). This enforces conciseness naturally -- atomic items stay short. The 150 char limit is a safety net.

**Implementation:**
- Plugin validates each item after agent returns
- If any item over limit: re-prompt agent once listing all violations (e.g., "Item 1 was 187 chars (37 over limit)"), agent can shorten or split
- If still over limit after 1 retry: commit nothing, report violations to user (user handles manually)

### 5. File Locking

Promise-based mutex (`withLock()`) prevents concurrent write races. Uses Map to track active locks.

### 6. File Initialization

If Memory.md doesn't exist (first run, new machine, accidental deletion), plugin creates it with `# Memory` header before any read/write operations.

### 7. Deduplication via Significance Evaluation

Agent reads memory, skips if redundant. No separate dedup layer (exact match too simple, semantic similarity too complex).

### 8. Context Injection Before First Message

Plugin injects Memory.md via `session.created` hook with `noReply: true`.

**Rationale:** Available before first message, no tool latency, works without agent invocation.

**Implementation:** Track sessions in Set to prevent duplicate injection. AGENTS.md updated to remove "read memory first" instruction (now auto-loaded).

### 9. Automatic Memory Updates via `session.idle`

Plugin listens for `session.idle` events and automatically invokes the memory subagent after every assistant response to evaluate if anything is worth adding.

**Rationale:** Removes reliance on primary agent remembering to invoke memory subagent. Ensures memory is always up to date.

**Implementation:** On `session.idle`, plugin invokes memory subagent with summary of recent conversation. Agent evaluates and outputs items or SKIP.

## File Structure

```
plugins/
  memory-manager.ts          # Plugin implementation
agents/memory/
  memory.md                  # Agent instructions (evaluation only)
vibe-context/memory/
  Memory.md                  # Memory storage (managed by plugin)
```

## Workflow

1. **Session Start:** Plugin injects Memory.md content via `session.created` hook (before first user message)
2. **During Session:** Primary agent invokes memory subagent when appropriate
3. **Memory Evaluation:** Agent outputs memory items or skips
4. **Plugin Processing:**
    - Plugin acquires file lock
    - Plugin validates 150 char limit (each item = one piece of information)
    - If over limit, re-prompt agent once to shorten/split
    - If still over limit: commit nothing, report to user
    - Truncate file if at 50 items (FIFO)
    - Append item
    - Release lock

## Future Considerations

- Memory search/retrieval tools
- Priority/bumping for critical items (currently all age out equally via FIFO)
- Mid-session memory refresh via `experimental.chat.system.transform` (fires per-LLM-call, reads fresh memory; blocked on hook graduating from experimental/undocumented to stable)
