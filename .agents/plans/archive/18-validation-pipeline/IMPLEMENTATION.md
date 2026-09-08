# Implementation: Plan 18 Validation Pipeline

Test-first. Write every test in Tasks 1–7 and confirm each fails for the right
reason before implementing anything. The tests lock in the shape; the
implementation tasks make them green, one scenario per task.

The runner is an importable Python module with a function per stage (`run_lint`,
`run_gitleaks`, `run_trivy`, `run_build`, `run_test`, or a generic `run_stage`),
so tests mock stages in-process and the real scanners never run in unit tests. It
lives at its final destination from the start — inside the `validating-work`
skill's `scripts/` folder — and is installed via the render pipeline, following
the `evaluating-memory` skill+script pattern. See ACCEPTANCE.md (Manifest Format,
Runner Design, Runner Summary Output, and the scenarios) for the full spec.

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

## Task 7: Write the test for pipeline-skill-defines-loop

Write the failing test encoding the `pipeline-skill-defines-loop` scenario. Red
until the skill exists.

## Task 8: Write the test for coder-loads-pipeline-skill

Write the failing test encoding the `coder-loads-pipeline-skill` scenario. Red
until the coder loads the skill.

## Task 9: Implement manifest validation

Locate `.agents/pipeline.yaml`, parse it, and reject each malformed case with its
defined error message and a non-zero exit before any stage runs.

**Verify:** runner-rejects-malformed-manifest

## Task 10: Implement stage execution in fixed order

Run the stages in the fixed order `lint → gitleaks → trivy → build → test`, each
in its `working-dir` (repo root by default), streaming each stage command's output
straight through. The two scans are runner-owned functions, not manifest-declared,
and run sequentially.

**Verify:** runner-runs-stages-fail-fast-order

## Task 11: Implement fail-fast and failure summary

Stop at the first non-zero stage, print `pipeline failed at: <stage>`, exit
non-zero, and run no later stage.

**Verify:** runner-fails-fast-on-first-failure

## Task 12: Implement the success summary

On all stages passing, print one `<stage>: passed` line per stage in run order
(including both scans) and a final `pipeline passed`, exit zero.

**Verify:** runner-emits-success-summary

## Task 13: Implement skip handling

Skip a configurable stage absent from the manifest: do not call its function, mark
it `skipped` in the summary, do not fail the run. Scans always run and are never
skipped.

**Verify:** runner-skips-unconfigured-stage

## Task 14: Create the validating-work skill

Create a `validating-work` skill following the `evaluating-memory` pattern: a
`SKILL.md.ts` body wrapping the runner already living in its `scripts/` folder,
rendered and installed the same way. The body describes the workflow: run the
pipeline to self-verify the work, read the streamed tool output to fix anything
that fails, loop until the pipeline passes, and only then advance to the next task
or hand off. State plainly that a passing pipeline — not human approval — is the
stop signal, and that no human is in this loop. Point at the installed runner
script.

**Verify:** pipeline-skill-defines-loop

## Task 15: Make the coder load the skill

Edit `src/global/agents/coder/coder.md.ts` so the coder loads `validating-work`
to self-verify its work before advancing or handing off, in both plan and ad-hoc
modes. Reconcile the existing per-task verification wording with the pipeline as
the stop signal.

**Verify:** coder-loads-pipeline-skill

## Task 16: Add this repo's manifest

Add `.agents/pipeline.yaml` declaring this repo's real lint, build, and test
commands. Confirm the runner runs the real stages (including gitleaks and trivy)
and exits zero on a clean tree.

**Verify:** this-repo-conforms
