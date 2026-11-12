// Helpers for the install integration tests (plan 22). They run the repo's
// real install.sh with HOME pointed at a fresh temporary directory, so the
// real config is never touched. Go keeps its downloaded libraries and
// compiled code under HOME, so the real GOCACHE and GOMODCACHE (read once
// from `go env`) are passed through; the boy build then reuses them instead
// of re-downloading and recompiling on every run.
//
// install.sh re-renders the repo's dist/ on every run, so installs are
// serialized: no two install.sh processes may read or rebuild dist/ at the
// same time.

import { cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const repoRoot = join(import.meta.dir, "../..")

export interface InstallRun {
  home: string
  config: string
  agents: string
  skills: string
  stdout: string
  stderr: string
  exitCode: number
}

const tempHomes: string[] = []

function trackHome(home: string): string {
  tempHomes.push(home)
  return home
}

// A fresh temp directory to use as HOME. Tracked for cleanup.
export async function createTempHome(): Promise<string> {
  return trackHome(await mkdtemp(join(tmpdir(), "vibe-install-test-home-")))
}

// Removes every temp directory created by these tests.
export async function cleanupTempHomes(): Promise<void> {
  for (const home of tempHomes.splice(0)) {
    await rm(home, { recursive: true, force: true }).catch(() => undefined)
  }
}

// Copies a directory tree to a fresh tracked temp directory, byte for byte.
// The destination never exists beforehand, so node's cp creates it as a copy.
export async function copyTree(src: string): Promise<string> {
  const parent = trackHome(await mkdtemp(join(tmpdir(), "vibe-install-test-snap-")))
  const dest = join(parent, "copy")
  await cp(src, dest, { recursive: true })
  return dest
}

let goEnvPromise: Promise<Record<string, string>> | null = null

// The real GOCACHE and GOMODCACHE, read once from `go env` under the real
// HOME (the test process's own environment).
function realGoEnv(): Promise<Record<string, string>> {
  goEnvPromise ??= (async () => {
    try {
      const proc = Bun.spawnSync(["go", "env", "GOCACHE", "GOMODCACHE"], { env: process.env })
      if (proc.exitCode !== 0) return {}
      const [gocache, gomodcache] = proc.stdout.toString().trim().split("\n")
      const out: Record<string, string> = {}
      if (gocache) out.GOCACHE = gocache
      if (gomodcache) out.GOMODCACHE = gomodcache
      return out
    } catch {
      return {}
    }
  })()
  return goEnvPromise
}

// Serializes install.sh runs so dist/ is never re-rendered concurrently.
let installLock: Promise<void> = Promise.resolve()

function withInstallLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = installLock.then(fn, fn)
  installLock = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// Runs the repo's install.sh with HOME pointed at `home`, or at a fresh temp
// directory when `home` is omitted. Runs from the repo root, because
// install.sh resolves ./config.ts relative to the working directory.
export async function runInstall(args: string[] = [], home?: string): Promise<InstallRun> {
  const h = home ?? (await createTempHome())
  return withInstallLock(async () => {
    const env: Record<string, string | undefined> = { ...process.env, HOME: h }
    const goEnv = await realGoEnv()
    if (goEnv.GOCACHE) env.GOCACHE = goEnv.GOCACHE
    if (goEnv.GOMODCACHE) env.GOMODCACHE = goEnv.GOMODCACHE

    const proc = Bun.spawn(["bash", "install.sh", ...args], {
      cwd: repoRoot,
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    const config = join(h, ".config", "opencode")
    return {
      home: h,
      config,
      agents: join(config, "agents"),
      skills: join(config, "skills"),
      stdout,
      stderr,
      exitCode,
    }
  })
}

// Sorted relative paths of every file under `dir` (empty when `dir` is absent).
export async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  try {
    const walk = async (d: string, prefix: string): Promise<void> => {
      for (const entry of await readdir(d, { withFileTypes: true })) {
        const abs = join(d, entry.name)
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) await walk(abs, rel)
        else if (entry.isFile()) out.push(rel)
      }
    }
    await walk(dir, "")
  } catch {
    // absent directory: nothing to list
  }
  return out.sort()
}

// Sorted relative paths of every directory under `dir` (empty when absent).
export async function listDirs(dir: string): Promise<string[]> {
  const out: string[] = []
  try {
    const walk = async (d: string, prefix: string): Promise<void> => {
      for (const entry of await readdir(d, { withFileTypes: true })) {
        const abs = join(d, entry.name)
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          out.push(rel)
          await walk(abs, rel)
        }
      }
    }
    await walk(dir, "")
  } catch {
    // absent directory: nothing to list
  }
  return out.sort()
}

