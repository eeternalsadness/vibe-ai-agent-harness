# Plan: memory-plugin-v4

## Problem

Two issues with the current memory plugin evaluation loop:

**Re-sanitization on every cycle** — `evaluateSession` re-fetches and re-sanitizes the entire message history every time it runs. As sessions grow this becomes increasingly wasteful — work done on already-processed messages is thrown away and repeated each cycle.

**Unreliable research signal** — the sanitized transcript emits three separate tool call lines for a research cycle. The memory agent has to infer whether they form a complete cycle, and gets it wrong — tagging investigative codebase work as `[research]` because the content looks research-like, not because the research tooling was actually invoked.

## Goals

- Sanitized transcript is built incrementally — only new messages since the last evaluation are processed and appended
- A complete research cycle within a single assistant turn emits a deterministic signal in the sanitized transcript
- The memory agent reads the signal as a fact, not an inference
- The evaluating-memory skill is updated to reflect the new signal

## Design Decisions

**Incremental caching is in-memory only** — the transcript cache resets on process restart. The next evaluation after a restart re-sanitizes from scratch, which is acceptable. No persistence needed.

**Research detection uses the existing transcript** — `[tool: task] subagent_type: research` is already emitted by `sanitizeTranscript`. No plugin changes needed for research detection. The evaluating-memory skill is updated to treat this line as a direct, unambiguous signal — one occurrence = one research cycle. Replaces the old three-step inference (skill load + research agent + kb agent). The skill-load signal (`skill: researching-knowledge`) fires only once per session due to caching and is not a reliable per-cycle indicator.

**Skill update, not agent update** — the fix lives in what the transcript says and what the skill instructs. The memory agent config is unchanged.
