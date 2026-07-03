/**
 * Builds the prompt sent to the memory agent on each evaluation cycle.
 *
 * The transcript is split into two labeled sections instead of one cumulative blob:
 * - "Previously Evaluated" — prior cycles' transcript, kept for resolving references only.
 * - "New Since Last Evaluation" — the segment added since the last cycle, the only
 *   section the agent should mine for memory items.
 *
 * This closes a duplicate-write bug: without the split, the agent re-reads old
 * `[tool: task] subagent_type: research` (and similar) lines every cycle and re-extracts
 * the same item. See plan 16-memory-dedup-marker for the root-cause writeup.
 *
 * This function emits pure data — no extraction-scope instruction text. That rule is
 * documented canon in the `evaluating-memory` skill, not duplicated here.
 */
export function buildEvaluationPrompt(
  previouslyEvaluated: string,
  newSegment: string,
  existingMemory: string
): string {
  const sections: string[] = []

  if (previouslyEvaluated.trim()) {
    sections.push(`## Previously Evaluated (context only)\n\n${previouslyEvaluated}`)
  }

  sections.push(`## New Since Last Evaluation\n\n${newSegment}`)
  sections.push(`## Existing Memory\n\n${existingMemory}`)

  return sections.join("\n\n")
}
