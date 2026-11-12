# Acceptance: Self-Contained Install

## Scenario: skills-installed-whole

**Given** `HOME` is an empty temporary directory `H`
**When** `install.sh` runs
**Then** each of these exists under `H/.config/opencode/skills/` and is byte-identical to its source in
`src/global/skills/`:

- `validating-work/scripts/pipeline_runner.py`
- `maintaining-knowledge-base/scripts/audit-dangling.sh`
- `maintaining-knowledge-base/scripts/audit-orphans.py`
- `maintaining-knowledge-base/scripts/audit-oversized.sh`
- `evaluating-memory/scripts/append-memory.sh`

**And** `writing-knowledge-base/reference/zettelkasten-conventions.md` exists
**And** `writing-plans/reference/plan-format.md` exists
**And** every skill folder under `src/global/skills/` has a matching `<id>/SKILL.md`
**And** no `__pycache__` folder and no `*.pyc` file exists under `H/.config/opencode/`

**Verify:** `bun test test/integration/install.test.ts -t "skills-installed-whole"`

## Scenario: agents-installed-flat

**Given** `HOME` is an empty temporary directory `H`
**When** `install.sh` runs
**Then** every entry in `H/.config/opencode/agents/` is a regular file ending in `.md`
**And** `H/.config/opencode/agents/` contains no folders
**And** no folder named `reference` exists anywhere under `H/.config/opencode/` outside `skills/`

**Verify:** `bun test test/integration/install.test.ts -t "agents-installed-flat"`

## Scenario: no-checkout-references

**Given** `HOME` is an empty temporary directory `H`
**When** `install.sh` runs
**Then** no file under `H/.config/opencode/` contains `dist/opencode`
**And** no file under `H/.config/opencode/` contains the harness repo's absolute path

**Verify:** `bun test test/integration/install.test.ts -t "no-checkout-references"`

## Scenario: skill-paths

**Given** `HOME` is an empty temporary directory `H`, and `S` is `H/.config/opencode/skills`
**When** `install.sh` runs
**Then** for each skill folder `S/<id>`:

- every file in `S/<id>/reference/` is named in its `SKILL.md` as `reference/<file>`
- its `SKILL.md` does not contain `S/<id>/reference/`
- every file in `S/<id>/scripts/` is named in its `SKILL.md` by its full path `S/<id>/scripts/<file>`
- its `SKILL.md` does not contain `scripts/<file>` without the `S/<id>/` prefix

**And** every `reference/<file>` named in a `SKILL.md` exists in that skill's own folder
**And** every path starting with `S/` named in any `SKILL.md` exists
**And** `creating-agent-skills` is exempt from the checks on paths it names, because its body uses example paths such
as `reference/finance.md` to teach the layout

**Verify:** `bun test test/integration/install.test.ts -t "skill-paths"`

## Scenario: skill-commands-allowed

**Given** `HOME` is an empty temporary directory `H`
**When** `install.sh` runs
**Then** for each installed agent, and each skill that agent's permissions allow by name:

- every line in a fenced code block of that skill's `SKILL.md` that starts with `bash ` or `python3 ` matches at least
  one of the agent's `shell` allow rules, using OpenCode's wildcard rules (`*` matches any characters, including `/`
  and spaces)

**And** the check covers at least these pairs:

| Agent | Skill |
|---|---|
| `coder` | `validating-work` |
| `curator` | `maintaining-knowledge-base` |
| `curator` | `enriching-knowledge-base` |
| `memory` | `evaluating-memory` |

**Verify:** `bun test test/integration/install.test.ts -t "skill-commands-allowed"`

## Scenario: skill-files-readable

**Given** `HOME` is an empty temporary directory `H`, and `S` is `H/.config/opencode/skills`
**When** `install.sh` runs
**Then** for each installed agent, and each skill `<id>` that agent's permissions allow by name, the agent has an
`external_directory` allow rule matching, by OpenCode's wildcard rules:

- every file in `S/<id>/reference/` and `S/<id>/scripts/`
- every path starting with `S/` that the skill's `SKILL.md` names

**And** the check covers at least these pairs:

| Agent | Skill | Includes |
|---|---|---|
| `knowledge-base` | `writing-knowledge-base` | `S/writing-knowledge-base/reference/zettelkasten-conventions.md` |
| `coder` | `implementing-code` | `S/writing-plans/reference/plan-format.md` |
| `coder` | `validating-work` | `S/validating-work/scripts/pipeline_runner.py` |
| `curator` | `enriching-knowledge-base` | `S/evaluating-memory/scripts/append-memory.sh` |
| `memory` | `evaluating-memory` | `S/evaluating-memory/scripts/append-memory.sh` |

**Verify:** `bun test test/integration/install.test.ts -t "skill-files-readable"`

## Scenario: cross-skill-allowlist

**Given** `HOME` is an empty temporary directory `H`, and `S` is `H/.config/opencode/skills`
**When** `install.sh` runs
**Then** the cross-skill references are exactly these, where a cross-skill reference is a path starting with
`S/<other id>/` inside any file in `S/<id>/`:

| From skill | To |
|---|---|
| `implementing-code` | `S/writing-plans/reference/plan-format.md` |
| `enriching-knowledge-base` | `S/evaluating-memory/scripts/append-memory.sh` |

**And** a reference not in the table fails the scenario
**And** a reference missing from the installed files fails the scenario

