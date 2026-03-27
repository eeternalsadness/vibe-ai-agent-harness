export default `# OpenCode Skill Conventions

Platform-specific conventions for creating OpenCode skills.

## YAML Frontmatter

Every OpenCode SKILL.md must start with YAML frontmatter:

\`\`\`yaml
---
name: skill-identifier
description: What the skill does and when to use it
---
\`\`\`

### name Field
- Lowercase letters, numbers, hyphens only
- Maximum 64 characters
- No XML tags
- Avoid vendor-specific words ("anthropic-helper", "openai-tools")
- Prefer gerund form (verb + -ing)

### description Field
- Maximum 1024 characters
- Must be non-empty
- No XML tags
- Most critical field for triggering
- Write in third person

## Skill Locations

**Project-specific:**
\`\`\`
.opencode/skills/
\`\`\`

**Global:**
\`\`\`
~/.config/opencode/skills/
\`\`\`

## File Naming

- Forward slashes in paths: \`reference/guide.md\` not \`reference\\guide.md\`
- Descriptive names: \`validation-rules.md\` not \`doc2.md\`
- Group by domain: \`reference/finance.md\`, \`reference/sales.md\`
- Keep references one level deep from SKILL.md

## Loading Behavior

OpenCode loads skills in layers:

1. **Metadata (always)** — Name + description pre-loaded (~100 tokens)
2. **SKILL.md body (on trigger)** — Full instructions when relevant
3. **Reference files (as needed)** — Only loaded when model needs them
4. **Scripts (executed, not loaded)** — Run via bash, source not loaded

## Complete Workflow Example

When creating an OpenCode skill:

\`\`\`markdown
- [ ] Step 1: Clarify requirement with user
- [ ] Step 2: Choose skill name (gerund form, descriptive)
- [ ] Step 3: Determine location (user already chose project or global)
- [ ] Step 4: Create skill directory
- [ ] Step 5: Write YAML frontmatter
- [ ] Step 6: Write main skill instructions
- [ ] Step 7: Add reference files if needed
- [ ] Step 8: Test the skill
\`\`\`

### Step 1: Clarify Requirement

Ask user:
- What should this skill enable?
- When should it trigger?
- What are typical use cases?

### Step 2: Choose Skill Name

Propose name following conventions:
- Gerund form: \`analyzing-logs\`, \`managing-databases\`
- Descriptive and specific
- Maximum 64 characters

### Step 3: Determine Location (Based on User's Choice)

User should have already specified project or global. Use their choice:

**Global scope** → \`~/.config/opencode/skills/\`
- Use for: reusable skills across projects, personal preferences, general-purpose capabilities

**Project scope** → \`.opencode/skills/\`
- Use for: team conventions, project-specific patterns, internal standards

### Step 4: Create Directory

**For global skills:**
\`\`\`bash
mkdir -p ~/.config/opencode/skills/skill-name/
\`\`\`

**For project skills:**
\`\`\`bash
mkdir -p .opencode/skills/skill-name/
\`\`\`

**For complex skills with references (add reference/ and/or scripts/ subdirectories):**

Global:
\`\`\`bash
mkdir -p ~/.config/opencode/skills/skill-name/reference/
mkdir -p ~/.config/opencode/skills/skill-name/scripts/
\`\`\`

Project:
\`\`\`bash
mkdir -p .opencode/skills/skill-name/reference/
mkdir -p .opencode/skills/skill-name/scripts/
\`\`\`

### Step 5: Write YAML Frontmatter

Create SKILL.md with:

\`\`\`yaml
---
name: skill-identifier
description: Comprehensive description including what it does, when to use it, and specific keywords/contexts that should trigger it.
---
\`\`\`

Make description "pushy" to ensure proper triggering.

### Step 6: Write Main Instructions

Structure with:
- Overview
- When to use this skill
- Key instructions
- Workflow (if multi-step with checklist)
- Common patterns
- Examples
- Common mistakes
- References

Target: under 500 lines. Move details to reference files.

### Step 7: Add Reference Files

For complex skills, create:

\`\`\`
reference/
├── detailed-docs.md
├── api-reference.md
└── patterns.md
\`\`\`

Link from SKILL.md using markdown:
\`\`\`markdown
See [reference/api-reference.md](reference/api-reference.md) for details.
\`\`\`

### Step 8: Test the Skill

Verify:
- Loads without errors
- Triggers on expected keywords/contexts
- Produces expected guidance
- No conflicts with other skills
`
