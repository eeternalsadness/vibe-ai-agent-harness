# Plan 20: Ad-hoc Coders, Follow-ups, and a Friendlier boy

## Problem

`boy start` only runs plans. A small, well-understood change still needs a full plan before it can run in the background. Once a coder finishes, nothing can give it more instructions, so review feedback means starting over, and the future orchestrator has no way to steer a coder. Starting a plan means typing its exact directory name. `boy status` prints JSON only, which suits the orchestrator but not a person checking in. Decisions are committed to `DECISIONS.md` in the plan directory, where they pile up in the repo and its history. Ad-hoc runs only report decisions in a final message, which nobody reads when the run is headless.

## Goals

- `boy start "<prompt>"` runs an ad-hoc coder in its own worktree and branch, the same way plans run.
- `boy start --plan <path>` starts a plan from its directory path. `boy start` with no arguments opens a picker: choose plan or ad-hoc, then pick from a plan list or type a one-line prompt.
- `boy prompt <session-id> "<text>"` sends a follow-up to any coder, from any directory, whether the coder is running or idle.
- `boy start`, `boy status`, and `boy prompt` print human-readable output by default and JSON with `-o json`.
- The coder follows one autonomous workflow in both modes: work unattended, commit, never push, and keep its decisions current. Plan mode adds the plan's files on top.
- Decisions are a temporary record of what is true of the current result. They feed the later review artifact and are never committed.

## Design Decisions

- **`start` takes a plan or a prompt, never both.** A plan is the whole spec, and extra instructions belong in a follow-up. Passing both is an error.
- **The prompt is a positional argument and the plan is `--plan <path>`.** The common quick case is the shortest to type. The path tab-completes in the shell and also tells boy which repo it's in, so `start --dir` goes away. `status --dir` stays.
- **`--plan` accepts only active plans in a main checkout.** Archived plans, copies inside worktrees, and global plans are refused.
- **Ad-hoc names are generated as `adhoc-<slug>-<hash>`.** The slug makes the branch readable, and a 6-hex sha256 of the prompt and start time makes it unique. The `adhoc-` prefix marks a run as ad-hoc without boy storing anything. Every ad-hoc `start` creates a new run. Changes to an existing run go through `prompt`.
- **`prompt` addresses a coder by session id from any directory**, like `status <id>` and `remove`. It refuses sessions that aren't coders.
- **Follow-ups are queued by default, and `--steer` redirects the current turn.** Queueing never interrupts work in progress. `--steer` is for course corrections. The text reaches the coder unchanged: the agent file already describes the workflow, and the session holds the whole conversation.
- **Follow-ups on plans are for fixes, not spec changes.** A real change to the spec goes back through the planner and then `start --plan`, which resumes at the first unchecked task.
- **Status fields are `title`, `plan`, `branch`, and `worktree`.** `plan` is null for ad-hoc runs, which is what marks them. `branch` is always present because it's what you merge. `tasks` is null for ad-hoc runs. This is a breaking schema change, and now is the cheapest time to make it, before the orchestrator reads the output.
- **Output is human-readable by default, with `-o json` for machines.** Status prints a table, and every command follows the same rule.
- **The picker is go-fuzzyfinder behind a small interface**, so boy's own flow can be tested with a fake, like the opencode client. With no terminal, the picker is never opened and the command fails instead of hanging.
- **Decisions live in `.agents/DECISIONS.md` in the coder's checkout, ignored and never committed**, in both modes and on every branch. The coder reads the file and keeps it true for the current result, rewriting or deleting any decision a follow-up changes. A boy worktree starts without the file and loses it on `boy remove`, so the file records only that run. Anything that should outlast the run goes into code or docs as part of the commit.

## Out of Scope

- The review artifact that reads the decisions file. It must read the file before `boy remove` runs.
- Making repos ignore `.agents/DECISIONS.md`. The workflow enforces that, not boy.
- Cleaning up the main checkout's `DECISIONS.md` after TUI runs.
- Waiting for a coder to finish. Callers poll `boy status`.
- Ad-hoc runs for global plans or for repos other than the current one.
- Shell completion beyond the shell's own path completion.
