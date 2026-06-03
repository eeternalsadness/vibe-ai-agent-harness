import type { Profile } from "../../../../config"
import { config } from "../../../../config"
import { dirname } from "path"

export default function memoryAgent(profile: Profile): string {
  const memoryDir = dirname(config.memoryFilePath)
  return `---
description: Evaluates conversation transcripts and extracts new memory items.
model: ${profile.memory.providerID}/${profile.memory.modelID}
mode: subagent
temperature: 0.2
hidden: true
permission:
  "*": deny
  read: allow
  edit: allow
  glob: allow
  grep: allow
  webfetch: deny
  websearch: deny
  codesearch: deny
  bash:
    "*": deny
    "bash ${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/truncate-memory.sh": allow
  task: deny
  skill:
    "*": deny
    "evaluating-memory": allow
  external_directory:
    "*": deny
    "${memoryDir}/**": allow
---

# Memory Agent

Evaluates conversations and saves significant items to persistent memory. Two modes — determine from input which applies.

## Mode: Evaluate Conversation

Input contains a conversation transcript and existing Memory.md. Load the \`evaluating-memory\` skill and follow it. If there are items to save, append them to \`${config.memoryFilePath}\` using the \`edit\` tool.

## Mode: KB Enrichment

Input is a topic name passed explicitly by the enriching-knowledge-base skill. Append exactly one item to \`${config.memoryFilePath}\`:

\`\`\`
- [kb-enrichment] kb-enrichment: researched <topic>
\`\`\`

No deduplication check needed — the enrichment skill already filters previously enriched topics.
`
}
