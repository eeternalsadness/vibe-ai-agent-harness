# Implementation: Plan 19 Orchestration Tooling

Test-first. Within each group, write the tests and confirm each fails for the right reason before implementing. ACCEPTANCE.md is the source of truth for every assertion, message, and field; tasks reference its scenarios by name rather than restating them.

## Structure

- `boy` is a Go CLI using cobra (commands, flags) and viper (config file and environment overrides).
- It lives in `boy/` at the repo root as a self-contained Go module with its own `go.mod`. It imports nothing from `src/`, so it can move to its own repo later.
- All opencode calls go through one `Client` interface. `main` wires in the HTTP implementation; command tests pass a fake that keeps sessions in memory and records every call. The HTTP implementation is tested against `httptest`.
- Commands take their dependencies (client, clock, stdout, stderr) as parameters, so tests run them in-process against temporary git repos.
- `install.sh` builds the binary and copies it to `~/.local/bin/boy`.
- The coder agent template gains the unattended rules; there is no separate headless agent. `boy` supplies the no-`ask` permission rule set when it creates the session.

## opencode v2 Facts (verified on 2.0.32)

- Session routes wrap replies in `{"data": ...}`; worktree routes return bare JSON.
- A session's directory is at `location.directory`. A session in a worktree gets the same `projectID` as the main checkout.
- `start` order: create the git worktree, create the session in it (its reply gives the `projectID`), refresh worktrees for that project, then send the prompt.
- `GET /api/session` filters: `directory` matches exactly, `parentID=null` returns top-level sessions only, `limit` pages.
- `GET /api/session/active` lists only running sessions; idle ones are absent. Idle sessions carry `time.idle` and `outcome`.
- Unauthenticated requests get 401; Bearer tokens get 401. HTTP Basic `opencode:<password>` works.

## Task 1: Scaffold `boy/`

Create the Go module and the types every test needs to compile. No behavior yet.

- `boy/go.mod`, module path `boy` (renamed when it moves to its own repo).
- `boy/main.go` builds the cobra root with `start`, `status`, and `remove` subcommands and their flags from the ACCEPTANCE.md command surface. Each returns "not implemented".
- `boy/internal/client`: the `Client` interface, one method per row of client-sends-opencode-requests, plus `Session`, `Message`, and worktree types. A `Fake` implementation that keeps sessions in a map, lets tests set state, timestamps, and errors, and records each call with its arguments.
- `boy/internal/app`: one function per command, taking a `Deps` struct (client, clock, stdout, stderr, working directory). `main.go` only parses flags and calls these.
- `boy/internal/testutil`: helpers to make a temporary git repo with a committed plan (`.agents/plans/<plan>/` with a `TODO.md`), and a fixed clock.

Done when `go build ./...` and `go vet ./...` pass in `boy/`.

## Tests

Each task writes the failing test(s) for one scenario and confirms they fail for the right reason. Go tests live next to the code in `boy/`; the render test goes in `test/integration/`; runner tests go in the existing `test/integration/test_pipeline_runner*.py` files.

## Task 2: Write the test for client-sends-opencode-requests

In `boy/internal/client`, one `httptest` test per method in the scenario's table, plus the unreachable and 401 cases.

## Task 3: Write the test for config-resolves-server

In `boy/internal/config`, one test per case, using a temporary home directory (`HOME`/`XDG_STATE_HOME`) and `t.Setenv`.

## Tasks 4–8: Write the tests for start

In `boy/internal/app`, against a temporary repo from `testutil` and the fake client. One task per scenario:

- Task 4: start-creates-worktree
- Task 5: start-launches-coder
- Task 6: start-from-other-dir (run with the working directory set outside the repo)
- Task 7: start-rejects-invalid-request (one subtest per error case)
- Task 8: start-is-idempotent (one subtest per case; seed the worktree and the fake session first)

## Tasks 9–14: Write the tests for status

In `boy/internal/app`, with coders seeded through `start` against the fake client, two temporary repos where a scenario needs repo A and repo B, and the fixed clock for time fields:

- Task 9: status-lists-repo
- Task 10: status-lists-all
- Task 11: status-scoped-to-session
- Task 12: status-reports-fields
- Task 13: status-ignores-non-coder-sessions
- Task 14: status-rejects-invalid-request

