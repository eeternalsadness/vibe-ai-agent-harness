import type { Profile } from "../../../../config"
import { config } from "../../../../config"
import { dirname } from "node:path"

export default function curatorAgent(profile: Profile): string {
  const memoryDir = dirname(config.memoryFilePath)
  return `---
description: Autonomous knowledge base curator. Runs enrichment and maintenance on the knowledge base.
model: ${profile.knowledgeBase.providerID}/${profile.knowledgeBase.modelID}
mode: primary
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
    resource: "grep *"
    effect: allow
  - action: shell
    resource: "shuf *"
    effect: allow
  - action: shell
    resource: "bash ${config.harnessPath}/dist/opencode/skills/maintaining-knowledge-base/scripts/*"
    effect: allow
  - action: shell
    resource: "python3 ${config.harnessPath}/dist/opencode/skills/maintaining-knowledge-base/scripts/*"
    effect: allow
  - action: shell
    resource: "bash ${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/append-memory.sh *"
    effect: allow
  - action: shell
    resource: "git -C ${config.knowledgeBasePath} add -A"
    effect: allow
  - action: shell
    resource: "git -C ${config.knowledgeBasePath} commit -m *"
    effect: allow
  - action: shell
    resource: "git -C ${config.knowledgeBasePath} push"
    effect: allow
  - action: skill
    resource: "enriching-knowledge-base"
    effect: allow
  - action: skill
    resource: "maintaining-knowledge-base"
    effect: allow
  - action: skill
    resource: "researching-knowledge"
    effect: allow
  - action: subagent
    resource: "research"
    effect: allow
  - action: subagent
    resource: "knowledge-base"
    effect: allow
  - action: external_directory
    resource: "${config.knowledgeBasePath}/**"
    effect: allow
  - action: external_directory
    resource: "${memoryDir}/**"
    effect: allow
  - action: external_directory
    resource: "${config.harnessPath}/dist/opencode/skills/evaluating-memory/scripts/**"
    effect: allow
  - action: external_directory
    resource: "${config.harnessPath}/dist/opencode/skills/maintaining-knowledge-base/scripts/**"
    effect: allow
---

# Curator Agent

You are an autonomous worker. Your job is to enrich and maintain the knowledge base.

## Personality

Reliable and methodical. No improvisation. Follow the skill workflow step by step.

## Workflow

You will be invoked with one of two prompts:

- **Enrich** — Load the \`enriching-knowledge-base\` skill and execute it fully.
- **Maintain** — Load the \`maintaining-knowledge-base\` skill and execute it fully.

Execute autonomously without asking for confirmation.
`
}
