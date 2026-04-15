# Implementation: Claude Code Platform Support

This plan depends on Memory Plugin V3 being completed first.

## Tasks

### 1. Add platform parameter to render pipeline
- Update `src/render.ts` to accept and pass platform parameter
- Update all template function signatures to accept platform
- Update template calls to pass platform through

### 2. Update all agent templates for platform awareness
- Add platform conditionals for frontmatter (permission vs tools syntax)
- Add platform conditionals for paths (dist/opencode vs dist/claudecode)
- Test rendering for both platforms

### 3. Create CLAUDE.md template
- Create `src/global/CLAUDE.md.ts` (or reuse AGENTS.md.ts with platform conditionals)
- Ensure content appropriate for Claude Code

### 4. Create Claude Code hooks
- Create `src/platforms/claudecode/hooks/` directory
- Implement Stop hook script (memory evaluation)
- Implement SessionEnd hook script (temp file cleanup)
- Make scripts executable

### 5. Create hooks configuration template
- Create `src/platforms/claudecode/hooks.json.ts`
- Register Stop and SessionEnd hooks
- Template renders to `dist/claudecode/hooks/hooks.json`

### 6. Extend install.sh for Claude Code
- Add `install_claudecode()` function
- Copy CLAUDE.md to `~/.claude/`
- Copy agents to `~/.claude/agents/`
- Copy skills to `~/.claude/skills/`
- Copy hooks to `~/.claude/hooks/`
- Make hook scripts executable

### 7. Test installation
- Run `./install.sh --platform claudecode --profile copilot`
- Verify files in `~/.claude/`
- Verify frontmatter correct for Claude Code
- Verify paths point to claudecode dist

### 8. Test memory workflow
- Start Claude Code session
- Have multi-turn conversation with decisions
- Verify Memory.md updated automatically
- Verify temp file created and cleaned up
- Verify same Memory.md used by both platforms

### 9. Update documentation
- Update README.md with Claude Code support
- Update AGENTS.md (repo root) with platform notes
- Document platform differences if any
