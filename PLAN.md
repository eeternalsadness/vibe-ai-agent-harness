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

**Implementation:**
- Agent reads Memory.md, outputs memory items or skips
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

Enforce 150 char limit per item with validation loop and atomic commit.

**Rationale:** Only agent can semantically shorten items (programmatic truncation breaks meaning).

**Implementation:**
- Plugin validates each item individually
- If any item over limit: re-prompt agent listing ALL violations (e.g., "Item 1 was 187 chars (37 over limit)"), agent can shorten OR split (max 2 retries)
- If still fails: commit nothing, report ALL violations to user

### 5. File Locking

Promise-based mutex (`withLock()`) prevents concurrent write races. Uses Map to track active locks.

### 6. Deduplication via Significance Evaluation

Agent reads memory, skips if redundant. No separate dedup layer (exact match too simple, semantic similarity too complex).

### 7. Context Injection Before First Message

Plugin injects Memory.md via `session.created` hook with `noReply: true`.

**Rationale:** Available before first message, no tool latency, works without agent invocation.

**Implementation:** Track sessions in Set to prevent duplicate injection. AGENTS.md updated to remove "read memory first" instruction (now auto-loaded).

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
    - Plugin validates 150 char limit
    - If over limit, re-prompt agent to shorten (max 2 retries)
    - Truncate file if at 50 items (FIFO)
    - Append item
    - Release lock

## Future Considerations

- `session.idle` hook for automatic memory updates (see [[OpenCode Plugin Session Lifecycle Hooks]])
- Memory search/retrieval tools
- Priority/bumping for critical items (currently all age out equally via FIFO)
- Mid-session memory refresh (currently injected once at session start; acceptable tradeoff for MVP)
