# Acceptance: Coder Sandbox

Every scenario is falsifiable from a command. Unit scenarios run against a recording podman fake, so they need no container runtime; integration scenarios are gated behind `BOY_PODMAN_TESTS=1`. Names are referenced by TODO.md `Verify:` lines.

---

## Scenario: skills-installed-whole

**Given** a rendered `dist/<platform>/skills/<id>/` containing `SKILL.md`, `scripts/run.sh` and `reference/note.md`
**When** `install.sh` installs skills
**Then** the installed `~/.config/opencode/skills/<id>/` contains `SKILL.md`, `scripts/run.sh` and `reference/note.md`

**Verify:** `bun test test/integration/skills-install.test.ts -t "installs skill support files"`

## Scenario: skill-bodies-reference-installed-paths

**Given** the rendered skill documents and agent definitions
**When** the render pipeline runs
**Then** no rendered file contains the string `dist/opencode/skills`
**And** the `validating-work` body references `scripts/pipeline_runner.py` relative to its own directory
**And** the coder agent's `shell` permission resource names `~/.config/opencode/skills/validating-work/scripts/pipeline_runner.py`

**Verify:** `bun test test/integration/render.test.ts -t "skills reference installed paths"`

## Scenario: sandbox-clone-single-branch

**Given** a repo with branches `main` and `other`, and no sandbox for plan `p`
**When** `boy start --plan .agents/plans/p` runs
**Then** `.agents/sandboxes/p` is a git repository whose `HEAD` is branch `p`
**And** `git -C .agents/sandboxes/p branch --list` lists exactly one branch, `p`
**And** `git -C .agents/sandboxes/p log --oneline -1` equals `git -C <repo> log --oneline -1` before the start

**Verify:** `go -C boy test ./internal/app -run TestSandboxCloneSingleBranch`

## Scenario: start-converges

**Given** a plan whose branch, sandbox and container are in the state described
**When** `boy start --plan .agents/plans/<p>` runs
**Then** the outcome is:

| Given state | Then |
|---|---|
| branch + sandbox + running container + session | no container or sandbox created; prompt sent to the existing session; stderr contains `resumed session` |
| branch + sandbox, container absent | a container is created named `boy-<repoSlug>-<p>`; a session is created; prompt is the continue prompt mentioning `TODO.md` |
| branch + sandbox, container stopped | the existing container is started; no new container is created |
| branch only, sandbox absent | the sandbox is re-cloned from branch `<p>`; no `branch exists` error |

**Verify:** `go -C boy test ./internal/app -run TestStartConverges`

## Scenario: container-spec

**Given** a started coder
**When** the recording runtime's last `run` invocation is inspected
**Then** it contains:

