#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCODE_CONFIG="${HOME}/.config/opencode"

DRY_RUN=false
FORCE=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Renders templates and installs files to ~/.config/opencode/.

Options:
  --dry-run   Print planned actions without writing anything
  --force     Overwrite existing files without prompting
  --help      Show this help message
EOF
  exit 0
}

log() {
  echo "$@"
}

maybe_copy() {
  local src="$1"
  local dst="$2"
  if [ "$DRY_RUN" = true ]; then
    log "[dry-run] copy $src → $dst"
  else
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    log "installed $dst"
  fi
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --force)   FORCE=true; shift ;;
    --help)    usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Check bun
if ! command -v bun &>/dev/null; then
  echo "Error: bun not found in PATH" >&2
  exit 1
fi

# Render templates
if [ "$DRY_RUN" = true ]; then
  log "[dry-run] bun run src/render.ts"
else
  bun run "$SCRIPT_DIR/src/render.ts"
fi

# Install AGENTS.md
maybe_copy \
  "$SCRIPT_DIR/dist/opencode/AGENTS.md" \
  "$OPENCODE_CONFIG/AGENTS.md"

# Install agent .md files flat (skip reference/ subdirs)
while IFS= read -r -d '' src; do
  name="$(basename "$src")"
  maybe_copy "$src" "$OPENCODE_CONFIG/agents/$name"
done < <(find "$SCRIPT_DIR/dist/opencode/agents" -maxdepth 2 -name "*.md" -not -path "*/reference/*" -print0)

# Install skills .md files flat per skill dir (skip reference/ subdirs)
while IFS= read -r -d '' src; do
  skill_dir="$(basename "$(dirname "$src")")"
  name="$(basename "$src")"
  maybe_copy "$src" "$OPENCODE_CONFIG/skills/$skill_dir/$name"
done < <(find "$SCRIPT_DIR/dist/opencode/skills" -maxdepth 2 -name "*.md" -not -path "*/reference/*" -print0)

# Install plugin
maybe_copy \
  "$SCRIPT_DIR/src/platforms/opencode/plugins/memory-manager.ts" \
  "$OPENCODE_CONFIG/plugins/memory-manager.ts"

log ""
log "done"
