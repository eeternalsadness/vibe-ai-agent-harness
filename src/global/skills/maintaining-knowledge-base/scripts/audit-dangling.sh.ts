import { config } from "../../../../../config"

export default `#!/usr/bin/env bash
# audit-dangling.sh — find [[wiki-links]] with no corresponding .md file
# Exit 0 = clean, exit 1 = dangling links found, exit 2 = script error

set -euo pipefail

KB="${config.knowledgeBasePath}"
KB="\${KB/#\\~/$HOME}"

if [[ ! -d "$KB" ]]; then
  echo "Error: KB directory not found: $KB" >&2
  exit 2
fi

declare -A targets   # target title -> 1 if file exists
declare -A sources   # target title -> newline-separated source files

# Build set of all note titles (filename without .md)
while IFS= read -r -d '' f; do
  title="\$(basename "$f" .md)"
  targets["$title"]=1
done < <(find "$KB" -maxdepth 1 -name "*.md" -print0)

# Scan all notes for [[wiki-links]], strip fenced code blocks first
found=0
while IFS= read -r -d '' f; do
  # Strip fenced code blocks, then extract [[links]]
  links="\$(awk '/^\`\`\`/{in_block=!in_block; next} !in_block' "$f" | grep -oP '\\[\\[\\K[^\\]]+(?=\\]\\])' || true)"
  while IFS= read -r link; do
    [[ -z "$link" ]] && continue
    if [[ -z "\${targets[$link]+x}" ]]; then
      sources["$link"]="\${sources[$link]:-}\${f#$KB/}\\n"
      found=1
    fi
  done <<< "$links"
done < <(find "$KB" -maxdepth 1 -name "*.md" -print0)

if [[ $found -eq 0 ]]; then
  echo "No dangling links found."
  exit 0
fi

count="\${#sources[@]}"
echo "Found \${count} dangling link(s):"
echo ""
for link in "\${!sources[@]}"; do
  echo "  [[$link]]"
  while IFS= read -r src; do
    [[ -z "$src" ]] && continue
    echo "    <- $src"
  done <<< "\$(echo -e "\${sources[$link]}")"
done

exit 1
`
