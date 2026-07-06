# Plan: Memory Append Script

## Problem

Memory agent writes to `Memory.md` using the `edit` tool — LLM-controlled, no validation, prone to malformed output and format drift. Truncation is a separate step that can be skipped. The two-step write-then-truncate flow is not atomic.

## Goals

- Memory items written exclusively via a bash script — `edit: allow` removed from memory agent
- Script validates format regex and 150-char limit before writing; rejects bad input with a clear error message
- Truncation to 100 items happens inside the same script call — never skipped
- `truncate-memory.sh` deleted; logic merged into `append-memory.sh`
- KB enrichment mode uses the same script for consistency
- Skill instructs agent to retry up to twice on non-zero exit, then skip

## Design Decisions

**CLI argument over stdin.** Item passed as a single quoted argument: `bash append-memory.sh "- [tag] project: desc"`. Simple, explicit, visible in logs.

**One script call per item.** Enables per-item validation and retry. No batching complexity.

**Truncate-in-place after every append.** Script appends first, then rewrites the file keeping last 100 bullet lines. Atomic from the agent's perspective — no separate truncate step to forget.

**Retry up to 2 times.** If script exits non-zero, agent fixes the item and retries. Skips the item after two failures.
