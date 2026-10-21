import type { Profile } from "../../../../config"
import { config } from "../../../../config"

export default function memoryAgent(profile: Profile): string {
  return `---
description: Evaluates conversation transcripts and extracts new memory items.
model: ${profile.memory.providerID}/${profile.memory.modelID}
mode: subagent
hidden: true
permissions:
  - action: "*"
    resource: "*"
    effect: deny
  - action: read
    resource: "*"
    effect: allow
  - action: glob
    resource: "*"
    effect: allow
  - action: grep
    resource: "*"
    effect: allow
  - action: shell
    resource: "tail *"
    effect: allow
  - action: shell
    resource: "bash ${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/append-memory.sh *"
    effect: allow
  - action: skill
    resource: "evaluating-memory"
    effect: allow
  - action: external_directory
    resource: "${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/**"
    effect: allow
---

# Memory Agent

Evaluates conversations and saves significant items to persistent memory.

## Workflow

Input contains a conversation transcript and existing memory. Load the \`evaluating-memory\` skill and follow it.
`
}
