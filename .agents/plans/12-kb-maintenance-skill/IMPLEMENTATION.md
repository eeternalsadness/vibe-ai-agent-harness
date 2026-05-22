# Implementation: KB Maintenance Skills

## Task 1: Extend `render.ts` to handle any `*.<ext>.ts` template

Modify `src/render.ts` so that any file matching `*.<ext>.ts` (where `<ext>` is not `ts`) is treated as a template — imported, its default export called with the profile, and written to `dist/` as `*.<ext>`. Currently only `*.md.ts` is handled.

The change is in `findTemplates`: replace the `.md.ts` extension check with a regex that matches any `*.<ext>.ts` pattern where the penultimate extension is not `ts`. The output path stripping in `renderTemplates` already works by removing the trailing `.ts` — no change needed there.

**Acceptance criteria:**
- `*.sh.ts` files render to `*.sh` in `dist/`
- `*.py.ts` files render to `*.py` in `dist/`
- `*.md.ts` behaviour unchanged
- Verified by running `bun run src/render.ts opencode copilot` and confirming scripts appear under `dist/opencode/skills/maintaining-knowledge-base/scripts/`

---

## Task 2: Write audit scripts as templates

Create three script templates under `src/global/skills/maintaining-knowledge-base/scripts/`.

Each script accepts an optional `--kb <path>` argument and defaults to `config.knowledgeBasePath`. Exit 0 = clean, exit 1 = problems found, exit 2 = script error.

### `audit-dangling.sh.ts`

Bash script. Finds `[[wiki-links]]` in notes with no corresponding `.md` file. Strips fenced code blocks before scanning to avoid false positives.

Output:
```
Found N dangling link(s):

  [[Link Target]]
    <- Source Note A
    <- Source Note B
```

### `audit-orphans.py.ts`

Python script. BFS from `Index.md` through all `[[wiki-links]]`, collecting reachable note titles. Any `.md` file whose title is not in the reachable set is an orphan. Strips fenced code blocks before scanning.

Output:
```
Found N orphaned note(s) (not reachable from Index.md):
  - Note Title.md
```

### `audit-oversized.sh.ts`

Bash script. Finds notes exceeding 100 lines. Accepts `--limit <n>` to override the threshold. Sorted descending by line count.

Output:
```
Found N oversized note(s) (>100 lines):
  820  TypeScript Unit Testing.md
  503  TypeScript Best Practices.md
```

**Acceptance criteria:**
- All three scripts run correctly against the live KB
- Default KB path is baked in from `config.knowledgeBasePath`
- Each exits non-zero when problems are found

---

## Task 3: Write `maintaining-knowledge-base` skill

Create `src/global/skills/maintaining-knowledge-base/SKILL.md.ts`.

**Trigger description:** Load when asked to audit the knowledge base, check for dangling links, orphaned notes, oversized notes, or run a KB health check.

**Content:**
1. Script paths (using `config.harnessPath` to reference `dist/` locations)
2. How to invoke each: `bash <script>` / `python <script>`
3. How to interpret each script's output
4. Workflow:
   - Run all three scripts
   - Collect output
   - Pass to `@knowledge-base` with fix instructions per category:
     - Dangling links: remove or replace the link in each source note
     - Orphans: find the correct parent and add a wiki-link, or delete if spurious
     - Oversized: trim first; split if trimming is not enough; create intermediate topic nodes if an index is too large

**Acceptance criteria:**
- Valid YAML frontmatter with `name: maintaining-knowledge-base`
- Script paths use `config.harnessPath`
- Skill body under 300 lines

---

## Task 4: Write `modifying-knowledge-base` skill

Create `src/global/skills/modifying-knowledge-base/SKILL.md.ts`.

**Trigger description:** Load when about to delete a note, rename a note, or split an oversized note.

**Content — three procedures:**

### Delete a note
1. Grep the KB for all `[[Note Name]]` references
2. For each source file: remove or replace the link (rewrite prose if needed)
3. Delete the note file
4. Verify no references remain by grepping again

### Rename a note
1. Grep the KB for all `[[Old Name]]` references
2. Update every reference to `[[New Name]]`
3. Rename the file; update the H1 heading to match
4. Verify all references resolve

### Split an oversized note
1. Identify logical sections that can stand alone as atomic notes
2. Create child notes — one concept per note, each with a `## See also` link back to the parent index
3. Replace the parent with a slim index: H1 + flat list of `[[child]] - description` entries
4. If the parent is itself an index that is too large, create intermediate topic nodes rather than leaf children
5. Backlinks to the parent remain valid — the parent still exists as the index
6. Verify all child notes are reachable from `Index.md`

**Acceptance criteria:**
- Valid YAML frontmatter with `name: modifying-knowledge-base`
- All three procedures are unambiguous
- Skill body under 300 lines

---

## Task 5: Update `@knowledge-base` agent permissions

In `src/global/agents/knowledge-base/knowledge-base.md.ts`, replace:
```yaml
skill: deny
```
with:
```yaml
skill:
  "*": deny
  "modifying-knowledge-base": allow
```

**Acceptance criteria:**
- Agent definition renders correctly
- `@knowledge-base` can load `modifying-knowledge-base` and no other skill
