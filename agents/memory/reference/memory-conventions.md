# Memory Management Conventions

This document defines how the memory agent manages short-term working memory.

## Purpose

The memory system provides persistent context across sessions. The entire memory file gets injected into the agent's context, so extreme conciseness is critical.

## Memory File Location

`~/Repo/vibe-coding/vibe-context/memory/Memory.md`

## Memory Format

```markdown
# Memory

- [concise fact or context]
- [concise fact or context]
- [concise fact or context]
```

That's it. Just a flat list of bullet points, chronologically ordered (oldest first, newest last).

## Memory Item Guidelines

Each bullet point should be:

1. **One line** - Rarely more than one sentence
2. **Context, not details** - What the agent needs to know, not how it was done
3. **Actionable or informative** - Either states current work or provides needed context

**Good memory items:**

```markdown
- Working on AI agent harness project with stateless agents
- Restructured vibe-context repo: knowledge/ and memory/ subdirectories  
- Knowledge base agent complete, now implementing memory agent
- Using [[AI Subagent Best Practices]] as design guide
- Memory limit: ~50 lines, prune oldest when exceeded
```

**Bad memory items (too detailed):**

```markdown
- Changed line 47 in auth.js from `if (user.token == null)` to `if (!user.token)`
- Updated test file with 3 new test cases for null, undefined, empty string
```

**Bad memory items (too vague):**

```markdown
- Fixed some stuff
- Made changes
```

## Size Limit

Keep memory around **50 lines** (just the bullet points). When approaching limit:

1. **First pass**: Remove redundant/outdated items
2. **Second pass**: Combine related items if possible  
3. **Last resort**: Delete oldest items

The goal is keeping only what matters for current/future work.

## Adding Memory

The memory agent should add memory when:

- New project context is established
- Major decisions or direction changes occur
- Important discoveries or learnings happen
- Key patterns or preferences are established
- Current work focus changes

**Don't add memory for:**

- Routine task completion
- Implementation details (code specifics)
- Things already in knowledge base
- Temporary debugging info

## Updating Memory

When new memory is related to existing memory:

- If it extends/updates existing item: Update the bullet AND move it to the bottom (newest position)
- If it's truly new: Append to bottom

This keeps recently-relevant information fresh and prevents premature pruning of active context.

**Example:**

Before:
```markdown
- Working on authentication system
- Using OAuth2 pattern
```

After adding "completed OAuth2, now adding 2FA":
```markdown
- Working on authentication system
- Completed OAuth2, now implementing 2FA support
```

The updated OAuth2 item moved to the bottom as the newest memory.

## Cross-Referencing Knowledge

Use `[[wiki-links]]` sparingly to reference knowledge base notes when helpful:

```markdown
- Implementing OAuth2 using pattern from [[OpenCode GitHub Integration]]
```

## Example Memory File

```markdown
# Memory

- Building AI agent harness: stateless agents, knowledge-driven, small model compatible
- Repo structure: vibe-ai-agent-harness/ (configs), vibe-context/ (knowledge + memory)
- Knowledge base agent complete: manages ~/Repo/vibe-coding/vibe-context/knowledge/
- Knowledge uses zettelkasten format: [[wiki-links]], 50-100 line limit per note
- Now implementing memory agent to manage this file
- Memory injected into context, must stay under 50 lines
- Memory agent analyzes and prunes when near limit
```

This entire memory file is ~10 lines and provides all essential context for a new session.
