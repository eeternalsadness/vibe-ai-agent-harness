// Named model variables — reusable across profiles
const models = {
  claudeSonnet: { providerID: "github-copilot", modelID: "claude-sonnet-4-6" },
  gptMini:      { providerID: "github-copilot", modelID: "gpt-5-mini" },
  bigPickle:    { providerID: "opencode", modelID: "big-pickle" },
  gptOss120b:   { providerID: "openrouter/openai", modelID: "gpt-oss-120b:free" },
}

export type ModelRef = { providerID: string; modelID: string }

const repoPath = "~/Repo"

export const config = {
  repoPath,
  knowledgeBasePath: `${repoPath}/vibe-coding/vibe-context/knowledge`,
  memoryFilePath: `${repoPath}/vibe-coding/vibe-context/memory/Memory.md`,
  harnessPath: `${repoPath}/vibe-coding/vibe-ai-agent-harness`,

  profiles: {
    default: {
      primary: models.claudeSonnet,
      memory:  models.gptMini,
      research: models.claudeSonnet,
    },
    personal: {
      primary: models.bigPickle,
      memory:  models.gptOss120b,
      research: models.gptOss120b,
    },
  },
}

export type Profile = typeof config.profiles[keyof typeof config.profiles]
