import { config } from "../../../../../config"

export default `#!/usr/bin/env bash
# append-memory.sh — validate, append, and keep only the last 100 memory items
# Exit 0 = success, exit 1 = validation or write error

set -euo pipefail

MEMORY="\${VIBE_MEMORY_FILE:-${config.memoryFilePath}}"
MAX_ITEMS=100
FORMAT_RE='^- \\[(decision|work|research|kb-enrichment)\\] [^:]+: .+$'

if [[ "$#" -ne 1 ]]; then
  echo "Expected exactly one memory item argument." >&2
  exit 1
fi

item="$1"

if [[ ! "$item" =~ $FORMAT_RE ]]; then
  echo "Invalid memory item format. Expected: - [tag] project: description" >&2
  exit 1
fi

if (( \${#item} > 150 )); then
  echo "Memory item exceeds 150 characters." >&2
  exit 1
fi

mkdir -p "$(dirname "$MEMORY")"
printf '%s\n' "$item" >> "$MEMORY"

# Extract bullet lines, keep last MAX_ITEMS, rebuild file
items="$(grep '^- ' "$MEMORY" | tail -n $MAX_ITEMS)"
printf '# Memory\n\n%s\n' "$items" > "$MEMORY"
`
