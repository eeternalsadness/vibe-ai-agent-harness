# Acceptance Criteria: Plan 20 Ad-hoc Coders, Follow-ups, and a Friendlier boy

Verification is programmatic unless a scenario is marked **[MANUAL]**.
Each scenario has a stable name that `TODO.md` tasks reference in their `Verify:` line.
This file is the source of truth for what the tests assert.

## Command Surface

```
boy start  [-o json] [--plan <path> | "<prompt>"]
boy prompt [-o json] [--steer] <session-id> "<text>"
boy status [-o json] [--dir <repo> | --all | -A] [<session-id>]
boy remove [--force] <session-id>
```

- `start "<prompt>"` and `start` with no arguments use the git repo containing the current directory. `start --plan <path>` uses the repo that contains `<path>`, and `<path>` may be relative or absolute.
- `start` no longer has `--dir`.
- `prompt` and `remove` identify a coder by session id alone, from any directory.
- Server configuration is unchanged from plan 19.

## Coder Names

- A coder's name is its worktree directory name and its branch name: `<repo>/.agents/worktrees/<name>/` on branch `<name>`, created from the main checkout's HEAD.
- A plan coder's name is the plan directory name.
- An ad-hoc coder's name is `adhoc-<slug>-<hash>`, or `adhoc-<hash>` when the slug is empty:
  - `<slug>`: lowercase the prompt; replace every run of characters outside `[a-z0-9]` with `-`; trim leading and trailing `-`; keep the first 5 `-`-separated words; cut to 30 characters; trim trailing `-`.
  - `<hash>`: the first 6 hex digits of `sha256(<prompt> + "\n" + <start time as UTC RFC 3339 with nanoseconds>)`.
- A coder whose name starts with `adhoc-` is ad-hoc. Every other coder is a plan coder.

## Status Output

With `-o json`, `boy status` prints a JSON array with one entry per coder, sorted by `repo` and then `branch`. Each entry has:

| Key | Value |
|---|---|
| `session` | session id |
| `repo` | absolute path of the main checkout |
| `worktree` | absolute path of the coder's worktree |
| `title` | the session's title as the server reports it (`""` if it has none yet) |
| `plan` | plan name, or `null` for an ad-hoc coder |
| `branch` | the coder's name |
| `tasks` | `{ "done", "skipped", "total" }` from the worktree's copy of the plan's `TODO.md`, or `null` for an ad-hoc coder |
| `state`, `outcome`, `started_at`, `state_since`, `running_for`, `in_state_for` | unchanged from plan 19 |

Without `-o json`, `boy status` prints a table aligned with Go's `text/tabwriter` (padding 2): a header row, then one row per entry in the same order. With no coders it prints only the header.

| Column | Value |
|---|---|
| `REPO` | `repo`; this column appears only with `--all` / `-A` |
| `SESSION` | `session` |
| `STATE` | `state` |
| `TASKS` | `<done>/<total>`, or `-` for an ad-hoc coder |
| `BRANCH` | `branch` |
| `AGE` | `running_for` seconds as a Go `time.Duration` string, e.g. `1h2m3s` |
| `IN STATE` | `in_state_for` in the same format |
| `TITLE` | `title` |

## Other Output

- `boy start` and `boy prompt` print the coder's status entry: a JSON object with `-o json`, otherwise the table header and one row. Then they print a one-line message on stderr.
- `start` messages: `plan <plan> started at <worktree>`, `ad-hoc <name> started at <worktree>`, or the start-is-idempotent messages.
- `prompt` messages: `prompt sent to session <id>` (idle), `prompt queued for session <id>` (running), `prompt steered into session <id>` (running, `--steer`).
- `-o` with any value other than `json` fails with `unknown output format: <value>`.
- On failure, a command exits non-zero, prints a plain-text error to stderr, and prints nothing to stdout, whatever `-o` is set to.

## Test Setup

Same as plan 19: a fake opencode client that records calls, and real git in temporary repos. In addition, the interactive picker is reached through an interface. Command tests pass in a fake picker that returns scripted choices and records what it was shown. Tests also choose whether the command sees a terminal. No test drives the real terminal UI.

## Superseded Plan 19 Scenarios

These plan 19 scenarios are replaced by the scenarios of the same name below: start-creates-worktree, start-launches-coder, start-rejects-invalid-request, status-reports-fields, remove-refuses-unsafe, client-sends-opencode-requests, coder-instructions. start-from-other-dir is replaced by start-plan-from-anywhere. All other plan 19 scenarios stand as written, run with `-o json` wherever they parse output.

