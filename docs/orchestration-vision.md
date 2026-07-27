# Orchestration & Goal-Driven Engineering Vision & Roadmap

## Problem

The harness has specialized agents but no way to compose them autonomously. Every coding task runs through a primary agent with a human approving each edit. That human approval is the only safety net. It does not scale: the user cannot delegate a task, walk away, and trust the result.

The blocker to removing the human is that "done" is currently defined as *"the human approved the edits."* There is no machine-checkable definition of success. Without one, an autonomous agent has nothing to measure its output against, and delegation is unsafe by construction.

## Vision

An **orchestrator** primary agent that reads a plan, spawns a coder to work its TODO list to completion in an isolated sandbox, runs the change through a validation pipeline, and presents a reviewed result for the user to merge.

This is only safe if "done" is redefined. Across the whole harness — orchestrated *and* normal workflows — **the gate is tests, not human approval.** A task is done when its acceptance tests pass. The human's role moves upstream (defining what success means) and to the final merge gate, not per-edit babysitting.

Phases 1–3 stand on their own as workflow improvements for the existing human-in-the-loop flow — a trustworthy test gate, structured acceptance criteria, a validation pipeline, and isolated branches make normal coding better even if the orchestrator never ships. The orchestrator (Phase 4) is the payoff that consumes that foundation, not a prerequisite for its value.

Four pillars make this safe:

1. **Acceptance criteria are defined by a human during planning**, as named Given/When/Then scenarios concrete enough that tests are derivable from them by transcription rather than interpretation.
2. **Tests are the gate, always.** Written from the criteria, validated independently, and run to verify every behavioral change.
3. **A validation pipeline runs before any human sees the work.** Programmatic gates (tests, lint, secret/leak scan, vulnerability scan) enforce objective correctness autonomously; a reviewer then analyzes for non-programmatic concerns and reports findings. The human is the only judgment gate and the loop's termination condition.
4. **Each delegated plan runs in an isolated sandbox.** Work lands on a branch and merges back only after the pipeline is green and the human approves. A rogue or buggy agent cannot corrupt the main working tree.

---

## Phases

### Phase 1 — Goal/Test Foundation *(hard gate for everything else)*

Plan: `17-acceptance-criteria-foundation`

**Prerequisite for all autonomy.** An orchestrator on top of an untrustworthy test gate just automates the production of green-but-wrong results. The gate must be trustworthy before anything delegates to it.

Parts:

1. **Acceptance criteria as a planning artifact.** The planner produces an `ACCEPTANCE.md` per plan, separate from `PLAN.md`. Criteria are structured — named Given/When/Then scenarios with concrete inputs and expected outputs, each with a verification method. Verification is a repeatable, programmatic command by default; criteria that genuinely cannot be verified programmatically are marked distinctly as manual verification. This is a human-in-the-loop planning output.

2. **Per-task verification in TODO.** Each `TODO.md` task carries a `Verify:` line referencing an `ACCEPTANCE.md` scenario by name. The exact test file and command may not exist at plan time, so the reference resolves to a concrete check as the implementer works. This lets the implementer self-verify a task and advance without a human gate between tasks.

3. **Implementer writes tests from criteria.** The coder reads `ACCEPTANCE.md`, turns each referenced scenario into runnable tests before implementation (test-first ordering), and treats the verification passing as the definition of done. No separate test-generation skill; this is coder-instruction behavior.

4. **Independent test validation.** The reviewer agent validates that the tests actually encode the referenced acceptance scenarios. This breaks the circular-gate problem where the same agent writes and passes its own test.

5. **Redefine "done" everywhere.** The coder and planner treat passing acceptance tests as the definition of done, in both normal and delegated workflows.

### Phase 2 — Validation Pipeline

A gated sequence a change must pass before a human is ever contacted. Two kinds of gates, in order of trust, then a single human judgment gate.

- **Programmatic gates (autonomous, deterministic).** Tests, lint, secret/leak scan, vulnerability scan, and other scripts. Ordered fail-fast, cheap checks first. Any failure routes back to the coder automatically. No human involved; these are objective.
- **Reviewer analysis (autonomous, no gating authority).** Runs only after programmatic gates are green. Looks for what scanners cannot catch: coding conventions, architecture fit, design tradeoffs, smells. Produces structured findings (severity + reasoning), anchored to documented conventions/decisions where possible. It reports; it does not block or loop on its own authority. Stays advisory in spirit.
- **Human-presentation artifact.** Aggregates: summary of what changed, key decisions made during implementation, reviewer findings, programmatic gate results, and anything flagged for a second look. This is what the human sees instead of a raw diff.
- **Human gate (the only judgment gate).** The human reviews the artifact and either approves (proceed to merge) or directs specific changes, which loop back to the coder. The human is the loop's termination condition, not a heuristic iteration cap.

