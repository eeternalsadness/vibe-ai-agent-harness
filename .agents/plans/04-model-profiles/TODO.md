# TODO: Model Profiles

Track implementation progress. Update status as work proceeds.

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Tasks

- [x] **Task 1** — Refactor `config.ts`: named model vars + `profiles` map
- [x] **Task 2** — Update `memory.md.ts`: accept `memoryModel` arg, interpolate `model` frontmatter
- [x] **Task 3** — Update `render.ts`: read profile from CLI arg, pass profile object to templates
- [x] **Task 4** — Update `memory-manager.ts`: remove `FALLBACK_MODELS`, remove `model` override from `session.prompt`
- [x] **Task 5** — Update `install.sh`: add `--profile` flag, default to `default`, pass as CLI arg to render
- [x] **Task 6** — Verify end-to-end: run install, confirm `memory.md` has correct `model` frontmatter
