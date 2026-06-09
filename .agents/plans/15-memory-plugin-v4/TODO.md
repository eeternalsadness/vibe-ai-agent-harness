# TODO: memory-plugin-v4

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Tasks

- [x] **Write tests** — `test/unit/memory-manager.test.ts`; export `sanitizeTranscript` and `shouldSkipEvaluation`; cover sanitization, system prompt injection, and incremental cache
- [x] **Incremental transcript cache** — add `transcriptCache` map, modify `evaluateSession` to slice and append only new messages, clean up on `session.deleted`
- [x] **Update evaluating-memory skill** — replace research detection rule with `[tool: task] subagent_type: research` as the sole signal
- [x] **Build and verify** — `./install.sh`, all tests pass
