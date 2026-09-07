# Acceptance Criteria: Plan 18 Validation Pipeline

Verification is programmatic unless a scenario is marked **[MANUAL]**.
Each scenario has a stable name that `TODO.md` tasks reference in their `Verify:` line.

## Scenario: runner-runs-stages-fail-fast-order

Given a repo configured for lint, build, and test
When the pipeline runner is invoked
Then lint runs before the scans, the scans run before build, and build runs before test

Verification:
- Run the runner against a fixture whose stages each record their name and time to a log; assert lint precedes both scans, both scans precede build, and build precedes test

## Scenario: runner-fails-fast-on-first-failure

Given a repo whose lint stage fails
When the pipeline runner is invoked
Then it stops without running the later stages and exits non-zero

Verification:
- Run the runner against a fixture where lint fails; assert non-zero exit and that the later stages left no markers in the run log

## Scenario: runner-emits-failure-detail

Given a repo whose test stage fails and prints diagnostic output
When the pipeline runner is invoked
Then its output includes the failing stage's name and the failing command's output

Verification:
- Run the runner against a failing fixture; assert output contains the failing stage name and the command's emitted diagnostic string

## Scenario: runner-emits-success-summary

Given a repo whose every stage passes
When the pipeline runner is invoked
Then it exits zero and prints a summary of the stages that ran

Verification:
- Run the runner against an all-passing fixture; assert exit code zero and that output lists each stage that ran

## Scenario: runner-skips-unconfigured-stage

Given a repo that does not configure the lint stage
When the pipeline runner is invoked
Then lint is skipped and noted, and this does not fail the run

Verification:
- Run the runner against a fixture with no lint configured; assert exit code zero and that the summary marks lint as skipped

## Scenario: this-repo-conforms

Given this repo's committed pipeline configuration
When the pipeline runner is invoked at this repo's root
Then it runs this repo's real stages and exits zero on a clean tree

Verification:
- Run the runner at the harness repo root; assert exit code zero

## Scenario: pipeline-skill-defines-loop

Given the rendered validating-work skill
When its instructions are read
Then they describe running the pipeline to self-verify, looping until it is green before advancing or handing off, and that a green pipeline (not human approval) is the stop signal
And they point at the installed runner script

Verification:
- Render src/global, then confirm the rendered skill file describes the run-verify-loop-until-green workflow and references the runner script path

## Scenario: coder-loads-pipeline-skill

Given the rendered coder instructions
When they are read
Then they instruct the coder to load the validating-work skill to self-verify its work before advancing or handing off

Verification:
- Render src/global, then confirm the rendered coder file triggers loading the validating-work skill

## Out of Scope

- No check asserts the LLM actually runs the pipeline as instructed. [MANUAL]
- Grouping test results by acceptance scenario; the pipeline emits raw output
  only. A later piece has an agent form the scenario-grouped report.
- Reviewer consumption of the pipeline output and the reviewer report shape.
- Choice of specific secret/vuln scanning tools.