| Element | Expected |
|---|---|
| name | `boy-<repoSlug>-<name>` |
| labels | `boy.coder=true`, `boy.repo=<abs repo>`, `boy.name=<name>`, `boy.kind=plan\|adhoc`, `boy.image=<image>` |
| network | no `--network=host`; port published as `127.0.0.1::4096` |
| rootfs | `--read-only` |
| restart | `--restart=unless-stopped` |
| env | `HOME=/home/bach`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME` all under the state volume, `OPENCODE_SERVER_PASSWORD` set and non-empty |
| command | `serve --hostname 0.0.0.0 --port 4096` |

**Verify:** `go -C boy test ./internal/app -run TestContainerSpec`

## Scenario: mount-table

**Given** a started coder
**When** the recording runtime's mounts are inspected
**Then** exactly these bind mounts exist, each at its host path:

| Source | Destination | Mode |
|---|---|---|
| `<repo>/.agents/sandboxes/<name>` | same | `rw` |
| `~/.config/opencode` | same | `ro` |
| `<knowledge base>` | same | `ro` |

**And** the state volume is mounted once at `/home/bach/.local/boy`
**And** `/tmp` and `/home/bach/.cache` are tmpfs
**And** no mount exists for `<harness>/dist`, for `Memory.md`, or for `auth.json`

**Verify:** `go -C boy test ./internal/app -run TestMountTable`

## Scenario: container-root-read-only

**Given** a running sandboxed coder
**When** the container writes to `/usr/local/bin/probe`, `/etc/probe` and `/home/bach/.config/probe`
**Then** each write fails
**And** writes to the sandbox path, `/tmp` and `/home/bach/.cache` succeed

**Verify:** `BOY_PODMAN_TESTS=1 go -C boy test ./internal/container -run TestRootfsReadOnly`

## Scenario: config-symlinks-resolved

**Given** `~/.config/opencode/opencode.json` is a symlink to a path outside `~/.config/opencode`
**When** a coder is started
**Then** the symlink's target is mounted read-only at its own absolute path
**And** inside the container `~/.config/opencode/opencode.json` resolves to a readable file
**And** writing to it fails

**Verify:** `BOY_PODMAN_TESTS=1 go -C boy test ./internal/container -run TestConfigSymlinksResolved`

## Scenario: server-readiness-gate

**Given** a container whose server never answers `/api/info`
**When** `boy start` runs
**Then** it fails with `server did not become ready: <container>` within the configured timeout
**And** the container it created is removed
**And** the sandbox is left in place

**Verify:** `go -C boy test ./internal/app -run TestReadinessGate`

## Scenario: session-rooted-in-sandbox

**Given** a started plan coder
**When** the session creation request is inspected
**Then** `Directory` equals `<repo>/.agents/sandboxes/<name>`
**And** `Agent` equals `coder`
**And** `Permissions` equals the allow-all rule set followed by `question` deny

**Verify:** `go -C boy test ./internal/app -run TestSessionRootedInSandbox`

## Scenario: no-credentials-in-container

**Given** a started coder
**When** the container environment is inspected
**Then** no variable matching `*_API_KEY`, `*_TOKEN`, `AWS_*`, `OPENROUTER_*` or `ANTHROPIC_*` is present
**And** no mount provides `auth.json`, `~/.aws`, or `~/.ssh`

**Verify:** `BOY_PODMAN_TESTS=1 go -C boy test ./internal/container -run TestNoCredentialsInContainer`

## Scenario: host-paths-absent

**Given** a running sandboxed coder
**When** the coder checks for host paths outside the mount table
**Then** each of these does not exist inside the container:

- `~/.ssh`
- `~/.aws`
- `<repo>/go.mod` (the main checkout, as opposed to the sandbox clone)
- a second repo's directory

**Verify:** `BOY_PODMAN_TESTS=1 go -C boy test ./internal/container -run TestHostPathsAbsent`

## Scenario: fetch-back-fast-forwards

**Given** a sandbox with one commit on branch `<name>` that the host branch does not have
**When** `boy status` runs
**Then** the host branch `<name>` points at the sandbox's commit
**And** `refs/heads/main` and every other ref is unchanged

**Verify:** `go -C boy test ./internal/app -run TestFetchBackFastForwards`

## Scenario: fetch-back-rejects-non-ff

**Given** a host branch `<name>` that advanced past the sandbox's base commit
**When** any command fetches back
**Then** it fails with `cannot fast-forward <name>: host branch has diverged`
**And** the host branch still points at its previous commit

**Verify:** `go -C boy test ./internal/app -run TestFetchBackRejectsNonFF`

## Scenario: status-states

**Given** four coders in one repo whose runtime states are running, stopped, container-absent and sandbox-absent
**When** `boy status` runs
**Then** the JSON array contains these exact state strings:

| Coder | state |
|---|---|
| active turn | `running` |
| session finished | `idle` |
| container stopped | `stopped` |
| sandbox only | `no container` |
| container only | `broken` |

**And** a `no container` entry still reports the branch and the TODO task counts

**Verify:** `go -C boy test ./internal/app -run TestStatusStates`

## Scenario: discovery-scoped-to-repo

**Given** coders in two repos
**When** `boy status` runs in the first
**Then** only that repo's coders are listed
**And** `boy status --all` lists both
**And** a sandbox-only coder is absent from `--all`

**Verify:** `go -C boy test ./internal/app -run TestDiscoveryScopedToRepo`

## Scenario: attach-targets-owning-server

**Given** a running coder with a known session id
**When** `boy attach <session-id>` runs
**Then** it execs `opencode --server http://127.0.0.1:<port>` with `--session <session-id>`
**And** `OPENCODE_SERVER_PASSWORD` in the child environment equals the container's password

