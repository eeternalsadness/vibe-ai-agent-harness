#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCODE_CONFIG="${HOME}/.config/opencode"

DRY_RUN=false
CLEAN=false
PROFILE=""
PLATFORM="opencode"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Renders templates and installs files to ~/.config/opencode/.

Options:
  --dry-run           Print planned actions without writing anything
  --clean             Remove agents/ and skills/ before installing
  --profile <name>    Select a profile (default: from config.ts)
  --platform <name>   Target platform (default: "opencode")
  --help              Show this help message
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
    --dry-run)   DRY_RUN=true; shift ;;
    --clean)     CLEAN=true; shift ;;
    --profile)   PROFILE="$2"; shift 2 ;;
    --platform)  PLATFORM="$2"; shift 2 ;;
    --help)      usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Check bun
if ! command -v bun &>/dev/null; then
  echo "Error: bun not found in PATH" >&2
  exit 1
fi

# Resolve available profiles and default from config.ts
PROFILES=$(bun -e "import { config } from './config.ts'; console.log(Object.keys(config.profiles).join(' '))")
DEFAULT_PROFILE=$(bun -e "import { config } from './config.ts'; console.log(config.defaultProfile)")

# Default to config's defaultProfile if not provided via --profile
if [ -z "$PROFILE" ]; then
  PROFILE="$DEFAULT_PROFILE"
fi

# Validate selected profile exists
if ! echo "$PROFILES" | grep -qw "$PROFILE"; then
  echo "Error: unknown profile \"$PROFILE\". Available: $PROFILES" >&2
  exit 1
fi

log "Using profile: $PROFILE"
log "Target platform: $PLATFORM"

# Render templates
if [ "$DRY_RUN" = true ]; then
  log "[dry-run] rm -rf $SCRIPT_DIR/dist/$PLATFORM"
  log "[dry-run] bun run src/render.ts $PLATFORM $PROFILE"
else
  rm -rf "$SCRIPT_DIR/dist/$PLATFORM"
  bun run "$SCRIPT_DIR/src/render.ts" "$PLATFORM" "$PROFILE"
fi

# Bundle plugin
if [ "$DRY_RUN" = true ]; then
  log "[dry-run] bun build src/platforms/$PLATFORM/plugins/memory-manager.ts → dist/$PLATFORM/plugins/memory-manager.js"
else
  bun build "$SCRIPT_DIR/src/platforms/$PLATFORM/plugins/memory-manager.ts" \
    --target=bun \
    --external=@opencode/plugin \
    --outfile="$SCRIPT_DIR/dist/$PLATFORM/plugins/memory-manager.js"
  log "bundled dist/$PLATFORM/plugins/memory-manager.js"
fi

# Build and install boy
BOY_BIN="${HOME}/.local/bin/boy"
if ! command -v go &>/dev/null; then
  echo "Error: go not found in PATH (needed to build boy)" >&2
  exit 1
fi
if [ "$DRY_RUN" = true ]; then
  log "[dry-run] go -C $SCRIPT_DIR/boy build -o $BOY_BIN ."
else
  mkdir -p "$(dirname "$BOY_BIN")"
  go -C "$SCRIPT_DIR/boy" build -o "$BOY_BIN" .
  log "installed $BOY_BIN"
fi

# With --clean, empty agents/ and skills/ after the boy build and before the
# first copy, so any earlier failure leaves the install untouched. Missing
# folders are tolerated. With --dry-run, print a delete line per file.
if [ "$CLEAN" = true ]; then
  for dir in "$OPENCODE_CONFIG/agents" "$OPENCODE_CONFIG/skills"; do
    if [ -d "$dir" ]; then
      if [ "$DRY_RUN" = true ]; then
        while IFS= read -r -d '' file; do
          log "[dry-run] delete $file"
        done < <(find "$dir" -type f -print0)
      else
        rm -rf "$dir"
      fi
    fi
  done
fi

# Install AGENTS.md
maybe_copy \
  "$SCRIPT_DIR/dist/$PLATFORM/AGENTS.md" \
  "$OPENCODE_CONFIG/AGENTS.md"

# Install agent .md files flat (skip reference/ subdirs)
while IFS= read -r -d '' src; do
  name="$(basename "$src")"
  maybe_copy "$src" "$OPENCODE_CONFIG/agents/$name"
done < <(find "$SCRIPT_DIR/dist/$PLATFORM/agents" -maxdepth 2 -name "*.md" -not -path "*/reference/*" -print0)

# Install skill folders whole: every file, path kept relative to the skill dir
while IFS= read -r -d '' src; do
  rel="${src#"$SCRIPT_DIR/dist/$PLATFORM/skills/"}"
  skill_dir="${rel%%/*}"
  maybe_copy "$src" "$OPENCODE_CONFIG/skills/$skill_dir/${rel#*/}"
done < <(find "$SCRIPT_DIR/dist/$PLATFORM/skills" -type f -print0)

# Install plugin
maybe_copy \
  "$SCRIPT_DIR/dist/$PLATFORM/plugins/memory-manager.js" \
  "$OPENCODE_CONFIG/plugins/memory-manager.js"

log ""
log "done"
