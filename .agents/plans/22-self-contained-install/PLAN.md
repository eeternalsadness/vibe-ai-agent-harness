# Plan: Self-Contained Install

## Problem

Installed skills and agents are split across two places. `install.sh` installs only their markdown files; a skill's
`scripts/` and `reference/`, and an agent's reference files, stay in the harness checkout, and the installed files
point back at `<harness>/dist/opencode/...` to reach them. Everything a skill or agent needs should be installed
alongside it.

Agents also mix two jobs. Their instructions say how they behave, but several also carry whole workflows, formats and
conventions inline. Agents should say how to behave; skills should hold the workflows and the material those workflows
need.

## Goals

1. **Self-contained install** - every file a skill or agent references is installed; nothing points at the harness
   checkout.
2. **One folder per skill** - a skill's `SKILL.md`, `scripts/` and `reference/` install together into its folder. The
   body names its own reference files relative to that folder, and gives commands that run its scripts as the full
   installed path.
3. **Agents say how to behave, skills say how to work** - an agent is a single markdown file holding its role,
   personality, behavior and constraints, and which skill to load for which task. Workflows, formats and conventions
   live in skills.
4. **No instruction lost** - every directive in today's agents and skills survives the refactor, in the agent or skill
   that now owns it, and material shared between workflows exists once.
5. **Clean install on request** - `install.sh --clean` empties `agents/` and `skills/` before copying, so nothing left
   over from earlier installs can affect a skill or agent.

## Design Decisions

### Skills install as whole folders

Each skill's folder is installed as a whole, including `scripts/` and `reference/`. OpenCode treats a folder containing
`SKILL.md` as one skill and does not look inside it, so support files never load as skills of their own.

### Agents stay flat; their material moves into skills

Agents remain single files. OpenCode cannot hold per-agent folders: it names an agent by its path and loads every
markdown file under `agents/` as an agent, so an agent's reference files would become agents themselves. Material an
agent needs moves into the skill whose workflow uses it.

### What stays in an agent, what moves to a skill

An agent keeps its role, personality, behavior, constraints and permissions, and says which skill to load before each
kind of task. Multi-step procedures, reference material such as conventions, formats and criteria, and anything shared
between workflows move into skills.

Applied to today's agents, the knowledge-base, coder, planner and reviewer agents give up their workflows to new
skills, and `modifying-knowledge-base` merges into the new knowledge-base writing skill, since both change the
knowledge base and share its conventions. `research` stays as it is: its short procedure is the agent's whole job.

### Reference files are relative; commands and outside references use full installed paths

A skill names its own reference files relative to its folder; OpenCode tells the agent the skill's base directory when
it loads. Commands that run a skill's scripts are written out with the full installed path, because they run from the
working directory and must match permission rules exactly. Anything else outside the skill's folder, such as references
into another skill, also uses the full installed path. Cross-skill references couple skills together, so they are kept
to a short explicit allowlist, and any reference not on it is a defect.

### `--clean` empties `agents/` and `skills/`, and only those

Without `--clean`, install copies over what is there, as today. With `--clean`, it first empties `agents/` and
`skills/`, which hold only harness output, so the result is exactly what the harness ships. Nothing else in the config
directory is deleted.

### "No instruction lost" is checked mechanically

Before anything moves, the directives in today's agents and skills are captured as a fixture. After the refactor, each
must still appear in the agent or skill that now owns it. A dropped rule fails a test instead of going unnoticed.
