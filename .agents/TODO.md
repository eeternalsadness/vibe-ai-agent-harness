# TODO

Findings from code reviewer — address in any order.

## High Priority

- [ ] **`MEMORY_FILE_PATH` construction is fragile** — `config.memoryFilePath.replace("~/", "")` silently produces wrong path if value doesn't start with `~/`. Use `startsWith("~/")` guard or store path without tilde and expand once.

- [ ] **`(input as any)` casts x3 in memory plugin** — `sessionID` and `agent` fields are not in the SDK type definition. Silent breakage if they disappear in an SDK update. Needs proper typing or explicit acknowledgment with a comment.

## Medium Priority

- [ ] **CWD assumption in `render.ts`** — `join("dist/opencode", relative)` resolves relative to CWD at runtime. `install.sh` doesn't `cd` to repo root before invoking bun. Add `process.chdir(import.meta.dir + "/..")` or use an absolute path derived from `import.meta.dir`.

- [ ] **`render.ts` hardcodes `dist/opencode/`** — contradicts platform-agnostic philosophy. `src/global/` is portable but the renderer bakes in `opencode`. Consider making the output subdirectory configurable.

- [ ] **`parseMemoryItems` and `parseAgentOutput` are duplicates** — identical logic in two functions. Collapse into one.

- [ ] **`invokeMemoryAgent` does too much** — handles session creation, tracking, prompting, response parsing, cleanup, and error recovery. Split response extraction into a separate function.

- [ ] **`withLock` is hard to follow** — externally-captured resolver pattern and while-loop busy-wait both look like bugs without explanation. Add comments.

- [ ] **`cached: memoryCache !== null` log is misleading** — always `true` at the point it fires. Capture whether cache was hit before calling `getCachedMemory()`.

## Low Priority

- [ ] **Stack traces logged unconditionally** — full stack traces (including absolute paths) go to platform logger. Should be deliberate, not automatic.

- [ ] **`broke`/`based` profile names are opaque** — personality names with no self-describing meaning. Consider `free-tier`/`mixed` or similar.

- [ ] **`resolve!` non-null assertion in `withLock`** — use definite assignment assertion `let resolve!: () => void` instead to be explicit about intent.

## Completed

- [x] **Formatting corruption in `reviewer.md.ts`** — mangled spacing around hyphens and missing spaces after periods.
- [x] **No tests** — added test suite for `render.ts` with fixtures and 8 integration tests.
- [x] **`render.ts` not testable** — refactored to export `findTemplates` and `renderTemplates`.
