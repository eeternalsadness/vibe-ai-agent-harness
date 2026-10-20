# Plan 19: Orchestration Tooling (Phase 3)

## Problem

Every coder run happens in the main working tree, with a human approving edits. To hand a plan off and walk away, the coder needs an isolated place to work, has to run unattended in the background, and someone has to be able to check on it. None of that exists yet.

This is Phase 3 of `docs/orchestration-vision.md`. The orchestrator (Phase 4) will drive this tooling.

## Goals

- Start a coder on a finished plan in its own worktree and branch. It runs in the background on an opencode server, with no terminal.
- Check on a running coder at any time and get facts, not the coder's own account.
- The coder works unattended: it never waits on a human, commits after each finished task, and installs what it needs.
- Remove a plan's worktree once its branch has been merged.
- The main working tree is never touched, and its own checks never see a coder's unfinished work.

## Design Decisions

- **A stateless CLI, not an opencode plugin.** A plugin is tied to the server that loads it; a CLI can talk to a server anywhere. It also follows the `pipeline_runner.py` convention and can be tested without opencode running.
- **Attach to a configured opencode server; never start one.** The server is the user's own long-running setup. opencode stores the sessions, so the CLI keeps no state of its own.
- **One shared server, one session per plan, rooted in that plan's worktree.** The spike confirmed a session can be rooted in any directory and run in the background with no terminal.
- **Plain git worktrees under `.agents/worktrees/`, gitignored, one worktree and one branch per plan.** Not opencode's project copies, which always use a detached HEAD and sit behind an experimental API. Living inside the repo keeps each worktree next to the code it changes; the cost is that the main checkout's own checks must skip it.
- **Status comes from the server, git, and the worktree**, never from the coder reporting on itself.
- **Permissions are only allow or deny**, so a coder can never block waiting for approval. The exact set will be settled by experiment.

## Out of Scope

- The orchestrator agent (Phase 4).
- The reviewer hand-off and the artifact the human reviews (the next plan).
- Merging the branch (the human does this).
- Settling the headless coder's final permission set.
- Starting or managing the opencode server.
- Crash recovery and containers (Phase 5).
- More than one coder per plan.
