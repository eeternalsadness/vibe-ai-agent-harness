import { test, expect, beforeEach, afterEach } from "bun:test"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawn } from "node:child_process"
import appendMemoryScript from "../../src/global/skills/evaluating-memory/scripts/append-memory.sh"

let testDir: string
let scriptPath: string
let memoryPath: string

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "vibe-memory-test-"))
  scriptPath = join(testDir, "append-memory.sh")
  memoryPath = join(testDir, "Memory.md")
  await writeFile(scriptPath, appendMemoryScript, "utf-8")
  await chmod(scriptPath, 0o755)
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

async function runAppend(item?: string): Promise<{ code: number | null; stderr: string }> {
  const args = item === undefined ? [scriptPath] : [scriptPath, item]

  return await new Promise((resolve) => {
    const child = spawn("bash", args, {
      env: { ...process.env, VIBE_MEMORY_FILE: memoryPath },
    })
    let stderr = ""
    child.stderr.on("data", chunk => stderr += chunk)
    child.on("close", code => resolve({ code, stderr }))
  })
}

test("append-memory validates and appends a formatted item", async () => {
  const result = await runAppend("- [decision] test-project: use script-backed memory writes")

  expect(result.code).toBe(0)
  await expect(readFile(memoryPath, "utf-8")).resolves.toBe(
    "# Memory\n\n- [decision] test-project: use script-backed memory writes\n"
  )
})

test("append-memory rejects malformed items", async () => {
  const result = await runAppend("decision: malformed")

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("Invalid memory item format")
  await expect(readFile(memoryPath, "utf-8")).rejects.toThrow()
})

test("append-memory rejects items over 150 characters", async () => {
  const result = await runAppend(`- [work] test-project: ${"x".repeat(130)}`)

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("exceeds 150 characters")
})

test("append-memory keeps only the last 100 bullet items", async () => {
  for (let i = 1; i <= 101; i++) {
    const result = await runAppend(`- [work] test-project: completed item ${i}`)
    expect(result.code).toBe(0)
  }

  const memory = await readFile(memoryPath, "utf-8")
  const items = memory.split("\n").filter(line => line.startsWith("- "))

  expect(items).toHaveLength(100)
  expect(items[0]).toBe("- [work] test-project: completed item 2")
  expect(items[99]).toBe("- [work] test-project: completed item 101")
})
