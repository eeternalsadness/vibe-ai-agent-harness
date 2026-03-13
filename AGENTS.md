# Agent Instructions

## Memory

You have access to short-term working memory at `~/Repo/vibe-coding/vibe-context/memory/Memory.md`. This file contains concise bullet points about recent work, decisions, and context. **Read this file at the start of each session** to understand current state.

**When to update memory:**

- Important context changes or decisions
- New project focus or direction
- Key discoveries or learnings

**How to update:**

Invoke the memory subagent: `@memory add [concise description]` or `@memory update [existing item with new info]`

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