**Verify:** `bun test test/integration/install.test.ts -t "cross-skill-allowlist"`

## Scenario: skill-set

**Given** `HOME` is an empty temporary directory `H`, and `S` is `H/.config/opencode/skills`
**When** `install.sh` runs
**Then** the folders in `S` are exactly:

- `creating-agent-skills`
- `enriching-knowledge-base`
- `evaluating-memory`
- `implementing-code`
- `maintaining-knowledge-base`
- `reading-knowledge-base`
- `researching-knowledge`
- `reviewing-code`
- `validating-work`
- `writing-knowledge-base`
- `writing-plans`

**And** each `S/<id>/SKILL.md` has frontmatter `name` equal to `<id>` and a non-empty `description`
**And** no file under `H/.config/opencode/` contains `modifying-knowledge-base`

**Verify:** `bun test test/integration/install.test.ts -t "skill-set"`

## Scenario: agents-name-their-skills

**Given** `HOME` is an empty temporary directory `H`
**When** `install.sh` runs
**Then** each agent's body names each of its skills, and its permissions contain a `skill` rule with that skill as the
resource and effect `allow`:

| Agent | Skills |
|---|---|
| `coder` | `implementing-code`, `validating-work` |
| `curator` | `enriching-knowledge-base`, `maintaining-knowledge-base` |
| `knowledge-base` | `reading-knowledge-base`, `writing-knowledge-base` |
| `memory` | `evaluating-memory` |
| `planner` | `writing-plans` |
| `reviewer` | `reviewing-code` |

**Verify:** `bun test test/integration/install.test.ts -t "agents-name-their-skills"`

## Scenario: no-instruction-lost

**[MANUAL]** After the plan is implemented, start a `@reviewer` session. Ask it to compare the agents and skills in
`src/global/` on the main branch with those on the plan's branch. Confirm its report states, for each directive on the
main branch, which agent or skill now holds it, reports nothing as lost, changed in meaning, moved to a skill its agent
does not load, or duplicated across agents or skills, and ends with `Lost directives: 0`.

## Scenario: clean-install

**Given** `HOME` is a temporary directory `H`, and `C` is `H/.config/opencode`
**And** `C` already contains the files in the table
**When** `install.sh --clean` runs
**Then** each file ends in the stated state:

| Planted file | After `--clean` |
|---|---|
| `C/skills/modifying-knowledge-base/SKILL.md` | absent |
| `C/skills/validating-work/old.md` | absent |
| `C/agents/old-agent.md` | absent |
| `C/opencode.json` | byte-identical |
| `C/plugins/my-plugin.js` | byte-identical |
| `C/node_modules/pkg/index.js` | byte-identical |

**And** `C/skills/` and `C/agents/` contain exactly what a fresh install into an empty `H` produces

**Verify:** `bun test test/integration/install.test.ts -t "clean-install"`

## Scenario: clean-missing-folders

**Given** `HOME` is a temporary directory `H`, `C` is `H/.config/opencode`, and the folders are in the stated state
**When** `install.sh --clean` runs
**Then** the exit code is 0 and `C/skills/` and `C/agents/` contain exactly what a fresh install into an empty `H`
produces:

| State before |
|---|
| `C` does not exist |
| `C` exists, `C/agents/` and `C/skills/` do not |
| `C/agents/` exists and is empty, `C/skills/` does not exist |

**Verify:** `bun test test/integration/install.test.ts -t "clean-missing-folders"`

## Scenario: clean-dry-run

**Given** `HOME` is a temporary directory `H`, and `C` is `H/.config/opencode` holding a complete earlier install
plus a stale `C/skills/validating-work/old.md`
**When** `install.sh --clean --dry-run` runs
**Then** the exit code is 0
**And** every file under `C` is byte-identical to before
**And** stdout contains `[dry-run] delete <path>` for every file under `C/agents/` and `C/skills/`, including
`C/skills/validating-work/old.md`
**And** stdout contains no `[dry-run] delete` line for any other path

**Verify:** `bun test test/integration/install.test.ts -t "clean-dry-run"`

## Scenario: install-without-clean

**Given** `HOME` is a temporary directory `H`, and `C` is `H/.config/opencode` holding a complete earlier install
plus a stale `C/skills/validating-work/old.md` and `C/agents/old-agent.md`
**When** `install.sh` runs without `--clean`
**Then** `C/skills/validating-work/old.md` and `C/agents/old-agent.md` still exist, byte-identical
**And** every other file under `C/skills/` and `C/agents/` matches a fresh install into an empty `H`
**And** with `--dry-run` added, stdout contains no `[dry-run] delete` line

**Verify:** `bun test test/integration/install.test.ts -t "install-without-clean"`

---

## Out of Scope

- Changing what agents do. Instructions are moved and reworded to fit the new structure, not given new behavior. The
  exceptions are the planner's new rule for documentation tasks and dropping the coder's documentation steps, which
  the global instruction now covers.
- Whether an agent loads the right skill at the right moment at runtime. Only the manual review and real use check
  this.
- Documentation content. It is updated by tasks and checked in review, not by a scenario.
- Removing skills or agents the harness stops shipping, without `--clean`. They stay installed until a clean install.
- `plugins/`, `opencode.json` and anything else outside `agents/` and `skills/`.
- The Claude Code platform (plan 10) and the sandbox config render (plan 21).
- Model profiles.
