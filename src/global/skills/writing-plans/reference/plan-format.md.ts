export default `# Plan Format

The format conventions for the files in a plan directory.

## Directory naming

\`<nn>-<slug>/\` - two-digit number (padded), followed by a hyphen and a short kebab-case slug describing the plan.

Examples: \`07-auth-refactor/\`, \`12-api-versioning/\`

## PLAN.md

High-level only. Sections:
- **Problem** - what is broken or missing and why it matters
- **Goals** - what success looks like
- **Design Decisions** - key choices and their rationale

No step-by-step implementation detail. That belongs in IMPLEMENTATION.md.

## ACCEPTANCE.md (required - every plan)

The machine-checkable definition of done. Without it, "done" means "a human approved the diff" - which no orchestrator can trust. Content:

- **Named Given/When/Then scenarios** - each scenario is a concrete, falsifiable acceptance test, not BDD prose. Give each a stable kebab-case name; TODO.md tasks reference scenarios by that name.
- **Verification section per scenario** - a repeatable programmatic command (a test, a script, a grep over rendered output), not an LLM judgment. Verification is programmatic **by default**.
- **Out of Scope section** - what these criteria deliberately do not cover.

Vagueness test: if you cannot write a failing test from a scenario, the scenario is too vague. Rewrite it until you can.

- **Edge cases.** Give each case its own line with its exact result; never join cases with "or". For every rule that accepts, rejects, or excludes something, list its boundary inputs: the excluded item itself, absent vs empty vs whitespace, relative vs absolute paths.

Criteria that genuinely cannot be verified programmatically are allowed only as the exception, never as an escape hatch: mark them **[MANUAL]** and state how a human confirms them. If a programmatic check exists, use it - do not mark it manual.

## IMPLEMENTATION.md (complex plans only)

Detailed task breakdown for the implementing agent. Numbered tasks, enough detail that an agent can execute without ambiguity. Reference \`ACCEPTANCE.md\` scenarios by name rather than restating their spec - that file is the sole source of truth for assertions and exact strings.

## TODO.md

Checklist only. One line per task. Matches the tasks in IMPLEMENTATION.md (or PLAN.md goals for simple plans). Updated by the implementing agent, not the planner.

**Each task carries at most one \`Verify:\` line**, naming one or more \`ACCEPTANCE.md\` scenarios. The reference resolves as the implementer writes the test - this is what lets the agent self-verify each task and advance without a human gate.

**For plans involving code, split each scenario into a test task and an implementation task** (see format below): the test task writes the failing test, has no \`Verify:\` line, and comes first; the implementation task makes it pass and carries the \`Verify:\` line.

**Documentation updates are not acceptance scenarios.** They are tasks without a \`Verify:\` line, checked in review.

Format:
\`\`\`
# TODO: <plan name>

Legend: \`[ ]\` pending · \`[x]\` done · \`[-]\` skipped

---

## Tests

- [ ] **Task 1** - write the test for <scenario name>
- [ ] **Task 2** - write the test for <scenario name>

## Implementation

- [ ] **Task 3** - description
      Verify: <scenario name>
- [ ] **Task 4** - description
      Verify: <scenario name>, <another scenario name>
\`\`\`

## Constraints

- Keep PLAN.md free of implementation detail.
- Keep TODO.md as a pure checklist - no prose.
`
