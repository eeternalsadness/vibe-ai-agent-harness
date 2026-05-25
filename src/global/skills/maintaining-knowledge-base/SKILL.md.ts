import { config } from "../../../../config"

export default `---
name: maintaining-knowledge-base
description: Use when asked to audit the knowledge base, check for dangling links, orphaned notes, oversized notes, or run a knowledge base health check.
---

# Maintaining the Knowledge Base

Use this skill to audit the knowledge base for structural problems and delegate fixes to \`@knowledge-base\`.

## Scripts

All scripts live in \`${config.harnessPath}/dist/opencode/skills/maintaining-knowledge-base/scripts/\`.

| Script | Purpose | Run with |
|---|---|---|
| \`audit-dangling.sh\` | \`[[wiki-links]]\` with no matching \`.md\` file | \`bash <script>\` |
| \`audit-orphans.py\` | Notes not reachable from \`Index.md\` | \`python3 <script>\` |
| \`audit-oversized.sh\` | Notes exceeding 100 lines | \`bash <script>\` |

Exit codes: \`0\` = clean, \`1\` = problems found, \`2\` = script error.

## Workflow

1. **Run all three scripts** and collect their output.

2. **Delegate fixes to \`@knowledge-base\`** — one call per category, passing the full list of findings for that category.

### Dangling links

Pass the full script output and instruct \`@knowledge-base\`:
> The following links have no matching file. For each source note listed, remove the link and rewrite the surrounding prose so the context still makes sense.

### Orphaned notes

Pass the full script output and instruct \`@knowledge-base\`:
> The following notes are not reachable from \`Index.md\`. For each, find the correct parent note and add a \`[[wiki-link]]\` to it. If no suitable parent exists, create an intermediate topic note. If a note is spurious or a duplicate, delete it using the \`modifying-knowledge-base\` skill.

### Oversized notes

Pass the full script output and instruct \`@knowledge-base\`:
> The following notes exceed 100 lines. For each, apply your oversized note resolution procedure.

3. **Verify** — after fixes, re-run the relevant scripts and confirm exit 0.
`
