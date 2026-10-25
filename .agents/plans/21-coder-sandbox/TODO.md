# TODO: Coder Sandbox

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Tests

- [ ] **Task 1** — write the test for skills-installed-whole
- [ ] **Task 2** — write the test for skill-bodies-reference-installed-paths
- [ ] **Task 3** — write the test for coder-deny-rules-present
- [ ] **Task 12** — write the test for container-spec
- [ ] **Task 13** — write the test for mount-table
- [ ] **Task 14** — write the podman-gated tests for container-root-read-only, config-symlinks-resolved, no-credentials-in-container, host-paths-absent
- [ ] **Task 20** — write the test for sandbox-clone-single-branch
- [ ] **Task 21** — write the tests for fetch-back-fast-forwards, fetch-back-rejects-non-ff
- [ ] **Task 23** — write the tests for start-converges, server-readiness-gate, session-rooted-in-sandbox, start-fails-before-side-effects
- [ ] **Task 24** — write the tests for status-states, discovery-scoped-to-repo, attach-targets-owning-server, prompt-routes-to-owning-container, remove-refuses-unless-safe, remove-cleans-and-keeps-branch

## Implementation

### Phase 0 — Harness: Claude-style skills

- [ ] **Task 4** — add `opencodeSkillsPath` to `config.ts`
      Verify: skill-bodies-reference-installed-paths
- [ ] **Task 5** — rewrite skill bodies to skill-relative paths
      Verify: skill-bodies-reference-installed-paths
- [ ] **Task 6** — point agent permissions at installed skill paths
      Verify: skill-bodies-reference-installed-paths
- [ ] **Task 7** — install skill directories whole in `install.sh`
      Verify: skills-installed-whole
- [ ] **Task 8** — update the progressive-disclosure note in `AGENTS.md.ts` and repo `AGENTS.md`
- [ ] **Task 32** — add credential deny rules to the rendered config and coder agent
      Verify: coder-deny-rules-present

### Phase 1 — Image

- [ ] **Task 9** — write `container/Dockerfile`
- [ ] **Task 10** — write `container/build.sh`
- [ ] **Task 11** — write `container/smoke.sh`

### Phase 2 — Boy: container runtime and spec

- [ ] **Task 15** — create `boy/internal/container` with the `Runtime` interface and `Spec`
- [ ] **Task 16** — implement the podman runtime
      Verify: container-root-read-only, config-symlinks-resolved, no-credentials-in-container, host-paths-absent
- [ ] **Task 17** — implement the recording fake runtime
      Verify: container-spec
- [ ] **Task 18** — build the container spec and resolve escaping config symlinks
      Verify: mount-table
- [ ] **Task 19** — extend boy config with image, knowledge base path, podman binary and timeout
      Verify: container-spec

### Phase 3 — Boy: sandbox and git

- [ ] **Task 22** — implement the sandbox layer: branch, clone, dirty check, merged check, fetch-back
      Verify: sandbox-clone-single-branch, fetch-back-fast-forwards, fetch-back-rejects-non-ff

### Phase 4 — Boy: commands

- [ ] **Task 25** — replace `Deps.Client` with a client resolver plus `Deps.Runtime`
- [ ] **Task 26** — make `start` converge
      Verify: start-converges, server-readiness-gate, session-rooted-in-sandbox, start-fails-before-side-effects
- [ ] **Task 27** — make `status` report the five states and scope discovery to the repo
      Verify: status-states, discovery-scoped-to-repo
- [ ] **Task 28** — route `prompt` to the owning container
      Verify: prompt-routes-to-owning-container
- [ ] **Task 29** — add `boy attach`
      Verify: attach-targets-owning-server
- [ ] **Task 30** — clean up completely in `remove`
      Verify: remove-refuses-unless-safe, remove-cleans-and-keeps-branch

### Phase 5 — Documentation

- [ ] **Task 31** — update `README.md` and repo `AGENTS.md` for the sandbox model
