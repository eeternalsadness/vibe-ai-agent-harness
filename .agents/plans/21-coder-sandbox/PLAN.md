# Plan: Coder Sandbox

## Problem

`boy start` isolates a coder with a git worktree. That isolates *files*, not the *process*. The coder session runs inside the one opencode server on the host, and that server executes the agent's tools as local processes: shell commands, file writes, subagents. Every coder gets `{action: "*", resource: "*", effect: "allow"}`, which is the point - a coder should not stop to ask permission - but that means "unlimited access" currently means unlimited access to the whole host: dotfiles, other repos, SSH keys, every credential in the environment.

Isolation is also inconsistent. Two coders in the same repo can read each other's worktrees, and nothing stops a coder from writing outside `.agents/worktrees/<name>` at all. An allow-all rule set is only safe if the process itself is confined.

## Goals

1. **Real confinement** - a coder's tools can only touch what boy mounts. Any other host path is absent, not merely denied, so a buggy or hostile coder cannot reach it.
2. **Unlimited inside the sandbox** - within its mounts the coder keeps allow-all behavior and a full dev toolchain: build, test, install dependencies, commit.
3. **Same commands, same workflow** - `boy start`, `status`, `prompt` and `remove` keep their meaning. Branches are still merged from the main checkout. `status` still aggregates.
4. **Work outlives the container** - commits and uncommitted changes live on the host filesystem. Removing or recreating a container never loses the branch.
5. **One runtime definition** - a single image holds the toolchain, and the agent configuration is the same one the host agents use, mounted read-only. No per-profile images, no regeneration, no drift between what the user edits and what a coder runs.

## Design Decisions

### One container and one opencode server per coder

Isolation is a process boundary, so the server that runs the coder must live inside the container. A host-side server with a container attached would only move *files* into the sandbox while the tools still ran on the host. Subagents are in-process sessions of that server, so research work happens inside the sandbox too.

Boy therefore becomes a multi-server orchestrator: one server, port and password per coder, each resolved per coder rather than from a single global `service.json`.

### The workspace is a host-side clone, not a worktree

```
git clone --single-branch --branch <name> <repo> <repo>/.agents/sandboxes/<name>
```

The clone is a normal repository with a self-contained `.git`, so git works inside the sandbox with no `GIT_DIR` plumbing, no alternates file, and no coupling to the host gitdir. Local clones hardlink their objects, so the cost is one checkout - the same cost a worktree pays.

`--single-branch` means the coder sees no other branch. That is tighter than a worktree, whose `.git` pointer exposes the repo's entire ref store.

Bring-back is a local fetch on the host:

```
git -C <repo> fetch <sandbox> <name>:<name>
```

The refspec omits the force marker, so it only fast-forwards. A coder that amended or rebased fails loudly instead of rewriting the host branch. Uncommitted work needs no bring-back: the mount is a host directory, so `git -C <sandbox> status` already runs on the host.

### Host paths are mirrored inside the container

Agents, skills and permission rules are written against absolute host paths. Rewriting them per coder would drift from what the user edits. Instead every mount lands at its real host path and the container runs with `HOME=/home/bach`, so the installed configuration is used unchanged.

| Mount | Mode | Why |
| --- | --- | --- |
| `<repo>/.agents/sandboxes/<name>` | rw | the coder's clone - the only place repo changes land |
| `~/.config/opencode` | ro | agents, skills, providers, permission rules |
| each symlink target escaping the config dir | ro | today: `opencode.json` lives in a dotfiles repo, so it must be mounted at its real path or the config dangles |
| knowledge base | ro | research reads |
| per-coder state, data and cache dirs | rw | sessions survive recreation; tool caches |
| `/tmp` | rw tmpfs | build scratch |

### Config is mounted read-only, not baked and not regenerated

The configuration lives on the host and is mounted read-only at its own path. This gives immutability from inside the container - a read-only bind mount cannot be written even by root - without freezing a copy per coder, rebuilding images per profile, or regenerating anything.

Consequences accepted: a profile switch or permission edit applies to running coders on their next turn, and the image stays profile-agnostic. Boy resolves symlinks that escape the config directory and mounts their targets read-only, because a dangling `opencode.json` would silently leave a coder with no providers.

### The container root is read-only, with explicit writable areas

`podman run --read-only` plus writable mounts for the sandbox, per-coder state/data/cache and `/tmp`. This is what makes "the coder cannot change agent behavior" a filesystem property rather than a promise: the image, the toolchain and the mounted config are immutable from inside. Tool caches and session state are writable, so builds and resume work normally.

