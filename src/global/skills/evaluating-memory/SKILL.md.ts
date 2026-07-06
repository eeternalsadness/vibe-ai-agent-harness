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
| \`append-memory.sh\` | Validate, append, and truncate memory items | \`bash <script> "<tag>" "<project>" "<description>"\` |

Exit codes: \`0\` = saved, \`1\` = validation or write error.

## Input

The prompt contains up to three labeled sections:

- **\`## Previously Evaluated (context only)\`** — transcript from prior evaluation cycles in this session. Present only from the second cycle onward. Read it to resolve references and pronouns — never an extraction source.
- **\`## New Since Last Evaluation\`** — the segment added since the last cycle. The only section to mine for memory items.
- **\`## Existing Memory\`** — current contents of Memory.md, for deduplication.

**Scoping rule:** extract an item only if its triggering moment (decision confirmation, completed edit, or the \`[tool: task] subagent_type: research\` line) appears in "New Since Last Evaluation". Never mine "Previously Evaluated" — even if an item there looks unrecorded in Existing Memory. Re-adding an old item you think was "missed" is the failure mode this rule prevents.

## Workflow

1. **Evaluate** — identify decisions, work, and research from "New Since Last Evaluation" per the scoping rule above. Apply deduplication against the supplied Existing Memory.
2. **Extract** — for each new item, identify: tag, project, description.
3. **Write** — for each item, run:
    \`\`\`bash
    bash ${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/append-memory.sh "<tag>" "<project>" "<description>"
    \`\`\`
    The script inserts today's date automatically. If the script exits non-zero, fix the arguments and retry up to twice. Skip the item after two failures.

If nothing is worth saving, stop at step 1.

## Item Format

Items are stored as \`- [YYYY-MM-DD] [tag] project: description\`. The date is inserted by the script — do not include it in the arguments.

- **tag** — \`decision\` · \`work\` · \`research\` · \`kb-enrichment\`
- **project** — project name or \`global\` for cross-project items
- **description** — outcome only, no implementation details. Fewest words that preserve the meaning. 150 chars max.

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
- \`[tool: task] subagent_type: research\` appears in the transcript — one occurrence = one \`[research]\` item
- Topic is inferred from conversation context surrounding that line
- Description is topic name only — no URLs or note counts

**\`[kb-enrichment]\`** — Passed in explicitly by the enriching-knowledge-base skill. Never inferred from transcript.

## Deduplication

Check the last 10 items in Existing Memory - if the session's outcome is already captured there, skip it. Do not scan the full file for deduplication.

Use this command to extract the deduplication set before deciding whether an item is new:

\`\`\`bash
tail -n 10 ${config.memoryFilePath}
\`\`\`

## Examples

**Conversation:**
\`\`\`
[user]: let's use Vitest instead of Jest
[assistant]: Agreed.
[tool: edit] filePath: package.json
[tool: edit] filePath: vitest.config.ts
\`\`\`
**Calls:**
\`\`\`bash
bash append-memory.sh "decision" "my-project" "use Vitest over Jest"
bash append-memory.sh "work" "my-project" "migrated test suite to Vitest"
\`\`\`
**Written to Memory.md:**
\`\`\`
- [2026-06-05] [decision] my-project: use Vitest over Jest
- [2026-06-05] [work] my-project: migrated test suite to Vitest
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
**Calls:**
\`\`\`bash
bash append-memory.sh "decision" "my-project" "use in-memory caching over Redis for now"
bash append-memory.sh "work" "my-project" "implemented in-memory caching"
\`\`\`

---

**Conversation:**
\`\`\`
[user]: how does the memory plugin work?
[assistant]: The plugin injects Memory.md into the system prompt...
\`\`\`
**New items:** none — stop at step 1.
`
