# Orchestration & Goal-Driven Engineering Vision & Roadmap

## Problem

The harness has specialized agents but no way to compose them autonomously. Every coding task runs through a primary agent with a human approving each edit. That human approval is the only safety net. It does not scale: the user cannot delegate a task, walk away, and trust the result.

The blocker to removing the human is that "done" is currently defined as *"the human approved the edits."* There is no machine-checkable definition of success. Without one, an autonomous agent has nothing to measure its output against, and delegation is unsafe by construction.

## Vision

An **orchestrator** primary agent that decomposes a plan into tasks and delegates each to a subagent, autonomously, and returns verified results for the user to merge.

This is only safe if "done" is redefined. Across the whole harness — orchestrated *and* normal workflows — **the gate is tests, not human approval.** A task is done when its acceptance tests pass. The human's role moves upstream (defining what success means) and to the final merge gate, not per-edit babysitting.

Phases 1–3 stand on their own as workflow improvements for the existing human-in-the-loop flow — a trustworthy test gate, structured acceptance criteria, and isolated per-task branches make normal coding better even if the orchestrator never ships. The orchestrator (Phase 4) is the payoff that consumes that foundation, not a prerequisite for its value.

Three pillars make this safe:

1. **Acceptance criteria are defined by a human during planning**, in a structured, example-driven form concrete enough that tests are derivable from them by transcription rather than interpretation.
2. **Tests are the gate, always.** Generated from the criteria, validated independently, and run to verify every behavioral change. Refactors pin existing behavior. Docs changes need no tests.
3. **Each delegated task runs in an isolated sandbox.** Work lands on a branch and merges back only after tests pass and the human approves. A rogue or buggy agent cannot corrupt the main working tree.

---

## Phases

### Phase 1 — Goal/Test Foundation *(hard gate for everything else)*

**Prerequisite for all autonomy.** An orchestrator on top of an untrustworthy test gate just automates the production of green-but-wrong results. The gate must be trustworthy before anything delegates to it.

Parts:

1. **Acceptance criteria as a planning artifact.** The planner produces an `ACCEPTANCE.md` per plan, separate from `PLAN.md`. Criteria are structured and example-driven — Given/When/Then scenarios with concrete inputs and expected outputs — so that test generation is transcription, not interpretation. This is a human-in-the-loop planning output.

2. **Autonomous test generation.** A new coder skill, `generating-acceptance-tests`, turns `ACCEPTANCE.md` into runnable tests before implementation begins.

3. **Independent test validation.** The reviewer agent validates that the generated tests actually encode the acceptance criteria, before the coder implements. This breaks the circular-gate problem where the same agent writes and passes its own test.

4. **Redefine "done" everywhere.** The coder and planner treat passing acceptance tests as the definition of done, in both normal and delegated workflows.

### Phase 2 — Verifiable Task Contracts

Formalize the contract each task carries so it can be delegated and verified without a human reading prose.

- Every task declares a **verification command** — how the orchestrator (or coder) checks it passed.
- Every task declares a **class** that determines how it is verified:
  - *Verifiable* — has acceptance tests; the test suite is the gate.
  - *Docs-autonomous* — documentation changes; no tests required, done autonomously.
  - *Refactor-behavior-pinned* — behavior must not change; existing tests pin behavior and must still pass.
- Define the **harness proxy-test story** so the harness can verify itself: render output validity, required frontmatter present, `append-memory.sh` behavior, plugin unit tests.

### Phase 3 — Sandboxed Execution

Isolate the work environment for each task so an autonomous agent cannot damage the main working tree.

- **Git worktrees** to start: each task gets its own branch and working directory. Provides file-level isolation and parallelism across independent tasks. Cheap, instant, native.
- **Branch per task.** Work never touches main directly.
- **Merge gate:** a task branch merges into the main working tree only after acceptance tests pass **and** the human approves the merge. Tests gate autonomy; the human gates the merge.
- **Containers are a future hardening step** for full execution isolation (filesystem, process, network). The intended end state is a container whose workspace is a git worktree bind-mounted in — execution isolation plus a clean git-based merge path. Credential injection into the sandbox is a deferred design problem to be solved when containers land.

### Phase 4 — Orchestrator Agent

A new primary agent that composes everything below it.

- Reads a plan and its `ACCEPTANCE.md`.
- Decomposes it into tasks with contracts (Phase 2).
- Spawns a coder subagent per task, each in its own worktree sandbox (Phase 3).
- Generates and validates tests (Phase 1), implements, runs the verification command.
- Routes failures back for retry; presents verified branches to the user for merge.

Depends entirely on Phases 1–3.

### Phase 5 — Autonomous Delegation Hardening

Make delegation robust at scale.

- Failure recovery: retry and escalation policy when a task cannot reach green.
- Reviewer-in-the-loop on generated tests within the orchestration flow.
- Observability: what was delegated, what passed, what merged.
- Containers as the deeper isolation layer (from Phase 3's future note).

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Definition of "done" | Acceptance tests pass | Machine-checkable target; enables safe autonomy |
| Test gate scope | Always — orchestrated and normal | Consistent safety model; autonomy only removes the human, not the gate |
| Acceptance criteria owner | Human, during planning | Success definition is a judgment call, not an agent's |
| Criteria format | Structured, example-driven | Makes test generation transcription, not interpretation |
| Criteria location | Own file (`ACCEPTANCE.md`) | Keeps `PLAN.md` high-level; separates spec from design |
| Test authoring | Autonomous, via coder skill | Human defines success; agent transcribes it into tests |
| Test validation | Reviewer agent, independently | Breaks the circular gate — writer must not be sole verifier |
| Docs tasks | Autonomous, no tests | Low risk; not meaningfully E2E-testable |
| Refactor tasks | Behavior pinned by tests | Correctness = unchanged behavior |
| Isolation (initial) | Git worktrees | Cheap, native, file-level isolation + parallelism |
| Isolation (future) | Containers over worktrees | Full execution sandbox; credential design deferred |
| Merge gate | Tests pass + human approves | Tests gate autonomy; human gates the merge |
| Phase ordering | Test foundation first, hard gate | Orchestrator on an untrusted gate automates wrong results |
