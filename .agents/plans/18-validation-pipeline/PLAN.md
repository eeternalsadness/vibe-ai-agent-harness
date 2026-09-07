# Plan 18: Validation Pipeline (Phase 2, Piece 1)

## Problem

The coder cannot yet finish work on its own. Phase 1 gave it a per-task
definition of done - make the acceptance test pass - but a passing test is not
the whole of "done." A change is not safe until it also lints, builds, leaks no
secrets, and pulls in no known-vulnerable dependencies. The coder has no
programmatic way to run those checks and confirm its work is actually complete,
so it cannot reliably know when to stop. It either under-verifies and hands off
broken work, or loops with no deterministic stop signal.

Making the coder autonomous means giving it a way to validate its own work and
know when it is done. That is the intent of Phase 2 of
`docs/orchestration-vision.md`: a standard validation pipeline the coder runs to
self-verify and stop looping. For the pipeline to run in any repo it must know
what to run there, so a per-repo manifest declaring how standard stages map to
real commands is part of the same picture.

This plan implements the first piece of Phase 2. No human is in the coder's
loop; the human returns only at the end, after review (a later piece).

## Goals

- The coder can validate its own work and know when it is done, with no human
  in the loop.
- A standard validation pipeline the coder runs the same way in any repo,
  covering lint/format, build/typecheck, tests, secret/leak scan, and
  vulnerability scan.
- Each repo declares how the standard stages map to its real commands, so the
  pipeline is deterministic rather than guessing at tooling.
- The pipeline gives the coder a clear stop signal and enough detail to fix
  what failed, so it loops until green and then advances or hands off.
- This repo conforms to the standard, dogfooding it.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Definition of "done" for a change | The pipeline is green | A deterministic, programmatic stop signal the coder can trust |
| Human in the implementation loop | None | Autonomy is the point; human judgment moves to the end of the loop |
| Standard vs. per-repo | Standard stages; each repo maps them to its own commands | One uniform contract across languages without prescribing tools |
| Failure handling | Fail-fast, cheapest stage first | Fast feedback; do not wait on slow stages to surface cheap breakage |
| Missing stage | Skipped and noted, not a failure | Repos adopt stage-by-stage rather than all-or-nothing |
| Output | Detail on failure, summary on success | Coder needs failure detail to fix; a green summary feeds later review |

## Out of Scope

- How the reviewer consumes the pipeline result and what its report looks like -
  the next Phase 2 piece.
- Sandboxing / worktrees (Phase 3) and the orchestrator (Phase 4).
- A skill to generate a manifest by inspecting a repo's tooling - a likely
  follow-up once the pipeline and manifest format exist.
