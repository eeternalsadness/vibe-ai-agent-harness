# Implementation: Memory Plugin V3

## Overview

Refactor memory system from explicit tool-based triggering to automatic hook-based evaluation. Memory agent evaluates full conversation on each turn, extracts new items, no user intervention required.

## Tasks

### 1. Update Memory Agent Instructions

**File:** `src/global/agents/memory/memory.md.ts`

**Changes:**
- Add instructions for receiving conversation transcript
- Add instructions for receiving already-saved items list
- Define output format: `SAVE:\n- item1\n- item2` or `SKIP`
- Add judgment criteria (what to save vs skip)
- Clarify memory agent is observing conversation, not participating

**Acceptance:**
- Memory agent instructions clearly explain transcript + list input format
- Output format is machine-parseable
- Judgment criteria matches existing memory guidelines

### 2. Remove remember() Tool from Plugin

**File:** `src/platforms/opencode/plugins/memory-manager.ts`

**Changes:**
- Remove `remember()` tool registration
- Remove tool handler function
- Keep only hook handlers and helper functions

**Acceptance:**
- `remember()` tool no longer exposed
- Plugin compiles without errors
- No references to removed tool in code

### 3. Implement session.idle Hook Handler

**File:** `src/platforms/opencode/plugins/memory-manager.ts`

**Changes:**
- Add `session.idle` hook handler
- Get session ID and conversation transcript
- Read or create temp file `/tmp/memory-session-{sessionId}.json`
- Invoke memory agent with transcript + saved items list
- Parse memory agent response
- Append new items to Memory.md (with file locking)
- Update temp file with new items

**Acceptance:**
- Hook fires after each turn
- Temp file created on first evaluation
- Memory agent receives correct inputs
- New items appended to Memory.md
- Temp file updated with new items
- File locking prevents concurrent write conflicts

### 4. Implement session.deleted Hook for Cleanup

**File:** `src/platforms/opencode/plugins/memory-manager.ts`

**Changes:**
- Add `session.deleted` hook handler
- Delete temp file `/tmp/memory-session-{sessionId}.json`

**Acceptance:**
- Temp file deleted when session ends
- No errors if temp file doesn't exist
- No orphaned temp files after normal session lifecycle

### 5. Update Global Instructions

**File:** `src/global/AGENTS.md.ts`

**Changes:**
- Remove memory workflow section
- Remove instructions about when to call `remember()`
- Remove common violations examples related to memory

**Acceptance:**
- No mention of `remember()` tool
- No memory-related workflow instructions
- Primary agent instructions focused only on work, not memory

### 6. Test Multi-Turn Session

**Manual verification:**
- Start session, have multi-turn conversation with decisions
- Verify Memory.md updated after each turn
- Verify no duplicate items appear
- Verify temp file exists during session
- End session, verify temp file deleted

**Acceptance:**
- Items automatically appear in Memory.md
- No duplicates within session
- Temp file cleanup works

### 7. Test Concurrent Sessions

**Manual verification:**
- Start two sessions in different directories
- Make different decisions in each
- Verify both write to Memory.md without conflicts
- Verify separate temp files created

**Acceptance:**
- Both sessions' items appear in Memory.md
- No file corruption
- Separate temp files per session

### 8. Update Documentation

**Files:** `README.md`, `AGENTS.md` (repo root)

**Changes:**
- Update memory system description (automatic vs explicit)
- Remove references to `remember()` tool
- Update workflow diagrams if needed

**Acceptance:**
- Documentation reflects new automatic memory system
- No outdated references to old workflow
