# Enriching the Knowledge Base

## Problem

The knowledge base only grows reactively — when the user asks a question or explicitly requests research. There is no proactive force that deepens knowledge on topics the system already knows about. The `researching-knowledge` skill answers the question asked and stops.

Meanwhile, the KB has ~1190 notes covering many domains (AWS, Kubernetes, LLMs, Terraform, ephemeral environments, etc.). Most are atomic stubs that could be deepened, connected to external sources, and expanded into richer reference material. Nobody is doing this work.

Phase 4 of [kb-vision.md](../../docs/kb-vision.md) calls for autonomous enrichment: an agent that picks a topic, researches it from external sources, synthesizes new notes, commits the results — and runs on a loop without human initiation.

## Goals

1. **Create an `enriching-knowledge-base` skill** with two modes:
   - **Recent topic enrichment** — pick a topic from recent activity (working memory, git history) and go deep: explore it, expand it, develop neighboring topics.
   - **Random topic enrichment** — serendipitous discovery via random walk from `Index.md`. The "aha" mode: you suddenly think about an obscure topic and go deeper.

2. **Deep enrichment, not shallow** — each iteration picks one topic and explores it thoroughly. Not a drive-by "find one fact and leave." Expand neighboring topics, find connections, build a deeper web.

3. **Source-grounding** — the agent may only write notes synthesized from external sources fetched in the same session. No writing from model memory alone.

4. **Mode balance** — 80% of iterations enrich existing topics, 20% expand random topics. The loop script enforces this ratio.

5. **Nightly schedule** — enrichment runs during 12am–9am when the user isn't actively using opencode. Avoids git conflicts.

6. **Git commit + push** — after each enrichment iteration, the skill commits with message format `kb-enrichment: <topic>` and pushes.

7. **Maintenance cooldown** — the last 1–2 hours of the nightly window run the `maintaining-knowledge-base` skill to clean up any issues enrichment introduced (dangling links, oversized notes, orphans).

8. **Notification with memory conflict prevention** — enrichment results saved to Memory.md with `kb-enrichment:` prefix so they're filterable by future topic selection.

## Non-Goals

- Not replacing the `researching-knowledge` skill — enrichment *uses* it
- Not building the server-side MCP infrastructure (Phase 2) — runs locally on Framework Desktop
- Not a dedicated "novel topic discovery" mode (searching the internet for brand-new topics) — warrants its own skill; deferred
- Not fixing the memory system — the skill works around current limitations

## Design Decisions

### 1. Dedicated curator agent, not yapper

A new `curator` agent (`mode: primary`) handles all enrichment and maintenance work. Called directly by the loop script. Has scoped permissions (bash, skill, task, read) without touching yapper's permissions. The enrichment skill loads on curator, not yapper.

### 2. Agent-driven topic selection, not scripts

The agent selects topics using its own tools (read Memory.md, git log, read Index.md). LLM judgment is better than text parsing for identifying meaningful topics. No separate scripts needed.

- **Recent mode**: Agent reads Memory.md and git log, filters `kb-enrichment:` entries, picks the most actionable topic.
- **Random mode**: Agent does a two-hop random walk from Index.md — pick a random link to a topic hub, then a random link from that hub to a specific subtopic.

### 3. Mode balance enforced by loop script

Rolling window: every 5 iterations, 4 are "recent" and 1 is "random." Uses a shuffled-deck approach (pseudo-randomized order) so the pattern isn't predictable.

### 4. Daemon script with time awareness, not cron

Using cron for fixed windows is natural, but debugging failures is opaque. Instead, use a **persistent bash daemon** that runs as a systemd user service (or in a tmux session):

- `enrich-loop.sh` runs continuously
- Internal time check: active 12am–9am, sleeps outside that window
- `--mode recent|random|auto` (auto = 80/20 balance)
- Logs everything to `enrich-loop.log` with timestamps — `tail -f` to inspect live
- Writes a status file (`enrich-loop.status`) with last iteration result, current state, error counts
- Can be restarted, stopped, inspected without cron's opacity

**In tmux**: start manually in a pane, tail the log to observe progress. Later, promote to a systemd user service for auto-start.

### 5. Loop schedule flow

```
12:00    enrich iteration (mode from 80/20 balance)
         interval sleep (~30–60 min, configurable)
01:00    enrich iteration
         ...
         (repeat until ~7:00)
07:00    maintenance pass: run maintaining-knowledge-base skill
         if issues found → delegate fixes to @knowledge-base
08:00    final maintenance verification
09:00    loop sleeps until next 12am
```

### 6. Git commit discipline

The skill instructs the agent to commit with format `kb-enrichment: <topic> — <summary>` and push. Each iteration is a self-contained change, visible in git history, with the server kept canonical.

### 7. Memory conflict prevention

Enrichment saves a summary to Memory.md with `kb-enrichment:` prefix. Topic selection in recent mode filters out these entries to avoid self-reinforcing loops. The user can ask "what did enrichment research recently?" and the agent reads the tagged entries.

### 8. Maintenance as cooldown

Enrichment creates new notes and may introduce structural issues. Running `maintaining-knowledge-base` as the last step ensures the KB is clean before the loop sleeps. If maintenance finds issues, it delegates fixes to `@knowledge-base` (same as the manual workflow).

### 9. Progressive rollout

Phase 1 (reliable KB agent) is a prerequisite. `random` mode works immediately. `recent` mode quality depends on the memory system — start with `random` mode, then enable `recent` mode after memory improvements. Novel topic discovery is a separate skill, deferred.
