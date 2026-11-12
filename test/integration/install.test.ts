import { test, expect, afterAll } from "bun:test"
import { mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import {
  repoRoot,
  createTempHome,
  copyTree,
  runInstall,
  listFiles,
  listDirs,
  compareTrees,
  fileExists,
  cleanupTempHomes,
  type DirComparison,
  type InstallRun,
} from "./install-helpers"

// Scenario tests for plan 22 (self-contained install). Each test runs the
// real install.sh under a fresh temp HOME (see install-helpers.ts).
//
// The installed bytes embed $HOME (config.ts builds its paths from
// homedir()), so "matches a fresh install into an empty H" can only be
// checked against a fresh install under the SAME home. Every test therefore
// makes its own home, installs into it, and snapshots the result as the
// canonical state for that home before perturbing it.

afterAll(async () => {
  await cleanupTempHomes()
})

const srcSkills = join(repoRoot, "src/global/skills")

const NO_DIFF: DirComparison = { onlyInFirst: [], onlyInSecond: [], differing: [] }

// bun's toBe() takes no failure message, so a non-zero exit shows the stderr.
function expectSuccess(run: Pick<InstallRun, "exitCode" | "stderr">): void {
  if (run.exitCode !== 0) throw new Error(`install.sh exited ${run.exitCode}:\n${run.stderr}`)
}

async function freshInstall(): Promise<InstallRun> {
  const run = await runInstall()
  expectSuccess(run)
  return run
}

test("skills-installed-whole: skill scripts and reference files install whole", async () => {
  const run = await freshInstall()
  const S = run.skills

  const installedScripts = [
    "validating-work/scripts/pipeline_runner.py",
    "maintaining-knowledge-base/scripts/audit-dangling.sh",
    "maintaining-knowledge-base/scripts/audit-orphans.py",
    "maintaining-knowledge-base/scripts/audit-oversized.sh",
    "evaluating-memory/scripts/append-memory.sh",
  ]
  for (const rel of installedScripts) {
    expect(await fileExists(join(S, rel)), `skills/${rel} missing`).toBe(true)
    const installed = await readFile(join(S, rel))
    const source = await readFile(join(srcSkills, rel))
    expect(installed.equals(source), `skills/${rel} differs from src/global/skills/${rel}`).toBe(true)
  }

  expect(await fileExists(join(S, "writing-knowledge-base/reference/zettelkasten-conventions.md"))).toBe(true)
  expect(await fileExists(join(S, "writing-plans/reference/plan-format.md"))).toBe(true)

  // every skill folder under src/global/skills/ has a matching <id>/SKILL.md
  const ids = (await readdir(srcSkills, { withFileTypes: true }))
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) {
    expect(await fileExists(join(S, id, "SKILL.md")), `skills/${id}/SKILL.md missing`).toBe(true)
  }

  // no __pycache__ folder and no *.pyc file under the installed config
  for (const rel of await listFiles(run.config)) {
    expect(rel.endsWith(".pyc"), rel).toBe(false)
    expect(rel.split("/").includes("__pycache__"), rel).toBe(false)
  }
})

test("agents-installed-flat: agents install flat, no reference folder outside skills/", async () => {
  const run = await freshInstall()
  const entries = await readdir(run.agents, { withFileTypes: true })
  expect(entries.length).toBeGreaterThan(0)
  for (const entry of entries) {
    expect(entry.isDirectory(), `agents/${entry.name} is a folder`).toBe(false)
    expect(entry.name.endsWith(".md"), `agents/${entry.name} is not .md`).toBe(true)
  }

  // no folder named reference anywhere outside skills/ (any depth inside
  // skills/ is fine)
  for (const rel of await listDirs(run.config)) {
    if (rel === "skills" || rel.startsWith("skills/")) continue
    expect(rel.split("/").includes("reference"), rel).toBe(false)
  }
})

test("clean-install: --clean removes stale files and leaves everything else untouched", async () => {
  const run = await freshInstall()
  const C = run.config
  const refAgents = await copyTree(join(C, "agents"))
  const refSkills = await copyTree(join(C, "skills"))

  const planted: Array<[string, string]> = [
    ["skills/modifying-knowledge-base/SKILL.md", "stale skill\n"],
    ["skills/validating-work/old.md", "stale skill file\n"],
    ["agents/old-agent.md", "stale agent\n"],
    ["opencode.json", "{ \"key\": \"value\" }\n"],
    ["plugins/my-plugin.js", "// my plugin\n"],
    ["node_modules/pkg/index.js", "// pkg\n"],
  ]
  for (const [rel, content] of planted) {
    const abs = join(C, rel)
    await mkdir(join(abs, ".."), { recursive: true })
    await writeFile(abs, content)
  }

  const cleaned = await runInstall(["--clean"], run.home)
  expectSuccess(cleaned)

  for (const [rel] of planted.slice(0, 3)) {
    expect(await fileExists(join(C, rel)), `${rel} should be absent`).toBe(false)
  }
  for (const [rel, content] of planted.slice(3)) {
    expect(await readFile(join(C, rel), "utf-8")).toBe(content)
  }

  expect(await compareTrees(join(C, "agents"), refAgents)).toEqual(NO_DIFF)
  expect(await compareTrees(join(C, "skills"), refSkills)).toEqual(NO_DIFF)
})