## Tasks 15–17: Write the tests for remove

In `boy/internal/app`. Merge the plan branch in the main checkout where a scenario needs it.

- Task 15: remove-merged-coder
- Task 16: remove-refuses-unsafe (one subtest per error case)
- Task 17: remove-force (one subtest per unsafe state)

## Tasks 18–24: Write the remaining tests

- Task 18: coder-never-asks, in `boy/internal/app`, reading the `permissions` argument of the fake's recorded create-session call.
- Task 19: coder-instructions, in `test/integration/`, rendering `src/global` the same way `acceptance-criteria.test.ts` does.
- Task 20: worktrees-gitignored, in `test/integration/`, running `git check-ignore`.
- Task 21: main-pipeline-ignores-worktrees, next to `test_pipeline_runner_conforms.py` and with the same tool prerequisites; clone HEAD into a temp directory and plant the files there.
- Task 22: runner-skips-worktrees, in the runner's integration tests, against a small fixture repo with a vulnerable lockfile.
- Task 23: gitleaks-scans-current-branch, in the runner's integration tests, against a fixture repo with a known test secret on a side branch.
- Task 24: pipeline-covers-boy, parsing `.agents/pipeline.yaml` with PyYAML in the runner's integration tests.

## Implementation

## Task 25: Implement the HTTP client

Make client-sends-opencode-requests pass.

- Use `net/http` with HTTP Basic auth (`opencode:<password>`) on every request.
- Unwrap `{"data": ...}` on session routes; worktree routes reply with bare JSON.
- Map connection errors and 401s to distinct error values; the commands turn them into the scenario's messages.
- `GET /api/session` returns 50 sessions by default. Follow the reply's `cursor.next` (sent back as the `cursor` query param) until it is empty. Confirm the cursor field names against the live spec before relying on them.

## Task 26: Implement server discovery and login

Make config-resolves-server pass.

- Read `service.json` from `$XDG_STATE_HOME/opencode/` (default `~/.local/state/opencode/`).
- Load `~/.config/boy/config.yaml` with viper, and bind `BOY_SERVER_URL` and `BOY_SERVER_PASSWORD`.
- Resolve URL and password independently, each taking the highest source that sets it: environment, then config file, then `service.json`.
- Resolve on every command. Don't cache: the service's password and port can change when it restarts.

## Task 27: Implement start

Make start-creates-worktree, start-launches-coder, start-from-other-dir, start-rejects-invalid-request, start-is-idempotent, and coder-never-asks pass.

- Repo: the main checkout of the repo containing `--dir` (or the working directory). Use the parent of `git rev-parse --git-common-dir`, so it works even when run from inside a worktree.
- Checks, in order, before anything is created: repo, plan directory directly under `.agents/plans/`, plan committed (`git status --porcelain -- <plan dir>` is empty), branch-without-worktree. Then look up the worktree's session with `GET /api/session?parentID=null&directory=<worktree>`. That is the first server call, so an unreachable server fails before any git change.
- If the worktree exists, follow start-is-idempotent's cases. With several top-level sessions in the worktree, use the newest.
- Otherwise:
  1. `git worktree add -b <plan> <worktree> HEAD`
  2. create the session (`agent: "coder"`, `location.directory`, the permission rule set)
  3. refresh worktrees with the session's `projectID`
  4. send the prompt
  If step 2 or 4 fails, stop and report the error. Running `start` again resumes, per start-is-idempotent.
- Keep the permission rule set in one constant: a catch-all allow, then `question` denied. Tuning it is out of scope.
- The prompt names the plan and its path inside the worktree. A resume prompt says to continue from `TODO.md`.

## Task 28: Implement status

Make status-lists-repo, status-lists-all, status-scoped-to-session, status-reports-fields, status-ignores-non-coder-sessions, and status-rejects-invalid-request pass.

