# Plan 12: KB Maintenance Skills

## Problem

The knowledge base has no tooling to detect structural problems, and the `@knowledge-base` agent has no formal guidance for safe mutations. Dangling links, orphaned notes, and oversized notes accumulate silently between manual audits. When the agent deletes, renames, or splits a note, there is no documented procedure — backlinks get left dangling, references break, and split structure varies.

Two separate concerns need addressing: auditing the KB for problems, and safely modifying notes when problems are found or mutations are needed.

## Goals

1. **`maintaining-knowledge-base` skill** — audit workflow for primary agents:
   - Three executable scripts (`audit-dangling.sh`, `audit-orphans.py`, `audit-oversized.sh`) in `scripts/`
   - Instructions for running scripts, interpreting output, and delegating fixes to `@knowledge-base`
   - Scripts referenced by their `dist/` path

2. **`modifying-knowledge-base` skill** — safe mutation procedures for `@knowledge-base`:
   - How to delete a note (clean up all backlinks first)
   - How to rename a note (update all references atomically)
   - How to split an oversized note (create children, replace parent with slim index, update backlinks)
   - Loaded on-demand — not part of the normal write workflow

3. **Updated `@knowledge-base` permissions** — replace `skill: deny` with explicit narrow allow:
   ```yaml
   skill:
     "*": deny
     "modifying-knowledge-base": allow
   ```

4. **Updated `render.ts`** — extend the template pipeline to handle any `*.<ext>.ts` file (not just `*.md.ts`), rendering it to `*.<ext>` in `dist/`. Scripts are authored as `.sh.ts` and `.py.ts` templates so they can interpolate `config.knowledgeBasePath` as the default KB path.

## Design Decisions

**Two skills, not one.** Auditing and mutating are distinct workflows with different callers. `maintaining-knowledge-base` is for primary agents running audits. `modifying-knowledge-base` is for `@knowledge-base` performing safe mutations. Merging them would load audit instructions into every mutation operation and vice versa.

**Scripts in `scripts/`, not `reference/`.** Reference files are read as content. Scripts are executed. The distinction matters for how the agent uses them.

**Scripts are templates, invoked explicitly with `bash`/`python`.** Scripts need `config.knowledgeBasePath` baked in as the default path, so they are authored as `.sh.ts` and `.py.ts` templates — same pipeline as `.md.ts`. The convention is `*.<ext>.ts` → renders to `*.<ext>`. No executable bits needed; the skill instructs the primary agent to invoke them as `bash script.sh` and `python script.py`.

**Primary agent runs scripts, passes output to `@knowledge-base`.** The `@knowledge-base` agent has `bash: deny`. Scripts are run by the primary agent, which then delegates the fix work to `@knowledge-base` with the script output as context.

**Bash for simple scripts, Python for graph traversal.** `audit-dangling` and `audit-oversized` are straightforward file operations — bash suffices. `audit-orphans` requires BFS from `Index.md` through wiki-links — Python is cleaner.

**Last-match-wins permission ordering.** Deny rule comes first, allow comes last:
```yaml
skill:
  "*": deny
  "modifying-knowledge-base": allow
```
