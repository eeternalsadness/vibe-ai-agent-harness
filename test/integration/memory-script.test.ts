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

async function runAppend(...args: string[]): Promise<{ code: number | null; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn("bash", [scriptPath, ...args], {
      env: { ...process.env, VIBE_MEMORY_FILE: memoryPath },
    })
    let stderr = ""
    child.stderr.on("data", chunk => stderr += chunk)
    child.on("close", code => resolve({ code, stderr }))
  })
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

test("append-memory validates and appends a formatted item", async () => {
  const result = await runAppend("decision", "test-project", "use script-backed memory writes")

  expect(result.code).toBe(0)
  const memory = await readFile(memoryPath, "utf-8")
  const lines = memory.split("\n").filter(l => l.startsWith("- "))
  expect(lines).toHaveLength(1)
  // Format: - [YYYY-MM-DD] [decision] test-project: use script-backed memory writes
  expect(lines[0]).toMatch(/^- \[\d{4}-\d{2}-\d{2}\] \[decision\] test-project: use script-backed memory writes$/)
})

test("append-memory rejects invalid tag", async () => {
  const result = await runAppend("invalid-tag", "test-project", "some description")

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("Invalid tag")
  await expect(readFile(memoryPath, "utf-8")).rejects.toThrow()
})

test("append-memory rejects description over 150 characters", async () => {
  const result = await runAppend("work", "test-project", "x".repeat(151))

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("exceeds 150 characters")
})

test("append-memory accepts description of exactly 150 characters", async () => {
  const result = await runAppend("work", "test-project", "x".repeat(150))

  expect(result.code).toBe(0)
})

test("append-memory rejects wrong number of arguments", async () => {
  const result = await runAppend("decision")

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("Expected exactly three arguments")
})

test("append-memory keeps only the last 100 bullet items", async () => {
  for (let i = 1; i <= 101; i++) {
    const result = await runAppend("work", "test-project", `completed item ${i}`)
    expect(result.code).toBe(0)
  }

  const memory = await readFile(memoryPath, "utf-8")
  const items = memory.split("\n").filter(line => line.startsWith("- "))

  expect(items).toHaveLength(100)
  expect(items[0]).toContain("completed item 2")
  expect(items[99]).toContain("completed item 101")
})
