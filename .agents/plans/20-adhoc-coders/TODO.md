# TODO: Plan 20 Ad-hoc Coders, Follow-ups, and a Friendlier boy

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Setup

- [x] **Task 1** - ignore `.agents/DECISIONS.md` (test and fix together)
      Verify: decisions-gitignored
- [x] **Task 2** - scaffold the picker package, new Deps fields, client signature changes, and CLI flags

## Tests

- [x] **Task 3** - write the test for client-sends-opencode-requests
- [x] **Task 4** - write the test for adhoc-name-format
- [ ] **Task 5** - write the tests for start-creates-worktree, start-launches-coder, start-plan-from-anywhere, start-is-idempotent
- [x] **Task 6** - write the tests for adhoc-start-launches-coder and start-rejects-invalid-request
- [x] **Task 7** - write the tests for picker-starts-plan, picker-starts-adhoc, picker-rejects
- [x] **Task 8** - write the tests for prompt-idle-coder, prompt-running-coder, prompt-rejects-invalid-request
- [x] **Task 9** - write the tests for status-reports-fields and status-human-table
- [x] **Task 10** - write the test for output-format-flag
- [x] **Task 11** - write the tests for remove-refuses-unsafe, remove-adhoc-coder, remove-ignores-decisions-file
- [x] **Task 12** - write the test for coder-instructions

## Implementation

- [x] **Task 13** - update the HTTP client
      Verify: client-sends-opencode-requests
- [x] **Task 14** - implement ad-hoc naming
      Verify: adhoc-name-format
- [ ] **Task 15** - implement the new status entry and table
      Verify: status-reports-fields, status-human-table
- [ ] **Task 16** - start plans by path
      Verify: start-creates-worktree, start-launches-coder, start-plan-from-anywhere, start-is-idempotent
- [ ] **Task 17** - start ad-hoc coders
      Verify: adhoc-start-launches-coder, start-rejects-invalid-request
- [ ] **Task 18** - add the picker
      Verify: picker-starts-plan, picker-starts-adhoc, picker-rejects
- [ ] **Task 19** - implement prompt
      Verify: prompt-idle-coder, prompt-running-coder, prompt-rejects-invalid-request, output-format-flag
- [ ] **Task 20** - update remove
      Verify: remove-refuses-unsafe, remove-adhoc-coder, remove-ignores-decisions-file
- [ ] **Task 21** - update the coder agent's decision and commit rules
      Verify: coder-instructions
- [ ] **Task 22** - update the docs
- [ ] **Task 23** - live checks (human)
      Verify: live-adhoc-end-to-end, picker-in-terminal
