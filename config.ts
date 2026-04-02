// Model registry — nested by provider
const models = {
  copilot: {
    "claude-sonnet-4.5": { providerID: "github-copilot", modelID: "claude-sonnet-4.5" },
    "claude-sonnet-4.6": { providerID: "github-copilot", modelID: "claude-sonnet-4.6" },
    "claude-haiku-4.5": { providerID: "github-copilot", modelID: "claude-haiku-4.5" },
    "gpt-5-mini": { providerID: "github-copilot", modelID: "gpt-5-mini" },
    "gpt-4.1": { providerID: "github-copilot", modelID: "gpt-4.1" },
  },
  opencode: {
    "big-pickle": { providerID: "opencode", modelID: "big-pickle" },
  },
  openrouter: {
    "gpt-oss-120b": { providerID: "openrouter/openai", modelID: "gpt-oss-120b:free" },
    "llama-3.2-3b-instruct": { providerID: "openrouter/meta-llama", modelID: "llama-3.2-3b-instruct:free" },
  },
  ollama: {
    "llama3.2:3b": { providerID: "ollama", modelID: "llama3.2:3b" },
  },
}

const repoPath = "~/Repo"

export const config = {
  repoPath,
  knowledgeBasePath: `${repoPath}/vibe-coding/vibe-context/knowledge`,
  memoryFilePath: `${repoPath}/vibe-coding/vibe-context/memory/Memory.md`,
  harnessPath: `${repoPath}/vibe-coding/vibe-ai-agent-harness`,

  defaultProfile: "copilot" as const,

  profiles: {
    copilot: {
      primary: models.copilot["claude-sonnet-4.5"],
      memory: models.copilot["gpt-5-mini"],
      research: models.copilot["claude-sonnet-4.5"],
      knowledgeBase: models.copilot["claude-haiku-4.5"],
      planner: models.copilot["claude-sonnet-4.5"],
      coder: models.copilot["claude-sonnet-4.5"],
    },
    broke: {
      primary: models.opencode["big-pickle"],
      memory: models.ollama["llama3.2:3b"],
      research: models.opencode["big-pickle"],
      knowledgeBase: models.ollama["llama3.2:3b"],
      planner: models.opencode["big-pickle"],
      coder: models.opencode["big-pickle"],
    },
  },
}

export type Profile = typeof config.profiles[keyof typeof config.profiles]