export interface DirComparison {
  onlyInFirst: string[]
  onlyInSecond: string[]
  differing: string[]
}

// Compares two directories file by file: the same relative paths, same bytes.
export async function compareTrees(first: string, second: string): Promise<DirComparison> {
  const [filesFirst, filesSecond] = await Promise.all([listFiles(first), listFiles(second)])
  const setFirst = new Set(filesFirst)
  const setSecond = new Set(filesSecond)
  const onlyInFirst = filesFirst.filter(p => !setSecond.has(p))
  const onlyInSecond = filesSecond.filter(p => !setFirst.has(p))
  const differing: string[] = []
  for (const p of filesFirst) {
    if (!setSecond.has(p)) continue
    const a = await readFile(join(first, p))
    const b = await readFile(join(second, p))
    if (!a.equals(b)) differing.push(p)
  }
  return { onlyInFirst, onlyInSecond, differing }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

// True when `path` exists as a file OR a directory.
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export interface AgentRule {
  action: string
  resource: string
  effect: string
}

export interface AgentDef {
  rules: AgentRule[]
  body: string
}

// Parses an installed agent file: the permission rules in its YAML
// frontmatter (action / resource / effect) and the markdown body.
export function parseAgent(file: string, path: string): AgentDef {
  const lines = file.split("\n")
  if (lines[0] !== "---") throw new Error(`no frontmatter in ${path}`)
  const end = lines.indexOf("---", 1)
  if (end === -1) throw new Error(`unterminated frontmatter in ${path}`)
  const rules: AgentRule[] = []
  let rule: AgentRule | null = null
  for (const line of lines.slice(1, end)) {
    const action = line.match(/^  - action: (.+)$/)?.[1]
    if (action) {
      rule = { action: action.trim(), resource: "", effect: "" }
      rules.push(rule)
      continue
    }
    const kv = line.match(/^    (resource|effect): (.+)$/)
    const key = kv?.[1]
    const raw = kv?.[2]
    if (rule && key && raw) {
      const value = raw.trim().replace(/^"(.*)"$/, "$1")
      if (key === "resource") rule.resource = value
      else rule.effect = value
    }
  }
  return { rules, body: lines.slice(end + 1).join("\n") }
}

// Escapes regex special characters in `s`.
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// OpenCode wildcard match: each `*` matches any run of characters (including
// `/` and spaces); the pattern must match the whole string.
export function wildcardMatch(pattern: string, value: string): boolean {
  const re = new RegExp("^" + pattern.split("*").map(escapeRegex).join(".*") + "$")
  return re.test(value)
}

// Every absolute path under the installed skills root `S` named in `text`.
// Tokens are path-like runs of word characters, dots, dashes and slashes;
// trailing sentence punctuation is stripped.
export function namedSkillPaths(text: string, S: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(new RegExp(`${escapeRegex(S)}/[A-Za-z0-9._/-]+`, "g"))) {
    out.push(m[0].replace(/[.,;:)\]]+$/, ""))
  }
  return out
}

// Every `reference/<file>` path named in `text` that is NOT part of an
// absolute path under the installed skills root `S` (those are full paths,
// not relative names).
export function relativeReferencePaths(text: string, S: string): string[] {
  const noAbsolute = text.replace(new RegExp(`${escapeRegex(S)}/[A-Za-z0-9._/-]+`, "g"), " ")
  const out: string[] = []
  for (const m of noAbsolute.matchAll(/reference\/[A-Za-z0-9._/-]+/g)) {
    out.push(m[0].replace(/[.,;:)\]]+$/, ""))
  }
  return out
}

// The lines of fenced code blocks (``` ... ```) in `text` that start with
// `bash ` or `python3 ` after stripping leading whitespace.
export function fencedCommandLines(text: string): string[] {
  const out: string[] = []
  let inFence = false
  for (const line of text.split("\n")) {
    const t = line.trim()
    if (t.startsWith("```")) {
      inFence = !inFence
      continue
    }
    if (inFence && (t.startsWith("bash ") || t.startsWith("python3 "))) out.push(t)
  }
  return out
}
