# Split Knowledge Base Agent into Knowledge Base Agent + Research Agent

## Context

The current `@knowledge-base` agent does research + knowledge base writes. This conflates two distinct responsibilities.

## Design

### Knowledge Base Agent

Pure knowledge base operations. Single authority on knowledge base structure and conventions.

**Tools:** read, write, edit, glob, grep

**Mode:** subagent, temperature 0.3

**Read task:** Given a topic, return all relevant notes in full detail. If nothing relevant, say so explicitly.

**Write task:** Receive synthesized content, format per zettelkasten conventions, write to knowledge base.

### Research Agent

Fills gaps in the knowledge base. Handles forced research from primary agent.

**Tools:** webfetch, websearch, codesearch, task (to invoke knowledge base agent)

**Mode:** subagent, temperature 0.3

**Workflow:**
1. Call `@knowledge-base` to check existing coverage on the topic
2. If nothing relevant found:
   - Conduct internet research
   - Call `@knowledge-base` to write synthesized findings
3. If relevant found:
   - Return the relevant notes to the primary agent

**Forced research:** When primary agent delegates with a specific source (URL, file), skip straight to internet research and capture.

### Primary Agent Workflow

Updated in AGENTS.md:
- Step 1 (Research): working memory → if insufficient, delegate to `@research`
- "Knowledge base agent" reference → "knowledge base agent" (no change, but clarifies it's for reads via research agent)

## Changes

1. `src/global/agents/knowledge-base/knowledge-base.md.ts` — refactor to pure knowledge base read/write operations
2. `src/global/agents/research/research.md.ts` — new research agent
3. `src/global/AGENTS.md.ts` — update delegation to `@research`
4. `src/global/agents/memory/memory.md.ts` — check for @knowledge-base references, update if needed
