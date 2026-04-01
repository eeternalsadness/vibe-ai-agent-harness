# Plan: Coder Agent

## Problem

Currently, the planner agent creates structured plans (PLAN.md, IMPLEMENTATION.md, TODO.md), but there's no dedicated agent to execute those plans. Users must manually implement tasks or use the general-purpose primary agent, which isn't optimized for systematic plan execution.

**Why it matters:**
- Plans sit idle without a clear execution path
- No workflow for tracking task completion (updating TODO.md)
- Missing the "implement" half of the plan-implement cycle
- Ad-hoc changes by the primary agent bypass the planning discipline

## Goals

**Create a coder agent that:**
1. Executes plans created by the planner agent
2. Works sequentially through TODO.md, marking tasks complete as it progresses
3. Follows detailed instructions from IMPLEMENTATION.md (if exists) or PLAN.md goals
4. Searches both project-local (`.agents/plans/`) and global (`~/vibe-context/plans/`) plan directories
5. Delegates to @research when uncertain (no direct KB access)
6. Requires user approval between tasks (via TODO.md edit approval)
7. Evaluates whether to call `remember()` based on significance (not automatically after every task)

**Success looks like:**
- User says "implement plan 03-repo-restructure" → agent finds the plan, reads TODO.md/IMPLEMENTATION.md, executes tasks one by one
- Agent auto-detects which tasks are already complete and continues from where it left off
- Clear handoff between planner (creates plan) and coder (executes plan)

## Design Decisions

**Primary agent, not subagent**
- User can invoke @coder directly for plan execution
- More flexible than forcing planner → coder handoff
- Still disciplined: scope limited to executing formal plans only

**Sequential execution with approval gates**
- Agent executes one task at a time
- Updates TODO.md after each task
- Waits for user approval of TODO.md edit before proceeding
- Prevents runaway execution, maintains control

**Plan-only scope (no ad-hoc coding)**
- Coder agent only works with formal plans (PLAN.md + TODO.md ± IMPLEMENTATION.md)
- Ad-hoc code changes handled by primary agent (build agent)
- Forces planning discipline for complex work

**Smart plan discovery**
- Agent searches both `.agents/plans/` and `~/vibe-context/plans/`
- Matches user intent ("implement repo restructure") to plan directory names
- Asks for clarification if ambiguous (multiple matches or no match)

**Delegate uncertainty to @research**
- No direct knowledge base access
- When unsure about patterns, architecture, or implementation details → delegate to @research
- Falls back to asking user if research doesn't resolve it

**Same model/temperature as primary**
- Uses same model configuration as primary agent (claude-sonnet-4.5 in default profile)
- Consistency in reasoning capability and cost profile

**Testing deferred**
- No test verification in initial version (noted as high-priority future work)
- User currently lacks resources to properly instruct the agent on testing best practices

## Implementation

1. **Add coder to config.ts profiles** — both `default` and `personal` profiles get a `coder` key pointing to the same model as `primary`

2. **Create coder agent file** — `src/global/agents/coder/coder.md.ts` following the established pattern (imports Profile type, exports function returning frontmatter + instructions)

3. **Write agent instructions** including:
   - Personality: pragmatic, follows specs from plan files
   - Workflow: search plans → read TODO/IMPLEMENTATION → execute sequentially → update TODO → wait for approval → next task
   - Plan discovery logic (both directories)
   - Delegation to @research for unknowns
   - Memory evaluation (not automatic)
   - Constraints (plans only, no ad-hoc coding)

The render.ts script will auto-discover the new `.md.ts` file and include it in the build.
