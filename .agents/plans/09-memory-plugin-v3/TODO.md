# TODO: Memory Plugin V3

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Tasks

- [ ] **Update memory agent instructions** — add transcript input, output format, judgment criteria
- [ ] **Remove remember() tool** — delete tool registration and handler from plugin
- [ ] **Implement session.idle hook** — evaluate conversation, invoke memory agent, append items
- [ ] **Implement session.deleted hook** — cleanup temp file on session end
- [ ] **Update global instructions** — remove memory workflow from AGENTS.md
- [ ] **Test multi-turn session** — verify automatic capture, deduplication, cleanup
- [ ] **Test concurrent sessions** — verify multi-session safety
- [ ] **Update documentation** — README and repo AGENTS.md reflect new system
