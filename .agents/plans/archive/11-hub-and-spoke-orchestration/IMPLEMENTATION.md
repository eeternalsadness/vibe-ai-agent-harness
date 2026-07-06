# Implementation: Hub-and-Spoke Orchestration

## Task 1 — Create the research skill

Create `src/global/skills/research/SKILL.md.ts`.

The skill encodes the full research workflow that currently lives inside `@research`. Primary agents load this skill when they need to research a topic from external sources.

Workflow the skill must describe:

1. **Check the knowledge base** — Call `@knowledge-base` with a focused lookup prompt. Ask whether existing notes are sufficient to answer the question. This is a read-only lookup — do not include capture instructions.
2. **Evaluate** — `@knowledge-base` returns one of three response types:
   - **Sufficient knowledge** — return the findings to the caller immediately. Skip remaining steps.
   - **Insufficient knowledge** — `@knowledge-base` lists what exists and what is missing. Proceed to step 3, targeting only the gaps.
   - **No relevant notes** — Proceed to step 3 for the full topic.
3. **Research** — Call `@research` with the topic (or the specific gaps identified in step 2). `@research` returns a structured findings block.
4. **Capture** — Pass the structured findings block verbatim to `@knowledge-base` to capture. Wait for confirmation.
5. **Return** — Return a summary of findings to the caller.

Acceptance criteria:
- File exists at `src/global/skills/research/SKILL.md.ts` and exports a default string
- Skill is registered in `src/render.ts` so it renders to `dist/` and gets installed
- Workflow matches the steps above exactly

---

## Task 2 — Update AGENTS.md

Replace the current `@research` delegation instruction in `src/global/AGENTS.md.ts` with an instruction to load the research skill when external knowledge is needed.

Update the Common Workflow Violations examples to reference the skill, not `@research` directly.

Acceptance criteria:
- No direct mention of `@research` in AGENTS.md workflow instructions
- Skill load instruction is clear and unambiguous
- Violations examples updated consistently

---

## Task 3 — Update `@coder`

Replace `@research` delegation in `src/global/agents/coder/coder.md.ts` with an instruction to load the research skill.

Affected sections:
- Workflow — Plan Mode, step 3 (Research)
- Workflow — Ad-hoc Mode, step 2 (Research)
- Research and Context section

Acceptance criteria:
- No direct mention of `@research` in coder instructions
- All three sections updated consistently

---

## Task 4 — Update `@planner`

Replace `@research` delegation in `src/global/agents/planner/planner.md.ts` with an instruction to load the research skill.

Affected section:
- Research and Context section

Acceptance criteria:
- No direct mention of `@research` in planner instructions

---

## Task 5 — Refactor `@reviewer` to primary agent

In `src/global/agents/reviewer/reviewer.md.ts`:

1. Change `mode: subagent` to `mode: primary`
2. Add `hidden: true` to frontmatter
3. Remove the entire `permission:` block
4. Replace `@research` delegation with an instruction to load the research skill
5. Update the constraint "Research first — always delegate to @research before reviewing" to reference the research skill instead

Acceptance criteria:
- `mode: primary`, `hidden: true` in frontmatter
- No `permission:` block
- No direct mention of `@research`
- Research skill instruction present and consistent with other primary agents

---

## Task 6 — Refactor `@research` to pure fetcher

In `src/global/agents/research/research.md.ts`:

1. Set `task: deny` entirely — remove `knowledge-base: allow`
2. Remove Mode 1 and Mode 2 workflows — these move to the skill
3. Replace with a single workflow: receive a topic or specific question, fetch from external sources until the question is sufficiently answered — no more, no less. Prefer official sources. Reference multiple sources where possible.
4. Add a structured output format:

```
## Findings: <topic>

**Summary:** <one paragraph>

**Details:**
<findings>

**Sources:**
- <url>

**Related topics:** <comma-separated list>
```

5. Remove all mention of `@knowledge-base`, capture, and decomposition steps
6. Remove the local codebase exception — `@research` only handles external sources

Acceptance criteria:
- `task: deny` in permissions
- No mention of `@knowledge-base` anywhere in the instructions
- No mention of local codebase handling
- Structured output format defined
- Single focused workflow: receive topic/question → fetch external sources until question is answered → return findings block
- Stops researching once the question is sufficiently answered — does not exhaustively crawl all sources

---

## Task 7 — Update `@knowledge-base` output contract and input expectations

In `src/global/agents/knowledge-base/knowledge-base.md.ts`:

**Read Task** — formalize the three-type response contract. Every read response must be exactly one of:

1. **No relevant notes** — nothing in the knowledge base is related to the topic.
2. **Insufficient knowledge** — relevant notes exist but do not fully answer the question. List the relevant notes and explicitly state what is missing.
3. **Sufficient knowledge** — existing notes fully answer the question. List the relevant note names as references and return the content.

**Write Task** — add a note describing the expected input format — the structured findings block from `@research`:

```
## Findings: <topic>

**Summary:** <one paragraph>

**Details:**
<findings>

**Sources:**
- <url>

**Related topics:** <comma-separated list>
```

Acceptance criteria:
- Read Task section defines all three response types explicitly
- Write Task section references the expected input format
- No other changes to knowledge-base agent behavior

---

## Task 8 — Install and verify

Run `bash install.sh` and confirm all files render and install without errors.

Acceptance criteria:
- Install completes with no errors
- `dist/` contains the new research skill
- All updated agent files present in `~/.config/opencode/`
