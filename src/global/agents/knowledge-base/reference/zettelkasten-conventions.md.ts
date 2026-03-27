import { config } from "../../../../../config"

export default `# Zettelkasten Conventions

This document defines the note format and organizational rules for the knowledge base.

## Location

The knowledge base lives at \`${config.knowledgeBasePath}\`. All notes are stored in the root of that directory (flat directory structure).

## Note Types

### Hub notes

Hub notes act as topic indexes. They contain a title and a list of links to related notes. They exist to organize the graph — they carry no substantive content themselves.

**Example** (\`AI.md\`):

\`\`\`markdown
# AI

[[AI agent skill]]
[[AI agent training]]
[[AI prompt library]]
[[Model Context Protocol]]
\`\`\`

### Leaf notes

Leaf notes are atomic — each one covers a single topic in detail. This is where actual knowledge lives.

**Example** (\`AI coding workflow.md\`):

\`\`\`markdown
# AI coding workflow

The AI coding workflow consists of planning, prompting, scaffolding, debugging, and deployment. Each phase builds on the previous one.

## Planning

- Outline what you want to do
- Include inputs, outputs, and tech stack

## Prompting

- Better prompts yield better outputs
- Break down tasks before prompting

## Scaffolding

- Define code structure for the agent to use

## Debugging
## Deployment
\`\`\`

### Index

\`Index.md\` is the root entry point. It links to top-level hub notes only. When traversing the knowledge base, start here and follow links to narrow down.

## Note Format Rules

- Title: H1 heading matching the filename (without \`.md\`)
- Use \`[[wiki-link]]\` syntax to reference other notes
- Keep notes concise — aim for 50-100 lines

### Table of Contents (for long notes)

If a note MUST exceed the 100-line soft limit, add a table of contents to help readers navigate. Follow these rules:

1. **Placement:** The TOC must come immediately after the H1 heading
2. **Format:** Use \`## Contents\` as the section heading, then a bulleted list of all main H2 section names
3. **Introductory content:** If the note has an introductory paragraph, it must go in its own \`## Overview\` section AFTER the TOC
4. **Content:** List only main H2 sections in the TOC, not subsections

**Structure example:**

\`\`\`markdown
# Note Title

## Contents

- Section 1
- Section 2
- Section 3

## Overview

Introductory paragraph explaining the note's purpose or scope goes here.

## Section 1

...
\`\`\`

## Linking Rules

- Hub notes link to their child notes (sub-topics or leaf notes)
- Leaf notes can link to any other note as a reference using \`[[Note Name]]\`
- When creating a new note, link it from at least one existing hub note so it's reachable from the index
- If no suitable hub exists, create one and link it from an existing hub or from \`Index.md\`

## Naming Conventions

- Filenames use title case with spaces: \`AI coding workflow.md\`, not \`ai-coding-workflow.md\`
- Filenames match the H1 heading exactly
- Be descriptive but concise in naming
`
