# Acceptance Criteria: Plan 19 Orchestration Tooling

Verification is programmatic unless a scenario is marked **[MANUAL]**.
Each scenario has a stable name that `TODO.md` tasks reference in their `Verify:` line.
This file is the source of truth for what the tests assert.

## Command Surface

```
boy start  [--dir <repo>] <plan>
boy status [--dir <repo> | --all | -A] [<session-id>]
boy remove [--force] <session-id>
```

- `<repo>` defaults to the git repo containing the current directory.
- `<plan>` is a plan directory name under `<repo>/.agents/plans/`.
- `<session-id>` identifies a coder on its own, regardless of the current directory.
- The server URL and password come from opencode's `~/.local/state/opencode/service.json` (`url`, `password`). `server_url` and `server_password` in `~/.config/boy/config.yaml` override it, and `BOY_SERVER_URL` / `BOY_SERVER_PASSWORD` override both. Requests use HTTP Basic auth with username `opencode`. The CLI only attaches to the server; it never starts one.

## Worktrees

- A coder for `<plan>` works in `<repo>/.agents/worktrees/<plan>/` on branch `<plan>`, created from the main checkout's HEAD when `start` runs.
- `start` creates the worktree with git, then asks the server to refresh its worktree inventory so the worktree is registered. `remove` deletes it through the server's worktree API, which keeps the branch.
- One coder per plan: running `start` on a plan that is already started never creates a second coder (see start-is-idempotent).
- Only active plans can be started. Finished plans are archived under `.agents/plans/archive/`, so `start` does not find them.

## Status Output

`boy status` prints a JSON array with one entry per coder. Both the user and the orchestrator read it. Each entry has:

| Key | Value |
|---|---|
| `session` | session id |
| `repo` | absolute path of the main checkout |
| `plan` | plan name (also the worktree and branch name) |
| `tasks` | `{ "done", "skipped", "total" }`: counts of `[x]`, `[-]`, and all task checkboxes in the worktree's copy of the plan's `TODO.md` |
| `state` | `running` if the session is in the server's active list, otherwise `idle` |
| `outcome` | the session's `outcome` as reported by the server (e.g. `succeeded`, `interrupted`), or `null` before its first turn ends |
| `started_at` | when the session was created, ISO 8601 |
| `state_since` | when the current state began, ISO 8601: the latest prompt's time if `running`, the session's `time.idle` if `idle` |
| `running_for` | seconds since `started_at` |
| `in_state_for` | seconds since `state_since` |

## Other Output

- `boy start` prints the coder's status entry as a JSON object on stdout, then a one-line message on stderr saying what it did: `plan <plan> started at <worktree>` for a new coder, or the messages in start-is-idempotent.
- `boy remove` prints `removed session <session-id> at <worktree>`, where `<worktree>` is the removed worktree's absolute path.
- On failure, a command exits non-zero, prints a plain-text error to stderr, and prints nothing to stdout.

## Test Setup

All opencode calls go through one client interface. Command tests pass in a fake implementation that keeps sessions in memory, returns what the test sets up, and records each call and its arguments. Tests use real git in temporary repos. No live server or model is involved.

The real HTTP client is tested separately against Go's in-process `httptest` server (see client-sends-opencode-requests). Neither layer catches a future opencode API change; only live-coder-end-to-end does.

## Scenario: start-creates-worktree

Given a repo with a committed plan `<plan>`
When `boy start <plan>` runs in that repo
Then `<repo>/.agents/worktrees/<plan>/` is a git worktree on a new branch `<plan>`, whose tip is the main checkout's HEAD at start time
And the main checkout's HEAD, current branch, and working tree status are unchanged

Verification:
- In a temp repo with the client mocked, run `boy start`; check the worktree and branch with `git worktree list` and `git rev-parse`, and compare the main checkout's `git rev-parse HEAD`, `git branch --show-current`, and `git status --porcelain` before and after

## Scenario: start-launches-coder

Given the same setup as start-creates-worktree
When `boy start <plan>` runs
Then the worktree is registered with the server by one worktree refresh for the repo's project
And exactly one session is created, rooted at the worktree's absolute path, using the `coder` agent and a permission rule set that contains no `ask` (see coder-never-asks)
And exactly one prompt is sent to that session, and its text names the plan
And no call waits for the coder's reply
And the command exits 0, prints a status entry whose `session` is the created session's id and whose `plan` is `<plan>`, and prints `plan <plan> started at <worktree>` to stderr

