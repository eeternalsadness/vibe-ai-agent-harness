import { expect, test } from "bun:test"
import { join } from "node:path"

// Plan 19 scenario worktrees-gitignored: coder worktrees live inside the repo
// under .agents/worktrees/, and git must ignore everything in them.

const repoRoot = join(import.meta.dir, "../..")

test("worktrees-gitignored: git ignores paths under .agents/worktrees/", () => {
  const result = Bun.spawnSync(["git", "check-ignore", "-q", ".agents/worktrees/any/file"], {
    cwd: repoRoot,
  })

  expect(result.exitCode).toBe(0)
})
