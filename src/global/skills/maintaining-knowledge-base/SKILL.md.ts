import { config } from "../../../../config"

export default `---
name: maintaining-knowledge-base
description: Use when asked to audit the knowledge base, check for dangling links, orphaned notes, oversized notes, or run a knowledge base health check.
---

# Maintaining the Knowledge Base

Use this skill to audit the knowledge base for structural problems and delegate fixes to \`@knowledge-base\`. Execute all steps autonomously without asking for confirmation.

## Scripts

All scripts live in \`${config.harnessPath}/dist/opencode/skills/maintaining-knowledge-base/scripts/\`.

| Script | Purpose | Run with |
|---|---|---|
| \`audit-dangling.sh\` | \`[[wiki-links]]\` with no matching \`.md\` file | \`bash <script>\` |
| \`audit-orphans.py\` | Notes not reachable from \`Index.md\` | \`python3 <script>\` |
| \`audit-oversized.sh\` | Notes exceeding 100 lines | \`bash <script>\` |

Exit codes: \`0\` = clean, \`1\` = problems found, \`2\` = script error (skip that category and continue).

## Workflow

1. **Run all three scripts** and collect their output.

2. **Delegate fixes to \`@knowledge-base\`** — one call per category, in batches of 5 items. Evaluate each item individually before acting. Wait for each batch to complete before sending the next.

### Dangling links

Pass the full script output and instruct \`@knowledge-base\`:
> The following links have no matching file. For each, delete the \`[[wiki-link]]\`. If the link appears inside prose, reword the sentence so it reads naturally without the link. If the link appears in a topic note (links-only list), remove the line entirely.

### Orphaned notes

Pass the full script output and instruct \`@knowledge-base\`:
> The following notes are not reachable from \`Index.md\`. For each, find the correct parent note and add a \`[[wiki-link]]\` to it. If no suitable parent exists, create an intermediate topic note. If a note is spurious or a duplicate, delete it using the \`modifying-knowledge-base\` skill.

### Oversized notes

Pass the full script output and instruct \`@knowledge-base\`:
> The following notes exceed 100 lines. For each, apply your oversized note resolution procedure.

3. **Verify** — after fixes, re-run the relevant scripts and confirm exit 0.
`