Verification:
- Inspect the recorded client calls and their arguments after `boy start` exits, parse its stdout, and compare its stderr to the message

## Scenario: start-from-other-dir

Given a repo with a committed plan, and a current directory outside that repo
When `boy start --dir <repo> <plan>` runs
Then the outcome is the same as start-creates-worktree and start-launches-coder, for `<repo>`

Verification:
- Run from a temp directory outside the repo and repeat both scenarios' assertions

## Scenario: start-rejects-invalid-request

Given a request that cannot be started
When `boy start` runs
Then it prints the defined error, exits non-zero, creates no worktree or branch, and creates no session

Each case and its exact error message:
- `--dir` is not inside a git repo: `not a git repository: <dir>`
- `<plan>` is not a directory under `.agents/plans/` (archived plans included): `plan not found: <plan>`
- the plan directory has uncommitted or untracked changes: `plan has uncommitted changes: <plan>`
- the branch `<plan>` exists but its worktree does not: `branch exists without worktree: <plan>`
- the client cannot reach the configured server: `opencode server unreachable: <url>`

Verification:
- For each case, assert the exit code, that stderr equals the message, that `git worktree list` and `git branch` are unchanged, and that no session was created

## Scenario: start-is-idempotent

Given a plan whose worktree `<repo>/.agents/worktrees/<plan>/` already exists
When `boy start <plan>` runs
Then it creates no new worktree or branch, exits 0, prints the coder's status entry on stdout, and acts on the case it finds:

- no coder session for the worktree: creates one and prompts it as in start-launches-coder; stderr `plan <plan> started at <worktree>`
- the coder is `running`: sends nothing; stderr `plan already running: <plan> (session <session-id>)`
- the coder is `idle` with tasks left: sends one prompt to that same session to continue from its TODO; stderr `resumed session <session-id> for <plan>`
- the coder is `idle` with every task done or skipped: sends nothing; stderr `plan already finished: <plan> (session <session-id>)`

Verification:
- For each case, set up the worktree (and a mocked session in the given state), run `boy start`, and assert the exit code, the stdout entry, the stderr message, the recorded client calls, and that `git worktree list` and `git branch` are unchanged

## Scenario: status-lists-repo

Given two coders started in repo A and one in repo B
When `boy status` runs inside repo A, and `boy status --dir <A>` runs from outside repo A
Then both print an array holding exactly repo A's two entries

Verification:
- Start three coders with the client mocked; compare the `session` values in each output to those printed by `start`

## Scenario: status-lists-all

Given the same three coders as status-lists-repo
When `boy status --all` and `boy status -A` run from any directory
Then both print an array holding all three entries, each with its own `repo`

Verification:
- Compare the `session` and `repo` values in each output to those printed by `start`

## Scenario: status-scoped-to-session

Given the same three coders as status-lists-repo
When `boy status <session-id>` runs for a repo B coder, from inside repo A
Then it prints an array holding only that coder's entry

Verification:
- Assert the output has exactly one entry, with the given `session` and repo B's path as `repo`

## Scenario: status-reports-fields

Given a started coder whose worktree `TODO.md` has 2 `[x]`, 1 `[-]`, and 5 tasks in total
And the mocked session was created at T0, is in the active list, and its latest prompt was sent at T1
And the clock reads T2
When `boy status <session-id>` runs
Then the entry has `tasks: {"done": 2, "skipped": 1, "total": 5}`, `state: "running"`, `outcome: null`, `started_at: T0`, `state_since: T1`, `running_for: T2 - T0`, and `in_state_for: T2 - T1`
And after the session leaves the active list with `outcome: "succeeded"` and `time.idle` T3, the entry has `state: "idle"`, `outcome: "succeeded"`, and `state_since: T3`

Verification:
- Edit the worktree's `TODO.md` directly, set the mocked session's state and timestamps, fix the clock, and assert exact field values

## Scenario: status-ignores-non-coder-sessions

