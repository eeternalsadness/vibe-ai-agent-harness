# Plan 17: Acceptance Criteria Foundation (Phase 1)

## Problem

The harness defines "done" as "the human approved the edits." There is no
machine-checkable definition of success. This blocks all autonomy: an
orchestrator built on a human-approval gate would just automate the production
of green-but-wrong results. Before anything can be delegated, the gate must be
trustworthy and programmatic.

This plan implements Phase 1 of `docs/orchestration-vision.md`: a goal/test
foundation where every plan carries concrete, programmatically verifiable
acceptance criteria, and "done" means those criteria pass, not that a human
eyeballed a diff.

## Goals

- Every plan produces an `ACCEPTANCE.md` artifact alongside `PLAN.md`.
- Acceptance criteria are named Given/When/Then scenarios, each concrete and
  programmatically verifiable. Verification is a repeatable command, not an LLM
  judgment.
- Criteria that genuinely cannot be verified programmatically are marked
  distinctly as manual verification and state how they are confirmed. This is
  the exception, not an escape hatch.
- Each `TODO.md` task carries a `Verify:` line referencing an `ACCEPTANCE.md`
  scenario by name. The exact test/command may not exist at plan time; the
  reference resolves as the implementer works, letting it self-verify and
  advance without a human gate between tasks.
- The coder reads `ACCEPTANCE.md`, writes tests/checks from the referenced
  scenarios first, and treats the verification passing as the definition of done.
- The reviewer independently validates that tests/checks encode the referenced
  scenarios, breaking the circular gate where the author is the sole verifier.
- Harness self-tests programmatically confirm the rendered planner, coder, and
  reviewer instructions carry these rules.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Acceptance artifact | Required `ACCEPTANCE.md` per plan | A plan means work significant enough to define done |
| Where the format lives | Planner instructions, not a separate skill | No reusable standalone need yet; avoid indirection agents forget |
| Verification | Programmatic, repeatable command by default | LLM-judged criteria are not a trustworthy gate |
| Manual verification | Allowed but marked distinctly, with how it is confirmed | Honest about the gap; forbidden where a programmatic check exists |
| Criteria shape | Named GWT scenarios as a test contract | Given/When/Then plus a verification method plus out-of-scope; not BDD prose |
| Per-task verification | `TODO.md` task carries a `Verify:` reference to an `ACCEPTANCE.md` scenario | Test file may not exist at plan time; reference resolves as implementer works; enables self-advance |
| Vagueness test | If no failing test can be written from it, it is too vague | Forces falsifiable criteria |
| Coder "done" | Verification command passes | Machine-checkable target, in normal and delegated flows |
| Reviewer role | Validates tests encode criteria, independently | Writer must not be sole verifier |
| Instruction "tests" | Check the rendered output contains the required rules | Simple; we cannot test model intent, only the shipped artifact |

## Out of Scope

- Task classes (verifiable/docs/refactor taxonomy) — dropped; not needed.
- Validation pipeline: lint, secret/leak scan, vuln scan, reviewer-as-analysis,
  human-presentation artifact (Phase 2).
- Sandboxing / worktrees (Phase 3).
- Orchestrator agent (Phase 4).
- Any claim that harness tests verify LLM behavior. They verify rendered
  artifacts only.
