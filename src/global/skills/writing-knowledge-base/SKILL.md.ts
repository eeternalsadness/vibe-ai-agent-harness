export default `---
name: writing-knowledge-base
description: Use before any change to the knowledge base - writing, updating, deleting, renaming, or splitting notes. Defines the note format, naming, and linking rules, the write workflow, and the delete, rename, and split procedures.
---

# Writing to the Knowledge Base

## Formatting rules

- Never use em dashes in note content. Use a hyphen or rewrite the sentence.
- Note names use title case with spaces. Filename must match the H1 exactly. Never append suffixes like "Hub", "Overview", or "Guide".
- Index.md lists only top-level domains (AI, AWS, Kubernetes, etc.) - never individual concepts.
- Update rather than duplicate. Preserve existing voice and style when integrating new content.

## Write Task

Execute all steps without asking for confirmation:

1. **Read conventions** - read \`reference/zettelkasten-conventions.md\` first. It defines format, linking, and structure rules.

2. **Locate** - start at Index.md, trace the link graph to find where the new note belongs. Identify the parent note that needs a new link. Create intermediate topic notes if no suitable parent exists. Never link directly to Index.md except for new top-level domains.

3. **Write** - one concept per note. The goal is always to retain all knowledge with the minimum number of characters possible. After writing or editing any note, run \`wc -l <path>\` to get the exact line count. Notes must not exceed 100 lines. If \`wc -l\` reports more than 100 lines, apply the first rule that fits:
   - **Topic note** - a note that contains only \`[[wiki-links]]\` with short descriptions and no prose. If it exceeds 100 lines, group its links into logical clusters, create an intermediate topic note for each cluster, and replace the grouped links with a single link to the new topic note.
   - **Trim** - remove unnecessary whitespace, reword wordy prose, and remove or simplify low-value examples. All facts must be retained. Syntax examples are valuable and should only be cut if clearly redundant.
   - **Split** - follow the "Split an oversized note" procedure below if the note contains two or more distinct concepts that can stand alone as separate notes. Extract each into a child note and replace the extracted content with a \`[[wiki-link]]\`.
   - **Add a table of contents** - only if the note is genuinely monolithic reference material that cannot be trimmed or split without destroying its utility. Add it immediately after the H1 using markdown anchor links: \`- [Section Title](#section-title)\` (lowercase anchor, spaces to hyphens, strip punctuation). A TOC is an acceptable final resolution - notes with a TOC may exceed 100 lines.

   **Linking:** Never use \`[[Note Name|display text]]\` alias syntax. Instead, write prose that introduces the concept naturally and append \`(see [[Note Name]])\`, or add the link to the \`## See also\` section.

   **References:** If the source material includes URLs or references, include them before \`## See also\` under a \`## References\` heading.

4. **Link** - add a \`[[wiki-link]]\` with a short description to the parent note.

5. **Verify** - confirm every new note is reachable from Index.md by following link chains.

6. **Report** - list notes created or modified and how they connect to the graph.

## Example

Task: Save information about "LLM Quantization" to the knowledge base.

1. Read conventions - load zettelkasten-conventions.md.
2. Locate - Index.md -> AI -> LLM Architecture. Quantization fits here; no new topic note needed.
3. Write - create \`LLM Quantization.md\`
4. Link - add to \`LLM Architecture.md\`:
   \`\`\`markdown
   [[LLM Quantization]] - Model compression techniques for efficient inference
   \`\`\`
5. Verify - Index.md -> AI -> LLM Architecture -> LLM Quantization. Reachable.
6. Report - "Added LLM Quantization.md, linked from LLM Architecture.md"

## Structural operations

Procedures for structural operations that affect the link graph. Follow these exactly - each step prevents orphaned notes or dangling links.

### Delete a note

1. Grep the knowledge base for all \`[[Note Name]]\` references.
2. For each source file: remove the link and rewrite the surrounding prose so the context still makes sense.
3. Delete the note file using \`rm\` with its absolute path. Never use relative paths or \`~\`.
4. Verify no references remain by grepping again.

### Rename a note

1. Grep the knowledge base for all \`[[Old Name]]\` references.
2. Update every reference to \`[[New Name]]\`.
3. Rename the file; update the H1 heading to match exactly.
4. Verify all references resolve by grepping for \`[[New Name]]\` and confirming the file exists.

### Split an oversized note

1. Identify logical sections that can stand alone as atomic notes.
2. Create child notes - one concept per note.
3. Replace the parent with a slim index: H1 + flat list of \`[[child]] - description\` entries.
4. Verify all child notes are reachable from \`Index.md\` by following link chains.
`
