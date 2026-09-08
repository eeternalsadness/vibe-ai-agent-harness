import { test, expect } from "bun:test"
import { join } from "node:path"
import { spawn } from "node:child_process"

const scriptPath = join(import.meta.dir, "../../src/global/skills/maintaining-knowledge-base/scripts/audit-dangling.sh")
const fixturesDir = join(import.meta.dir, "../fixtures/knowledge-base")

async function run(kbPath: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn("bash", [scriptPath, kbPath])
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", chunk => stdout += chunk)
    child.stderr.on("data", chunk => stderr += chunk)
    child.on("close", code => resolve({ code, stdout, stderr }))
  })
}

test("audit-dangling exits 0 on a clean knowledge base", async () => {
  const result = await run(join(fixturesDir, "clean"))

  expect(result.code).toBe(0)
  expect(result.stdout).toContain("No dangling links found.")
})

test("audit-dangling exits 1 and reports the missing target and source file", async () => {
  const result = await run(join(fixturesDir, "dangling"))

  expect(result.code).toBe(1)
  expect(result.stdout).toContain("[[Missing]]")
  expect(result.stdout).toContain("Note.md")
})

test("audit-dangling ignores wiki-links inside fenced code blocks", async () => {
  const result = await run(join(fixturesDir, "fenced-code"))

  expect(result.code).toBe(0)
  expect(result.stdout).toContain("No dangling links found.")
})

test("audit-dangling exits 2 when the knowledge base directory doesn't exist", async () => {
  const result = await run(join(fixturesDir, "does-not-exist"))

  expect(result.code).toBe(2)
  expect(result.stderr).toContain("not found")
})

test("audit-dangling exits 2 when called without a kb-path argument", async () => {
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
    const child = spawn("bash", [scriptPath])
    let stderr = ""
    child.stderr.on("data", chunk => stderr += chunk)
    child.on("close", code => resolve({ code, stderr }))
  })

  expect(result.code).toBe(2)
  expect(result.stderr).toContain("Expected exactly one argument")
})
