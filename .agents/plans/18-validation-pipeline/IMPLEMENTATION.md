# Implementation: Plan 18 Validation Pipeline

Test-first ordering. Runner assumes `python3`, `gitleaks`, `trivy` on the machine.

## Task 1: Define the manifest format

The manifest is a YAML file at `.agents/pipeline.yaml` in the repo. Flat
top-level stage keys, each an object with a required `command` and an optional
`working-dir` (defaults to the repo root). Only `lint`, `build`, and `test` are
configurable; the scan stages are standard and owned by the runner. A stage key
absent from the file means that stage is skipped.

```yaml
# .agents/pipeline.yaml
lint:
  command: bun run lint
build:
  command: bun run typecheck
test:
  command: bun test
  working-dir: .
```

This shape is the contract the runner, the fixtures, and the tests all reference.

**Verify:** this-repo-conforms

## Task 2: Implement the pipeline runner and its tests

A Python script that reads `.agents/pipeline.yaml`, resolves each configured
stage's command and working-dir, and runs the stages fail-fast in the order:
lint → scans → build → test. The two scans (`gitleaks`, `trivy`) are standard
commands the runner owns; the two may run in parallel. A stage absent from the
manifest is skipped.

The runner is thin: each stage command's own output streams straight through to
the caller. The runner's only output is the final summary:
- success — one line per stage in run order, `<stage>: passed` or
  `<stage>: skipped`, then `pipeline passed`; exit 0
- failure — stop at the first non-zero stage and print `pipeline failed at:
  <stage>`; exit non-zero. The agent reads the streamed tool output above for why.

Write the tests alongside, since they depend on the runner's structure. They test
orchestration, not the real scan tools, so fixtures mock every stage (scans
included) with trivial commands that record their stage and time to a log and
exit 0 or 1; the runner lets tests substitute the scan commands with mocks.
Fixtures are subfolders acting as mini-repos. Cover:
- every stage passes → exit 0; summary lists each stage `passed` in order lint →
  scans → build → test; ends `pipeline passed`
- lint fails → exit non-zero; prints `pipeline failed at: lint`; the build/test/
  scan mocks left no markers in the log
- test fails with a diagnostic → exit non-zero; prints `pipeline failed at: test`;
  the diagnostic appears in the streamed output
- manifest omits lint → exit 0; summary shows `lint: skipped`

**Verify:** runner-runs-stages-fail-fast-order, runner-fails-fast-on-first-failure, runner-emits-failure-detail, runner-emits-success-summary, runner-skips-unconfigured-stage

## Task 3: Create the validating-work skill

Create a `validating-work` skill following the `evaluating-memory` pattern: a
`SKILL.md.ts` body plus the runner in its `scripts/` folder, rendered and
installed the same way. The body describes the workflow: run the pipeline to
self-verify the work, read the streamed tool output to fix anything that fails,
loop until the pipeline passes, and only then advance to the next task or hand
off. State plainly that a passing pipeline — not human approval — is the stop
signal, and that no human is in this loop.

**Verify:** pipeline-skill-defines-loop

## Task 4: Make the coder load the skill

Edit `src/global/agents/coder/coder.md.ts` so the coder loads `validating-work`
to self-verify its work before advancing or handing off, in both plan and ad-hoc
modes. Reconcile the existing per-task verification wording with the pipeline as
the stop signal.

**Verify:** coder-loads-pipeline-skill

## Task 5: Add this repo's manifest

Add `.agents/pipeline.yaml` declaring this repo's real lint, build, and test
commands. Confirm the runner exits 0 on a clean tree.

**Verify:** this-repo-conforms
