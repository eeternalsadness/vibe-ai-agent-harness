import { config } from "../../../../../config"

export default `#!/usr/bin/env bash
# append-memory.sh — validate, append, and keep only the last 100 memory items
# Usage: append-memory.sh <tag> <project> <description>
# Exit 0 = success, exit 1 = validation or write error

set -euo pipefail

MEMORY="\${VIBE_MEMORY_FILE:-${config.memoryFilePath}}"
MAX_ITEMS=100

if [[ "$#" -ne 3 ]]; then
  echo "Expected exactly three arguments: tag, project, description" >&2
  exit 1
fi

tag="$1"
project="$2"
description="$3"

if [[ ! "$tag" =~ ^(decision|work|research|kb-enrichment)$ ]]; then
  echo "Invalid tag. Must be one of: decision, work, research, kb-enrichment" >&2
  exit 1
fi

if (( \${#description} > 150 )); then
  echo "Description exceeds 150 characters." >&2
  exit 1
fi

today="\$(date +%Y-%m-%d)"
item="- [\$today] [$tag] \$project: \$description"

mkdir -p "$(dirname "$MEMORY")"
printf '%s\n' "\$item" >> "$MEMORY"

# Extract bullet lines, keep last MAX_ITEMS, rebuild file
items="\$(grep '^- ' "$MEMORY" | tail -n $MAX_ITEMS)"
printf '# Memory\n\n%s\n' "\$items" > "$MEMORY"
`
