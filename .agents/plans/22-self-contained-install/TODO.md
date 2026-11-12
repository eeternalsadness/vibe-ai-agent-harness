# TODO: Self-Contained Install

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Tests

- [x] **Task 1** - write the install test harness
- [x] **Task 2** - write the tests for skills-installed-whole, agents-installed-flat, clean-install,
      clean-missing-folders, clean-dry-run, install-without-clean
- [x] **Task 5** - write the tests for skill-set, agents-name-their-skills
- [ ] **Task 10** - write the tests for no-checkout-references, skill-paths, skill-commands-allowed,
      skill-files-readable, cross-skill-allowlist

## Implementation

### Phase 1 - Install mechanics

- [x] **Task 3** - install skill folders whole
      Verify: agents-installed-flat
- [x] **Task 4** - add `--clean`
      Verify: clean-install, clean-missing-folders, clean-dry-run, install-without-clean

### Phase 2 - Refactor

- [x] **Task 6** - create the knowledge base skills and merge `modifying-knowledge-base`
- [x] **Task 7** - create `implementing-code`
- [ ] **Task 8** - create `writing-plans`
      Verify: skills-installed-whole
- [ ] **Task 9** - create `reviewing-code`
      Verify: skill-set, agents-name-their-skills

### Phase 3 - Paths

- [ ] **Task 11** - add `opencodeConfigPath` to `config.ts`
- [ ] **Task 12** - fix skill paths
      Verify: skill-paths, cross-skill-allowlist
- [ ] **Task 13** - fix agent permission paths and remove `harnessPath`
      Verify: no-checkout-references, skill-commands-allowed, skill-files-readable

### Phase 4 - Documentation

- [ ] **Task 14** - add the planner documentation rule
- [ ] **Task 15** - update the repo `AGENTS.md`
- [ ] **Task 16** - update `README.md`
