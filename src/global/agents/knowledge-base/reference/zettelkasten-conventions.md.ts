import { config } from "../../../../../config"

export default `# Zettelkasten Conventions

This document defines the note format and organizational rules for the knowledge base.

## Location

The knowledge base lives at \`${config.knowledgeBasePath}\`. All notes are stored in the root of that directory (flat directory structure).

## Note Types

### Hub notes

Hub notes act as topic indexes. They exist to organize the graph — they carry no substantive content themselves, only links to child notes.

Use a flat list when all links fall under one coherent topic with no meaningful subdivisions. Use sections when there are clear logical groupings. Sections can themselves become separate hub notes when a grouping grows large enough.

All links in hub notes must include a short description — they lack the surrounding prose that would otherwise provide context.

**Flat example** (\`Cooking.md\`):

\`\`\`markdown
# Cooking

[[Knife skills]] - Chopping, dicing, and julienning techniques
[[Mise en place]] - Preparing and organizing ingredients before cooking
[[Heat control]] - Managing temperature for different cooking methods
\`\`\`

**Sectioned example** (\`Baking.md\`):

\`\`\`markdown
# Baking

## Bread

[[Sourdough starter]] - Live culture of wild yeast used to leaven bread
[[Bulk fermentation]] - First rise after mixing dough

## Pastry

[[Shortcrust pastry]] - Crumbly pastry used for tarts and pies
[[Laminated dough]] - Layered dough used for croissants and puff pastry
\`\`\`

### Leaf notes

Leaf notes are atomic — each one covers exactly one concept. If a section within a note could stand alone as its own concept, it should be its own note. This is where actual knowledge lives.

**Example** (\`Sourdough starter.md\`):

\`\`\`markdown
# Sourdough starter

A sourdough starter is a live culture of wild yeast and bacteria used to leaven [[bread]]. It must be fed regularly with flour and water to stay active.

A starter is ready to use when it doubles in size within 4-8 hours of feeding and smells pleasantly sour. An unfed starter becomes too acidic and produces dense, overly sour bread.

## See also

[[Bulk fermentation]] - First rise after mixing; timing depends on starter activity
[[Sourdough hydration]] - Ratio of water to flour; affects crumb structure
\`\`\`

Note what this example does NOT do: it does not include sections on hydration or bulk fermentation. Those are separate concepts with their own notes, linked from here.

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
- Leaf notes can link to any other note using \`[[Note Name]]\`
- When creating a new note, link it from at least one existing hub note so it's reachable from the index
- If no suitable hub exists, create one and link it from an existing hub or from \`Index.md\`

### Inline links

Embed links naturally in prose where the surrounding sentence provides context. No description needed — the prose does that work.

\`\`\`markdown
A sourdough starter must be fed before use in [[bulk fermentation]].
\`\`\`

### Out-of-prose links

Links that appear outside of prose — in hub notes or \`## See also\` sections — must include a short description, since there is no surrounding context.

\`\`\`markdown
[[Bulk fermentation]] - First rise after mixing; timing depends on starter activity
\`\`\`

Use a \`## See also\` section at the bottom of a leaf note for related concepts that are relevant but don't fit naturally into the prose.

## Naming Conventions

- Filenames use title case with spaces: \`AI coding workflow.md\`, not \`ai-coding-workflow.md\`
- Filenames match the H1 heading exactly
- Be descriptive but concise in naming
`
