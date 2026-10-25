# Implementation: Coder Sandbox

Phases are ordered by dependency, not by size. Phase 0 must land first: the mount table's "no harness mount" claim depends on skills being self-contained. Phase 1 must land before any container test can run. Phases 2-4 are the boy changes. Do not start a phase before the previous one's tasks are green.

Scenario names refer to `ACCEPTANCE.md`; that file is the sole source of truth for assertions and exact strings.

---

## Phase 0 — Harness: Claude-style skills

Today `install.sh` installs only `*.md` files (`find … -maxdepth 2 -name "*.md" -not -path "*/reference/*"`), so installed skills never receive `scripts/` or `reference/`, and skill bodies compensate by pointing at `<harness>/dist/...`. That is why a sandbox would need a harness mount. This phase removes the dependency.

**Task 1 — Test: installed skills are complete.**
Add `test/integration/skills-install.test.ts`. Run `install.sh` into a temporary `OPENCODE_CONFIG` and assert the installed tree for a skill that has support files (`validating-work`) contains `scripts/pipeline_runner.py`, and that a skill with references keeps its `reference/` directory. Covers `skills-installed-whole`.

**Task 2 — Test: no rendered file references the build output.**
Extend `test/integration/render.test.ts` with a case that renders every template and asserts no output contains `dist/opencode/skills`. Also assert the `validating-work` body mentions `scripts/pipeline_runner.py` and the coder agent's `shell` resource names `~/.config/opencode/skills/validating-work/scripts/pipeline_runner.py`. Covers `skill-bodies-reference-installed-paths`.

**Task 3 — Test: deny rules are rendered.**
Add `test/integration/coder-permissions.test.ts` asserting the rendered config and coder agent contain the deny rules, in the order required (`.env.example` allow before `.env.*` deny). Covers `coder-deny-rules-present`.

**Task 4 — Add the installed-skills path to config.**
In `config.ts`, add `opencodeSkillsPath: \`${homedir()}/.config/opencode/skills\``. Template bodies and agent permissions import it instead of composing `${harnessPath}/dist/...`.

**Task 5 — Rewrite skill bodies to skill-relative paths.**
In each `src/global/skills/*/SKILL.md.ts`, replace `${config.harnessPath}/dist/opencode/skills/<skill>/…` with paths relative to the skill directory (`scripts/x.sh`, `reference/y.md`). OpenCode resolves them against the loaded skill's base directory, which it injects at load time. `config.knowledgeBasePath` and `config.memoryFilePath` stay absolute: they are data paths, not skill assets.

**Task 6 — Point agent permissions at installed paths.**
In `src/global/agents/coder/coder.md.ts` (and `curator`, `memory` where they reference skill scripts), change permission resources to `${config.opencodeSkillsPath}/<skill>/scripts/…`. Keep the `external_directory` allow on the same path.

**Task 7 — Install skills whole.**
In `install.sh`, replace the per-file skills loop with a directory install: for each directory under `dist/$PLATFORM/skills`, copy it recursively into `$OPENCODE_CONFIG/skills/`, preserving `scripts/` and `reference/`. Keep `maybe_copy` semantics (skip unchanged files, respect dry-run). Leave the agents loop as it is; agents are flat files.

**Task 8 — Update the philosophy note.**
`src/global/AGENTS.md.ts` currently states that reference subdirectories are never installed and are read from the repo path. Replace with: skills install whole; bodies address support files relative to the skill directory; the repo checkout is not required at runtime. Also update the repo `AGENTS.md` structure section to say skills are installed complete.

