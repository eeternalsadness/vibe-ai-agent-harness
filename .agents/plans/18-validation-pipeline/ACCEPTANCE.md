# Acceptance Criteria: Plan 18 Validation Pipeline

Verification is programmatic unless a scenario is marked **[MANUAL]**.
Each scenario has a stable name that `TODO.md` tasks reference in their `Verify:` line.
This file is the source of truth for what the tests assert.

## Manifest Format

The manifest is `.agents/pipeline.yaml` at the repo root. Flat top-level stage
keys, each a mapping with a required `command` and an optional `working-dir` that
defaults to the repo root. Only `lint`, `build`, and `test` are configurable; the
two scans (`gitleaks`, `trivy`) are the runner's own standard commands and are not
declared in the manifest. A stage key absent from the file means that stage is
skipped.

```yaml
lint:
  command: bun run lint
build:
  command: bun run typecheck
test:
  command: bun test
  working-dir: .
```

Stage run order is fixed: lint → scans → build → test.

## Test Fixtures

Behavioral scenarios run the runner against fixtures — subfolder mini-repos, each
with its own `.agents/pipeline.yaml`. Fixtures mock every stage (scans included)
with a trivial command that records its stage name and a timestamp to a shared log
and exits 0 or 1. The runner lets tests substitute the scan commands with mocks so
the real `gitleaks`/`trivy` are never invoked. Tests assert on the log and on the
runner's own summary output, not on real tools.

## Runner Summary Output

The runner streams each stage command's own output through unchanged; its only
own output is the final summary:
- success — one line per stage in run order, `<stage>: passed` or
  `<stage>: skipped`, then a final `pipeline passed`; exit 0
- failure — stop at the first non-zero stage, print `pipeline failed at: <stage>`;
  exit non-zero

## Scenario: runner-rejects-malformed-manifest

Given a `.agents/pipeline.yaml` that is malformed
When the pipeline runner is invoked
Then the runner prints the defined error for that problem and exits non-zero without running any stage

Each malformed case and its exact error message:
- manifest file missing entirely → `manifest not found: .agents/pipeline.yaml`
- file is not valid YAML → `manifest is not valid YAML: <parser detail>`
- a stage omits the required `command` → `manifest stage '<stage>' is missing required key 'command'`
- a top-level key is not one of `lint`/`build`/`test` → `manifest has unknown stage '<key>'; allowed: lint, build, test`
- a stage value is not a mapping → `manifest stage '<stage>' must be a mapping`

Verification:
- For each case above, run the runner against a fixture in that state; assert non-zero exit, the error output equals the defined message (the `<...>` slot filled in), and that no stage mock left a marker in the run log

## Scenario: runner-runs-stages-fail-fast-order

Given a repo configured for lint, build, and test
When the pipeline runner is invoked
Then lint runs before the scans, the scans run before build, and build runs before test

Verification:
- Run the runner against a fixture whose stages each record their name and time to a log; assert lint precedes both scans, both scans precede build, and build precedes test

## Scenario: runner-fails-fast-on-first-failure

Given a repo whose stages are all mocked and exactly one stage fails
When the pipeline runner is invoked
Then it stops at the failing stage, prints `pipeline failed at: <stage>`, and exits non-zero, and no stage after the failing one runs

Verification:
- Run three fixtures, failing at lint (first), build (after the scans), and test (last) respectively; for each assert non-zero exit, output contains `pipeline failed at: <that stage>`, the stages before it left their markers, and the stages after it left no markers in the run log

## Scenario: runner-emits-success-summary

Given a repo whose every stage passes
When the pipeline runner is invoked
Then it exits zero and prints the success summary defined in Runner Summary Output

Verification:
- Run the runner against an all-passing fixture; assert exit code zero, one `<stage>: passed` line per configured stage in run order, and a final `pipeline passed` line

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
