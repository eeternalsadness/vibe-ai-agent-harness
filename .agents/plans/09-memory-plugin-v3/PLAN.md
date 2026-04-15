# Plan: Memory Plugin V3 - Session-Scoped Auto-Capture

## Problem

The current memory system requires the primary agent to explicitly call `remember()` after each response. This design has reliability issues — the agent sometimes forgets to call `remember()`, causing significant decisions, preferences, and outcomes to be lost.

**Current workflow (v2):**
1. Primary agent completes work
2. Primary agent judges what should be remembered
3. Primary agent calls `remember()` tool with content
4. Memory plugin spawns memory agent to format
5. Formatted items appended to Memory.md

**Issues with current approach:**
- **Unreliable** — agent forgets to call `remember()`, memory gaps occur
- **Coupled** — primary agent handles both judgment and triggering (mixed concerns)
- **Manual** — requires discipline from primary agent (cognitive load)
- **Inconsistent** — memory capture depends on agent behavior, not guaranteed

The root cause: the primary agent is responsible for both doing work AND remembering to save memory. When focused on complex tasks, memory calls get dropped.

## Goals

1. **Automatic capture** — memory saved on every turn without requiring explicit `remember()` calls
2. **Separation of concerns** — memory agent handles judgment (what to save) and formatting, primary agent only does work
3. **Full context** — memory agent sees entire conversation, can extract meaningful items with proper context
4. **No duplication** — items extracted once per session, not re-saved on subsequent turns
5. **Append-only writes** — Memory.md is append-only, no modifications to existing items
6. **Multi-session safe** — multiple concurrent sessions can write without conflicts

## Design Decisions

**Automatic trigger via session.idle hook**
- Remove `remember()` tool
- Hook fires after each turn, guarantees evaluation
- Primary agent instructions simplified

**Memory agent handles judgment**
- Shift responsibility from primary to memory agent
- Memory agent sees full conversation and decides what to save
- Clear separation of concerns

**Session-scoped deduplication via temp file**
- Track saved items in `/tmp/memory-session-{sessionId}.json`
- Pass list to memory agent on each evaluation
- Works for both OpenCode and Claude Code (cross-platform)
- Deleted on session end

**Append-only writes**
- Write to Memory.md immediately (not buffered)
- Multi-session safe, no read-modify-write races
- Survives crashes

**One-shot memory agent invocation**
- Single agent call per evaluation (not persistent session)
- Pass conversation + already-saved items, get new items
- Full transcript necessary for quality (last turn only lacked context)

## Success Criteria

1. **Automatic capture** — multi-turn session with decisions/preferences produces memory items without user intervention
2. **No duplication within session** — same decision mentioned across multiple turns appears only once
3. **Multi-session safety** — concurrent sessions write to Memory.md without conflicts
4. **Quality maintained** — memory items remain meaningful and contextual
5. **Simplified primary agent** — global instructions no longer include memory workflow
6. **Temp file cleanup** — session temp files deleted on session end
7. **Cross-platform compatible** — implementation works for both OpenCode and Claude Code

