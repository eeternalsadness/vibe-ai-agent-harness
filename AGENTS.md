# Agent Instructions

## Knowledge Base

You have access to a persistent knowledge base stored in the `vibe-knowledge-base` repository (located at `~/Repo/vibe-coding/vibe-knowledge-base`). This knowledge base is a zettelkasten — a graph of atomic notes covering various topics. **ALWAYS check the knowledge base FIRST before using any tool (such as webfetch) to gather information**.

**Priority order for gathering information:**

1. Check the knowledge base first
2. Only if the knowledge base doesn't have the answer, use other information sources

**How to use it:**

- Start from `vibe-knowledge-base/Index.md` and traverse links to find relevant notes
- Use the knowledge base to build on existing understanding rather than starting from scratch each time

**Structure:**

- All notes are markdown files in the root of `vibe-knowledge-base/`
- Notes use `[[wiki-links]]` to reference each other
- Hub notes organize topics, leaf notes contain actual knowledge
