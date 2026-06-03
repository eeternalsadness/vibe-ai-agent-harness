# TODO: Memory Append Script

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Tasks

- [ ] **Create `append-memory.sh.ts`** — bash script that: (1) validates arg count, (2) validates format regex `^- \[(decision|work|research|kb-enrichment)\] [^:]+: .+$`, (3) validates length ≤ 150 chars, (4) appends to `Memory.md`, (5) rewrites file keeping last 100 bullet lines with `# Memory\n\n` header. Exit 1 with stderr message on any validation failure.
- [ ] **Delete `truncate-memory.sh.ts`** — logic merged into append script
- [ ] **Update `SKILL.md.ts`** — replace step 3 (edit tool) + step 4 (truncate) with: call `bash append-memory.sh "<item>"` for each item; retry up to twice on non-zero exit; skip item after two failures
- [ ] **Update `memory.md.ts`** — remove `edit: allow`; replace truncate-memory.sh bash permission with `append-memory.sh *`; update both mode descriptions to call the script instead of using the edit tool
- [ ] **Build and verify** — run `./install.sh`, confirm `dist/` contains `append-memory.sh` and no `truncate-memory.sh`
