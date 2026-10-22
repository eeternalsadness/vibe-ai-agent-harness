import { expect, test } from "bun:test"
import { join } from "node:path"

// Plan 19 scenario worktrees-gitignored: coder worktrees live inside the repo
// under .agents/worktrees/, and git must ignore everything in them.
// Plan 20 scenario decisions-gitignored: the coder's decisions record is
// ignored too, so it is never committed.

const repoRoot = join(import.meta.dir, "../..")

function checkIgnore(path: string): number {
  const result = Bun.spawnSync(["git", "check-ignore", "-q", path], { cwd: repoRoot })
  return result.exitCode
}

test("worktrees-gitignored: git ignores paths under .agents/worktrees/", () => {
  expect(checkIgnore(".agents/worktrees/any/file")).toBe(0)
})

test("decisions-gitignored: git ignores .agents/DECISIONS.md", () => {
  expect(checkIgnore(".agents/DECISIONS.md")).toBe(0)
})
