# Memory Plugin Architecture Plan

## Overview

Memory management uses a **separation of concerns** architecture:
- **Memory Agent:** Evaluates significance and formats items (intelligence)
- **Memory Plugin:** Handles file I/O, truncation, locking (mechanics)

## Core Principles

### Single Global Memory

Memory is **global and cross-project** by design:
- Single Memory.md file shared across all OpenCode instances
- Captures YOUR work context, not project-specific state
- Natural chronological stream regardless of which project you're working in
- 50-line FIFO window maintains recent context

**Why global?**
1. "Pick up where I left off" transcends project boundaries
2. Work often spans multiple projects
3. Research and learning happen independent of any project

### Memory Contains Context, Not Details

**Memory items are signposts, not documentation:**
- Memory: `- Refactored agent permissions; see [[OpenCode Agent Permissions]]`
- Details: In Knowledge Base notes or project files

**Project-specific details belong in:**
- Project's own files (README, docs, config)
- Knowledge Base notes (for cross-project patterns)
- NOT in Memory.md

**This enables:**
- Lightweight memory (150 chars per item enforces this)
- References via `[[wiki-links]]` to deeper context
- Memory focuses on "what happened" not "how it works"

## Key Decisions

### 1. Programmatic Truncation (No LLM)

**Decision:** Use mechanical FIFO truncation instead of LLM-based summarization.

**Rationale:**
- Faster (no LLM call)
- Predictable (oldest items always dropped)
- No token cost
- Simpler implementation

**Implementation:** Plugin enforces 50-line hard limit, deleting oldest items when capacity reached.

### 2. Agent Only Evaluates

**Decision:** Memory agent only evaluates significance and formats items. No file write operations.

**Rationale:**
- Simpler agent instructions (86 lines → 35 lines)
- File operations don't require LLM intelligence
- Faster execution (direct file I/O vs tool calls)
- Clear separation of concerns

**Implementation:** 
- Agent has Read tool access to Memory.md (reads latest version from file)
- Agent outputs: `- [item]` or `SKIP: [reason]`
- Plugin parses output and handles file writes
- Primary agent receives injected memory snapshot at session start (may be stale mid-session)
- Memory subagent always reads fresh file content (source of truth)

### 3. Small Model Usage

**Decision:** Use small models for memory evaluation with simplified fallback pattern.

**Rationale:**
- Task is simple (evaluate + format)
- Small models are fast and cheap
- Reduces resource usage

**Implementation:**
- Hardcoded fallback array (editable in plugin code)
- Specific models TBD through testing
- Simple try-catch loop through models sequentially
- NOT using full OpenCode session-scoped fallback pattern (see [[OpenCode Plugin Model Fallback Chains]])
- If all models fail: report error to user

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

**Reference:** [[OpenCode Plugin Model Fallback Chains]] for full session-scoped pattern (not used here)

### 4. 150 Character Hard Limit

**Decision:** Enforce 150 char limit per memory item with validation loop and atomic commit.

**Rationale:**
- Ensures memory stays concise
- Prevents agent from being verbose
- Only the agent can semantically shorten or split items (programmatic truncation would break meaning)
- Atomic transaction model ensures data integrity

**Implementation:**
- Agent instructed to keep items ≤150 chars
- Plugin validates EACH item individually
- If ANY items over limit:
  - Re-prompt agent with specific feedback listing ALL violations (e.g., "Item 1 was 187 chars (37 over limit)")
  - Agent can shorten OR split into multiple items as needed
  - Max 2 retry attempts
- If still fails after 2 attempts:
  - Commit NOTHING (atomic transaction)
  - Report ALL violations to user with failed item texts
  - User manually intervenes
- Only commits to file if ALL items pass validation

### 5. File Locking

**Decision:** Implement promise-based file locking in plugin.

**Rationale:**
- Prevents concurrent writes from race conditions
- Simple promise-based mutex pattern
- No external dependencies needed

**Implementation:** `withLock()` function using Map to track active locks.

### 6. No Duplicate Checking in Agent

**Decision:** Agent does NOT check for duplicates in memory.

**Rationale:**
- If plugin invokes agent, information is potentially worth considering
- Agent focuses on significance evaluation only
- User can explicitly ask to update memory

**Implementation:** Agent evaluates significance based on criteria, not existence in memory.

### 7. Context Injection Before First Message

**Decision:** Plugin injects Memory.md content via `session.created` hook with `noReply: true`.

**Rationale:**
- Memory available before agent processes first user message
- No latency from tool execution
- Works even if agent doesn't invoke tools
- Appears as synthetic message in conversation history (not system prompt)

**Implementation:** 
- Use `session.created` event hook
- Call `client.session.prompt()` with `noReply: true` and memory content
- Track sessions in Set to prevent duplicate injection
- AGENTS.md updated to remove "read memory first" instruction (now auto-loaded)

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
3. **Memory Evaluation:**
   - Agent receives Memory.md content (already injected)
   - Agent evaluates significance
   - Agent outputs: `- [item]` or `SKIP: [reason]`
4. **Plugin Processing:**
   - Plugin acquires file lock
   - Plugin validates 150 char limit
   - If over limit, asks agent to shorten
   - Plugin truncates file if at 50 lines (FIFO)
   - Plugin appends item
   - Plugin releases lock

## Future Considerations

- Session idle detection for automatic memory updates (via `session.idle` hook)
- Session summary extraction for memory context
- Memory search/retrieval tools for agents
- Mid-session memory refresh (if memory file updated externally during active session)
  - Currently: memory injected at session start, not refreshed mid-session
  - Acceptable trade-off: multi-instance scenarios handle stale snapshots via file locking on writes
  - Future: could add refresh mechanism if stale context becomes problematic
