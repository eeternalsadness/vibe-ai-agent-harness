import { config } from "../../../../../config"

export default `#!/usr/bin/env python3
# audit-orphans.py — find notes not reachable from Index.md via [[wiki-links]]
# Exit 0 = clean, exit 1 = orphans found, exit 2 = script error

import sys
import os
import re
from pathlib import Path
from collections import deque

kb = Path(os.path.expanduser("${config.knowledgeBasePath}"))
if not kb.is_dir():
    print(f"Error: knowledge base directory not found: {kb}", file=sys.stderr)
    sys.exit(2)

index = kb / "Index.md"
if not index.exists():
    print(f"Error: Index.md not found at {index}", file=sys.stderr)
    sys.exit(2)

FENCED_BLOCK = re.compile(r"\`\`\`.*?\`\`\`", re.DOTALL)
WIKI_LINK = re.compile(r"\\[\\[([^\\]]+)\\]\\]")

def extract_links(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    text = FENCED_BLOCK.sub("", text)
    return WIKI_LINK.findall(text)

# Build title -> path map
all_notes: dict[str, Path] = {}
for f in kb.glob("*.md"):
    title = f.stem
    all_notes[title] = f

# BFS from Index.md
reachable: set[str] = set()
queue: deque[str] = deque(["Index"])
reachable.add("Index")

while queue:
    title = queue.popleft()
    path = all_notes.get(title)
    if path is None:
        continue
    for link in extract_links(path):
        if link not in reachable and link in all_notes:
            reachable.add(link)
            queue.append(link)

orphans = sorted(
    f.name for title, f in all_notes.items() if title not in reachable
)

if not orphans:
    print("No orphaned notes found.")
    sys.exit(0)

print(f"Found {len(orphans)} orphaned note(s) (not reachable from Index.md):")
for name in orphans:
    print(f"  - {name}")

sys.exit(1)
`