### The image is built from this repo, and is profile-agnostic

One image: `debian:bookworm-slim` with pinned Go, Node, bun, uv, shellcheck and `@opencode/cli@2.1.4` (the documented v2 npm channel; its postinstall selects the native binary). Git name and email are baked in via build args, so identity needs no mount. The image carries no agent configuration and no credentials.

`boy start` fails loudly when the image is absent, before any git or container side effect, naming the image and the build script. Boy never builds images; `container/build.sh` does, as a deliberate user step.

Rejected: **`ghcr.io/anomalyco/opencode`** - `:latest` is v1.19.4, and the `:2.1.4` tag is Alpine/musl, which conflicts with the glibc toolchain.

### Skills adopt the Claude layout, which OpenCode v2 supports

Verified on v2.1.4: a directory containing `SKILL.md` is one skill and OpenCode does not search inside it, so `scripts/` and `references/` can live beside it without being promoted to skills. Root-level `*.md` files are still skills, and nested grouping directories work.

This lets each skill be self-contained and removes its dependency on a build output path. Prerequisite harness change: `install.sh` currently installs only `*.md` and skips `reference/` and `scripts/`, which is why skill bodies point at `<harness>/dist/...`. Skills are installed whole, bodies use paths relative to the skill directory, and permission rules keep absolute paths - which stay deterministic because the config mount path is fixed.

Payoff: the sandbox needs no harness mount at all, and host agents stop depending on a checkout.

### Discovery goes through podman, and session identity is local

Containers carry `boy.coder`, `boy.repo`, `boy.name`, `boy.kind` and `boy.image` labels. "Which coders belong to this directory" is one query: `podman ps -a --filter label=boy.repo=<abs path>`. Boy records each coder's session id, port and password in that coder's state directory, so resolving a session to its container needs no probing of other servers. Live state (running, idle, task counts) still comes from the coder's own server.

### Deny rules are defense in depth, not the boundary

The coder keeps allow-all, then denies reads, writes and shell access to credential-shaped paths (`.env`, `*.pem`, `*.key`, `id_*`, `.ssh`, `.aws`, `.netrc`, `auth.json`) and denies writes to the mounted config and state directories.

These rules are coarse: the `read` and `write` tool patterns are enforced, but shell patterns are string matches and a determined command can evade them. The guarantee comes from the mounts - files outside them do not exist, and no credential is in the container. The residual risk is secrets inside the coder's own repo.

### Credentials: none in the container

For now coders use the `framework` provider, a LAN OpenAI-compatible endpoint with no secret. No provider credentials are injected, no `auth.json` is mounted, and nothing in the container is worth stealing. Credentialed providers are a follow-up: either a host-side proxy that keeps keys outside the container, or scoped short-lived keys - Bedrock's SigV4 signing rules out a naive proxy.

### `remove` keeps the branch and refuses unsafe removals

Unchanged contract: refuse while running, while the sandbox has uncommitted changes, or while the branch is unmerged, unless `--force`. Removal fetches commits back first, then deletes the container and the sandbox and state directories, and keeps the branch.

## Risks

- **Memory scales per coder.** An idle v2 server measured ~200 MB RSS; N concurrent coders cost roughly N times that, with no CPU cost while idle.
- **Live configuration.** A running coder picks up host config changes on its next turn. That is the price of not freezing a copy per coder.
- **Shell-level denies are advisory.** String matching can be evaded; only absence and read-only mounts are structural.
- **Knowledge capture is disabled** for sandboxed coders, since the knowledge base is read-only. Serving it over MCP is the fix.
- **Clone cost on large repos.** Local clones hardlink objects but still write a full checkout at start.
- **Image size.** A full toolchain image is in the 1.5 GB class, built once and shared by every container.

## Out of Scope

- Coders spanning multiple repos. A plan lives in one repo, so the model is already single-repo; sandboxing turns today's accidental host-wide reach into an explicit failure. Mounts and clones are lists, so this extends later.
- Credentialed providers and any proxy for them.
- Serving the knowledge base over MCP.
- Migrating existing worktree-based coders; the layout changes from `.agents/worktrees/` to `.agents/sandboxes/`.
- Containers inside the sandbox: coders get no podman or docker.
- Building or pulling images automatically.
- The memory plugin, which is currently disabled.
