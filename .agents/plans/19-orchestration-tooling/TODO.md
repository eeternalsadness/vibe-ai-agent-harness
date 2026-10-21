# TODO: Plan 19 Orchestration Tooling

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Setup

- [x] **Task 1** - scaffold `boy/` (module, cobra commands, Client interface, fake, test helpers)

## Tests

- [x] **Task 2** - write the test for client-sends-opencode-requests
- [x] **Task 3** - write the test for config-resolves-server
- [x] **Task 4** - write the test for start-creates-worktree
- [x] **Task 5** - write the test for start-launches-coder
- [x] **Task 6** - write the test for start-from-other-dir
- [x] **Task 7** - write the test for start-rejects-invalid-request
- [x] **Task 8** - write the test for start-is-idempotent
- [x] **Task 9** - write the test for status-lists-repo
- [x] **Task 10** - write the test for status-lists-all
- [x] **Task 11** - write the test for status-scoped-to-session
- [x] **Task 12** - write the test for status-reports-fields
- [x] **Task 13** - write the test for status-ignores-non-coder-sessions
- [x] **Task 14** - write the test for status-rejects-invalid-request
- [x] **Task 15** - write the test for remove-merged-coder
- [x] **Task 16** - write the test for remove-refuses-unsafe
- [x] **Task 17** - write the test for remove-force
- [x] **Task 18** - write the test for coder-never-asks
- [x] **Task 19** - write the test for coder-instructions
- [x] **Task 20** - write the test for worktrees-gitignored
- [x] **Task 21** - write the test for main-pipeline-ignores-worktrees
- [x] **Task 22** - write the test for runner-skips-worktrees
- [x] **Task 23** - write the test for gitleaks-scans-current-branch
- [x] **Task 24** - write the test for pipeline-covers-boy

## Implementation

- [x] **Task 25** - implement the HTTP client
      Verify: client-sends-opencode-requests
- [x] **Task 26** - implement server discovery and login
      Verify: config-resolves-server
- [x] **Task 27** - implement start
      Verify: start-creates-worktree, start-launches-coder, start-from-other-dir, start-rejects-invalid-request, start-is-idempotent, coder-never-asks
- [x] **Task 28** - implement status
      Verify: status-lists-repo, status-lists-all, status-scoped-to-session, status-reports-fields, status-ignores-non-coder-sessions, status-rejects-invalid-request
- [x] **Task 29** - implement remove
      Verify: remove-merged-coder, remove-refuses-unsafe, remove-force
- [x] **Task 30** - add the unattended rules to the coder agent
      Verify: coder-instructions
- [x] **Task 31** - keep this repo's checks out of worktrees
      Verify: worktrees-gitignored, main-pipeline-ignores-worktrees
- [x] **Task 32** - make the runner's trivy stage skip worktrees
      Verify: runner-skips-worktrees
- [x] **Task 33** - make the runner's gitleaks stage scan only the current branch
      Verify: gitleaks-scans-current-branch
- [x] **Task 34** - add the Go checks to this repo's pipeline
      Verify: pipeline-covers-boy
- [x] **Task 35** - build and install boy from install.sh
      Verify: live-coder-end-to-end
- [x] **Task 36** - update the docs
