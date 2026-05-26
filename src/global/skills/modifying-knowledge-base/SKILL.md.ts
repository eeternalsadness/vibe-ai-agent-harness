export default `---
name: modifying-knowledge-base
description: Use when about to delete a note, rename a note, or split an oversized note in the knowledge base.
---

# Modifying the Knowledge Base

Procedures for structural operations that affect the link graph. Follow these exactly — each step prevents orphaned notes or dangling links.

## Delete a note

1. Grep the knowledge base for all \`[[Note Name]]\` references.
2. For each source file: remove the link and rewrite the surrounding prose so the context still makes sense.
3. Delete the note file using \`rm\` with its absolute path. Never use relative paths or \`~\`.
4. Verify no references remain by grepping again.

## Rename a note

1. Grep the knowledge base for all \`[[Old Name]]\` references.
2. Update every reference to \`[[New Name]]\`.
3. Rename the file; update the H1 heading to match exactly.
4. Verify all references resolve by grepping for \`[[New Name]]\` and confirming the file exists.

## Split an oversized note

1. Identify logical sections that can stand alone as atomic notes.
2. Create child notes — one concept per note.
3. Replace the parent with a slim index: H1 + flat list of \`[[child]] - description\` entries.
4. Verify all child notes are reachable from \`Index.md\` by following link chains.
`
