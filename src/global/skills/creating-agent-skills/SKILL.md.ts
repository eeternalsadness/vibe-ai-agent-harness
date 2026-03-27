import { config } from "../../../../config"

// TODO: the opencode-conventions reference link below is OpenCode-specific (local file path).
// Future: make this a platform-specific parameter so other platforms can inject their own equivalent.

export default `---
name: creating-agent-skills
description: Create agent skills with proper structure, metadata, and documentation for AI coding assistants. Use when the user wants to create a new skill, define custom capabilities, or set up reusable task definitions. Includes guidance on skill design, naming, structure, and best practices.
---

# Creating Agent Skills

Guide for creating well-structured, maintainable agent skills for AI coding assistants.

## Skill Creation Workflow

When creating a skill, ask two questions:

**Ask the user:**
> 1. Which skill convention should I use?
>    - **OpenCode** (YAML frontmatter in SKILL.md)
>    - **Custom** (provide your format/convention)
>
> 2. What is the skill scope?
>    - **Project-level** (specific to current project/repository)
>    - **Global** (reusable across all projects)

If OpenCode: Follow \`${config.harnessPath}/dist/opencode/skills/creating-agent-skills/reference/opencode-conventions.md\`
If Custom: Ask user for metadata format, file structure, and save location

## Core Design Principles

### 1. Clarity of Purpose
- **What** capability does this enable?
- **When** should it trigger? (keywords, contexts, scenarios)
- **What** output should it produce?

### 2. Progressive Disclosure
Organize in layers by usage frequency:
1. **Metadata** — Always visible (~100 tokens)
2. **Core instructions** — Loaded when triggered
3. **Reference files** — Loaded only when needed
4. **Scripts** — Executed, not loaded

### 3. Appropriate Structure
- **Simple (single file)** — Straightforward instructions, self-contained
- **Complex (multiple files)** — Multi-step workflows, reference docs, scripts

## Skill Naming

Choose names that are:
- **Descriptive** — Immediately clear what it does
- **Action-oriented** — Gerund form preferred: \`processing-pdfs\`, \`analyzing-data\`
- **Vendor-agnostic** — No platform-specific terms
- **Concise** — Short but meaningful

**Good:** \`creating-agent-skills\`, \`managing-git-workflows\`, \`testing-python-code\`
**Poor:** \`helper\`, \`utils\`, \`my-skill\`, \`documents\`

## Skill Description

Include:
1. What the skill does (specific, not vague)
2. When to use it (contexts, keywords, file types)
3. Trigger phrases (help model recognize relevance)

Write in third person:
- ✓ "Processes Excel files and generates reports"
- ✗ "I can help you process Excel files"

Be slightly "pushy" — include contexts where model might hesitate but should trigger.

## Skill Content Structure

### Essential Sections

**Overview** — One paragraph on purpose

**When to Use** — Specific scenarios and triggers

**Key Instructions** — Core guidance (keep focused)

**Workflow** — For multi-step tasks, use checklists:
\`\`\`markdown
- [ ] Step 1: Analyze requirements
- [ ] Step 2: Design structure
- [ ] Step 3: Implement
- [ ] Step 4: Test
\`\`\`

**Common Patterns** — Reusable templates

**Common Mistakes** — Table of pitfalls and solutions

**References** — Links to detailed docs in separate files

## Common Patterns

### Template Pattern
Provide exact output structures:

\`\`\`\`markdown
## Output Format

Use this template:

\`\`\`markdown
# [Title]
## Section 1
[Content]
\`\`\`
\`\`\`\`

### Examples Pattern
Show input/output pairs:

\`\`\`markdown
**Example 1:**
Input: [description]
Output:
\`\`\`
[exact output]
\`\`\`
\`\`\`

### Workflow Pattern
Sequential steps with checklists for tracking.

### Conditional Workflow
Guide through decision points:

\`\`\`markdown
Determine task type:
- **Creating?** → Follow creation workflow
- **Editing?** → Follow editing workflow
\`\`\`

### Feedback Loop
Validate → fix → repeat cycles:

\`\`\`markdown
1. Perform task
2. Validate output
3. If fails: fix and return to step 2
4. Proceed only when valid
\`\`\`

## Best Practices

### Conciseness
- Every line must justify its presence
- Main file target: under 500 lines
- Move details to reference files
- Use progressive disclosure

### Structure
- Consistent terminology throughout
- Clear heading hierarchy
- Number workflow steps
- 2-3 concrete examples for clarity

### Testing
Before deployment:
- **Manual test** — Triggers appropriately
- **Behavior test** — Produces expected results
- **Edge case test** — Handles unusual inputs
- **Collision test** — No conflicts with other skills

## Common Mistakes

| Mistake | Problem | Solution |
|---------|---------|----------|
| Too much detail in main file | Bloats context | Move to reference files |
| Vague description | Doesn't trigger | Add specific keywords |
| Complex workflow | Model loses track | Use checklists |
| No examples | Model guesses output | Provide 2-3 examples |
| Nested references | Hard to find info | One level deep max |
| Generic name | Not discoverable | Be specific |
| Inconsistent terms | Confusing | Choose and stick |

## File Organization

### Simple Skill
\`\`\`
skill-name/
└── SKILL.md
\`\`\`

### Complex Skill
\`\`\`
skill-name/
├── SKILL.md
├── reference/
│   ├── api-docs.md
│   └── patterns.md
├── examples.md
└── scripts/
    └── validate.py
\`\`\`

**Naming conventions:**
- Use forward slashes: \`reference/guide.md\`
- Descriptive names: \`validation-rules.md\` not \`doc2.md\`
- Group by domain: \`reference/finance.md\`, \`reference/sales.md\`
- One level deep from SKILL.md
`