## Scenario: start-creates-worktree

Given a repo with a committed plan at `<repo>/.agents/plans/<plan>/`
When `boy start --plan .agents/plans/<plan>` runs in that repo (with or without a trailing slash)
Then `<repo>/.agents/worktrees/<plan>/` is a git worktree on a new branch `<plan>`, whose tip is the main checkout's HEAD at start time
And the main checkout's HEAD, current branch, and working tree status are unchanged

Verification:
- In a temp repo with the client faked, run `boy start`, check the worktree and branch with `git worktree list` and `git rev-parse`, and compare the main checkout's `git rev-parse HEAD`, `git branch --show-current`, and `git status --porcelain` before and after. Run once with and once without the trailing slash.

## Scenario: start-launches-coder

Given the same setup as start-creates-worktree
When `boy start -o json --plan .agents/plans/<plan>` runs
Then the worktree is registered with the server by one worktree refresh for the repo's project
And exactly one session is created, rooted at the worktree's absolute path, using the `coder` agent and the plan 19 coder-never-asks rule set, with no title
And exactly one prompt is sent to that session, with no `delivery`, and its text names the plan
And the command exits 0, prints an entry whose `session` is the created session's id, whose `plan` and `branch` are `<plan>`, and whose `worktree` is the worktree path, and prints `plan <plan> started at <worktree>` to stderr

Verification:
- Inspect the recorded client calls and their arguments, parse stdout, and compare stderr to the message

## Scenario: start-plan-from-anywhere

Given a repo with a committed plan, and a current directory outside that repo
When `boy start --plan <repo>/.agents/plans/<plan>` runs with an absolute path
Then the outcome is the same as start-creates-worktree and start-launches-coder, for `<repo>`

Verification:
- Run from a temp directory outside the repo and repeat both scenarios' assertions

## Scenario: adhoc-start-launches-coder

Given a repo with a clean main checkout, and a clock fixed at T
When `boy start -o json "<prompt>"` runs in that repo
Then `<repo>/.agents/worktrees/<name>/` is a git worktree on a new branch `<name>`, from the main checkout's HEAD, where `<name>` follows Coder Names for `<prompt>` and T
And the main checkout is unchanged, as in start-creates-worktree
And one worktree refresh, one session created as in start-launches-coder, and one prompt are recorded, and the prompt's text is exactly `<prompt>`, with no `delivery`
And the command exits 0, prints an entry with `plan: null`, `tasks: null`, and `branch: <name>`, and prints `ad-hoc <name> started at <worktree>` to stderr

Verification:
- In a temp repo with the client faked and the clock fixed, compute the expected name in the test from Coder Names, then assert the git state, the recorded calls, stdout, and stderr

## Scenario: adhoc-name-format

Given a fixed start time T
When the ad-hoc name is computed for each prompt below
Then it matches Coder Names, so each name is `adhoc-` + slug + `-` + hash, with the slugs shown:

- `Fix the auth typo in login.go, please!`: slug `fix-the-auth-typo-in`
- `  --Update README  `: slug `update-readme`
- `refactorize everything thoroughly immediately`: slug `refactorize-everything-thoroug` (cut to 30 characters)
- `日本語のみ`: slug empty, so the name is `adhoc-<hash>`
And the same prompt at two different start times gives two different names

Verification:
- A table test of the name function with a fixed clock. The test computes each expected hash with `crypto/sha256`.

## Scenario: start-rejects-invalid-request

Given a request that cannot be started
When `boy start` runs
Then it prints the defined error, exits non-zero, creates no worktree or branch, and creates no session

Each case and its exact error message:
- the current directory (prompt or no arguments) or `<path>` (`--plan`) is not inside a git repo: `not a git repository: <dir>`
- `<path>` does not exist: `plan not found: <path>`
- `<path>` exists but is not `<repo>/.agents/plans/<name>` in a main checkout (an archived plan, a plan inside a worktree, or any other directory): `not an active plan: <path>`
- the plan directory has uncommitted or untracked changes: `plan has uncommitted changes: <plan>`
- the branch `<name>` exists but its worktree does not: `branch exists without worktree: <name>`
- both `--plan` and a prompt are given: `pass a plan or a prompt, not both`
- the prompt is empty or only whitespace: `prompt required`
- no arguments and stdin is not a terminal: `plan or prompt required`
- the client cannot reach the configured server: `opencode server unreachable: <url>`