Pipeline in one line: automated correctness → automated analysis → human judgment. The reviewer may or may not be the existing reviewer agent, reshaped or new; that is an implementation choice.

### Phase 3 — Sandboxed Execution

Isolate the work environment for a delegated plan so an autonomous agent cannot damage the main working tree.

- **Git worktrees.** A delegated coder run gets its own branch and working directory. Provides file-level isolation and parallelism across independent plans. Cheap, instant, native. This is the scope for now.
- **Branch per plan.** Work never touches main directly.
- **Merge gate:** a branch merges into the main working tree only after the validation pipeline (Phase 2) is green **and** the human approves the merge. Tests and scans gate autonomy; the human gates the merge.
- **Containers are deferred** to a much later hardening step for full execution isolation (filesystem, process, network). Not in scope now. The eventual end state is a container whose workspace is a git worktree bind-mounted in; credential injection is a deferred design problem for when containers land.

### Phase 4 — Orchestrator Agent

A new primary agent that composes everything below it.

- Reads a plan, its `TODO.md`, and its `ACCEPTANCE.md`. Tasks are already defined by planning; the orchestrator does not re-decompose them.
- Spawns a coder subagent in its own worktree sandbox (Phase 3) to work the TODO list until every task is checked off.
- The coder writes and validates tests (Phase 1), implements, and self-verifies each task via its `Verify:` reference before advancing.
- Runs the validation pipeline (Phase 2), routes programmatic failures back for retry, and presents the reviewed branch and its human-presentation artifact to the user for the merge decision.

Depends entirely on Phases 1–3.

### Phase 5 — Autonomous Delegation Hardening

Make delegation robust at scale.

- Failure recovery: retry and escalation policy when a task cannot reach green.
- Reviewer-in-the-loop on generated tests within the orchestration flow.
- Observability: what was delegated, what passed, what merged.
- Containers as the deeper isolation layer (from Phase 3's deferred note).

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Definition of "done" | Acceptance tests pass | Machine-checkable target; enables safe autonomy |
| Test gate scope | Always — orchestrated and normal | Consistent safety model; autonomy only removes the human, not the gate |
| Acceptance criteria owner | Human, during planning | Success definition is a judgment call, not an agent's |
| Criteria format | Named Given/When/Then scenarios, each with a verification method | Concrete enough that tests are transcription, not interpretation |
| Criteria location | Own file (`ACCEPTANCE.md`) | Keeps `PLAN.md` high-level; separates spec from design |
| Per-task verification | `TODO.md` task carries a `Verify:` reference to an `ACCEPTANCE.md` scenario | Test file may not exist at plan time; reference resolves as implementer works; enables self-advance |
| Verification method | Programmatic, repeatable command by default; manual marked distinctly | LLM-judged criteria are not a trustworthy gate |
| Test authoring | Coder instruction, not a separate skill | Human defines success; agent transcribes it into tests |
| Test validation | Reviewer agent, independently | Breaks the circular gate — writer must not be sole verifier |
| Validation pipeline | Programmatic gates → reviewer analysis → human judgment | Objective checks autonomous; subjective quality reported, not auto-gated |
| Programmatic gates | Tests, lint, secret/leak scan, vuln scan; fail routes to coder | Deterministic, objective, no human needed |
| Reviewer authority | Reports findings; no autonomous gate or loop | LLM judgment cannot be a trustworthy hard gate |
| Loop termination | The human, via the presentation artifact | Approve → merge; direct changes → loop to coder |
| Presentation artifact | Summary, key decisions, reviewer findings, gate results, flags | Human judges without re-reviewing the raw diff |
| Isolation (initial) | Git worktrees, branch per plan | Cheap, native, file-level isolation + parallelism |
| Isolation (future) | Containers over worktrees | Full execution sandbox; credential design deferred |
| Merge gate | Tests pass + human approves | Tests gate autonomy; human gates the merge |
| Phase ordering | Test foundation first, hard gate | Orchestrator on an untrusted gate automates wrong results |
