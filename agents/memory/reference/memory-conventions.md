# Memory Management Conventions

Memory provides persistent context across sessions. Injected directly into agent context.

**Location:** `~/Repo/vibe-coding/vibe-context/memory/Memory.md`

## Format

```markdown
# Memory

- [fact]
- [fact]
```

Flat list. Chronological (oldest first, newest last).

## Item Rules

1. **One line** - One sentence max
2. **150 chars max** - Split if longer
3. **Context, not details** - What/why, not how
4. **Actionable/informative** - Current work or needed context

## Good vs Bad

**Good:**
```markdown
- Working on auth using [[OAuth2 Patterns]]
- Token refresh flow complete, adding rate limiting
- Migrated API gateway from monolith to microservices
```

**Bad (too long, split needed):**
```markdown
- Researched OAuth2 flows and created 5 guides covering authorization code, client credentials, refresh tokens, PKCE, and security best practices
```

**Should be:**
```markdown
- Created [[OAuth2 Implementation Guide]] in knowledge base
- Implementing OAuth2 authorization code flow with PKCE
```

**Bad (too detailed, use KB):**
```markdown
- OAuth2: client redirects to auth server, user authenticates, returns code, exchanges for token
```

**Should be:**
```markdown
- Implementing OAuth2 flow using [[OAuth2 Patterns]]
```

## Size Limit

**Hard limit: 50 lines.** When at capacity, delete oldest item before adding new. No evaluation - mechanical FIFO queue.

## What to Remember

**Remember:**
- Project context
- Major decisions/changes
- Discoveries/learnings
- Patterns/preferences
- Work focus shifts

**Skip:**
- Routine tasks
- Implementation details
- Info in knowledge base
- Temporary debugging

## Wiki-Links

Reference knowledge base: `[[Note Name]]`

## Example

```markdown
# Memory

- Building API gateway: event-driven microservices
- Repo: backend/ (services), docs/ (specs), infra/ (IaC)
- Auth service complete using [[OAuth2 Patterns]]
- Rate limiting: token bucket, Redis-backed
- Working on Stripe payment integration
- Payment flows: [[Payment Processing Patterns]]
```
