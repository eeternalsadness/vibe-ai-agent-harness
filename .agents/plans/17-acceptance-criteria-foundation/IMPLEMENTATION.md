# Implementation: Plan 17 Acceptance Criteria Foundation

Each task edits a `.md.ts` template under `src/global/`, then runs the render
script and checks the rendered file in `dist/` (no render errors, content
correct). Never edit `dist/` directly.

Render: `bun run src/render.ts` writes to `dist/opencode/`.
Rendered files to check:
- `dist/opencode/agents/planner/planner.md`
- `dist/opencode/agents/coder/coder.md`
- `dist/opencode/agents/reviewer/reviewer.md`

## Task 1 — Planner requires ACCEPTANCE.md

Edit `src/global/agents/planner/planner.md.ts`: every plan must produce an
`ACCEPTANCE.md` alongside `PLAN.md`, in both the workflow and File Conventions.
Render and confirm the rendered planner file states the requirement.

Verify: planner-requires-acceptance-md

## Task 2 — Planner defines the ACCEPTANCE.md format

Edit the planner template to document the format: named Given/When/Then
scenarios, each with a Verification section and an Out of Scope section;
verification is programmatic by default; manual-only criteria marked distinctly.
Render and confirm the rendered planner file describes it.

Verify: planner-defines-acceptance-format

## Task 3 — Planner TODO tasks carry a Verify reference

Edit the planner template's TODO convention and example so each task carries a
`Verify:` line referencing an `ACCEPTANCE.md` scenario by name. Render and
confirm the rendered planner file describes it.

Verify: planner-todo-verify-references

## Task 4 — Coder reads ACCEPTANCE.md and redefines done

Edit `src/global/agents/coder/coder.md.ts`: read `ACCEPTANCE.md` before
implementing, resolve each task's `Verify:` reference to a concrete test/command,
write tests from referenced scenarios first, and treat verification passing as
the definition of done (not diff approval). Render and confirm.

Verify: coder-reads-acceptance-and-self-verifies

## Task 5 — Reviewer validates tests encode criteria

Edit `src/global/agents/reviewer/reviewer.md.ts`: validate tests/checks encode
the referenced `ACCEPTANCE.md` scenarios; author must not be the sole verifier.
Keep minimal (full pipeline reshaping is Phase 2). Render and confirm.

Verify: reviewer-validates-tests-encode-criteria

## Task 6 — Full render and docs

Run the render for all profiles/platforms as applicable; confirm no errors and
all three files carry their new content. Run `bun test` to confirm existing
tests still pass. Update `AGENTS.md` / `README.md` if the plan-workflow
description needs it. Confirm `[MANUAL]` out-of-scope items by review.

Verify: render-succeeds
