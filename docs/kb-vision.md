# Knowledge Base Vision & Roadmap

## Problem

The knowledge base degrades silently over time. Convention drift accumulates because the KB agent only enforces rules at write time, in the same session. It has no ability to audit or repair existing notes. The result: notes far exceeding the 100-line limit (some at 500-800+ lines), dangling references, inconsistent naming, and hub notes that have become monoliths.

The research skill compounds this — it is reactive and shallow. It answers the question asked and stops. There is no proactive force that deepens knowledge on topics the system already knows about.

## Vision

A server-side knowledge base service that is self-maintaining and self-enriching. Clients interact with it through MCP tool calls. The KB agent runs server-side. Background jobs handle maintenance and enrichment autonomously.

---

## Phases

### Phase 1 - Reliable KB Agent *(mostly done)*

**Prerequisite for everything else.** Autonomous enrichment on a broken KB just automates the mess. Before the KB goes anywhere near a server or background jobs, the agent must produce output that can be trusted.

Two parts:

1. **Repair the existing KB**

   Plan: 12-kb-maintenance-skill

   A one-time (then periodic) maintenance pass over the existing notes: split oversized notes, fix dangling references, enforce naming conventions, ensure all notes are reachable from `Index.md`.

2. **Stronger write discipline**

   Plans: 05-kb-research-split, 12-kb-maintenance-skill

   Improve the KB agent so new writes don't immediately drift again. Enforce conventions at write time, not just for notes created in the current session.

### Phase 2 - Server-Side KB with MCP Interface *(not started)*

Move the KB to the homelab. Expose it via an MCP server. The KB agent runs server-side. Clients no longer delegate to a subagent - they call MCP tools directly.

**Deployment:** Kubernetes workload in the homelab cluster, behind Traefik ingress. The Framework Desktop serves only model endpoints.

**Source of truth:** Git remains canonical, but the repo lives on the server only - no client-side copy. The MCP server reads and writes through git commits.

**MCP interface:** Full CRUD - read notes, write notes, search, list. The `researching-knowledge` skill calls MCP tools instead of delegating to the `@knowledge-base` subagent. The subagent becomes obsolete.

### Phase 3 - Background Maintenance

A scheduled job that runs the KB agent in maintenance mode. Corrective, not generative - lower risk than enrichment.

Tasks:
- Split notes exceeding the 100-line limit
- Fix dangling `[[wiki-links]]` with no corresponding file
- Reattach orphaned notes (notes not reachable from `Index.md`)
- Enforce naming conventions (title case, filename matches H1)
- Refactor hub notes that have grown into monoliths

Maintenance and enrichment (Phase 4) modify the same files, so **locking is required** - only one job runs at a time. Enrichment can undo maintenance work and vice versa. A message queue (see Phase 2 write design) handles sequencing.

### Phase 4 - Autonomous Enrichment

Plan: 13-enriching-knowledge-base

An agent that proactively deepens knowledge without being asked. It picks a topic, fetches external sources, synthesizes new notes, and notifies you of what it explored.

**Topic selection:** Two signals combined:
- *Recent memory* - topics that have appeared in working memory or recent agent activity get higher priority
- *Random/spontaneous* - a random walk over existing notes to surface topics that haven't been touched recently; intentionally unpredictable to surface unexpected connections

**Source-grounding rule (hard constraint):** The agent may only write notes synthesized from external sources it fetched in the same session. It may not write from model memory alone. If it cannot find a credible external source for a claim, it does not write that claim. This is the primary quality gate against hallucination polluting the KB.

**Notification:** After each enrichment run, you are informed of which topics were explored and what notes were created or modified.

---

## Architecture: Phase 2+ Service Design

### Write Path - Async with Message Queue

Write requests from clients are async for latency reasons - LLM inference + file I/O is slow, and clients should not block waiting for a write to complete. Design:

- Client sends a write request to the MCP server and receives an acknowledgment immediately
- The write request is placed on a **message queue**
- A worker processes the queue **sequentially** - one write at a time, no concurrent modifications to the KB
- Sequential processing eliminates write conflicts between concurrent clients and between background jobs (maintenance, enrichment)
- The queue also serializes maintenance and enrichment jobs against client writes

### Read Path - Cache

Read requests can be served from a cache to reduce latency and avoid hitting the filesystem on every read.

- Cache is populated on read miss (lazy) or proactively after a write completes
- Cache is invalidated when a note is modified by a write or maintenance job
- Cache scope: individual notes keyed by filename; search results are not cached (too dynamic)

### Locking

Maintenance and enrichment jobs must not run concurrently with each other or with active write queue processing. A single lock (or the queue itself as the serialization mechanism) ensures only one writer is active at any time.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Source of truth | Git on server | Preserves history and diffs; no two-master problem |
| Client interface | MCP tools | Protocol-agnostic; replaces subagent delegation |
| Write latency | Async + queue | LLM inference is slow; clients should not block |
| Write ordering | Sequential queue | Eliminates conflicts; simplest correct solution |
| Read latency | Note-level cache | Reads are frequent; filesystem access is expensive |
| Enrichment quality gate | External sources only | Prevents hallucination from polluting KB context |
| Topic selection | Memory signals + random | Recency bias + spontaneous discovery |
| Phase ordering | Phase 1 first, hard gate | Broken KB + automation = automated mess |
| PR review for enrichment | Rejected | Daily review is unsustainable at autonomous scale |
