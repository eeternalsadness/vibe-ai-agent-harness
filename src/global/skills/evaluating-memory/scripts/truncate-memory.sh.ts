import { config } from "../../../../../config"

export default `#!/usr/bin/env bash
# truncate-memory.sh — keep only the last 100 bullet items in Memory.md
# Exit 0 = success, exit 1 = error

set -euo pipefail

MEMORY="${config.memoryFilePath}"
MAX_ITEMS=100

if [[ ! -f "$MEMORY" ]]; then
  echo "Memory file not found: $MEMORY" >&2
  exit 1
fi

# Extract bullet lines, keep last MAX_ITEMS, rebuild file
items="\$(grep '^- ' "$MEMORY" | tail -n $MAX_ITEMS)"
count="\$(echo "$items" | grep -c '^- ' || true)"

printf '# Memory\\n\\n%s\\n' "$items" > "$MEMORY"
echo "Truncated to $count items."
`
