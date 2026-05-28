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

4. **Report** — Call \`remember()\` with a short summary: *"kb-enrichment: <topic A>, <topic B>, <topic C>"*.

5. **Commit and push** — Call \`@knowledge-base\` to commit and push all changes.

---

## Mode: Random Topic Enrichment

1. **Select topic** — Read \`${config.knowledgeBasePath}/Index.md\`. Pick a random \`[[wiki-link]]\` and follow it to a domain hub. From that hub, pick a random \`[[wiki-link]]\` to a specific subtopic (e.g., Index.md → AWS.md → AWS ALB.md). That subtopic is the enrichment target.

2–5. Same as Recent Topic Enrichment steps 2–5.
`
