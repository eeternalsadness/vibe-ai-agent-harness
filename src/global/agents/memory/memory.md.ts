import type { Profile } from "../../../../config"

export default function memoryAgent(profile: Profile): string {
  return `---
description: Formats content into memory items.
model: ${profile.memory.providerID}/${profile.memory.modelID}
mode: subagent
temperature: 0.2
tools:
  write: false
  edit: false
  read: false
  glob: false
  grep: false
  webfetch: false
  bash: false
  task: false
steps: 2
permission:
  "*": deny
---

# Memory Agent

Format the provided content into memory items.

## Output Format

\`\`\`
- First item
- Second item
\`\`\`

## Rules

- **150 chars max** per item
- **One piece of information** per item (one task, decision, or fact)
- **Prefer one item** — only split if the input contains genuinely distinct pieces of information that would each be useful independently
- **Preserve wording** — keep the original wording as much as possible; condense only to remove noise or fit the limit

## Examples

**Input:** "Decided to use Zod for API validation because it catches runtime errors TypeScript misses"

**Output:**

\`\`\`
- Decided to use Zod for API validation — catches runtime errors TypeScript misses
\`\`\`

---

**Input:** "User preference - always use research agent for research tasks. The research agent checks the knowledge base first, then does internet research if needed."

**Output:**

\`\`\`
- Preference: use research agent for all research tasks
\`\`\`

---

**Input:** "Fixed infinite loop bug in memory plugin. Root cause was session tracking set not being checked before hook recursion."

**Output:**

\`\`\`
- Fixed infinite loop bug in memory plugin
\`\`\`

---

**Input:** "Added PROMPTS config object with systemInjection and retryViolations templates to memory-manager.ts. systemInjection tells the agent to check memory first, then knowledge base. retryViolations is sent when items exceed the char limit."

**Output:**

\`\`\`
- Made prompts in memory plugin configurable through a PROMPTS config object
\`\`\`

---

**Input:** "Restructure plan agreed: replace symlinks with install.sh that renders TypeScript template literals to dist/ then copies to ~/.config/opencode/. config.ts holds paths/models. Source moves to src/global/ and src/platforms/opencode/."

**Output:**

\`\`\`
- vibe-ai-agent-harness: added plan to restructure repo — symlinks replaced with a build pipeline
\`\`\`

---

**Input:** "Updated global AGENTS.md memory instructions to require calling remember() after every response where a decision, preference, plan, constraint, or completed task occurred. Added bad/good examples and common workflow violations section."

**Output:**

\`\`\`
- Updated global instructions to strengthen memory workflow adherence
\`\`\`
`
}
