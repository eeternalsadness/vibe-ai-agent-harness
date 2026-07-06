# Plan: Planner Agent

## Problem

There is no dedicated agent for creating structured plans. Planning is currently ad-hoc, relying on the primary agent's general capabilities. A dedicated planner agent with strong reasoning, a defined workflow, and a consistent file structure would make planning more reliable and reusable.

## Goals

- Add a `planner` primary agent to the harness
- Define a clear planning workflow: requirements gathering, scope/complexity determination, file creation, and user review
- Support two plan scopes: project (`.agents/plans/`) and global (`~/Repo/vibe-coding/vibe-context/plans/`)
- Support two plan sizes: PLAN.md + TODO.md (simple) or all three files including IMPLEMENTATION.md (complex)

## Design Decisions

- **Agent type:** Primary agent (`mode: primary`), switchable via Tab
- **Model:** Claude Sonnet minimum; Opus preferred for stronger reasoning
- **Permissions:** Deferred — interactive mode with per-write approval is sufficient for now
- **Numbering:** Auto-determined at file-creation time by reading existing directories in the target location
- **Scope:** Always user-declared (project vs global)
- **Complexity:** Planner judges whether IMPLEMENTATION.md is needed; user can override

## File Structure

### Project scope
```
.agents/plans/<nn>-<slug>/
├── PLAN.md           # High-level: problem, goals, design decisions (no implementation detail)
├── IMPLEMENTATION.md # Step-by-step breakdown (complex tasks only)
└── TODO.md           # Checklist tracking implementation progress
```

### Global scope
```
~/Repo/vibe-coding/vibe-context/plans/<nn>-<slug>/
├── PLAN.md
├── IMPLEMENTATION.md # (complex tasks only)
└── TODO.md
```

## Planner Workflow

1. **Requirements** - Hash out what the user wants; ask clarifying questions
2. **Scope** - User declares project or global
3. **Complexity** - Planner proposes whether to include IMPLEMENTATION.md; user can disagree
4. **Write files** - Auto-number, create directory, write files
5. **Review** - Discuss with user and reach consensus; update files if needed

## File Conventions

**PLAN.md** - High-level. Problem, goals, design decisions. No step-by-step detail.

**IMPLEMENTATION.md** - Detailed task breakdown for complex plans. Guides the implementing agent. Numbered tasks with clear acceptance criteria.

**TODO.md** - Checklist only. One line per task, matches IMPLEMENTATION.md tasks. Updated by the implementing agent, not the planner.

## Source File

`src/global/agents/planner/planner.md.ts` — follows the same template pattern as other agents.
