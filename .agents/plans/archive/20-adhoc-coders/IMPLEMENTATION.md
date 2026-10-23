# Implementation: Plan 20 Ad-hoc Coders, Follow-ups, and a Friendlier boy

Test-first. Write each group's tests and confirm they fail for the right reason before implementing. ACCEPTANCE.md is the source of truth for every assertion, message, field, and format. Tasks refer to its scenarios by name rather than restating them.

## Structure

- **Picker.** A new package `boy/internal/picker` holds the `Picker` interface (`Choose(header string, items []string) (int, error)` and `ReadLine(prompt string) (string, error)`), an `ErrCancelled` error, a `Fake` that returns scripted answers and records what it was shown, and the real implementation. The real `Choose` calls go-fuzzyfinder's `Find` and maps `ErrAbort` to `ErrCancelled`. The real `ReadLine` prints the prompt to stderr, reads one line from stdin with `bufio`, and maps EOF to `ErrCancelled`. The package imports nothing from `app`, which mirrors how `client` is laid out.
- **`app.Deps` gains three fields.** `Picker`. `Interactive bool`: `main` sets it with `term.IsTerminal(int(os.Stdin.Fd()))` from `golang.org/x/term`. `Output string`: `""` or `json`, taken from `-o`/`--output`.
- **Commands validate first, then call the server, then touch git.** Each command checks `Output` and its own arguments before making any client call. As in plan 19, the first server call happens before any git change, so an unreachable server fails cleanly.
- **Naming.** `app.AdhocName(prompt string, start time.Time) string` is exported for the table test. A coder's kind comes from its name: the `adhoc-` prefix marks an ad-hoc coder. `isCoder` stays based on the worktree path's shape.
- **Client changes.** `SendPrompt(ctx, sessionID, text, delivery string)`: an empty `delivery` leaves the field out. Add constants `client.DeliveryQueue = "queue"` and `client.DeliverySteer = "steer"`. `Session` gains `Title`. `CreateSessionRequest` loses `Title`.
- **Entry.** It gains `Worktree`, `Title`, and `Branch`. `Plan` becomes `*string` and `Tasks` becomes `*Tasks`, so ad-hoc coders serialize as `null`. Sort by repo, then branch.
- **Output rendering.** The JSON path is unchanged. The table path uses `text/tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)`. Durations are `(time.Duration(n) * time.Second).String()`.

## Task 1: Ignore the decisions file

Make decisions-gitignored pass before anything else, so this plan's own worktree ignores `.agents/DECISIONS.md` from the start.

- `.gitignore`: add `.agents/DECISIONS.md`.
- Add the check to `test/integration/worktrees-gitignored.test.ts`, alongside the existing worktree check. This one task writes both the test and the fix: a one-line config change doesn't need its own red phase.

## Task 2: Scaffold the new surfaces

Add only the types and signatures the tests need to compile. No new behavior.

- Create the `picker` package with its interface, `ErrCancelled`, and `Fake`. The real implementation can be a stub that returns an error for now.
- Add the new `Deps` fields, the `client` signature and field changes (update `Fake` and `HTTP` to match), `app.AdhocName` and `app.Prompt` as stubs, and `app.Start(ctx, d, StartOptions{Plan, Prompt string})` in place of `(dir, plan)`.
- cobra: remove `start --dir` and add `start --plan`; add `-o`/`--output` to `start`, `status`, and `prompt`; add `prompt <session-id> <text>` with `--steer` and exactly 2 args. `start` takes at most 1 positional argument.
- Update every existing test call site so it compiles. Behavior changes come later.

Done when `go -C boy build ./...` and `go -C boy vet ./...` pass.

## Tests

Go tests go next to the code in `boy/`. The coder-instructions test stays in `test/integration/coder-instructions.test.ts`. Plan 19 tests that parse stdout as JSON get `Output: "json"` in their deps.

## Task 3: Write the test for client-sends-opencode-requests

Update `boy/internal/client/http_test.go`: create-session sends no `title`; send-prompt is tested with and without each delivery value; get and list parse `title`.

## Task 4: Write the test for adhoc-name-format

A table test in `boy/internal/app` covering the scenario's prompts, with expected hashes computed in the test.

## Task 5: Write the tests for starting plans by path

Rewrite plan 19's start tests for start-creates-worktree, start-launches-coder, and start-is-idempotent to use `--plan <path>`. Replace `TestStartFromOtherDir` with start-plan-from-anywhere. start-launches-coder now also asserts no session title, no prompt `delivery`, and the new entry fields.

## Task 6: Write the tests for adhoc-start-launches-coder and start-rejects-invalid-request

Use a fixed clock for the ad-hoc test. Extend the invalid-request table with every case in the scenario. The no-terminal case runs with `Interactive: false` and a fake picker that fails the test if it is called.

## Task 7: Write the tests for the picker

picker-starts-plan, picker-starts-adhoc, and picker-rejects, with `Interactive: true` and a scripted `picker.Fake`. The plan case adds an archived plan under `.agents/plans/archive/`.

## Task 8: Write the tests for prompt

prompt-idle-coder, prompt-running-coder, and prompt-rejects-invalid-request. Run from a temp directory outside the repo. Mark sessions running or idle through the fake's active list.

## Task 9: Write the tests for status

status-reports-fields, with one plan coder and one ad-hoc coder, each with a fake title, and status-human-table, splitting each line on `\s{2,}`. Update the other plan 19 status tests to use `-o json`.

## Task 10: Write the test for output-format-flag

Run each command through `app` with `Output` set to `""`, `json`, and `yaml`. Check the `--output` long form in `boy/main_test.go` by looking up the flag on each command, the same way `TestStatusAllHasShorthandA` does.

