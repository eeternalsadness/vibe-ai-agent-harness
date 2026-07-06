# Memory Plugin v2 Plan

## Overview

Shift significance evaluation from the memory subagent to the primary agent.
The primary agent has full session context and is best positioned to judge
what is worth remembering. The memory subagent becomes a pure formatter.

**Changed separation of concerns:**
- **Primary Agent:** Evaluates significance, decides what to save, calls `remember()`
- **Memory Agent:** Formats items only — always writes, never skips
- **Memory Plugin:** File I/O, truncation, locking (unchanged)

## Problem with v1

The memory subagent evaluated significance from the last message pair, which
contains implementation noise (HOW details) rather than decisions/outcomes.
Small models applied too-permissive filtering, saving items that should have
been skipped per the memory convention.

The root cause: the subagent lacked sufficient context to judge significance.
The primary agent has full session context and does not have this problem.

## Key Changes

### 1. Primary Agent Drives Memory Saves

The primary agent calls `remember()` at the end of significant work. It
already has full conversation history, knows what was decided, and can see
the existing memory in its system prompt (injected by the plugin).

**AGENTS.md update required:** Add explicit instructions for when and how to
call `remember()`. The agent needs guidance on:
- What counts as significant (decisions, preferences, outcomes, constraints)
- What to skip (implementation details, debugging steps, discussion without conclusion)
- When to call it (end of a significant task, not after every turn)

### 2. Memory Agent Becomes a Formatter

The memory agent no longer evaluates significance. It receives pre-evaluated
content from `remember()` and formats it into valid memory items.

**Removed:** `SKIP` output, significance rules, significance examples
**Kept:** 150-char limit, one-piece-per-item rule, output format

The agent always outputs bullet points. If the input is already well-formed,
it normalises and returns. If it's verbose, it condenses.

### 3. `remember()` Tool Signature Unchanged

The tool already exists and works. No changes to the plugin's file I/O,
locking, FIFO truncation, or validation/retry logic.

### 4. Remove `session.idle` Auto-Evaluation

The idle fallback that invoked the memory subagent with the last message pair
is removed. It was the source of low-quality saves and is no longer needed
when the primary agent drives saves explicitly.

**Rationale:** The idle fallback was a workaround for the primary agent not
self-flagging. With strong AGENTS.md instructions, the primary agent handles
this directly.

## Workflow

1. **System Prompt Injection:** Plugin injects Memory.md via
   `experimental.chat.system.transform` (unchanged)
2. **During Session:** Primary agent works normally, with full memory context
3. **At end of significant work:** Primary agent calls `remember(content)`
   with a concise description of what was decided/accomplished
4. **Plugin receives call:** Passes content to memory agent for formatting
5. **Memory Agent formats:** Normalises into bullet points, enforces 150-char limit
6. **Plugin writes:** Validates, retries if violations, appends to Memory.md,
   applies FIFO truncation, invalidates cache

## Files to Change

```
plugins/memory-manager.ts       # Remove session.idle auto-evaluation block
agents/memory/memory.md         # Rewrite: formatter only, remove significance logic
AGENTS.md                       # Add remember() usage instructions
```

## What Stays the Same

- File locking, FIFO truncation, 150-char validation, retry logic
- `experimental.chat.system.transform` injection
- Memory agent session isolation (oh-my-openagent pattern)
- Model fallback chain
- Explicit `remember()` tool for user-triggered saves (already works well)

## Risk

**Primary agent discipline.** If the agent doesn't call `remember()` reliably,
memory goes stale. Mitigated by clear AGENTS.md instructions and the fact that
the agent already has the tool available and memory context injected.

The idle fallback could be kept as a safety net but would need stronger
filtering to avoid re-introducing the noise problem. Recommended: remove it
initially, observe behaviour, re-add only if significant gaps appear.
