import { config } from "../../../../config"

export default `---
name: evaluating-memory
description: Canonical reference for the automatic memory evaluation workflow. Covers input format, output format, tags, triggers, deduplication, and writing to Memory.md. Load this when evaluating a conversation transcript for memory items.
---

# Evaluating Memory

Evaluate a conversation transcript and extract new memory items. Prefer fewer significant items over more noisy ones. Keep each item concise — fewest words that preserve the meaning. When in doubt, skip.

## Scripts

All scripts live in \`${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/\`.

| Script | Purpose | Run with |
|---|---|---|
| \`append-memory.sh\` | Validate, append, and truncate memory items | \`bash <script> "<item>"\` |

Exit codes: \`0\` = saved, \`1\` = validation or write error.

## Workflow

1. **Evaluate** — identify decisions, work, and research from the conversation. Apply deduplication against the supplied Existing Memory.
2. **Format** — write each new item as \`- [tag] project: description\`
3. **Write** — for each item, run:
    \`\`\`bash
    bash ${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/append-memory.sh "<item>"
    \`\`\`
    If the script exits non-zero, fix the item and retry up to twice. Skip the item after two failures.

If nothing is worth saving, stop at step 1.

## Item Format

\`- [tag] project: description\` — 150 chars max total.

- **tag** — \`decision\` · \`work\` · \`research\` · \`kb-enrichment\`
- **project** — project name or \`global\` for cross-project items
- **description** — outcome only, no implementation details. Fewest words that preserve the meaning.

## Tags

**\`[decision]\`** — A non-trivial choice confirmed by the user.
- Explicit confirmation: "let's", "agreed", "we'll go with", "decided", "yes", "correct"
- Implicit confirmation: user adopts proposal without objecting
- Alternatives existed (named or implied)
- If reversed later in conversation, save only the final position
- Skip: no conclusion reached, trivial choices

**\`[work]\`** — Significant work completed.
- Approved \`edit\`/\`write\` tool calls present (not denied)
- Substantial: feature, plan task, real fix — not typos or comments
- Research sessions don't count as work
- One item per logical unit — outcome only ("fixed memory leak", not "edited cache.ts")

**\`[research]\`** — Topic researched end-to-end.
- \`researching-knowledge\` skill loaded AND \`research\` agent invoked AND \`knowledge-base\` agent wrote findings
- Description is topic name only — no URLs or note counts

**\`[kb-enrichment]\`** — Passed in explicitly by the enriching-knowledge-base skill. Never inferred from transcript.

## Deduplication

Skip any item semantically equivalent to an existing Memory entry, even if worded differently.

## Examples

**Conversation:**
\`\`\`
[user]: let's use Vitest instead of Jest
[assistant]: Agreed.
[tool: edit] filePath: package.json
[tool: edit] filePath: vitest.config.ts
\`\`\`
**New items:**
\`\`\`
- [decision] my-project: use Vitest over Jest
- [work] my-project: migrated test suite to Vitest
\`\`\`

---

**Conversation:**
\`\`\`
[user]: let's use Redis
[assistant]: Sure.
[user]: actually in-memory for now
[assistant]: Good call.
[tool: edit] filePath: cache.ts
\`\`\`
**New items:**
\`\`\`
- [decision] my-project: use in-memory caching over Redis for now
- [work] my-project: implemented in-memory caching
\`\`\`

---

**Conversation:**
\`\`\`
[user]: how does the memory plugin work?
[assistant]: The plugin injects Memory.md into the system prompt...
\`\`\`
**New items:** none — stop at step 2.
`