test("clean-missing-folders: --clean tolerates missing config, agents or skills folders", async () => {
  for (const state of ["none", "config", "agents"]) {
    // A fresh install into an empty H is the canonical state for this home.
    const run = await freshInstall()
    const C = run.config
    const refAgents = await copyTree(join(C, "agents"))
    const refSkills = await copyTree(join(C, "skills"))

    // Bring H to the given state.
    if (state === "none") await rm(C, { recursive: true })
    if (state === "config") await rm(join(C, "agents"), { recursive: true })
    if (state === "config") await rm(join(C, "skills"), { recursive: true })
    if (state === "agents") await rm(join(C, "skills"), { recursive: true })
    if (state === "agents") await rm(join(C, "agents"), { recursive: true })
    if (state === "agents") await mkdir(join(C, "agents"))

    const cleaned = await runInstall(["--clean"], run.home)
    expectSuccess(cleaned)
    expect(await compareTrees(join(C, "agents"), refAgents)).toEqual(NO_DIFF)
    expect(await compareTrees(join(C, "skills"), refSkills)).toEqual(NO_DIFF)
  }
})

test("clean-dry-run: --clean --dry-run deletes nothing and prints a delete line per agents/ and skills/ file", async () => {
  const run = await freshInstall()
  const C = run.config
  await writeFile(join(C, "skills", "validating-work", "old.md"), "stale\n")

  const before = new Map<string, Buffer>()
  for (const rel of await listFiles(C)) {
    before.set(join(C, rel), await readFile(join(C, rel)))
  }

  const dry = await runInstall(["--clean", "--dry-run"], run.home)
  expectSuccess(dry)

  // every file under C is byte-identical to before
  const after = await listFiles(C)
  expect(after.sort()).toEqual([...before.keys()].map(p => p.slice(C.length + 1)).sort())
  for (const [abs, bytes] of before) {
    expect((await readFile(abs)).equals(bytes), abs).toBe(true)
  }

  // a delete line for every file under agents/ and skills/ and no others
  const deletePaths = dry.stdout
    .split("\n")
    .filter(line => line.startsWith("[dry-run] delete "))
    .map(line => line.slice("[dry-run] delete ".length))
  const expected = [
    ...(await listFiles(join(C, "agents"))).map(p => join(C, "agents", p)),
    ...(await listFiles(join(C, "skills"))).map(p => join(C, "skills", p)),
  ].sort()
  expect(deletePaths.sort()).toEqual(expected)
  expect(deletePaths).toContain(join(C, "skills", "validating-work", "old.md"))
})

test("install-without-clean: without --clean stale files survive; --dry-run prints no delete lines", async () => {
  const run = await freshInstall()
  const C = run.config
  const refAgents = await copyTree(join(C, "agents"))
  const refSkills = await copyTree(join(C, "skills"))
  const staleSkill = join(C, "skills", "validating-work", "old.md")
  const staleAgent = join(C, "agents", "old-agent.md")
  await writeFile(staleSkill, "stale skill file\n")
  await writeFile(staleAgent, "stale agent\n")

  const second = await runInstall([], run.home)
  expectSuccess(second)
  expect(await readFile(staleSkill, "utf-8")).toBe("stale skill file\n")
  expect(await readFile(staleAgent, "utf-8")).toBe("stale agent\n")

  // every other file under skills/ and agents/ matches a fresh install
  expect(await compareTrees(join(C, "skills"), refSkills)).toEqual({
    onlyInFirst: ["validating-work/old.md"],
    onlyInSecond: [],
    differing: [],
  })
  expect(await compareTrees(join(C, "agents"), refAgents)).toEqual({
    onlyInFirst: ["old-agent.md"],
    onlyInSecond: [],
    differing: [],
  })

  const dry = await runInstall(["--dry-run"], run.home)
  expectSuccess(dry)
  expect(dry.stdout).not.toContain("[dry-run] delete")
})
