/**
 * Builds the prompt sent to the memory agent on each evaluation cycle.
 *
 * The prompt contains only the segment added since the last cycle plus a bounded recent-memory set.
 *
 * This closes a duplicate-write bug: if old transcript appears anywhere in the prompt, small
 * models sometimes mine it despite scoping instructions and re-extract the same item.
 *
 * This function emits pure data — no extraction-scope instruction text. That rule is
 * documented canon in the `evaluating-memory` skill, not duplicated here.
 */
function extractRecentMemoryItems(existingMemory: string, limit = 20): string {
  const items = existingMemory
    .split("\n")
    .filter(line => line.trim().startsWith("- "))
  return items.slice(-limit).join("\n")
}

export function buildEvaluationPrompt(
  _previouslyEvaluated: string,
  newSegment: string,
  existingMemory: string
): string {
  const sections = [
    `## New Since Last Evaluation\n\n${newSegment}`,
    `## Recent Memory Items\n\n${extractRecentMemoryItems(existingMemory)}`,
  ]

  return sections.join("\n\n")
}
