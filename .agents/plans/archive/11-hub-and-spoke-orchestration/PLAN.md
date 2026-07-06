# Plan: Hub-and-Spoke Orchestration

## Problem

Subagents calling other subagents causes inconsistent behavior. The root cause is architectural: `@research` calls `@knowledge-base`, and `@reviewer` calls `@research` — subagents acting as orchestrators. This needs to be eliminated.

## Goals

- Primary agents are the only orchestrators. Subagents are pure workers — receive a task, do work, return structured output, done.
- The research+capture workflow lives in a skill loaded by primary agents. No subagent knows about other subagents.
- `@research` and `@knowledge-base` have no task permissions.
- `@reviewer` becomes a hidden primary agent so it can use the research skill without being a subagent orchestrator.
- All primary agents use the research skill — single source of truth for the research workflow.
- Structured output contracts on `@research` and `@knowledge-base` so primary agents can reliably pass findings between them.
- Interactive turns are kept short — the skill returns as soon as the question is answered, without over-researching.
- `@knowledge-base` read responses follow a defined three-type contract so the skill can route deterministically.

## Design Decisions

**Hub-and-spoke, not peer-to-peer.** Primary agents orchestrate. Subagents work. Eliminates the class of bugs caused by subagents attempting to call agents they can't reach.

**Research workflow lifted into a skill.** The current `@research` agent workflow — check KB → research if insufficient → capture to KB — moves up to the primary agent level as a skill. `@research` becomes a pure fetcher with no KB awareness. The skill is the single source of truth for the full workflow, reusable across all primary agents.

**`@reviewer` as a hidden primary agent.** Reviewer needs research to do its job well. Making it primary lets it use the research skill directly. `hidden: true` keeps it out of the TUI — invocable only via `@reviewer`.

**Structured output on `@research`.** Returns a defined block (topic, findings, source URLs) so the primary agent can pass it verbatim to `@knowledge-base` without interpretation. `@research` researches until the question is answered — no more, no less — and prefers official sources, referencing multiple where possible.

**Three-type KB read contract.** `@knowledge-base` read responses are one of: (1) no relevant notes, (2) insufficient knowledge — lists what exists and what is missing, (3) sufficient knowledge — lists relevant notes with references. Anything other than sufficient triggers `@research`. This makes the skill's routing branch reliable and keeps interactive turns short.

**Background research is a future concern.** The knowledge base will eventually be enriched by a background process that runs research jobs independently of user sessions — deepening, correcting, and discovering knowledge without user prompting. This plan does not implement that system but the design must not close that door. The KB write contract and structured findings format should remain compatible with an automated writer.