Verification:
- For each case, assert the exit code, that stderr equals the message, that stdout is empty, that `git worktree list` and `git branch` are unchanged, and that no session was created. The no-terminal case also asserts the picker was never called.

## Scenario: start-is-idempotent

Unchanged from plan 19, except that it is started with `--plan <path>` and output is parsed with `-o json`.

Verification:
- As plan 19

## Scenario: picker-starts-plan

Given a repo with active plans `a-plan` and `b-plan` and an archived plan, and a terminal
When `boy start` runs with no arguments and the fake picker chooses "plan" and then `b-plan`
Then the picker was first shown exactly the two choices `plan` and `ad-hoc`, then exactly `a-plan` and `b-plan` in that order
And the outcome is the same as `boy start --plan <repo>/.agents/plans/b-plan`

Verification:
- Assert what the fake picker recorded, then repeat start-creates-worktree's and start-launches-coder's assertions for `b-plan`

## Scenario: picker-starts-adhoc

Given a repo and a terminal
When `boy start` runs with no arguments and the fake picker chooses "ad-hoc" and then reads the line `<prompt>`
Then the outcome is the same as `boy start "<prompt>"` (adhoc-start-launches-coder)

Verification:
- Repeat adhoc-start-launches-coder's assertions

## Scenario: picker-rejects

Given a terminal
When `boy start` runs with no arguments in each case below
Then it prints the defined error, exits non-zero, and creates no worktree, branch, or session

- the picker is cancelled at either step: `cancelled`
- "plan" is chosen in a repo with no active plans: `no active plans in <repo>`
- "ad-hoc" is chosen and the line read is empty or only whitespace: `prompt required`

Verification:
- Script the fake picker for each case and assert exit code, stderr, empty stdout, git state, and that no session was created

## Scenario: prompt-idle-coder

Given an idle coder (plan or ad-hoc)
When `boy prompt -o json <session-id> "<text>"` runs from any directory, with or without `--steer`
Then exactly one prompt is sent to that session, with text exactly `<text>` and no `delivery`
And the command exits 0, prints the coder's entry, and prints `prompt sent to session <session-id>` to stderr

Verification:
- With the client faked, run from a temp directory outside the repo and assert the recorded call, stdout, and stderr

## Scenario: prompt-running-coder

Given a running coder
When `boy prompt <session-id> "<text>"` runs, and then `boy prompt --steer <session-id> "<text>"`
Then the first sends one prompt with `delivery: "queue"` and prints `prompt queued for session <session-id>`
And the second sends one prompt with `delivery: "steer"` and prints `prompt steered into session <session-id>`
And neither interrupts the session

Verification:
- Assert the recorded calls and stderr for each run

## Scenario: prompt-rejects-invalid-request

Given a request that cannot be sent
When `boy prompt` runs
Then it prints the defined error, exits non-zero, prints nothing to stdout, and sends no prompt

- `<session-id>` is not on the server: `session not found: <session-id>`
- `<session-id>` is not a coder session: `not a coder session: <session-id>`
- `<text>` is empty or only whitespace: `prompt required`
- the client cannot reach the configured server: `opencode server unreachable: <url>`

Verification:
- For each case, assert exit code, stderr, empty stdout, and that no prompt call was recorded

## Scenario: status-reports-fields

Given a started plan coder set up as in plan 19's status-reports-fields, and a started ad-hoc coder in the same repo, each with a server title
When `boy status -o json` runs
Then the plan coder's entry has every plan 19 field value, plus `worktree`, `title` (the server title), `plan: <plan>`, and `branch: <plan>`
And the ad-hoc coder's entry has `plan: null`, `tasks: null`, `branch: <name>`, its `worktree`, and its server title
And both coders are listed by `boy status`, `boy status --all`, and `boy status <session-id>`

Verification:
- Set the fake sessions' titles, states, and timestamps, fix the clock, and assert exact field values in each output

## Scenario: status-human-table

Given the two coders from status-reports-fields
When `boy status` runs, then `boy status --all`, then `boy status` in a repo with no coders
Then the first prints the header `SESSION  STATE  TASKS  BRANCH  AGE  IN STATE  TITLE` (columns aligned) and one row per coder, with `TASKS` `2/5` for the plan coder and `-` for the ad-hoc coder, and `AGE` and `IN STATE` as Go duration strings
And the second adds `REPO` as the first column
And the third prints only the header

Verification:
- Split each line on runs of two or more spaces and assert the header cells and each row's cells exactly

## Scenario: output-format-flag

