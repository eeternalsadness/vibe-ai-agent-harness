# PLAN: Memory Dedup via Evaluation Marker

## Problem

The memory manager writes exact-duplicate items into `Memory.md`. Confirmed from debug logs (2026-07-03): the same `[research]` item was written by two separate, legitimate evaluation cycles 25 minutes apart on one session (e.g. "CNCF project maturity levels" written at 02:17 and again at 02:44).

Root cause, ruled in by log evidence and ruled out alternatives:
- **Not** a double-trigger. The plugin's three guards (500ms idle dedup, `evaluatingSessions` re-entrancy lock, `messageCount <= previousMessageCount` check) all worked correctly. `previousAssistantCount` advanced properly (48 → 52 → 56) every cycle.
- **Not** a single-turn double tool-call. Each invocation made exactly one `append-memory.sh` call for the item.
- **The actual cause:** `evaluateSession` sends a *cumulative* transcript to the memory agent on every cycle. It concatenates `cache.transcript + newSegment` into one undifferentiated blob (line 289-291) and hands it over with no signal about which portion was already evaluated. The agent re-reads old `[tool: task] ... subagent_type: research` lines every cycle. Because `[research]` extraction is a near-mechanical "topic name only" transform on a fixed transcript substring, the same item is produced again. The agent's `Existing Memory` cross-check (a soft LLM-judgment rule) does not reliably catch it.

The exactness of the duplicates is itself the tell: the source is a stable literal substring in the transcript, not free-form re-summarization (which would yield near-duplicates, as seen with `[decision]`/`[work]` items).

## Goals

- Eliminate the common duplicate case: an item extracted in one cycle is not re-extracted in a later cycle of the same session.
- Do this by making the already-evaluated boundary explicit in the prompt, instead of discarding it.
- Keep the change surgical: no new persistent state (the boundary already exists as `transcriptCache.messageCount`), no changes to `append-memory.sh`.
- Preserve existing behavior: cumulative context is still available to the agent for understanding references, just not as an extraction source.

## Non-Goals

- **No mechanical dedup in `append-memory.sh`.** Explicitly out of scope per user decision: if a topic is genuinely researched twice (across separate sessions or genuinely distinct moments), appending it twice is acceptable.
- No change to the cross-session dedup rule ("check today's + last 10 items"). It stays as-is, soft, LLM-judgment.
- No change to trigger logic, guards, caching mechanics, or system-prompt injection.

## Design Decisions

- **Split the prompt into two labeled transcript sections** rather than one blob:
  - `## Previously Evaluated (context only)` — the cached transcript from prior cycles. Present so the agent can resolve pronouns/references, but explicitly not an extraction source.
  - `## New Since Last Evaluation` — the newly-added segment. The only section the agent mines for items.
  - `## Existing Memory` — unchanged.
- **Reuse the existing boundary.** `transcriptCache.messageCount` (and the `newSegment` already computed at line 288) is exactly the marker. The fix is to stop merging the two pieces and instead pass them to the prompt builder separately. First-ever evaluation has no "Previously Evaluated" section (empty cache).
- **Instruction lives in both the prompt and the skill.** The prompt labels carry the constraint inline; `evaluating-memory` SKILL.md gets an explicit rule so the behavior is documented canon, not just an ephemeral prompt string.
- **Scoping rule wording matters.** The instruction must say: extract an item only if its *triggering moment* (decision confirmation, completed edit, or the `[tool: task] subagent_type: research` line) appears in the "New Since Last Evaluation" section — and never mine "Previously Evaluated" even if an item there looks unrecorded in Existing Memory. This closes the loophole where the agent "helpfully" re-adds an old item it thinks was missed.
- **Tests assert the split, not the blob.** The existing "incremental transcript cache" test currently asserts the second prompt contains all N+M messages in one place. That assertion must change to verify old messages land in "Previously Evaluated" and new messages land in "New Since Last Evaluation".

## Affected Components

- `src/platforms/opencode/plugins/memory-manager.ts` — `evaluateSession` prompt construction (lines 288-309).
- `src/global/skills/evaluating-memory/SKILL.md.ts` — workflow + new scoping rule.
- `test/unit/memory-manager.test.ts` — "incremental transcript cache" describe block.
- Rendered outputs (`dist/`) and installed copies regenerate via `install.sh`; not edited directly.

## Verification

- Unit tests pass (`bun test` or repo's test command), including updated cache tests.
- Manual: with `OPENCODE_MEMORY_DEBUG=1`, run a session that triggers a research eval, add more turns, trigger a second eval. Confirm the second cycle's logged prompt places the first research line under "Previously Evaluated" and that no duplicate item is written (before/after line-count diff in the log).
