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
    "minimax-m2.5": { providerID: "opencode", modelID: "minimax-m2.5-free" },
    "gpt-5-nano": { providerID: "opencode", modelID: "gpt-5-nano" },
  },
  openrouter: {
    "gpt-oss-120b": { providerID: "openrouter/openai", modelID: "gpt-oss-120b:free" },
    "llama-3.2-3b-instruct": { providerID: "openrouter/meta-llama", modelID: "llama-3.2-3b-instruct:free" },
  },
  lmstudio: {
    "qwen3.5:9b": { providerID: "lmstudio", modelID: "qwen/qwen3.5-9b" },
    "gemma4:e4b": { providerID: "lmstudio", modelID: "google/gemma-4-e4b" },
    "gpt-oss:20b": { providerID: "lmstudio", modelID: "openai/gpt-oss-20b" },
  },
  framework: {
    "qwen3.6:27b": { providerID: "framework", modelID: "Qwen3.6-27B-Q4_K_M" },
    "qwen3.6:35b-a3b-moe": { providerID: "framework", modelID: "Qwen3.6-35B-A3B-MXFP4_MOE" },
    "qwen3.6:35b-a3b": { providerID: "framework", modelID: "Qwen3.6-35B-A3B-UD-Q4_K_M" },
    "gpt-oss:120b": { providerID: "framework", modelID: "gpt-oss-120b-F16" },
  },
  yescale: {
    "gemini-3-pro": { providerID: "yescale", modelID: "gemini-3-pro-preview" },
    "deepseek-v3.2": { providerID: "yescale", modelID: "deepseek-v3.2-thinking" },
    "gemini-3-flash": { providerID: "yescale", modelID: "gemini-3-flash-preview" },
  }
}

import { homedir } from "os"
const repoPath = `${homedir()}/Repo`

export const config = {
  repoPath,
  knowledgeBasePath: `${repoPath}/vibe-coding/vibe-context/knowledge`,
  memoryFilePath: `${repoPath}/vibe-coding/vibe-context/memory/Memory.md`,
  harnessPath: `${repoPath}/vibe-coding/vibe-ai-agent-harness`,

  defaultProfile: "copilot" as const,

  profiles: {
    copilot: {
      primary: models.copilot["claude-sonnet-4.6"],
      memory: models.copilot["gpt-5-mini"],
      research: models.copilot["claude-sonnet-4.6"],
      knowledgeBase: models.copilot["claude-haiku-4.5"],
      planner: models.copilot["claude-sonnet-4.6"],
      coder: models.copilot["claude-sonnet-4.6"],
      reviewer: models.copilot["claude-sonnet-4.6"],
    },
    broke: {
      primary: models.opencode["big-pickle"],
      memory: models.opencode["gpt-5-nano"],
      research: models.opencode["big-pickle"],
      knowledgeBase: models.opencode["minimax-m2.5"],
      planner: models.opencode["big-pickle"],
      coder: models.opencode["big-pickle"],
      reviewer: models.opencode["big-pickle"],
    },
    framework: {
      primary: models.opencode["big-pickle"],
      memory: models.framework["qwen3.6:35b-a3b-moe"],
      research: models.framework["qwen3.6:35b-a3b-moe"],
      knowledgeBase: models.framework["qwen3.6:35b-a3b-moe"],
      planner: models.opencode["big-pickle"],
      coder: models.opencode["big-pickle"],
      reviewer: models.opencode["big-pickle"],
    },
    based: {
      primary: models.yescale["gemini-3-flash"],
      memory: models.lmstudio["qwen3.5:9b"],
      research: models.yescale["gemini-3-flash"],
      knowledgeBase: models.lmstudio["qwen3.5:9b"],
      planner: models.yescale["deepseek-v3.2"],
      coder: models.copilot["claude-sonnet-4.6"],
      reviewer: models.copilot["claude-sonnet-4.6"],
    },
  },
}

export type Profile = typeof config.profiles[keyof typeof config.profiles]
