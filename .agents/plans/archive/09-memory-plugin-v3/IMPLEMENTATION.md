# Implementation: Memory Plugin V3

## Overview

Refactor memory system from explicit tool-based triggering to automatic hook-based evaluation. Memory agent evaluates sanitized full conversation against existing Memory.md on each turn, extracts new tagged items, no user intervention required.

## Tasks

### 1. Update Memory Agent Instructions

**File:** `src/global/agents/memory/memory.md.ts`

**Changes:**
- Document input format: sanitized conversation (tool noise stripped) + existing Memory.md content
- Define output format: `SAVE:\n- items` or `SKIP`
- Add capture signals: decisions, preferences, completions, research runs, constraints (exact tags TBD)
- Add semantic dedup instructions: compare against existing Memory.md content, don't re-save
- Clarify memory agent is observing conversation, not participating
- Increase item limit awareness (100 max)

**Acceptance:**
- Memory agent instructions clearly explain sanitized transcript + Memory.md input format
- Output format is machine-parseable
- Judgment criteria defines specific capture signals
- Dedup instructions are explicit about semantic comparison

### 2. Rewrite Plugin: Remove remember(), Add session.idle

**File:** `src/platforms/opencode/plugins/memory-manager.ts`

**Changes:**
- Remove `remember()` tool registration and handler
- Add `session.idle` hook handler
- Implement conversation sanitization: strip tool results, keep user text + assistant text + tool call signals
- Read Memory.md content and pass to memory agent (no temp file)
- Invoke memory agent with sanitized conversation + Memory.md content
- Memory agent writes directly to Memory.md (no SAVE/SKIP parsing in plugin)
- Capture memory snapshot at session start, inject same snapshot into every LLM request within that session
- Increase MAX_ITEMS from 50 to 100
- Keep memory agent session tracking for hook recursion prevention
- Dual-trigger: turn interval (10 turns) or idle timeout (5 min), whichever comes first

**Acceptance:**
- `remember()` tool no longer exposed
- Hook fires on `session.idle` events
- Memory agent receives sanitized conversation + current Memory.md
- Memory agent writes new items directly to Memory.md
- No temp file created
- Each session receives the same memory block on every request (captured at session start)
- Plugin compiles without errors
- Debug logs show: snapshot capture, evaluation trigger, transcript shape, memory agent result

### 3. Remove remember() from Agent Instructions

**Files:**
- `src/global/agents/yapper/yapper.md.ts` — remove memory workflow step and Memory section
- `src/global/agents/coder/coder.md.ts` — remove remember evaluation steps
- `src/global/agents/curator/curator.md.ts` — remove `remember: allow` permission
- `src/global/skills/enriching-knowledge-base/SKILL.md.ts` — remove step 4 remember() call (research signals captured automatically)

**Changes:**
- Remove all references to `remember()` tool
- Remove memory workflow instructions from agents
- Yapper: replace explicit "call remember() after every response" with "memory is automatic"
- Coder: remove "evaluate memory" decision step from both plan and ad-hoc mode
- Curator: drop remember permission (tool will be gone)
- Enriching skill: remove the report-and-remember step (auto-capture handles it)

**Acceptance:**
- No agent instructions reference `remember()` tool
- Yapper no longer instructs explicit memory calls
- Coder no longer has memory evaluation steps
- Curator permissions don't include remember
- Enriching-knowledge-base skill doesn't call remember()

### 4. Create evaluating-memory Skill

**File:** `src/global/skills/evaluating-memory/SKILL.md.ts`

**Changes:**
- Create new skill document as canonical reference for the memory workflow
- Document: input format (sanitized conversation + Memory.md), capture signals, output format, dedup rules
- Keep tag taxonomy high-level and extensible (exact tags TBD)

**Acceptance:**
- Skill exists at the expected path
- Documents the complete memory evaluation workflow
- Loadable by developers for inspection

### 5. Update Documentation

**File:** `README.md` (repo root)

**Changes:**
- Update memory system description from explicit to automatic
- Remove references to `remember()` tool
- Note OpenCode-only requirement

**Acceptance:**
- Documentation reflects new automatic memory system
- No outdated references to old workflow

### 6. Manual Verification

**Process:**
- Install and run a session with multi-turn conversation involving decisions and research
- Review Memory.md after several turns — check for correct captures, no duplicates, consistent format
- End session, start a new one on the same topic — verify no cross-session duplicates
- Adjust memory agent instructions based on observed output quality

**Acceptance:**
- Items appear automatically in Memory.md
- No duplicates within or across sessions
- Format is consistent across items
- Capture signals fire reliably (decisions, preferences, completions, research, constraints)