Given a started coder, plus a child session in the same worktree directory and a session rooted at the main checkout
When `boy status` runs in the repo
Then only the coder's entry is listed

Verification:
- Add the extra sessions to the mock; assert the output holds exactly one entry, with the coder's `session`

## Scenario: status-rejects-invalid-request

Given a request whose target cannot be reported
When `boy status` runs
Then it prints the defined error and exits non-zero

Each case and its exact error message:
- `<session-id>` is not on the server: `session not found: <session-id>`
- `<session-id>` is on the server but is not a coder session: `not a coder session: <session-id>`
- `--dir` is not inside a git repo: `not a git repository: <dir>`
- the client cannot reach the configured server: `opencode server unreachable: <url>`

Verification:
- For each case, assert the exit code, that stderr equals the message, and that stdout is empty

## Scenario: remove-merged-coder

Given an idle coder whose branch is merged into the main checkout's HEAD and whose worktree is clean
When `boy remove <session-id>` runs from any directory
Then the worktree is gone from disk and from `git worktree list`, the branch still exists, and the session is deleted
And the command exits 0 and prints `removed session <session-id> at <worktree>`

Verification:
- Merge the branch in the main checkout, run remove, then check git and the recorded client calls (one worktree removal for the worktree's path and one session delete for that id), and compare stdout to the message

## Scenario: remove-refuses-unsafe

Given a coder in one of the states below
When `boy remove <session-id>` runs without `--force`
Then it prints the defined error, exits non-zero, and leaves the worktree and session untouched

Each case and its exact error message:
- the coder is `running`: `coder is still running: <session-id>`
- the branch is not merged into the main checkout's HEAD: `branch not merged: <plan>`
- the worktree has uncommitted or untracked changes: `worktree has uncommitted changes: <worktree>`
- `<session-id>` is not a coder session, or not on the server: the matching status-rejects-invalid-request message

Verification:
- For each case, assert the exit code, that stderr equals the message, that the worktree still exists with the same contents, and that no interrupt, worktree removal, or session delete call was recorded

## Scenario: remove-force

Given a coder in each unsafe state from remove-refuses-unsafe (except an unknown session)
When `boy remove --force <session-id>` runs
Then the worktree is removed, the branch kept, and the session deleted, as in remove-merged-coder
And if the coder was `running`, the session is interrupted before the worktree is removed

Verification:
- For each case, assert the worktree is gone, the branch exists, and the recorded client calls: one worktree removal and one session delete, preceded by one interrupt in the running case

## Scenario: client-sends-opencode-requests

Given the real HTTP client pointed at an `httptest` server
When each client method is called
Then it sends the request below with HTTP Basic auth (`opencode:<password>`), and parses a sample reply shaped like opencode v2.0.32's into the right values

| Method | Request |
|---|---|
| create session | `POST /api/session`, body `{"title", "agent": "coder", "location": {"directory": <worktree>}, "permissions": <rule set>}` |
| send prompt | `POST /api/session/<id>/prompt`, body `{"text": <prompt>}` |
| list sessions | `GET /api/session?parentID=null`, plus `directory=<worktree>` when looking up one worktree's session |
| get session | `GET /api/session/<id>`; a 404 reply returns a not-found error |
| get active sessions | `GET /api/session/active` |
| get latest prompt | `GET /api/session/<id>/message?type=user&order=desc&limit=1`; returns the newest user message, or none |
| interrupt | `POST /api/session/<id>/interrupt` |
| delete session | `DELETE /api/session/<id>` |
| refresh worktrees | `POST /api/worktree/refresh`, body `{"projectID"}` |
| remove worktree | `DELETE /api/worktree`, body `{"projectID", "directory", "force"}` |

And a connection failure returns an error that the commands report as `opencode server unreachable: <url>`
And a 401 reply returns an error that the commands report as `opencode server rejected credentials: <url>`

Verification:
- One test per method: the handler asserts method, path, query, body, and auth header, then replies with a sample; the test asserts the parsed result

## Scenario: config-resolves-server

Given a temporary home directory
When `boy` resolves the server URL and password
Then each case resolves as below

- only `service.json` exists: its `url` and `password`
- `config.yaml` sets `server_url` and `server_password`: those win over `service.json`
- `BOY_SERVER_URL` and `BOY_SERVER_PASSWORD` are set: those win over both
- an override sets only the URL: the password still comes from the next source down
- no source gives a URL: the command fails with `opencode server not configured: no service.json and no server_url`

Verification:
- For each case, write the files and set the variables in the temporary home, resolve, and assert the URL and password (or the exact error)

## Scenario: coder-never-asks

Given the permission rule set `boy start` sends when it creates a coder session
When it is read
Then every rule's `effect` is `allow` or `deny`, never `ask`
And its first rule is a catch-all (`"action": "*"`, `"resource": "*"`), so no action falls through to opencode's `ask` default
And the `question` action is denied

Verification:
- Run `boy start` with the client faked, take the `permissions` argument of the recorded create-session call, and assert all three conditions

## Scenario: coder-instructions

Given the rendered coder agent
When its instructions are read
Then they tell it to commit after each task whose pipeline is green
And to install dependencies in its working directory when it needs them
And, where it would otherwise ask the user, to resolve the ambiguity itself, continue, and record the decision in `DECISIONS.md` in the plan directory

Verification:
- Render src/global and confirm the rendered coder agent file contains each instruction, names `DECISIONS.md`, and no longer tells the coder to ask the user or to stop and wait

## Scenario: worktrees-gitignored

Given this repo
When a path under `.agents/worktrees/` is checked
Then git ignores it

Verification:
- `git check-ignore -q .agents/worktrees/any/file` exits 0

## Scenario: main-pipeline-ignores-worktrees

Given a copy of this repo whose `.agents/worktrees/<name>/` contains a TypeScript type error, a failing `*.test.ts`, a biome violation, a ruff violation, a shellcheck violation, and a lockfile with a known HIGH or CRITICAL vulnerability
When the pipeline runner runs at the copy's root
Then it exits 0

Verification:
- Clone HEAD into a temp directory, add the planted directory, run the real runner there, and assert exit 0 (same prerequisites as plan 18's this-repo-conforms)

## Scenario: runner-skips-worktrees

Given any repo whose only vulnerable lockfile is under `.agents/worktrees/<name>/`
When the pipeline runner runs its trivy stage at the repo root
Then the trivy stage passes

Verification:
- Integration test against a small fixture repo with real trivy

## Scenario: gitleaks-scans-current-branch

Given a repo whose only leaked secret is committed on a branch other than the checked-out one
When the pipeline runner runs its gitleaks stage at the repo root
Then the gitleaks stage passes
And with that branch checked out instead, the gitleaks stage fails

Verification:
- Integration test against a small fixture repo with real gitleaks: commit a known test secret on a side branch, run the stage on the main branch (expect pass), then switch to the side branch and run it again (expect fail)

## Scenario: pipeline-covers-boy

Given this repo's `.agents/pipeline.yaml`
When its stage commands are read
Then `lint` runs `go vet`, `build` runs `go build`, and `test` runs `go test`, each against `boy/`

Verification:
- Parse the manifest and assert each stage's command contains the Go command and targets `boy/`

## Scenario: live-coder-end-to-end [MANUAL]

Given the local opencode v2 service running (found through `service.json`), `boy` installed by `install.sh`, and a scratch repo with a committed two-task plan whose tasks are trivially small
When a human runs `boy start --dir <scratch-repo> <plan>`, then polls `boy status <session-id>` until `state` is `idle`
Then `outcome` is `succeeded` with 2 of 2 tasks done, the plan branch has a commit per task, the worktree is clean, and the main checkout is unchanged
And the coder never stalled on a permission prompt
And `boy status --all`, run from outside the scratch repo, lists the coder
And after the human merges the branch, `boy remove <session-id>` succeeds and the session is gone from `opencode session list`

Verification:
- A human performs the steps against the real server and records the outputs

## Out of Scope

- Deciding a branch is ready to merge; that belongs to the reviewer hand-off (next plan).
- The headless coder's final permission set; only "never `ask`" is checked here.
- Ad hoc requests without a plan, and plans outside the target repo.
- Starting or managing the opencode server, and recovering from a server crash.
- Nothing checks that the coder follows its instructions beyond live-coder-end-to-end. [MANUAL]
