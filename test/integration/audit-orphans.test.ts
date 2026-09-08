import { test, expect } from "bun:test"
import { join } from "node:path"
import { spawn } from "node:child_process"

const scriptPath = join(import.meta.dir, "../../src/global/skills/maintaining-knowledge-base/scripts/audit-orphans.py")
const fixturesDir = join(import.meta.dir, "../fixtures/knowledge-base")

async function run(kbPath: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn("python3", [scriptPath, kbPath])
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", chunk => stdout += chunk)
    child.stderr.on("data", chunk => stderr += chunk)
    child.on("close", code => resolve({ code, stdout, stderr }))
  })
}

test("audit-orphans exits 0 when every note is reachable from Index.md", async () => {
  const result = await run(join(fixturesDir, "clean"))

  expect(result.code).toBe(0)
  expect(result.stdout).toContain("No orphaned notes found.")
})

test("audit-orphans exits 1 and reports the unreachable note", async () => {
  const result = await run(join(fixturesDir, "orphan"))

  expect(result.code).toBe(1)
  expect(result.stdout).toContain("Orphan.md")
})

test("audit-orphans exits 2 when the knowledge base directory doesn't exist", async () => {
  const result = await run(join(fixturesDir, "does-not-exist"))

  expect(result.code).toBe(2)
  expect(result.stderr).toContain("not found")
})

test("audit-orphans exits 2 when Index.md is missing", async () => {
  const result = await run(join(fixturesDir, "no-index"))

  expect(result.code).toBe(2)
  expect(result.stderr).toContain("Index.md not found")
})

test("audit-orphans exits 2 when called without a kb-path argument", async () => {
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
    const child = spawn("python3", [scriptPath])
    let stderr = ""
    child.stderr.on("data", chunk => stderr += chunk)
    child.on("close", code => resolve({ code, stderr }))
  })

  expect(result.code).toBe(2)
  expect(result.stderr).toContain("Expected exactly one argument")
})
