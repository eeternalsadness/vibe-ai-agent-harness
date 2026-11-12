export default `---
name: reading-knowledge-base
description: Use when asked to read or query the knowledge base. Defines how to find content and the three exact answer formats to return.
---

# Reading the Knowledge Base

1. Start at \`Index.md\`, follow \`[[wiki-links]]\` through domain and sub-topic notes until you find relevant content.
2. Return exactly one of the following. No other output.

   **Sufficient:**
   \`\`\`
   The knowledge base has sufficient knowledge on this topic.

   <relevant content from notes>
   \`\`\`

   **Insufficient:**
   \`\`\`
   The knowledge base has insufficient knowledge on this topic.

   <relevant content from notes>

   Missing topics:
   - <topic>
   \`\`\`

   **No relevant notes:**
   \`\`\`
   The knowledge base has no relevant knowledge on this topic.
   \`\`\`
`
