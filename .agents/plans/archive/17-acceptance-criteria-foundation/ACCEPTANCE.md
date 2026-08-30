# Acceptance Criteria: Plan 17 Acceptance Criteria Foundation

Verification is programmatic unless a scenario is marked **[MANUAL]**.
Each scenario has a stable name that `TODO.md` tasks reference in their `Verify:` line.
Programmatic verification renders the templates to a temp dir and checks the output.

## Scenario: planner-requires-acceptance-md

Given the planner template is rendered
When the rendered planner instructions are read
Then they state every plan must include an `ACCEPTANCE.md` file alongside `PLAN.md`

Verification:
- Render src/global, then confirm the rendered planner file contains an ACCEPTANCE.md requirement

## Scenario: planner-defines-acceptance-format

Given the rendered planner instructions
When they are read
Then they document `ACCEPTANCE.md` as named Given/When/Then scenarios, each with a Verification section and an Out of Scope section
And they state verification is a repeatable programmatic command by default
And they state manual-only criteria are marked distinctly

Verification:
- Render, then confirm the rendered planner file describes the ACCEPTANCE.md sections and the programmatic-by-default rule

## Scenario: planner-todo-verify-references

Given the rendered planner instructions
When they are read
Then they state each `TODO.md` task carries a `Verify:` line referencing an `ACCEPTANCE.md` scenario by name

Verification:
- Render, then confirm the rendered planner file describes the TODO `Verify:` reference convention

## Scenario: coder-reads-acceptance-and-self-verifies

Given the rendered coder instructions
When they are read
Then they state the coder reads `ACCEPTANCE.md` before implementing
And resolves each task's `Verify:` reference to a concrete test/command
And treats that verification passing as the definition of done, not diff approval

Verification:
- Render, then confirm the rendered coder file describes reading ACCEPTANCE.md and the verification-passes definition of done

## Scenario: reviewer-validates-tests-encode-criteria

Given the rendered reviewer instructions
When they are read
Then they include validating that tests/checks encode the referenced `ACCEPTANCE.md` scenarios
And state the author must not be the sole verifier

Verification:
- Render, then confirm the rendered reviewer file describes validating tests against acceptance criteria

## Scenario: render-succeeds

Given the full src/global tree
When render runs against a temp output dir
Then it completes without error and produces the planner, coder, and reviewer outputs

Verification:
- Run the render and confirm exit success and that the three files exist

## Out of Scope

- No check asserts the LLM actually follows the instructions. [MANUAL]
- Prose quality of the instructions is confirmed by review, not verified. [MANUAL]
- No task classes, validation pipeline, sandbox, or orchestrator behavior.
