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

**Research detection is per-turn and structural** — a complete cycle requires all three tool calls (`skill: researching-knowledge`, `task: research` subagent, `task: knowledge-base` subagent) within the same assistant message. Checked against structured message data, not the flattened string. Cannot produce false positives from content.

**Skill update, not agent update** — the fix lives in what the transcript says. The evaluating-memory skill is updated accordingly. The memory agent config is unchanged.
