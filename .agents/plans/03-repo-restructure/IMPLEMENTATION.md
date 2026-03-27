# Implementation: Repo Restructure

## Task 1 — Create `config.ts`

Create `config.ts` at repo root with the exact shape from PLAN.md `## Config.ts Shape`. This file is imported by all templates — no logic, just a plain export.

## Task 2 — Create `src/` directory structure

```
src/
├── global/
│   ├── agents/
│   │   ├── knowledge-base/reference/
│   │   └── memory/
│   └── skills/creating-agent-skills/reference/
└── platforms/opencode/plugins/
```

`mkdir -p` all leaf directories.

## Task 3 — Convert `agents/` → `src/global/agents/`

For each `.md` file under `agents/`, create a corresponding `.md.ts` file under `src/global/agents/` that:

- `import { config } from "<relative path to repo root>/config"`
- `export default \`...\`` — the file content verbatim as a template literal
- Interpolates `config.knowledgeBasePath` and `config.harnessPath` wherever those paths appear as hardcoded strings

Files to convert:

| Source | Destination | Interpolation needed |
|---|---|---|
| `agents/knowledge-base/knowledge-base.md` | `src/global/agents/knowledge-base/knowledge-base.md.ts` | `config.knowledgeBasePath` (knowledge base path), `config.harnessPath` (zettelkasten ref path, permission rule) |
| `agents/knowledge-base/reference/zettelkasten-conventions.md` | `src/global/agents/knowledge-base/reference/zettelkasten-conventions.md.ts` | `config.knowledgeBasePath` (stale `vibe-knowledge-base` repo reference in lines 7 and 107) |
| `agents/memory/memory.md` | `src/global/agents/memory/memory.md.ts` | None |

**Escaping rule:** Any backtick inside the template literal must be escaped as `` \` ``. This includes fenced code blocks (`` ``` `` → `` \`\`\` ``).

## Task 4 — Convert `skills/` → `src/global/skills/`

Same pattern as Task 3.

| Source | Destination | Interpolation needed |
|---|---|---|
| `skills/creating-agent-skills/SKILL.md` | `src/global/skills/creating-agent-skills/SKILL.md.ts` | None |
| `skills/creating-agent-skills/reference/opencode-conventions.md` | `src/global/skills/creating-agent-skills/reference/opencode-conventions.md.ts` | None |

Apply the same backtick escaping rule.

## Task 5 — Convert `AGENTS.md` → `src/global/AGENTS.md.ts`

Same pattern. Interpolate `config.knowledgeBasePath` wherever the knowledge base path appears.

Output path: `dist/opencode/AGENTS.md`

## Task 6 — Move plugin

Copy (not rename) `plugins/memory-manager.ts` → `src/platforms/opencode/plugins/memory-manager.ts` verbatim. This file is not a template and receives no modifications.

## Task 7 — Create `src/render.ts`

Bun entry point. No external dependencies.

```
import each .md.ts template
import { mkdir, writeFile } from "node:fs/promises"

define output map: [distPath, templateContent][]
  src/global/AGENTS.md.ts              → dist/opencode/AGENTS.md
  src/global/agents/**/*.md.ts         → dist/opencode/agents/**/*.md
  src/global/skills/**/*.md.ts         → dist/opencode/skills/**/*.md

for each [distPath, content]:
  mkdir -p dirname(distPath)
  writeFile(distPath, content)
  log distPath
```

Plugin is not rendered here — it is copied by `install.sh` directly from source.

## Task 8 — Create `install.sh`

Executable bash script at repo root. Uses `set -euo pipefail`.

```
parse flags: --dry-run, --force, --help
check bun in PATH → exit 1 if missing

bun run src/render.ts

copy dist/opencode/AGENTS.md           → ~/.config/opencode/AGENTS.md
copy dist/opencode/agents/             → ~/.config/opencode/agents/
copy dist/opencode/skills/             → ~/.config/opencode/skills/
copy src/platforms/opencode/plugins/memory-manager.ts → ~/.config/opencode/plugins/memory-manager.ts

bun install in ~/.config/opencode/

report installed files
```

`--dry-run`: print all planned actions, skip all writes and `bun` invocations.

Note: plugins are copied from source (not `dist/`) since they are not rendered.

## Task 9 — Add `.gitignore`

Create `.gitignore` at repo root containing `dist/`.

## Task 10 — Delete superseded files

```bash
rm -rf agents/ skills/ plugins/
rm -rf .opencode/plugins/ .opencode/node_modules/ .opencode/package.json .opencode/bun.lock
```

`.opencode/` directory and its `.gitignore` are retained (OpenCode uses the directory for runtime state).

## Task 11 — Verify

1. `bun run src/render.ts` — no errors, 6 files written under `dist/opencode/`
2. Spot-check one rendered file: confirm config values are interpolated (no `${config...}` literals remain)
3. `bash install.sh --dry-run` — all copy operations printed, nothing written
4. `bash install.sh` — files land in `~/.config/opencode/`, `bun install` completes
5. `git status` — `dist/` does not appear as untracked
