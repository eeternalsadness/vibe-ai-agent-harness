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
2. **150 characters max** - If longer, split into multiple focused bullets
3. **Context, not details** - What the agent needs to know, not how it was done
4. **Actionable or informative** - Either states current work or provides needed context

When a memory item exceeds 150 characters, break it down into multiple atomic items. Each should capture one distinct fact or piece of context.

**Good memory items:**

```markdown
- Working on authentication system using [[OAuth2 Patterns]]
- Implemented token refresh flow, now adding rate limiting
- API gateway redesign complete: migrated from monolith to microservices
- Using event-driven architecture with message queue pattern
```

**Bad memory items (too long, should be split):**

```markdown
- Researched OAuth2 flows and created 5 implementation guides covering authorization code flow, client credentials, refresh tokens, PKCE extension, and security best practices with token storage recommendations
```

Should be split into:
```markdown
- Researched OAuth2 and created [[OAuth2 Implementation Guide]] in knowledge base
- Now implementing OAuth2 authorization code flow with PKCE in auth service
```

**Bad memory items (too detailed, belongs in knowledge base):**

```markdown
- OAuth2 uses authorization code flow: client redirects to auth server, user authenticates, server returns code, client exchanges code for token
- Token refresh requires storing refresh token in httpOnly cookie and access token in memory with 15min expiry
```

Should be:
```markdown
- Implementing OAuth2 flow using [[OAuth2 Patterns]] guide
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

- Building API gateway: event-driven microservices architecture
- Repo structure: backend/ (services), docs/ (API specs), infra/ (IaC configs)
- Authentication service complete using [[OAuth2 Patterns]]
- Rate limiting implemented: token bucket algorithm, Redis-backed
- Now working on payment service integration with Stripe
- Payment flows documented in [[Payment Processing Patterns]]
```

This entire memory file is ~10 lines and provides essential context. Details live in knowledge base notes that are linked when relevant.
