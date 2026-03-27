export const config = {
  knowledgeBasePath: "~/Repo/vibe-coding/vibe-context/knowledge",
  memoryFilePath: "~/Repo/vibe-coding/vibe-context/memory/Memory.md",
  harnessPath: "~/Repo/vibe-coding/vibe-ai-agent-harness",

  models: {
    primary: "anthropic/claude-sonnet-4-5",
    small: "anthropic/claude-haiku-4-5",
    fallbacks: ["openai/gpt-4o", "google/gemini-2.0-flash"],
  },
}
