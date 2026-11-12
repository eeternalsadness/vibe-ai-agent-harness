# Implementation: Self-Contained Install

Scenario names refer to `ACCEPTANCE.md`, the sole source of truth for assertions and exact strings.

Phases run in order:

1. **Install mechanics** - skill folders install whole, and `--clean` exists.
2. **Refactor** - workflows and reference material move out of agents into skills.
3. **Paths** - every path points into the installed config directory instead of the harness checkout.
4. **Documentation** - the root `AGENTS.md`, `README.md` and the planner's documentation rule.

Paths come after the refactor so each moved instruction has its path fixed once, in its new home, instead of twice.
Some scenarios can only pass once a later phase lands. Each is verified by the task that completes it, not the first
task that touches it.

---

## Phase 1 - Install mechanics

**Task 1 - Test harness for install scenarios.**
Add `test/integration/install-helpers.ts`. It runs the real `install.sh` with `HOME` set to a fresh temporary
directory, so nothing touches the real config. Go keeps its downloaded libraries and compiled code under `HOME`, so
pass the real `GOCACHE` and `GOMODCACHE` (read once from `go env`) through; the boy build then reuses them instead of
re-downloading and recompiling on every run. Install tests share one fresh install, made once, as the baseline for
"matches a fresh install". They run serially, because every install re-renders the repo's `dist/`.

**Task 2 - Tests for the install scenarios.**
In `test/integration/install.test.ts`, write one test per scenario: `skills-installed-whole`, `agents-installed-flat`,
`clean-install`, `clean-missing-folders`, `clean-dry-run`, `install-without-clean`.

**Task 3 - Install skill folders whole.**
In `install.sh`, replace the skills loop that copies only `*.md`: copy every file under each skill folder in
`dist/$PLATFORM/skills/`, keeping its path relative to the skill folder, through `maybe_copy`. Leave the agents loop
as it is. Verify: `agents-installed-flat`. `skills-installed-whole` passes only after Task 8, which creates the last
reference file it checks.

**Task 4 - Add `--clean`.**
Add `--clean` to the option parsing and to `--help`. Empty `agents/` and `skills/` after the boy build and before the
first copy, so any earlier failure leaves the install untouched. With `--dry-run`, print `[dry-run] delete <path>` for
each file instead of deleting. Verify: `clean-install`, `clean-missing-folders`, `clean-dry-run`,
`install-without-clean`.

---

## Phase 2 - Refactor

Each task moves whole sections, rewording only where the new home needs it. Each agent ends up naming the skill to
load before each kind of task, and allowing it with a `skill` permission. Any existing test that asserts text a task
moves is updated in that task to assert it in its new home, still checking the same thing.

**Task 5 - Tests for the refactor scenarios.**
In `test/integration/install.test.ts`, write `skill-set` and `agents-name-their-skills`.

**Task 6 - Knowledge base skills.**

- `reading-knowledge-base`: the agent's Read Task, with its three answer formats.
- `writing-knowledge-base`: the agent's Write Task and Example; the formatting rules from "Rules that apply to all
  tasks" (no em dashes, note naming, what `Index.md` lists); "update rather than duplicate"; and the delete, rename
  and split procedures from `modifying-knowledge-base`.
- Move `agents/knowledge-base/reference/zettelkasten-conventions.md.ts` to
  `skills/writing-knowledge-base/reference/zettelkasten-conventions.md.ts`.
- Delete `skills/modifying-knowledge-base/`. Point `maintaining-knowledge-base`'s orphan instruction at
  `writing-knowledge-base`.
- The agent keeps its authority over the knowledge base and "only write what you have been given". It loads
  `reading-knowledge-base` before any read and `writing-knowledge-base` before any change. Remove the obsolete
  comment at the top of `knowledge-base.md.ts` about the zettelkasten preamble.

