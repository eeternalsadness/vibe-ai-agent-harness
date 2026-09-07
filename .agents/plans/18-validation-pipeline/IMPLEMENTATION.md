# Implementation: Plan 18 Validation Pipeline

## Task 1: Write the test for runner-rejects-malformed-manifest

Write the failing test encoding the `runner-rejects-malformed-manifest` scenario.
Red until the runner validates the manifest.

## Task 2: Write the test for runner-runs-stages-fail-fast-order

Write the failing test encoding the `runner-runs-stages-fail-fast-order`
scenario. Red until the runner exists.

## Task 3: Write the test for runner-fails-fast-on-first-failure

Write the failing test encoding the `runner-fails-fast-on-first-failure`
scenario. Red until the runner exists.

## Task 4: Write the test for runner-emits-success-summary

Write the failing test encoding the `runner-emits-success-summary` scenario. Red
until the runner exists.

## Task 5: Write the test for runner-skips-unconfigured-stage

Write the failing test encoding the `runner-skips-unconfigured-stage` scenario.
Red until the runner exists.

## Task 6: Write the test for this-repo-conforms

Write the failing test encoding the `this-repo-conforms` scenario. Red until the
runner and this repo's manifest exist.

## Task 7: Write the tests for pipeline-skill-defines-loop and coder-loads-pipeline-skill

Write the failing tests encoding the `pipeline-skill-defines-loop` and
`coder-loads-pipeline-skill` scenarios. Red until the skill exists and the coder
loads it.

## Task 8: Implement the pipeline runner

A Python script that reads and validates `.agents/pipeline.yaml`, then runs the
stages fail-fast in order lint → scans → build → test, per the Manifest Format,
Runner Summary Output, and scenario specs in ACCEPTANCE.md. Design:
- Ships inside the `validating-work` skill's `scripts/` folder and is installed
  via the render pipeline, following the `evaluating-memory` skill+script pattern.
- The two scans (`gitleaks`, `trivy`) are runner-owned, not declared in the
  manifest, and run in parallel with each other.
- Each stage command runs in its `working-dir` (repo root by default) with its
  output streamed straight through; the runner's only own output is the summary.
- Scan commands are injectable so tests substitute mocks and the real scanners
  never run.

Implement until Tasks 1–5 pass.

**Verify:** runner-rejects-malformed-manifest, runner-runs-stages-fail-fast-order, runner-fails-fast-on-first-failure, runner-emits-success-summary, runner-skips-unconfigured-stage

## Task 9: Create the validating-work skill

Create a `validating-work` skill following the `evaluating-memory` pattern: a
`SKILL.md.ts` body plus the runner in its `scripts/` folder, rendered and
installed the same way. The body describes the workflow: run the pipeline to
self-verify the work, read the streamed tool output to fix anything that fails,
loop until the pipeline passes, and only then advance to the next task or hand
off. State plainly that a passing pipeline — not human approval — is the stop
signal, and that no human is in this loop.

**Verify:** pipeline-skill-defines-loop

## Task 10: Make the coder load the skill

Edit `src/global/agents/coder/coder.md.ts` so the coder loads `validating-work`
to self-verify its work before advancing or handing off, in both plan and ad-hoc
modes. Reconcile the existing per-task verification wording with the pipeline as
the stop signal.

**Verify:** coder-loads-pipeline-skill

## Task 11: Add this repo's manifest

Add `.agents/pipeline.yaml` declaring this repo's real lint, build, and test
commands. Confirm the runner exits 0 on a clean tree.

**Verify:** this-repo-conforms
