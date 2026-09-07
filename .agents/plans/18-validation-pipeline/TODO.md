# TODO: Plan 18 Validation Pipeline

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

Tests first, goal-driven. Write every test in the first section and confirm it
fails for the right reason before implementing anything in the second section.
Specs live in ACCEPTANCE.md — each test encodes the named scenario.

---

## Tests (write first, all red)

- [ ] **Task 1** — Write the test for runner-rejects-malformed-manifest
- [ ] **Task 2** — Write the test for runner-runs-stages-fail-fast-order
- [ ] **Task 3** — Write the test for runner-fails-fast-on-first-failure
- [ ] **Task 4** — Write the test for runner-emits-success-summary
- [ ] **Task 5** — Write the test for runner-skips-unconfigured-stage
- [ ] **Task 6** — Write the test for this-repo-conforms
- [ ] **Task 7** — Write the tests for pipeline-skill-defines-loop and coder-loads-pipeline-skill

## Implementation (make tests green)

- [ ] **Task 8** — Implement the pipeline runner
      Verify: runner-rejects-malformed-manifest, runner-runs-stages-fail-fast-order, runner-fails-fast-on-first-failure, runner-emits-success-summary, runner-skips-unconfigured-stage
- [ ] **Task 9** — Create the validating-work skill
      Verify: pipeline-skill-defines-loop
- [ ] **Task 10** — Make the coder load the skill
      Verify: coder-loads-pipeline-skill
- [ ] **Task 11** — Add this repo's manifest
      Verify: this-repo-conforms
