import { config } from "../../../../config"

export default `---
name: enriching-knowledge-base
description: Use when asked to enrich, deepen, or expand the knowledge base with new research. Covers recent-topic and random-topic enrichment modes. Source-grounded only — no fabrication.
---

# Enriching the Knowledge Base

Proactively deepens the knowledge base with source-grounded research. Two modes: **recent** (follows recent session topics) and **random** (explores the existing graph). Designed for loop execution — each run targets one topic. Execute all steps autonomously without asking for confirmation.

**Source-grounding rule:** Every claim written to the knowledge base must be traceable to an external source fetched this session. If no credible source is found, do not write it.

---

## Mode: Recent Topic Enrichment

1. **Select topic** — Read \`${config.memoryFilePath}\`. Find entries tagged \`[research]\` and filter out any whose topic already has a corresponding \`[kb-enrichment]\` entry. Pick the most recent remaining topic. If none remain, fall back to Random Topic Enrichment mode.

2. **Research topic** — Load the \`researching-knowledge\` skill. Use a comprehensive research prompt — ask for depth beyond surface-level coverage: mechanisms, tradeoffs, edge cases, and recent developments. Example: *"Research <topic> comprehensively: how it works internally, key tradeoffs, common failure modes, and anything non-obvious."*

3. **Research related subtopics** — Identify 2–3 closely related subtopics. Load the \`researching-knowledge\` skill for each using the same comprehensive prompt style.

4. **Save to memory** — Run the append-memory script directly:
    \`\`\`bash
    bash ${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/append-memory.sh "- [kb-enrichment] kb-enrichment: researched <primary topic>"
    \`\`\`
    Do this **before** committing. Exit 0 = saved, exit 1 = validation error (skip if fails twice).

5. **Commit and push** — After the append script succeeds, run these commands directly:
   \`\`\`bash
   git -C ${config.knowledgeBasePath} add -A
   git -C ${config.knowledgeBasePath} commit -m "enrich: <topic name>"
   git -C ${config.knowledgeBasePath} push
   \`\`\`

---

## Mode: Random Topic Enrichment

1. **Select topic** — Run the following to pick a random domain hub from the index:
   \`\`\`bash
   grep -o '\\[\\[[^]]*\\]\\]' ${config.knowledgeBasePath}/Index.md | shuf -n1
   \`\`\`
   Read the resulting hub note. Based on its structure and breadth, decide how many levels deep to go:
   - **Narrow hub** (few subtopics, tight concept, thin content) → use the hub itself as the enrichment target.
   - **Broad hub** (many subtopics, high-level overview) → pick a random subtopic by running the same grep+shuf command on the hub file, then read that subtopic. Decide again: is it narrow enough, or go one more level?
   - **Deep hub** (subtopics that themselves contain sub-subtopics with thin content) → optionally navigate a third level.
   
   The goal is to land on a note with room for meaningful deepening — a note whose content is relatively thin or high-level and would benefit from more depth.

2–5. Same as Recent Topic Enrichment steps 2–5.
`
