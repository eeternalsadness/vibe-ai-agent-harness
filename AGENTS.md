# Agent Instructions — vibe-ai-agent-harness

## What This Repo Is

A **build and install pipeline** for an AI coding assistant harness. It is not an application. It generates configuration files — agent instructions, skills, and a runtime plugin — and copies them into `~/.config/opencode/`.

## Philosophy

See [README.md](./README.md) for the system philosophy and design.

## Structure

```
config.ts                    # User-editable: paths and model IDs imported by all templates
install.sh                   # Renders templates → dist/, then copies to ~/.config/opencode/
src/render.ts                # Walks src/global/, imports each *.md.ts, writes strings to dist/

src/global/                  # Platform-agnostic: instructions, agents, skills (TypeScript template literals)
  AGENTS.md.ts               # Global agent instructions (the installed AGENTS.md)
  agents/                    # Subagent definitions
  skills/                    # Skill definitions

src/platforms/opencode/      # OpenCode-specific runtime code (non-portable)
  plugins/memory-manager.ts  # Plugin: injects memory into system prompt, exposes remember() tool

dist/                        # .gitignored — generated output written by render.ts, installed by install.sh
.agents/plans/               # Planning docs for ongoing and completed work
```

## Key Concepts

**Template literal pipeline.** All installable content lives in `.md.ts` files that export a default string. `config.ts` is imported to inject configurable values at render time. `src/render.ts` produces the final strings in `dist/`.

**Two-layer separation.** `src/global/` is portable — intended to support multiple platforms. `src/platforms/<platform-name>/` is narrow and explicit; currently only OpenCode. New platforms get their own directory under `src/platforms/`.

**Skills use progressive disclosure.** The skill body loads on trigger; reference subdirectories are never installed and are accessed only via the repo path.

## Working in This Repo

- Edit `.md.ts` files in `src/global/` to change agent instructions, skill definitions, or agent prompts.
- Edit `src/platforms/opencode/plugins/memory-manager.ts` to change plugin behavior.
- Edit `config.ts` to change paths or model IDs.
- `dist/` is generated — never edit it directly.
