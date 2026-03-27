# Plan: Repo Restructure

## Problem

The repo is currently set up with symlinks from `~/.config/opencode/` pointing directly into the repo. This makes `AGENTS.md` serve as both global instructions and project instructions simultaneously — there's no way to have project-specific instructions for working inside the harness itself.

## Goals

- Add a project-specific `AGENTS.md` for the harness repo
- Replace symlinks with a one-shot install script
- Support templating for configurable values (paths, model names) in instructions/agents/skills files
- Keep platform-agnostic content separate from platform-specific content
- Remain extensible to other platforms (e.g. Claude Code) in the future

## Design Decisions

- **Install mechanism:** Single `install.sh` bash script (no Makefile, no remote install)
- **Templating:** TypeScript template literals — source files are `.md.ts`, each exports a default string
- **Config:** `config.ts` at repo root — user-editable, imported by all templates
- **Render step:** `src/render.ts` — Bun entry point, imports all templates, writes to `dist/`
- **No root `package.json`:** Render step is dependency-free; `bun run` is sufficient
- **Plugin install:** Global only (`~/.config/opencode/plugins/`); project-local `.opencode/plugins/` removed
- **`opencode.json`:** Not touched — stays in dotfiles repo; project-level merge not needed yet
- **`dist/`:** Gitignored — always regenerated from source

## Philosophy

- Platform-agnostic layer: `AGENTS.md`, `agents/`, `skills/` (portable open standards)
- Platform-specific layer: `plugins/` (OpenCode-only, acknowledged as non-portable)
- Provider/platform agnostic language throughout

## Target Structure

```
vibe-ai-agent-harness/
│
├── AGENTS.md                          # Project-specific instructions (plain .md, written separately)
├── config.ts                          # User-editable: paths, model IDs, fallbacks
├── install.sh                         # Install entry point
│
├── src/
│   ├── render.ts                      # Renders all templates → dist/
│   │
│   ├── global/                        # Platform-agnostic content (TS template literals)
│   │   ├── AGENTS.md.ts               # → dist/opencode/AGENTS.md
│   │   ├── agents/
│   │   │   ├── knowledge-base/
│   │   │   │   ├── knowledge-base.md.ts
│   │   │   │   └── reference/
│   │   │   │       └── zettelkasten-conventions.md.ts
│   │   │   └── memory/
│   │   │       └── memory.md.ts
│   │   └── skills/
│   │       └── creating-agent-skills/
│   │           ├── SKILL.md.ts
│   │           └── reference/
│   │               └── opencode-conventions.md.ts
│   │
│   └── platforms/
│       └── opencode/
│           └── plugins/
│               └── memory-manager.ts  # Copied as-is (not a template)
│
├── dist/                              # .gitignored — generated output
│   └── opencode/
│       ├── AGENTS.md
│       ├── agents/
│       │   └── knowledge-base/
│       │       ├── knowledge-base.md          # installed flat → ~/.config/opencode/agents/knowledge-base.md
│       │       └── reference/
│       │           └── zettelkasten-conventions.md  # NOT installed; referenced by path from repo
│       ├── skills/
│       └── plugins/
│
├── .opencode/                         # Project-local OpenCode runtime (plugins/ removed)
│   └── .gitignore
│
└── .agents/plans/                     # Internal planning docs
```

## `config.ts` Shape

```typescript
export const config = {
  knowledgeBasePath: "~/Repo/vibe-coding/vibe-context/knowledge",
  harnessPath: "~/Repo/vibe-coding/vibe-ai-agent-harness",

  models: {
    primary: "anthropic/claude-sonnet-4-5",
    small: "anthropic/claude-haiku-4-5",
    fallbacks: ["openai/gpt-4o", "google/gemini-2.0-flash"],
  },
}
```

## `install.sh` Flow

1. Parse flags: `--dry-run`, `--force`, `--help`
2. Check `bun` is available
3. `bun run src/render.ts` — renders templates to `dist/opencode/`
4. Copy `dist/opencode/AGENTS.md` → `~/.config/opencode/AGENTS.md`
5. Copy each agent `.md` flat: `dist/opencode/agents/**/*.md` → `~/.config/opencode/agents/<name>.md` (reference subdirs are NOT copied)
6. Copy `dist/opencode/skills/` → `~/.config/opencode/skills/`
7. Copy `dist/opencode/plugins/` → `~/.config/opencode/plugins/`
8. `bun install` in `~/.config/opencode/` (plugin dependencies)
9. Report what was installed

## Migration Steps

1. Create `config.ts`
2. Create `src/render.ts`
3. Convert `agents/` → `src/global/agents/` (`.md` → `.md.ts` template literals)
4. Convert `skills/` → `src/global/skills/` (`.md` → `.md.ts` template literals)
5. Convert `AGENTS.md` → `src/global/AGENTS.md.ts`
6. Move `plugins/memory-manager.ts` → `src/platforms/opencode/plugins/memory-manager.ts`
7. Delete `agents/`, `skills/`, `plugins/` at repo root
8. Delete `.opencode/plugins/`
9. Write `install.sh`
10. Add `dist/` to `.gitignore`
11. Clear root `AGENTS.md` (project-specific content written separately)

## Future Work

- Add Claude Code platform support under `src/platforms/claude-code/`
- Add model names to agent/skill frontmatter via config
- Fix stale path reference in `zettelkasten-conventions.md`
