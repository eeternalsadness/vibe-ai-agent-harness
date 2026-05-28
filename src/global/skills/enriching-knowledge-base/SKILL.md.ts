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

1. **Select topic** — Read \`${config.memoryFilePath}\`. Filter out entries prefixed with \`kb-enrichment:\`. Pick the most recent topic that could benefit from deeper enrichment. If no usable topics remain, fall back to Random Topic Enrichment mode.

2. **Research topic** — Load the \`researching-knowledge\` skill. Use a comprehensive research prompt — ask for depth beyond surface-level coverage: mechanisms, tradeoffs, edge cases, and recent developments. Example: *"Research <topic> comprehensively: how it works internally, key tradeoffs, common failure modes, and anything non-obvious."*

3. **Research related subtopics** — Identify 2–3 closely related subtopics. Load the \`researching-knowledge\` skill for each using the same comprehensive prompt style.

4. **Report** — Call \`remember()\` with a single simple sentence naming only the primary topic. Do this **before** committing. Example: *"kb-enrichment: researched <primary topic>"*. No details, no note counts, no filler — just the topic name.

5. **Commit and push** — After \`remember()\` returns, run these commands directly:
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
