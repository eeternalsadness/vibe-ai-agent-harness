// Named model variables — reusable across profiles
const models = {
  claudeSonnet: { providerID: "github-copilot", modelID: "claude-sonnet-4-6" },
  gptMini: { providerID: "github-copilot", modelID: "gpt-5-mini" },
  bigPickle: { providerID: "opencode", modelID: "big-pickle" },
  gptOss120b: { providerID: "openrouter/openai", modelID: "gpt-oss-120b:free" },
  llama3b: { providerID: "openrouter/meta-llama", modelID: "llama-3.2-3b-instruct:free" },
  localLlama3b: { providerID: "ollama", modelID: "llama3.2:3b" },
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
      memory: models.gptMini,
      research: models.claudeSonnet,
      knowledgeBase: models.gptMini,
    },
    personal: {
      primary: models.bigPickle,
      memory: models.localLlama3b,
      research: models.gptOss120b,
      knowledgeBase: models.localLlama3b,
    },
  },
}

export type Profile = typeof config.profiles[keyof typeof config.profiles]
