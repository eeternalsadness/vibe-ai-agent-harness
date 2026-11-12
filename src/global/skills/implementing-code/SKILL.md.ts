import { config } from "../../../../config"

export default `---
name: implementing-code
description: Use before any coding work - executing a plan task by task or implementing a direct coding request. Defines the plan and ad-hoc workflows, research and context, code quality standards, and TODO.md update rules.
---

# Implementing Code

## Workflow - Plan Mode

Follow these steps when executing a plan:

1. **Find the plan** - If the user specifies a plan (e.g., "implement plan 07-coder-agent" or "implement the coder agent plan"), search for it in both:
   - Project plans: \`.agents/plans/\`
   - Global plans: \`${config.repoPath}/vibe-coding/vibe-context/plans/\`

   Match the user's intent to directory names. If multiple plans match, pick the closest and record the choice as described in Working Unattended. If nothing matches, there is nothing to work on: say so in your final message.

2. **Read plan files** - Load TODO.md to see task status. Load IMPLEMENTATION.md (if it exists) or PLAN.md (for simple plans) to understand what needs to be done. **Load ACCEPTANCE.md** - it holds the named Given/When/Then scenarios that define done. Auto-detect which tasks are already complete (marked \`[x]\` in TODO.md) and continue from where work left off.

3. **Research** - Before implementing, load the \`researching-knowledge\` skill for anything you are not absolutely certain about:
   - Best practices for the language/technology you'll be working with
   - Existing patterns or conventions in the codebase
   - Architecture context relevant to the task
   - Any constraints or prior decisions that affect implementation

   Do this research upfront, before writing code. Do not guess or invent approaches.

4. **Execute next task** - Implement the next incomplete task. Follow the specification from IMPLEMENTATION.md or PLAN.md goals, and apply the best practices gathered during research. If you're uncertain about patterns, architecture, or implementation details, resolve it as described in Working Unattended.

   **Resolve the task's \`Verify:\` reference** - each TODO.md task carries a \`Verify:\` line naming an ACCEPTANCE.md scenario. Resolve that reference to a concrete test or command (write it if it doesn't exist yet), write the test from the scenario **before** implementing (see Tests Are Required, Written First below), and confirm it fails for the right reason, then implement. Make changes atomically - one small, focused edit at a time using the Edit tool. Each edit should be reviewable on its own.

5. **Self-verify with the pipeline.** Load the \`validating-work\` skill and run the standard validation pipeline. Read what it reports, fix anything that fails - including the scenario's own test - and loop, rerunning the pipeline, until it is green. **Done means the pipeline passes**, not that the diff looks right: a green pipeline, not human approval, is the stop signal, in normal and delegated flows alike. Only once it passes do you consider the task done and proceed to step 6.

6. **Mark complete and commit** - After completing a task, mark it \`[x]\` in TODO.md using the Edit tool, then commit the task's changes, TODO.md included, with a message naming the task. Never push. Then proceed to the next task automatically without waiting for further instruction.

7. **Repeat** - If more tasks remain and the user wants to continue, execute the next task (step 3).

## Workflow - Ad-hoc Mode

Follow these steps for direct coding requests:

1. **Clarify** - If the request is ambiguous or underspecified, resolve it as described in Working Unattended, and state your assumptions about scope and approach.

2. **Research** - Load the \`researching-knowledge\` skill for anything you are not absolutely certain about:
   - Best practices for the language/technology involved
   - Existing patterns or conventions in the codebase
   - Architecture context relevant to the request
   - Whether similar code already exists

   Do this before writing code. Do not guess or invent approaches.

3. **Implement** - If the request involves code, write its tests first (see Tests Are Required, Written First below), confirm they fail for the right reason, then write the code per the user's instructions and the best practices gathered. Follow all code quality standards below.

4. **Self-verify with the pipeline.** Load the \`validating-work\` skill and run the standard validation pipeline. Fix anything it reports and loop until it is green. A passing pipeline - not human approval - is the stop signal before you consider the request done.

5. **Commit** - Once the pipeline is green, commit the change with a message describing it. Never push. Then you are done.

## Research and Context

When you're uncertain about:
- Existing patterns or conventions
- How the proposed change fits into the architecture
- Implementation approaches for unfamiliar territory
- Whether similar code exists in the codebase

**Load the \`researching-knowledge\` skill.** Do not guess or invent patterns. Ground your implementation in what actually exists. If research doesn't resolve it, decide as described in Working Unattended.

## Code Quality Standards

Follow these standards for all code you write:

### Tests Are Required, Written First

**Write tests before implementation.** Tests define the target shape and goal of the change - confirm they fail for the right reason against the current code, then implement until they pass. Do not write implementation first and backfill tests afterward.

Tests should:
- Focus on desired outcomes, not implementation details
- Verify the code does what it's supposed to do
- Cover the important behavior, not every code branch
- Test the "happy path" and key error conditions
- Skip testing trivial or purely mechanical code paths

Do not aim for 100% coverage. Aim for confidence that the code works as intended.

### Make Focused, Incremental Changes

**Break work into small, related changes.** When implementing a task:
- Group related changes together (e.g., add function + its tests)
- Don't make sweeping changes across multiple unrelated files
- If a task requires touching many files, break it into subtasks
- Each change should be reviewable and understandable on its own
- Don't improve adjacent code, comments, or formatting that isn't part of the task
- Remove imports/variables/functions that your changes made unused - but leave pre-existing dead code alone unless asked

### Write Clean, Maintainable Code

- Follow established patterns and conventions in the codebase
- Use descriptive names for variables, functions, and types
- Keep functions focused and single-purpose
- Add comments only when the "why" isn't obvious from code
- Prefer clarity over cleverness
- Apply language-specific best practices gathered during research

## Task Status Format

The TODO.md format (legend and task lines) is defined in \`writing-plans/reference/plan-format.md\`.

When updating TODO.md:
- Change \`[ ]\` to \`[x]\` for completed tasks
- Use \`[-]\` only if a task cannot be done or the plan allows skipping it, and record why in \`.agents/DECISIONS.md\`
- Keep the legend and structure intact
`
