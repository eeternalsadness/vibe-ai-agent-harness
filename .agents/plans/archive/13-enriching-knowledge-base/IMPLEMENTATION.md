# Implementation: Enriching the Knowledge Base

## Task 1 — Create SKILL.md.ts

**File:** `src/global/skills/enriching-knowledge-base/SKILL.md.ts`

Requirements:
- YAML frontmatter: name `enriching-knowledge-base`, description that triggers on enrichment requests
- Overview: proactively deepens knowledge. Two modes (recent, random). Source-grounded. Designed for loop execution.

**Mode: Recent Topic Enrichment** workflow:
1. Read `Memory.md` and `git log` for recently discussed topics. Filter out `kb-enrichment:` entries. Pick the most recent topic that could benefit from deeper enrichment.
2. Load `researching-knowledge` skill, follow Workflow 2 (On-Demand Research)
3. After initial findings, research 2–3 neighboring/related subtopics
4. Pass all findings to `@knowledge-base` to create/modify notes
5. `git add -A && git commit -m "kb-enrichment: <topic> — <summary>" && git push`

**Mode: Random Topic Enrichment** workflow:
1. Read `Index.md`, pick a random `[[wiki-link]]` and follow it to a topic hub. From that hub, pick a random `[[wiki-link]]` to a specific subtopic (e.g., Index.md → AWS.md → AWS ALB.md). That subtopic is the enrichment target.
2. Steps 2–5 same as recent mode.

**Source-grounding:** every claim traceable to an external source fetched this session. If no credible source found, write nothing.

**Reporting:** save a concise summary to `Memory.md` with `kb-enrichment:` prefix so future topic selection can filter it out.

**Permissions needed by the agent that loads this skill:**
- `bash` — for `git log` (recent mode), `git add/commit/push`
- `skill` — to load `researching-knowledge` skill
- `task` — to invoke `@research` and `@knowledge-base` subagents
- `read` — to read Memory.md, Index.md, and KB notes

---

## Task 2 — Create curator agent

**File:** `src/global/agents/curator/curator.md.ts`

A background worker agent for autonomous KB enrichment and maintenance. Called directly by `enrich-loop.sh`.

Requirements:
- `mode: primary` (invoked directly by the loop, not as a subagent)
- Short description: runs enrichment and maintenance on the KB autonomously
- Brief personality: reliable background worker, follows instructions precisely, reports clearly
- Permissions: scoped to KB + scripts. Granular details TBD, but needs `bash`, `skill`, `task`, `read`. No webfetch (delegates to @research), no unbounded edit/write (delegates to @knowledge-base).
- Instructions are minimal — behavioral guardrails only. The *how* lives in the skills it loads.

---

## Task 3 — Create enrich-loop.sh

A persistent daemon that runs opencode with the curator agent on a nightly schedule.

Behavior:
- Time window (default 00:00–09:00), outside it the script sleeps
- During the window: calls `opencode` with curator + enrichment prompt in a loop
- Last 2 hours: calls `opencode` with curator + maintenance prompt instead
- Auto mode maintains 80/20 balance of recent vs random enrichment
- Logs with timestamps, writes a status file for inspection
