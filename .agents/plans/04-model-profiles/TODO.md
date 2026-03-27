# TODO: Model Profiles

Track implementation progress. Update status as work proceeds.

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Tasks

- [ ] **Task 1** — Refactor `config.ts`: named model vars + `profiles` map
- [ ] **Task 2** — Update `memory.md.ts`: accept `memoryModel` arg, interpolate `model` frontmatter
- [ ] **Task 3** — Update `render.ts`: read `PROFILE` env var, pass model refs to templates
- [ ] **Task 4** — Update `memory-manager.ts`: remove `FALLBACK_MODELS`, remove `model` override from `session.prompt`
- [ ] **Task 5** — Update `install.sh`: interactive profile selection, export `PROFILE`
- [ ] **Task 6** — Verify end-to-end: run install, confirm `memory.md` has correct `model` frontmatter
