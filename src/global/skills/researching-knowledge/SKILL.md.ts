export default `---
name: researching-knowledge
description: Looks up knowledge on a topic — best practices, architecture decisions, technology details, or prior decisions. Use when you are not absolutely certain about something. If there is any doubt, use this skill. Also use when the user explicitly provides an external source (such as a URL) to research. Does not apply to file or codebase exploration.
---

# Researching Knowledge

Use this skill any time you are not absolutely certain about a topic before acting, or when the user explicitly provides an external source to research. It checks the knowledge base first for topic research, goes straight to external research for on-demand requests, and captures findings for future use. If there is any doubt, load this skill — do not guess.

## Workflow 1: Topic Research

Use when you are not absolutely certain about a topic and no specific source has been provided.

1. **Check the knowledge base** — Call \`@knowledge-base\` with a focused lookup prompt. State the specific question you need answered and ask whether existing notes are sufficient. This is a read-only lookup — do not include capture or write instructions. Example: "I need to answer: [specific question]. Do your existing notes cover this sufficiently?"

2. **Evaluate the response** — \`@knowledge-base\` returns exactly one of three types:
   - **Sufficient knowledge** — notes fully answer the question. Use the returned content and skip remaining steps.
   - **Insufficient knowledge** — relevant notes exist but gaps remain. \`@knowledge-base\` lists what exists and what is missing. Proceed to step 3, targeting only the gaps.
   - **No relevant notes** — nothing related exists. Proceed to step 3 for the full topic.

3. **Research** — Call \`@research\` with the topic or the specific gaps from step 2. \`@research\` returns a structured findings block.

4. **Capture** — Pass the structured findings block verbatim to \`@knowledge-base\` to capture. Wait for confirmation.

5. **Return** — Return a summary of findings to the caller.

## Workflow 2: On-Demand Research

Use when the user explicitly provides an external source (such as a URL) to research. Skip the knowledge base check and go straight to \`@research\`.

1. **Research** — Call \`@research\` with the source and the question or topic. \`@research\` returns a structured findings block.

2. **Capture** — Pass the structured findings block verbatim to \`@knowledge-base\` to capture. Wait for confirmation.

3. **Return** — Return a summary of findings to the caller.
`
