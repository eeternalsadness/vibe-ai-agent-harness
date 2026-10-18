// Model registry — nested by provider
const models = {
  copilot: {
    "claude-sonnet-4.6": { providerID: "github-copilot", modelID: "claude-sonnet-4.6" },
    "claude-haiku-4.5": { providerID: "github-copilot", modelID: "claude-haiku-4.5" },
    "gpt-5-mini": { providerID: "github-copilot", modelID: "gpt-5-mini" },
    "gpt-4.1": { providerID: "github-copilot", modelID: "gpt-4.1" },
  },
  opencode: {
    "big-pickle": { providerID: "opencode", modelID: "big-pickle" },
    "deepseek-v4-flash": { providerID: "opencode", modelID: "deepseek-v4-flash-free" },
    "mimo-v2.5": { providerID: "opencode", modelID: "mimo-v2.5-free" },
  },
  openrouter: {
    "glm-5.2": { providerID: "openrouter/z-ai", modelID: "glm-5.2" },
  },
  lmstudio: {
    "qwen3.5:9b": { providerID: "lmstudio", modelID: "qwen/qwen3.5-9b" },
    "gemma4:e4b": { providerID: "lmstudio", modelID: "google/gemma-4-e4b" },
    "gpt-oss:20b": { providerID: "lmstudio", modelID: "openai/gpt-oss-20b" },
  },
  framework: {
    "qwen3.8-flash-next": { providerID: "framework", modelID: "Qwen3.8-Flash-Next" },
    "qwen3.8-27b": { providerID: "framework", modelID: "Qwen3.8-27B" },
    "qwen3.6:35b-a3b": { providerID: "framework", modelID: "Qwen3.6-35B-A3B" },
    "gemma-4-e4b": { providerID: "framework", modelID: "Gemma-4-E4B" },
  },
  halogen: {
    "qwen3.8-flash-next": { providerID: "halogen-flash-server", modelID: "halogen-qwen3.8-flash-next" },
  },
  yescale: {
    "deepseek-v4-pro": { providerID: "yescale", modelID: "deepseek-v4-pro" },
    "gemini-3-flash": { providerID: "yescale", modelID: "gemini-3-flash-preview" },
    "gemini-3-pro": { providerID: "yescale", modelID: "gemini-3-pro-preview" },
    "glm-5.3": { providerID: "yescale", modelID: "glm-5.3" },
    "minimax-m2.7": { providerID: "yescale", modelID: "MiniMax-M2.7" },
  },
  bedrock: {
    "claude-haiku-4.5": { providerID: "amazon-bedrock", modelID: "global.anthropic.claude-haiku-4-5-20251001-v1:0" },
    "claude-haiku-5.5": { providerID: "amazon-bedrock", modelID: "global.anthropic.claude-haiku-5-5" },
    "claude-sonnet-5": { providerID: "amazon-bedrock", modelID: "global.anthropic.claude-sonnet-5" },
    "claude-sonnet-5.5": { providerID: "amazon-bedrock", modelID: "global.anthropic.claude-sonnet-5-5" },
    "claude-opus-5.5": { providerID: "amazon-bedrock", modelID: "global.anthropic.claude-opus-5-5" },
    "glm-5": { providerID: "amazon-bedrock", modelID: "zai.glm-5" },
    "gpt-5.5": { providerID: "amazon-bedrock", modelID: "openai.gpt-5.5" },
    "grok-4.3": { providerID: "amazon-bedrock", modelID: "xai.grok-4.3" },
    "kimi-k2.5": { providerID: "amazon-bedrock", modelID: "moonshotai.kimi-k2.5" },
    "minimax-m2.5": { providerID: "amazon-bedrock", modelID: "minimax.minimax-m2.5" },
    "deepseek-v3.2": { providerID: "amazon-bedrock", modelID: "deepseek.v3.2" },
  },
}

import { homedir } from "node:os"
const repoPath = `${homedir()}/Repo`

export const config = {
  repoPath,
  knowledgeBasePath: `${repoPath}/vibe-coding/vibe-context/knowledge`,
  memoryFilePath: `${repoPath}/vibe-coding/vibe-context/memory/Memory.md`,
  harnessPath: `${repoPath}/vibe-coding/vibe-ai-agent-harness`,

  defaultProfile: "work" as const,

  profiles: {
    work: {
      primary: models.bedrock["claude-sonnet-5.5"],
      memory: models.bedrock["claude-haiku-5.5"],
      research: models.bedrock["claude-haiku-5.5"],
      knowledgeBase: models.bedrock["claude-haiku-5.5"],
      planner: models.bedrock["claude-opus-5.5"],
      coder: models.bedrock["claude-sonnet-5.5"],
      reviewer: models.bedrock["claude-sonnet-5.5"],
    },
    broke: {
      primary: models.opencode["big-pickle"],
      memory: models.opencode["deepseek-v4-flash"],
      research: models.opencode["big-pickle"],
      knowledgeBase: models.opencode["deepseek-v4-flash"],
      planner: models.opencode["big-pickle"],
      coder: models.opencode["big-pickle"],
      reviewer: models.opencode["big-pickle"],
    },
    framework: {
      primary: models.framework["qwen3.6:35b-a3b"],
      memory: models.framework["gemma-4-e4b"],
      research: models.framework["qwen3.6:35b-a3b"],
      knowledgeBase: models.framework["qwen3.6:35b-a3b"],
      planner: models.halogen["qwen3.8-flash-next"],
      coder: models.halogen["qwen3.8-flash-next"],
      reviewer: models.halogen["qwen3.8-flash-next"],
    },
    based: {
      primary: models.yescale["glm-5.3"],
      memory: models.lmstudio["qwen3.5:9b"],
      research: models.yescale["glm-5.3"],
      knowledgeBase: models.lmstudio["qwen3.5:9b"],
      planner: models.yescale["deepseek-v4-pro"],
      coder: models.yescale["glm-5.3"],
      reviewer: models.yescale["gemini-3-pro"],
    },
  },
}

export type Profile = typeof config.profiles[keyof typeof config.profiles]