**Task 7 - `implementing-code`.**
Move from the coder: both mode workflows, Research and Context, Code Quality Standards, and the TODO.md update rules.
For the TODO format itself, point at `writing-plans/reference/plan-format.md`. Drop both "Update documentation"
steps: the global instruction covers them. The agent keeps its personality, Working Unattended, Follow-ups and
Constraints, and loads `implementing-code` before any work.

**Task 8 - `writing-plans`.**
Move from the planner: the workflow, Research and Context, and Auto-numbering into the skill body. Move File
Conventions, plus the "keep PLAN.md free of implementation detail" and "keep TODO.md a pure checklist" constraints,
into `reference/plan-format.md`. Replace the em dashes in the TODO.md template with hyphens, per the global
instruction. The agent keeps its role, personality and "do not implement", and loads
`writing-plans` before any planning. Verify: `skills-installed-whole`.

**Task 9 - `reviewing-code`.**
Move from the reviewer: the workflow, Review Criteria and Finding Categories. The agent keeps its personality,
Feedback Principles and Constraints, and loads `reviewing-code` before any review. Verify: `skill-set`,
`agents-name-their-skills`.

---

## Phase 3 - Paths

**Task 10 - Tests for the path scenarios.**
In `test/integration/install.test.ts`, write `no-checkout-references`, `skill-paths`, `skill-commands-allowed`,
`skill-files-readable` and `cross-skill-allowlist`.

**Task 11 - One config value for the install path.**
In `config.ts`, add `opencodeConfigPath`, built from `homedir()` as `~/.config/opencode`. Templates build every
installed path from it.

**Task 12 - Skill paths.**
In every skill, name its own reference files relative to its folder, and write commands that run its scripts with the
full installed path (`${config.opencodeConfigPath}/skills/<id>/scripts/<file>`). The only cross-skill references are
the two allowlisted ones:

| From skill | To |
|---|---|
| `implementing-code` | `writing-plans/reference/plan-format.md` |
| `enriching-knowledge-base` | `evaluating-memory/scripts/append-memory.sh` |

Verify: `skill-paths`, `cross-skill-allowlist`.

**Task 13 - Agent permission paths.**
Point every `shell` and `external_directory` rule in the coder, curator, memory and knowledge-base agents at installed
paths. Each agent allows `external_directory` on the folder of every skill it loads, so it can read that skill's
reference files: `knowledge-base` needs `skills/writing-knowledge-base/**`, and `coder` needs `skills/writing-plans/**`
for the plan format. Remove the knowledge-base agent's rule for its old `agents/` reference folder, then remove
`harnessPath` from `config.ts`. Verify: `no-checkout-references`, `skill-commands-allowed`, `skill-files-readable`.

---

## Phase 4 - Documentation

These tasks have no `Verify:` line; they are checked in review.

**Task 14 - Planner documentation rule.**
In `writing-plans/reference/plan-format.md`, add to the TODO.md conventions: documentation updates are not acceptance
scenarios; they are tasks without a `Verify:` line, checked in review.

**Task 15 - Repo `AGENTS.md`.**
In the harness repo's root `AGENTS.md`, replace the "Skills use progressive disclosure" concept with two: skills
install as whole folders, and "Agents say how to behave, skills say how to work". Update the structure section so
`skills/` reads as skill folders installed whole, and the `install.sh` line mentions `--clean`.

**Task 16 - `README.md`.**

- Install examples: add `./install.sh --clean`; use only profiles defined in `config.ts`.
- Agents table: one row per agent in `src/global/agents/`, with its mode as defined in its file.
- New skills table: one row per skill in `src/global/skills/`, with what it is for and which agents load it.
- Diagram: add `curator`, and show agents loading skills.
- Memory section: keep the description of how the plugin works, and add that it still ships but currently adds little
  value, so disabling it is recommended, with `"-memory-manager"` in `plugins` in `opencode.json`.

---

## After implementation

The `no-instruction-lost` review is run by the user, not the implementing agent, before the branch is merged.
