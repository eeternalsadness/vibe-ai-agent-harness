# Agent Instructions

## Memory

You have access to short-term working memory at `~/Repo/vibe-coding/vibe-context/memory/Memory.md`. This file contains concise bullet points about recent work, decisions, and context. **Read this file at the start of each session** to understand current state.

**When to update memory (do this proactively):**

- After completing significant features or implementations
- After making important architectural or design decisions
- When project focus or direction changes
- After key discoveries or learnings
- At the end of multi-step workflows that establish new context

**Examples of significant work that should trigger memory updates:**

- Implementing new agents, skills, or subsystems
- Creating new file structures or organizational patterns
- Making design decisions (e.g., choosing vendor-agnostic approaches)
- Completing features that change how the system works
- Discovering important patterns or best practices

**How to update:**

Invoke the memory subagent: `@memory add [concise description]` or `@memory update [existing item with new info]`

**Important:** Update memory proactively as you complete work, not just when asked. If you've done substantial work (implementing features, making decisions, establishing patterns), update memory before concluding.

## Knowledge Base

You have access to a persistent knowledge base stored in the `vibe-context` repository (located at `~/Repo/vibe-coding/vibe-context/knowledge/`). This knowledge base is a zettelkasten — a graph of atomic notes covering various topics. **ALWAYS check the knowledge base FIRST before using any tool (such as webfetch) to gather information**.

**Priority order for gathering information:**

1. Check memory for recent context
2. Check the knowledge base for established knowledge
3. Only if neither has the answer, use other information sources

**How to use it:**

- Start from `~/Repo/vibe-coding/vibe-context/knowledge/Index.md` and traverse links to find relevant notes
- Use the knowledge base to build on existing understanding rather than starting from scratch each time

**Structure:**

- All notes are markdown files in `~/Repo/vibe-coding/vibe-context/knowledge/`
- Notes use `[[wiki-links]]` to reference each other
- Hub notes organize topics, leaf notes contain actual knowledge

## Vendor Agnostic Language and Approaches

Always use vendor-agnostic language and approaches when discussing or implementing solutions. Avoid vendor-specific terminology, APIs, or lock-in patterns. Focus on standard, portable, and interoperable solutions that can work across different platforms and tools.
