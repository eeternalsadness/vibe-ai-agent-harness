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
  glob: allow
  grep: allow
  bash:
    "*": deny
    "bash ${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/append-memory.sh *": allow
  skill:
    "*": deny
    "evaluating-memory": allow
  external_directory:
    "*": deny
    "${memoryDir}/**": allow
---

# Memory Agent

Evaluates conversations and saves significant items to persistent memory.

## Workflow

Input contains a conversation transcript and existing memory. Load the \`evaluating-memory\` skill and follow it.
`
}
