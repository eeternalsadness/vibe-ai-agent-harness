#!/usr/bin/env bash
# append-memory.sh — validate, append, and keep only the last 100 memory items
# Usage: append-memory.sh <memory-file> <tag> <project> <description>
# Exit 0 = success, exit 1 = validation or write error

set -euo pipefail

MAX_ITEMS=100

if [[ "$#" -ne 4 ]]; then
  echo "Expected exactly four arguments: memory-file, tag, project, description" >&2
  exit 1
fi

memory="$1"
tag="$2"
project="$3"
description="$4"

if [[ ! "$tag" =~ ^(decision|work|research|kb-enrichment)$ ]]; then
  echo "Invalid tag. Must be one of: decision, work, research, kb-enrichment" >&2
  exit 1
fi

if (( ${#description} > 150 )); then
  echo "Description exceeds 150 characters." >&2
  exit 1
fi

today="$(date +%Y-%m-%d)"
item="- [$today] [$tag] $project: $description"

mkdir -p "$(dirname "$memory")"
printf '%s\n' "$item" >> "$memory"

# Extract bullet lines, keep last MAX_ITEMS, rebuild file
items="$(grep '^- ' "$memory" | tail -n $MAX_ITEMS)"
printf '# Memory\n\n%s\n' "$items" > "$memory"
