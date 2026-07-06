# Plan: Memory Plugin V3 - Automatic Capture

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

1. **Automatic capture** — memory is evaluated automatically without requiring explicit `remember()` calls
2. **Separation of concerns** — memory agent handles judgment (what to save) and formatting, primary agent only does work
3. **Sanitized context** — memory agent receives conversation content without noisy tool results
4. **Semantic dedup** — no duplicate items, evaluated against existing Memory.md content using LLM judgment, not string matching
5. **Consistent format** — items follow a tagged taxonomy for quick scanning (specific tags TBD)
6. **Defined signals** — certain events (research runs, decisions, preferences, completions) should always be captured
7. **Append-only writes** — Memory.md is append-only, no modifications to existing items
8. **Stable session memory** — each request in a session receives the same session-start memory block to maintain input caching efficiency
9. **Next-session freshness** — memory written during a session becomes available to future sessions

## Design Decisions

**Automatic evaluation via session.idle**
- Remove `remember()` tool entirely
- Use idle session activity as the automatic evaluation point
- Do not rely on `session.deleted`, which only fires on actual deletion
- Primary agent instructions simplified — no memory workflow

**Memory agent handles judgment**
- Shift responsibility from primary to memory agent
- Memory agent sees full sanitized conversation and decides what to save
- Clear separation of concerns

**Memory.md is the dedup source of truth (no temp file)**
- Temp file approach discarded — fragile across crashes and session resumption
- Memory.md content passed to the memory agent on every evaluation
- LLM judges whether new items are already represented (semantic, not string match)
- Survives crashes, session resume, concurrent access — no lifecycle management

**Conversation sanitization before evaluation**
- Tool results and other noisy execution details are stripped before evaluation
- User messages, assistant responses, and compact tool-use signals are retained
- Reduces noise while preserving enough context for memory judgment

**Tagged format for consistency**
- Items prefixed with a tag indicating type (specific tags TBD)
- Enables quick scanning when injected into system prompt
- Memory agent classifies every saved item

**Defined capture signals**
- Certain events should always trigger a memory capture: decisions, preferences, completions, research runs, constraints
- Memory agent gets explicit criteria for what constitutes each signal

**evaluating-memory skill as canonical reference**
- Documents the complete workflow: input format, tags, judgment criteria, dedup rules, output format
- Loadable by developers for inspection and debugging
- Not loaded by the memory agent itself — rules inlined in its instructions

**Memory agent owns writes**
- Memory agent decides whether anything should be saved
- Memory agent writes useful new items to Memory.md
- Primary agents do not trigger, judge, format, or write memory

**Session-start memory snapshot**
- Memory is captured once at session start
- The same memory block is injected into every request in that session
- This keeps session memory stable for input caching
- Memory written during a session becomes visible in the next session
- Snapshot stored per-session; cleaned up when session is deleted

**OpenCode-only**
- Cross-platform claim dropped. Claude Code has different hook API and doesn't benefit this workflow.

## Success Criteria

1. **Automatic capture** — multi-turn session with decisions/preferences produces memory items without user intervention
2. **Semantic dedup** — same decision mentioned across multiple turns within or across sessions appears only once
3. **Stable session memory** — one memory block is captured per session and reused for every request in that session
4. **Consistent format** — all items follow the tagged format
5. **Defined signals** — research runs, decisions, preferences, completions, and constraints are reliably captured
6. **Clean agent instructions** — no agent references `remember()`, no agent instructs memory workflow
7. **Next-session freshness** — memory written during one session is available to later sessions
