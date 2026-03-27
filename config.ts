// Named model variables — reusable across profiles
const models = {
  claudeSonnet: { providerID: "github-copilot", modelID: "claude-sonnet-4-6" },
  gptMini:      { providerID: "github-copilot", modelID: "gpt-5-mini" },
}

export type ModelRef = { providerID: string; modelID: string }

export const config = {
  knowledgeBasePath: "~/Repo/vibe-coding/vibe-context/knowledge",
  memoryFilePath: "~/Repo/vibe-coding/vibe-context/memory/Memory.md",
  harnessPath: "~/Repo/vibe-coding/vibe-ai-agent-harness",

  profiles: {
    default: {
      primary: models.claudeSonnet,
      memory:  models.gptMini,
    },
  },
}

export type Profile = typeof config.profiles[keyof typeof config.profiles]
