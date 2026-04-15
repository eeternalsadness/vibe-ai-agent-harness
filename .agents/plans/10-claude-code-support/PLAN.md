# Plan: Claude Code Platform Support

## Problem

The harness currently only supports OpenCode. Claude Code is a major AI coding platform with different configuration conventions, and the harness was designed from the start to support both platforms. The architecture is already in place (`src/global/` for portable content, `src/platforms/<platform>/` for platform-specific runtime code), but the Claude Code implementation hasn't been built yet.

**Key differences between platforms:**

1. **Global instructions file** — OpenCode auto-loads `AGENTS.md`, Claude Code auto-loads `CLAUDE.md`
2. **Agent YAML frontmatter syntax** — OpenCode uses `permission:` blocks, Claude Code uses `tools:` arrays and different permission rule syntax
3. **Memory implementation** — OpenCode memory manager uses JS plugin SDK; Claude Code needs hooks-based implementation using its native hook system
4. **Install location** — OpenCode installs to `~/.config/opencode/`, Claude Code installs to `~/.claude/`
5. **Platform-specific paths** — References like `dist/opencode/agents/...` need to be platform-aware

Users cannot install the harness for Claude Code until the platform compatibility layer is implemented.

## Goals

1. **Multi-platform install** — `./install.sh --platform claudecode` renders templates and installs to `~/.claude/`
2. **Hooks-based memory manager** — equivalent memory functionality using Claude Code's hook system
3. **Shared memory file** — both platforms write to the same `Memory.md` (configurable via `config.ts`)
4. **Reusable global content** — agents, skills, and instructions from `src/global/` work on both platforms with appropriate translation
5. **Platform-agnostic templates** — frontmatter and paths render correctly per platform

## Design Decisions

**Platform parameter in templates**
- Add `platform` parameter to all template functions
- Templates use conditionals for platform-specific frontmatter and paths
- Render pipeline passes platform through

**Hook-based memory for Claude Code**
- Use `Stop` hook (equivalent to OpenCode's `session.idle`)
- Same temp file deduplication as Memory Plugin V3
- Identical behavior across platforms

**Inline translation in templates**
- No separate translation layer
- Platform conditionals in each template

**Platform-specific install functions**
- Extend `install.sh` with Claude Code logic
- Platform-specific steps isolated to functions

## Success Criteria

1. **Install works** — `./install.sh --platform claudecode` installs to `~/.claude/`
2. **Memory functions** — automatic capture identical to OpenCode
3. **Shared memory** — both platforms use same Memory.md path
4. **Correct rendering** — frontmatter and paths appropriate per platform
