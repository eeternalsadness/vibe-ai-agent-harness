# Agent Instructions — vibe-ai-agent-harness

## What This Repo Is

A **build and install pipeline** for an AI coding assistant harness. It is not an application. It generates configuration files — agent instructions, skills, and a runtime plugin — and copies them into `~/.config/opencode/`.

## Philosophy

See [README.md](./README.md) for the system philosophy and design.

## Structure

```
config.ts                    # User-editable: paths and model IDs imported by all templates
install.sh                   # Renders templates → dist/, then copies to ~/.config/opencode/ (--clean removes stale agents/ and skills/ files first)
src/render.ts                # Walks src/global/, imports each *.md.ts, writes strings to dist/

src/global/                  # Platform-agnostic: instructions, agents, skills (TypeScript template literals)
  AGENTS.md.ts               # Global agent instructions (the installed AGENTS.md)
  agents/                    # Subagent definitions
  skills/                    # Skill folders, each installed whole (<id>/ with its reference/ and scripts/ files)

src/platforms/opencode/      # OpenCode-specific runtime code (non-portable)
  plugins/memory-manager.ts  # Plugin: injects memory into system prompt, exposes remember() tool

boy/                         # Go CLI (own module, cobra/viper) that runs plan and ad-hoc coders in background git worktrees
                             # start / prompt / status / remove; attaches to the running opencode server, never starts one

dist/                        # .gitignored — generated output written by render.ts, installed by install.sh
.agents/plans/               # Planning docs for ongoing and completed work
```

## Key Concepts

**Template literal pipeline.** All installable content lives in `.md.ts` files that export a default string. `config.ts` is imported to inject configurable values at render time. `src/render.ts` produces the final strings in `dist/`.

**Two-layer separation.** `src/global/` is portable — intended to support multiple platforms. `src/platforms/<platform-name>/` is narrow and explicit; currently only OpenCode. New platforms get their own directory under `src/platforms/`.

**Skills install as whole folders.** Each `<id>/` under `src/global/skills/` is copied whole into `~/.config/opencode/skills/<id>/`, including its `reference/` and `scripts/` files. A skill names its own reference files relative to its folder and its scripts by full installed path; cross-skill references are limited to an allowlist (enforced by the install tests).

**Agents say how to behave, skills say how to work.** An agent file carries frontmatter (model, mode, permissions) plus a compact personality and constraints. The workflow lives in the skills it loads before acting; every loaded skill has an explicit `skill` allow rule and an `external_directory` rule for the files that skill names.

## Working in This Repo

- Edit `.md.ts` files in `src/global/` to change agent instructions, skill definitions, or agent prompts.
- Edit `src/platforms/opencode/plugins/memory-manager.ts` to change plugin behavior.
- Edit `config.ts` to change paths or model IDs.
- Edit `boy/` (Go) to change the orchestration CLI; its tests run with `go -C boy test ./...` and are part of the validation pipeline.
- `dist/` is generated — never edit it directly.