**Verify:** `go -C boy test ./internal/app -run TestAttachTargetsOwningServer`

## Scenario: prompt-routes-to-owning-container

**Given** three coders in one repo: one running, one with a stopped container, one with no container
**When** `boy prompt <session-of-running> "continue"` runs
**Then** the text reaches that coder's server and no other coder's server is contacted
**When** `boy prompt <session-of-stopped> "continue"` runs
**Then** it fails with `coder is not running: <name>; run boy start`
**When** `boy prompt <session-of-no-container> "continue"` runs
**Then** it fails with `coder has no container: <name>; run boy start`

**Verify:** `go -C boy test ./internal/app -run TestPromptRoutesToOwningContainer`

## Scenario: remove-refuses-unless-safe

**Given** a coder in the described state
**When** `boy remove` runs
**Then** the outcome is:

| Given state | Then |
|---|---|
| coder running | error `coder is still running: <session>` |
| sandbox has uncommitted changes | error `sandbox has uncommitted changes: <path>` |
| branch unmerged | error `branch not merged: <branch>` |
| any of the above with `--force` | removal proceeds |

**Verify:** `go -C boy test ./internal/app -run TestRemoveRefusesUnlessSafe`

## Scenario: remove-cleans-and-keeps-branch

**Given** a stopped coder with a merged, clean sandbox
**When** `boy remove <session>` runs
**Then** the container is removed with `--volumes`
**And** the sandbox directory is deleted
**And** `.agents/sandboxes/<name>` no longer exists
**And** branch `<name>` still exists in the repo

**Verify:** `go -C boy test ./internal/app -run TestRemoveCleansAndKeepsBranch`

## Scenario: start-fails-before-side-effects

**Given** the described precondition
**When** `boy start` runs
**Then**:

| Precondition | Then |
|---|---|
| image absent | error `image not found: <image>` naming `container/build.sh`; no branch, sandbox or container created |
| podman absent | error `podman not found`; no branch, sandbox or container created |
| plan has uncommitted changes | error `plan has uncommitted changes: <plan>`; no branch, sandbox or container created |

**Verify:** `go -C boy test ./internal/app -run TestStartFailsBeforeSideEffects`

## Scenario: coder-deny-rules-present

**Given** the rendered global config and coder agent
**When** they are inspected
**Then** `read` and `edit` deny rules exist for each of `.env`, `.env.*`, `*.pem`, `*.key`, `id_*`, `.ssh`, `.aws`, `.netrc`, `auth.json`
**And** an `edit` deny exists for `~/.config/**` and the state directory
**And** an `allow` rule for `.env.example` precedes the deny for `.env.*`
**And** shell deny rules exist for the same credential paths

**Verify:** `bun test test/integration/coder-permissions.test.ts -t "denies credential paths"`

---

## Out of Scope

- Multi-repo coders: no scenario covers mounting two repos into one sandbox.
- Credentialed providers: no scenario asserts provider keys work inside a sandbox; `framework` is assumed reachable.
- Knowledge base writes: allowed by no scenario; the mount is read-only and capture fails by design.
- Conversation-history durability across container recreation: no scenario requires it. Work continuity comes from TODO.md.
- Automatic container start after a host reboot (systemd user unit): only podman restarts are covered, via `--restart=unless-stopped`.
- Image building: `container/build.sh` is exercised manually, not by a scenario.
- Migration of existing worktree coders: no scenario covers `.agents/worktrees/`.
