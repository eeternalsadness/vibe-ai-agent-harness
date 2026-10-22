# Plan 20 Implementation Decisions

## Task 2: `StartOptions.Plan` stays a plan *name* in the scaffolding step

The plan's Task 2 says to scaffold the new signatures "with no new behavior" and
puts `--plan <path>` path resolution in Task 16. The cobra surface introduced in
Task 2 already declares the flag as `--plan <path>`, but resolving that path is
behavior that belongs to Task 16.

- Chosen: `StartOptions{Plan, Prompt string}`. In Task 2 `Plan` carries the plan
  *name* and `startPlan` resolves the repo from `WorkDir`, exactly as plan 19 did.
  The cobra `--plan` flag exists but is treated as a name until Task 16 rewrites
  `startPlan` to treat it as a path. The old `start --dir` flag is removed now
  (the flag set is part of the scaffolding), so the `--dir`-based test
  `TestStartFromOtherDir` is deleted; its replacement (`start-plan-from-anywhere`)
  is written in Task 5 and made to pass in Task 16.
- Why: keeps Task 2 a pure signature refactor (build + vet + existing tests stay
  green), keeps path resolution clearly in Task 16 where the rewritten start tests
  (Task 5) exercise it, and avoids reworking `Start` twice.
- The test-first pairing: the start tests are rewritten to `--plan <path>` in Task
  5 and made to pass in Task 16, so those two tasks form one red-to-green unit and
  are committed together. The same pattern applies to the other test (3-12) /
  implement (13-21) pairs.

## Pre-existing lint failure fixed in the Task 1 commit

Two shebang'd Python scripts (`src/global/skills/validating-work/scripts/
pipeline_runner.py` and `src/global/skills/maintaining-knowledge-base/scripts/
audit-orphans.py`) lacked the executable bit, which `ruff` flagged as EXE001 and
blocked the whole pipeline. Fixed by marking them executable (`git update-index
--chmod=+x`). This is unrelated to plan 20 but was required to get the pipeline
green at all.

## Task 16: `--plan` error messages use the path as given

The scenario writes `not a git repository: <dir>`, where `<dir>` is "the
current directory (prompt or no arguments) or `<path>` (`--plan`)". For the
`--plan` form, boy reports the path exactly as the user gave it (relative or
absolute), not the resolved absolute path or the containing directory.

- Also: a `--plan` path that exists but names a file is "not an active plan"
  (the plan must be a directory), and the "not a git repository" check runs
  before that one, so a file outside any repo is "not a git repository".
- Relative `--plan` paths resolve against the current directory (the command's
  work dir), never against the process's original working directory.

## Task 18: the picker's ad-hoc branch checks the blank line itself

When the picker's "ad-hoc" step reads a line, the flow does not recurse
through `Start` (which for a non-empty prompt would be equivalent). An empty
line would not match `Start`'s `opts.Prompt != ""` branch and would fall
through to the interactive case, reopening the picker instead of failing.

- Chosen: the ad-hoc branch checks `strings.TrimSpace(line) == ""` and
  returns `prompt required` itself, then calls `startAdhoc` directly with the
  line.
- Why: the scenario requires "ad-hoc chosen and the line empty or only
  whitespace" to fail with `prompt required`, and the direct call keeps the
  flow flat instead of re-entering the `Start` switch with the same
  `Interactive: true` deps.

## Task 19: output-format-flag is split across the prompt and status units

The scenario covers `start`, `status`, and `prompt`, but its
"without `-o` stdout is the table" half needs the table renderer that Task 15
introduces, so the full test (Task 10) cannot be green in the prompt unit.

- Chosen: the `checkOutput` helper (`unknown output format: <value>`) is
  implemented in the prompt unit and wired into `Prompt` only; `start` and
  `status` get it in the status unit, together with the renderer. The
  prompt-rejects table carries an `unknown output format: yaml` case (with a
  no-client-calls assertion) so the prompt side is tested now. The remaining
  output-format-flag assertions (table vs JSON for `""`/`json` on all three
  commands, and the `--output` long form in `main_test.go`) land with the
  status unit, where the scenario becomes fully green.
- Why: keeps each committed unit green while following the task order, and
  puts the "every command" rejection where the renderer already touches every
  command.

## Task 20: remove needed no code change

The plan 19 implementation already met all three remove scenarios: the merge
check takes the branch from the worktree directory name, which is the ad-hoc
name for ad-hoc coders, and the message is already `branch not merged:
<branch>`. An ignored `.agents/DECISIONS.md` never appears in `git status
--porcelain`. The new tests (ad-hoc unmerged case, ad-hoc removal, decisions
file) pass against the unchanged code, as the task anticipated.
