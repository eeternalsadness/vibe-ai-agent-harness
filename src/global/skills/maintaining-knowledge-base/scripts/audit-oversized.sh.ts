import { config } from "../../../../../config"

export default `#!/usr/bin/env bash
# audit-oversized.sh — find notes exceeding a line count threshold
# Exit 0 = clean, exit 1 = oversized notes found, exit 2 = script error

set -euo pipefail

KB="${config.knowledgeBasePath}"
KB="\${KB/#\\~/$HOME}"
LIMIT=100

if [[ ! -d "$KB" ]]; then
  echo "Error: KB directory not found: $KB" >&2
  exit 2
fi

# Find all .md files, get line counts, filter by threshold, sort descending
results="\$(find "$KB" -name "*.md" -exec wc -l {} + 2>/dev/null \
  | awk -v limit="$LIMIT" 'NF>=2 && $1+0 > limit && $NF !~ /total$/ {count=$1; $1=""; sub(/^ /, ""); print count, $0}' \
  | sort -rn)"

if [[ -z "$results" ]]; then
  echo "No oversized notes found (threshold: $LIMIT lines)."
  exit 0
fi

count="\$(echo "$results" | wc -l | tr -d ' ')"
echo "Found \${count} oversized note(s) (>\${LIMIT} lines):"
while IFS= read -r line; do
  linecount="\$(echo "$line" | awk '{print $1}')"
  filepath="\$(echo "$line" | cut -d' ' -f2-)"
  filename="\$(basename "$filepath")"
  printf "  %-6s %s\\n" "$linecount" "$filename"
done <<< "$results"

exit 1
`
