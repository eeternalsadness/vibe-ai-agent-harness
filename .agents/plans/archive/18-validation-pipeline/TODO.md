# TODO: Plan 18 Validation Pipeline

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

Tests first, goal-driven. Write every test in the first section and confirm it
fails for the right reason before implementing anything in the second section.
Specs live in ACCEPTANCE.md — each test encodes the named scenario.

---

## Tests (write first, all red)

- [x] **Task 1** — Write the test for runner-rejects-malformed-manifest
- [x] **Task 2** — Write the test for runner-runs-stages-fail-fast-order
- [x] **Task 3** — Write the test for runner-fails-fast-on-first-failure
- [x] **Task 4** — Write the test for runner-emits-success-summary
- [x] **Task 5** — Write the test for runner-skips-unconfigured-stage
- [x] **Task 6** — Write the test for this-repo-conforms
- [x] **Task 7** — Write the test for pipeline-skill-defines-loop
- [x] **Task 8** — Write the test for coder-loads-pipeline-skill

## Implementation (make tests green)

- [x] **Task 9** — Implement manifest validation
      Verify: runner-rejects-malformed-manifest
- [x] **Task 10** — Implement stage execution in fixed order
      Verify: runner-runs-stages-fail-fast-order
- [x] **Task 11** — Implement fail-fast and failure summary
      Verify: runner-fails-fast-on-first-failure
- [x] **Task 12** — Implement the success summary
      Verify: runner-emits-success-summary
- [x] **Task 13** — Implement skip handling
      Verify: runner-skips-unconfigured-stage
- [x] **Task 14** — Create the validating-work skill
      Verify: pipeline-skill-defines-loop
- [x] **Task 15** — Make the coder load the skill
      Verify: coder-loads-pipeline-skill
- [x] **Task 16** — Add this repo's manifest
      Verify: this-repo-conforms
