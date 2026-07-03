# TODO: Memory Dedup via Evaluation Marker

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

Tests first, goal-driven: each test encodes one guarantee about what the plugin sends to the memory agent. Write them before implementation, confirm they fail for the right reason, then implement until green.

Prompt construction moves into its own file as a pure function (`buildEvaluationPrompt`) - testable in isolation now, lifts out cleanly when the plugin migrates to a dedicated repo. `evaluateSession` keeps cache updates, guard checks, and full-transcript concerns; only string construction moves.

Locked section labels (asserted verbatim in tests):
`## Previously Evaluated (context only)` · `## New Since Last Evaluation` · `## Existing Memory`

---

## Tests (write first)

- [ ] **Builder — section structure** — `buildEvaluationPrompt` emits `## New Since Last Evaluation` + `## Existing Memory` + the extraction-scope instruction, in expected order
- [ ] **Builder — marker split** — given prior cumulative transcript + new segment, old content lands under "Previously Evaluated", new content under "New Since Last Evaluation"; boundary exactly at prior cycle's `messageCount`
- [ ] **Builder — no overlap/leakage** — no line appears in both sections; new never in old section, old never in new
- [ ] **Builder — first-eval shape** — empty prior transcript → NO "Previously Evaluated" section; all content under "New Since Last Evaluation"
- [ ] **Builder — context preserved** — old content still present in the prompt (relocated, not dropped)
- [ ] **Integration — two-cycle end-to-end** — `evaluateSession` (via capturePrompts) sends correctly-structured prompt across two cycles: cycle 1 first-eval shape, cycle 2 old-under-Previously / new-under-New
- [ ] **Guards see full transcript** — skip-skill signal in an earlier segment still suppresses evaluation; empty-content guard still evaluates old+new combined
- [ ] **Cache invariant** — after each cycle `transcriptCache` holds full cumulative transcript + total messageCount (next cycle's marker correct)

## Implementation (make tests green)

- [ ] **Add prompt-builder module** — new file with exported pure `buildEvaluationPrompt(previouslyEvaluated, newSegment, existingMemory)` producing the two labeled sections (Previously Evaluated omitted when empty) + Existing Memory + scope instruction
- [ ] **Extraction-scope instruction text** — inline in builder output: extract only from "New Since Last Evaluation", "Previously Evaluated" is read-only context, never re-extract old triggering moments
- [ ] **Wire builder into evaluateSession** — replace inline prompt string; keep cumulative cache update + full-transcript guard checks (skip-skill, empty-content) intact
- [ ] **Update SKILL.md** — two-section input description + scoping rule in `evaluating-memory` SKILL.md.ts; keep cross-session dedup rule intact

## Verify

- [ ] **Rebuild and run suite** — regenerate `dist/` via render pipeline (confirm new helper file bundles/imports correctly, not rendered as a stray entrypoint), full unit tests green, optional manual `OPENCODE_MEMORY_DEBUG=1` two-cycle check (no duplicate written)