Given a started coder
When `boy start`, `boy status`, and `boy prompt` run without `-o`, with `-o json`, with `--output json`, and with `-o yaml`
Then without `-o` stdout is the table, with `-o json` or `--output json` it is JSON, and with `-o yaml` the command fails with `unknown output format: yaml` and does nothing else (no git change, session, or prompt)

Verification:
- For each command and flag, assert stdout parses as JSON or not, and for `yaml` assert stderr, exit code, and no recorded mutating client calls

## Scenario: remove-refuses-unsafe

Unchanged from plan 19, except that the unmerged-branch message is `branch not merged: <branch>`, and it is also checked for an ad-hoc coder.

Verification:
- As plan 19, plus the unmerged case for an ad-hoc coder

## Scenario: remove-adhoc-coder

Given an idle ad-hoc coder whose branch is merged and whose worktree is clean
When `boy remove <session-id>` runs
Then the outcome is the same as plan 19's remove-merged-coder

Verification:
- As plan 19's remove-merged-coder, for an ad-hoc coder

## Scenario: remove-ignores-decisions-file

Given an idle, merged coder in a repo whose `.gitignore` ignores `.agents/DECISIONS.md`, and a `.agents/DECISIONS.md` in its worktree
When `boy remove <session-id>` runs without `--force`
Then it succeeds as in plan 19's remove-merged-coder

Verification:
- Write the file into the worktree, run remove, and assert success and the recorded worktree removal

## Scenario: client-sends-opencode-requests

Unchanged from plan 19, except:

| Method | Request |
|---|---|
| create session | `POST /api/session`, body `{"agent": "coder", "location": {"directory": <worktree>}, "permissions": <rule set>}`, with no `title` key |
| send prompt | `POST /api/session/<id>/prompt`, body `{"text": <text>}`, plus `"delivery": "queue"` or `"steer"` when given |

And get session and list sessions parse each session's `title`

Verification:
- As plan 19, plus a send-prompt test with and without delivery and title assertions in the get and list tests

## Scenario: coder-instructions

Given the rendered coder agent
When its instructions are read
Then they name `.agents/DECISIONS.md` as where decisions are recorded, in both modes
And they say never to commit `.agents/DECISIONS.md`
And they say to remove or rewrite decisions that no longer hold
And the ad-hoc workflow tells it to commit when the pipeline is green
And they no longer place `DECISIONS.md` in the plan directory, and no longer report ad-hoc decisions only in the final message
And the plan 19 checks still hold (commit, never push, install dependencies, never ask the user)

Verification:
- Render src/global and check the rendered coder file, case-insensitively: it contains `.agents/DECISIONS.md`; matches /never commit `?\.agents\/DECISIONS\.md/; matches /no longer hold/; its "Workflow — Ad-hoc Mode" section contains `commit`; it does not match /DECISIONS\.md`? in the plan directory/ or /final message instead/; plus the plan 19 assertions

## Scenario: decisions-gitignored

Given this repo
When `.agents/DECISIONS.md` is checked
Then git ignores it

Verification:
- `git check-ignore -q .agents/DECISIONS.md` exits 0

## Scenario: live-adhoc-end-to-end [MANUAL]

Given the local opencode service running, `boy` installed by `install.sh`, and a scratch repo that ignores `.agents/DECISIONS.md`
When a human runs `boy start "<a trivially small change>"`, sends a second small ask with `boy prompt <session-id> "<text>"` while it is running, then a third with `--steer` during a later run, and polls `boy status` until idle
Then the branch has commits for all three asks, `.agents/DECISIONS.md` is in no commit, the worktree is clean, and the main checkout is unchanged
And `boy status` shows a server-generated title and `-` under `TASKS`
And after merging, `boy remove <session-id>` succeeds

Verification:
- A human performs the steps against the real server and records the outputs

## Scenario: picker-in-terminal [MANUAL]

Given a repo with active plans, in a real terminal
When a human runs `boy start` with no arguments
Then the plan/ad-hoc choice appears, "plan" lists exactly the active plans, and Esc at either step prints `cancelled` and creates nothing

Verification:
- A human performs the steps and records the outcome

## Out of Scope

- Driving the real picker UI in automated tests.
- Whether the coder actually follows its instructions, beyond live-adhoc-end-to-end. [MANUAL]
- Plans whose directory name starts with `adhoc-`.
- Ad-hoc runs on uncommitted changes in the main checkout. The worktree starts from HEAD.
- Waiting for a coder, the review artifact, and other items in PLAN.md's Out of Scope.