**Task 32 — Add credential deny rules.**
In the rendered `opencode.json` (or the coder agent's `permissions`), add `read` and `edit` denies for `.env`, `.env.*`, `*.pem`, `*.key`, `id_*`, `.ssh`, `.aws`, `.netrc` and `auth.json`, an earlier `allow` for `.env.example`, `edit` denies for `~/.config/**` and the state directory, and `shell` denies for the same credential paths. Ordering matters: the last matching rule wins, so the `.env.example` allow must precede the `.env.*` deny. Keep the coder's allow-all first and the `question` deny last.

---

## Phase 1 — Image

The image is the sandbox's definition: one profile-agnostic image, no agent config, no credentials.

**Task 9 — Write `container/Dockerfile`.**
`FROM debian:bookworm-slim`. Install via apt: `ca-certificates curl git make jq procps ripgrep unzip xz-utils build-essential python3 shellcheck`. Install pinned toolchains from official tarballs as `ARG` values defaulting to: Go `1.26.3`, Node `25.9.0`, uv `0.11.6`, bun `1.4.2`. Then `npm install -g @opencode/cli@2.1.4` (pins v2; the GHCR image is Alpine/musl and `:latest` is v1). Create `/home/bach` and the XDG roots. Bake git identity with `ARG GIT_NAME` / `ARG GIT_EMAIL` into `/etc/gitconfig`. Do not add podman, docker, or any credential.

**Task 10 — Write `container/build.sh`.**
Flags: `--tag` (default `boy-coder:latest`), `--git-name`, `--git-email`, `--opencode-version`, `--go-version`, `--node-version`, `--bun-version`, `--uv-version`. Fails if git identity is missing. Refuses to overwrite an existing tag unless `--force`. Prints the final tag on success. Boy never calls this.

**Task 11 — Write `container/smoke.sh`.**
Builds nothing; runs the given tag and asserts, inside it: `opencode --version` is the expected v2 version, `go`, `node`, `bun`, `uv`, `shellcheck` report versions, `git -C /tmp init` succeeds, and `opencode serve` starts under `--read-only` with XDG paths on a writable mount and answers `/api/info` with basic auth. This is the gate that a broken image cannot reach boy. Not covered by an acceptance scenario; it is a manual pre-flight.

---

## Phase 2 — Boy: container runtime and spec

**Task 12 — Test: container spec.**
Write `boy/internal/app/container_spec_test.go` against a recording runtime, asserting every element in the `container-spec` table (name, labels, network, published port form, `--read-only`, restart policy, env, command). Covers `container-spec`.

**Task 13 — Test: mount table.**
Assert the exact three bind mounts and their modes, the single state volume mount, the two tmpfs mounts, and the absence of harness/dist, Memory.md and auth.json mounts. Covers `mount-table`.

**Task 14 — Test: integration behaviour of the real container.**
Add `boy/internal/container/podman_integration_test.go` gated on `BOY_PODMAN_TESTS=1`: rootfs read-only, config symlink resolution, no credential env, host paths absent. Covers `container-root-read-only`, `config-symlinks-resolved`, `no-credentials-in-container`, `host-paths-absent`. Four separate `Test…` functions, one per scenario.

**Task 15 — Create `boy/internal/container`.**
Define `Runtime` with the operations boy needs: `Run(spec) (name, error)`, `List(filter) ([]Container, error)`, `Inspect(name) (Container, error)`, `Start`, `Stop`, `Remove(name, removeVolumes bool)`, `Port(name, containerPort) (int, error)`, `Exists(name)`. Define `Spec` as data: name, image, labels, mounts, tmpfs, env, published port, command, read-only, restart policy. Keep `os/exec` confined to the podman implementation.

**Task 16 — Implement podman.**
Map `Spec` to argv with explicit flags. Read the host port back with `podman port <name> 4096` after start; never pre-allocate. Read the password from `podman inspect` env in boy's process without writing it to stdout. Use `podman rm -fv` for removal so the anonymous volume goes with the container.

**Task 17 — Build a recording fake.**
`FakeRuntime` records every call and returns scripted results, so all unit scenarios run without podman. This is the injection point for `Deps`.

**Task 18 — Build the spec.**
`internal/app` gains `buildSpec(coder)` producing the mount table, env, labels, tmpfs and command. Resolve config symlinks that escape `~/.config/opencode` and add a read-only mount at each target's real path; today that is `opencode.json` only.

**Task 19 — Extend boy config.**
Add `container_image`, `knowledge_base_path`, `podman_binary`, `startup_timeout`, and `container_name_prefix` to `config.go`, sourced like the existing keys (env, then `~/.config/boy/config.yaml`). `Resolve` no longer needs a server URL for coder commands; keep the existing server resolution only where a command still needs it, and stop printing `ServerURL` in coder errors.

---

## Phase 3 — Boy: sandbox and git

**Task 20 — Test: clone shape.**
Covers `sandbox-clone-single-branch`.

**Task 21 — Test: fetch-back both directions.**
Covers `fetch-back-fast-forwards` and `fetch-back-rejects-non-ff`.

**Task 22 — Implement the sandbox layer.**
Replace `worktreePath` with `sandboxPath` (`<repo>/.agents/sandboxes/<name>`) and `planFromWorktree` with `planFromSandbox`. Add `ensureBranch`, `ensureSandbox` (clone `--single-branch --branch <name>` when absent), `sandboxDirty`, `branchMerged`, and `fetchBack` (`git fetch <sandbox> <name>:<name>`, no force marker, rewriting git's non-fast-forward failure into `cannot fast-forward <name>: host branch has diverged`). Update `isCoder`, `status`, `entry` and `remove` references as they are reached.

---

## Phase 4 — Boy: commands

**Task 23 — Test: start converges, readiness, session, preconditions.**
Covers `start-converges`, `server-readiness-gate`, `session-rooted-in-sandbox`, `start-fails-before-side-effects`.

**Task 24 — Test: status, discovery, attach, remove.**
Covers `status-states`, `discovery-scoped-to-repo`, `attach-targets-owning-server`, `remove-refuses-unless-safe`, `remove-cleans-and-keeps-branch`.

**Task 25 — Rework `Deps`.**
Replace the single `Client` with a resolver: `NewClient(url, password string) client.Client` plus `Runtime container.Runtime`. Tests inject a fake factory keyed by URL and the recording runtime.

**Task 26 — `start` becomes converge.**
Order: check output → resolve plan → plan-clean check → image present check → podman present check → ensure branch → ensure sandbox → ensure container (create, or start if stopped) → wait for readiness → list sessions in the sandbox directory → create session if none → send start prompt (fresh sandbox) or continue prompt (existing sandbox) → print entry. Any failure before the container exists leaves git untouched; a readiness failure removes the container it created.

**Task 27 — `status` reports five states.**
Enumerate sandbox directories in the repo as identity, join containers by label, query each live server for session state. Emit `running`, `idle`, `stopped`, `no container`, `broken` exactly. `--all` lists containers by label only, so sandbox-only coders appear in their own repo only. Fetch back before reporting a clean state so the branch reflects the sandbox.

**Task 28 — `prompt` resolves locally.**
Resolve the session id to a container by listing the repo's containers and asking each candidate server once for that session id (a session id cannot be a container label, since the container exists before the session). A coder whose container is stopped fails with `coder is not running: <name>; run boy start`; one with no container fails with `coder has no container: <name>; run boy start`. No other coder's server is contacted once the owner is found.

**Task 29 — New `attach` command.**
`boy attach <session-id>`: resolve the owning container and port, then exec `opencode --server http://127.0.0.1:<port>` with `--session <id>` and `OPENCODE_SERVER_PASSWORD` set in the child environment. Register it in `main.go`.

**Task 30 — `remove` cleans completely.**
Fetch back first, then refuse per the existing rules using sandbox wording, then interrupt if running, `podman rm -fv`, delete the sandbox directory, keep the branch. A `no container` coder removes without touching podman.

---

## Phase 5 — Documentation

**Task 31 — Update `README.md` and the repo `AGENTS.md`.**
Describe the sandbox model, the `.agents/sandboxes/` layout, `container/build.sh`, `boy attach`, the five status states, and the credential stance (framework only, nothing secret in the container). Record that `.agents/worktrees/` is no longer produced.