## Task 11: Write the tests for remove

remove-refuses-unsafe with the new branch message and an ad-hoc case, remove-adhoc-coder, and remove-ignores-decisions-file. In the last one, the test repo's committed `.gitignore` ignores `.agents/DECISIONS.md`.

## Task 12: Write the test for coder-instructions

Update `test/integration/coder-instructions.test.ts` with the scenario's checks. Extract the "Workflow — Ad-hoc Mode" section by slicing from its heading to the next `## ` heading.

## Implementation

## Task 13: Update the HTTP client

Make client-sends-opencode-requests pass. Add `delivery` to the prompt body only when it is non-empty. Drop `title` from create-session. Parse `title` from session replies.

## Task 14: Implement ad-hoc naming

Make adhoc-name-format pass. Follow Coder Names exactly. Truncate by bytes, which is safe because the slug is ASCII after replacement.

## Task 15: Implement the new status entry and table

Make status-reports-fields and status-human-table pass.

- Add the new entry fields. For ad-hoc coders, `plan` and `tasks` are null. `branch` is the worktree directory name.
- Add one renderer that every command uses: JSON or table based on `Output`. Status prints the table with a header even when there are no rows. `--all` adds `REPO`.
- Reject any other `Output` with `unknown output format: <value>` before any client call, in every command.

## Task 16: Start plans by path

Make start-creates-worktree, start-launches-coder, start-plan-from-anywhere, and start-is-idempotent pass.

- Resolve `--plan` to an absolute, cleaned path with symlinks resolved. If it doesn't exist, fail with `plan not found: <path>`. The repo is the main checkout of the repo containing the path. The path must equal `<repo>/.agents/plans/<base>`, also with symlinks resolved. Otherwise fail with `not an active plan: <path>`. This also refuses archived plans and plans inside worktrees.
- Then follow the existing plan flow. Create the session without a title. Send prompts without `delivery`.

## Task 17: Start ad-hoc coders

Make adhoc-start-launches-coder and start-rejects-invalid-request pass.

- Argument checks first: both a plan and a prompt, then a blank prompt, then no arguments with `Interactive` false.
- Ad-hoc flow: the repo is the main checkout of `WorkDir`. The name is `AdhocName(prompt, d.Now())`. Check branch-without-worktree as for plans. Make one server call (the active list) before `git worktree add`, so an unreachable server fails before any git change. Then launch exactly as for plans, sending the prompt text unchanged.
- The `started at` message uses `ad-hoc <name>` for ad-hoc coders.

## Task 18: Add the picker

Make picker-starts-plan, picker-starts-adhoc, and picker-rejects pass.

- With no arguments and `Interactive` true: find the repo of `WorkDir`, then `Choose("start", ["plan", "ad-hoc"])`. For "plan": list the directories under `.agents/plans/` except `archive`, sorted. If there are none, fail with `no active plans in <repo>`. Otherwise `Choose("plan", names)`, then the `--plan` flow with the chosen path. For "ad-hoc": `ReadLine("prompt: ")`, then the ad-hoc flow. Map `ErrCancelled` to `cancelled`.
- Implement the real picker with `github.com/ktr0731/go-fuzzyfinder` and wire it, along with `Interactive`, in `main.go`. Run trivy over the new dependencies. If it flags a HIGH or CRITICAL issue, bump the affected module, as plan 19 did with `golang.org/x/text`.

## Task 19: Implement prompt

Make prompt-idle-coder, prompt-running-coder, prompt-rejects-invalid-request, and output-format-flag pass.

- Check `Output`, then reject blank text. Then fetch the active list (the first server call), then the coder session, with the same errors as `status <id>`.
- If the coder is idle, send with no `delivery`. If it's running, send with `queue`, or `steer` when `--steer` is set. Never interrupt.
- Print the entry, then the matching stderr message.

## Task 20: Update remove

Make remove-refuses-unsafe, remove-adhoc-coder, and remove-ignores-decisions-file pass. The merge check and its message use the branch name. Ignored files already don't show in `git status --porcelain`. If remove-ignores-decisions-file passes with no change, leave the code alone.

## Task 21: Update the coder agent's decision and commit rules

Make coder-instructions pass. Edit `src/global/agents/coder/coder.md.ts`.

- Working Unattended, step 3: record decisions in `.agents/DECISIONS.md` in the working directory, in both modes. If the file exists, read it first. Keep it true for the current result: remove or rewrite decisions that no longer hold. Never commit `.agents/DECISIONS.md`. Anything that should outlast the run goes into code comments or docs, as part of the commit.
- Ad-hoc workflow: add a step after the pipeline step. Commit the change once the pipeline is green, with a message describing it, and never push. The two workflows should differ only in the plan files.
- Follow-ups: a later prompt in the same session continues the same work. Implement it, commit, and update `.agents/DECISIONS.md`. In plan mode, don't edit the plan's files for a follow-up.
- Repoint the other `DECISIONS.md` references (the Task Status Format's skipped tasks, "Follow the spec") to `.agents/DECISIONS.md`. "Follow the user" records disagreement in `.agents/DECISIONS.md` instead of the final message.

## Task 22: Update the docs

- README `boy` section: the new command surface (`start --plan`, ad-hoc prompt, picker, `prompt`, `-o json`), the human table, and the decisions file.
- AGENTS.md: the `boy/` line now covers ad-hoc coders and `prompt`.
- `docs/orchestration-vision.md`: mention plan 20 next to plan 19 in Phase 3, and note that `boy prompt` is how the orchestrator will send review feedback.

## Task 23: Live checks (human)

live-adhoc-end-to-end and picker-in-terminal are [MANUAL]. An unattended coder leaves this task `[ ]`. The human runs them after `./install.sh`.