- Coder session: a top-level session whose `location.directory` is `<repo>/.agents/worktrees/<plan>` and still exists on disk.
- Repo scope (default or `--dir`): for each directory under `<repo>/.agents/worktrees/`, look up its session with the `directory` filter. The filter matches exactly, so it can't match a whole prefix.
- `--all`: list all top-level sessions and keep the coder sessions.
- `<session-id>`: fetch that one session; 404 means `session not found`, and a non-coder session means `not a coder session`.
- Derive `repo` and `plan` from the session's directory. Count tasks from the worktree's `.agents/plans/<plan>/TODO.md`, matching checkbox lines `- [x]`, `- [-]`, and `- [ ]`.
- Fetch the active list once per command. `state_since` is the newest user message's `time.created` when running, and the session's `time.idle` when idle.

## Task 29: Implement remove

Make remove-merged-coder, remove-refuses-unsafe, and remove-force pass.

- Look up the session as in status, with the same errors.
- Without `--force`, refuse if the coder is running, the branch isn't merged (`git merge-base --is-ancestor <plan> HEAD` in the main checkout fails), or the worktree has changes (`git -C <worktree> status --porcelain` is non-empty).
- Then, in order: interrupt if running (`--force` only); refresh worktrees, so a worktree the server doesn't know about can still be removed; `DELETE /api/worktree` with `force` matching the flag; delete the session.
- Print `removed session <session-id> at <worktree>`.

## Task 30: Add the unattended rules to the coder agent

Make coder-instructions pass. Edit `src/global/agents/coder/coder.md.ts`; no separate agent.

- After a task's pipeline is green and it is marked `[x]` in TODO.md, commit the task's changes, TODO.md included, with a message naming the task. Never push.
- Install dependencies in the working directory when a command needs them.
- Replace every "ask the user" instruction with: stop, and explain in the final message what is unclear and what is needed. These are in plan-mode steps 3 and 4, ad-hoc step 1, Research and Context, and the Constraints list ("Follow the spec", "Follow the user", "Delegate uncertainty").
- Leave the frontmatter permissions alone. opencode v2 translates them, and `boy` sets the session's own rule set.

## Task 31: Keep this repo's checks out of worktrees

Make worktrees-gitignored and main-pipeline-ignores-worktrees pass.

- `.gitignore`: add `.agents/worktrees/`.
- biome (`vcs.useIgnoreFile`) and ruff already respect `.gitignore`; confirm with the test, no change expected.
- `tsconfig.json`: add `"exclude": ["node_modules", "dist", ".agents/worktrees"]`. Setting `exclude` replaces the default, so keep `node_modules`.
- `lint:shell` in `package.json`: add `-not -path './.agents/worktrees/*'` to the `find`.
- `bun test`: check whether it skips gitignored paths. If not, exclude `.agents/worktrees/` through `bunfig.toml`, after checking the option name in Bun's docs.

## Task 32: Make the runner's trivy stage skip worktrees

Make runner-skips-worktrees pass. In `src/global/skills/validating-work/scripts/pipeline_runner.py`, add `--skip-dirs .agents/worktrees` to the trivy command. This applies to every repo using the runner.

## Task 33: Make the runner's gitleaks stage scan only the current branch

Make gitleaks-scans-current-branch pass. In the same file, add `--log-opts=HEAD` to the gitleaks command. gitleaks splits this value on spaces, so use the `=` form without quotes. Plan 18's this-repo-conforms must still pass.

## Task 34: Add the Go checks to this repo's pipeline

Make pipeline-covers-boy pass. In `.agents/pipeline.yaml`, append the Go check to each stage with `&&` (the runner runs stage commands through a shell). `go -C boy` runs from `boy/` without a `cd`:

```yaml
lint:
  command: bun run lint && go -C boy vet ./...
build:
  command: bun run typecheck && go -C boy build ./...
test:
  command: bun run test && go -C boy test ./...
```

## Task 35: Build and install boy from install.sh

In `install.sh`, after the plugin bundle step: fail with a clear error if `go` isn't on PATH, then run `go -C "$SCRIPT_DIR/boy" build -o "$HOME/.local/bin/boy" .`. Honor `--dry-run` the same way the other steps do. Then a human runs live-coder-end-to-end.

## Task 36: Update the docs

- `AGENTS.md`: add `boy/` to the Structure section and say what it is.
- `README.md`: describe `boy` (start, status, remove), how it finds the server, and that it is installed to `~/.local/bin/boy`.
- `docs/orchestration-vision.md`: name plan 19 under Phase 3.
