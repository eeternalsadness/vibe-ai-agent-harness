import { test, expect, beforeEach, afterEach } from "bun:test"
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawn } from "node:child_process"

const scriptPath = join(import.meta.dir, "../../src/global/skills/evaluating-memory/scripts/append-memory.sh")
const fixturesDir = join(import.meta.dir, "../fixtures/memory")

let testDir: string
let memoryPath: string

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "vibe-memory-test-"))
  memoryPath = join(testDir, "Memory.md")
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

// append-memory.sh mutates its target file, so fixtures are seeded by copying
// them into the per-test temp dir first — the checked-in fixture itself is
// never written to.
async function seedMemory(fixtureName: string): Promise<void> {
  await copyFile(join(fixturesDir, fixtureName), memoryPath)
}

async function runAppend(...args: string[]): Promise<{ code: number | null; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn("bash", [scriptPath, ...args])
    let stderr = ""
    child.stderr.on("data", chunk => stderr += chunk)
    child.on("close", code => resolve({ code, stderr }))
  })
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

test("append-memory validates and appends a formatted item", async () => {
  const result = await runAppend(memoryPath, "decision", "test-project", "use script-backed memory writes")

  expect(result.code).toBe(0)
  const memory = await readFile(memoryPath, "utf-8")
  const lines = memory.split("\n").filter(l => l.startsWith("- "))
  expect(lines).toHaveLength(1)
  // Format: - [YYYY-MM-DD] [decision] test-project: use script-backed memory writes
  expect(lines[0]).toMatch(/^- \[\d{4}-\d{2}-\d{2}\] \[decision\] test-project: use script-backed memory writes$/)
})

test("append-memory preserves existing items and appends the new one after them", async () => {
  await seedMemory("seeded.md")

  const result = await runAppend(memoryPath, "work", "test-project", "added a fourth item")

  expect(result.code).toBe(0)
  const memory = await readFile(memoryPath, "utf-8")
  const items = memory.split("\n").filter(l => l.startsWith("- "))

  expect(items).toHaveLength(4)
  expect(items[0]).toContain("use script-backed memory writes")
  expect(items[1]).toContain("implemented initial script")
  expect(items[2]).toContain("researched bash testing patterns")
  expect(items[3]).toContain("added a fourth item")
})

test("append-memory rejects invalid tag", async () => {
  const result = await runAppend(memoryPath, "invalid-tag", "test-project", "some description")

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("Invalid tag")
  await expect(readFile(memoryPath, "utf-8")).rejects.toThrow()
})

test("append-memory rejects description over 150 characters", async () => {
  const result = await runAppend(memoryPath, "work", "test-project", "x".repeat(151))

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("exceeds 150 characters")
})

test("append-memory accepts description of exactly 150 characters", async () => {
  const result = await runAppend(memoryPath, "work", "test-project", "x".repeat(150))

  expect(result.code).toBe(0)
})

test("append-memory rejects wrong number of arguments", async () => {
  const result = await runAppend(memoryPath, "decision")

  expect(result.code).toBe(1)
  expect(result.stderr).toContain("Expected exactly four arguments")
})

test("append-memory keeps only the last 100 bullet items, dropping the oldest", async () => {
  await seedMemory("at-capacity.md")

  const result = await runAppend(memoryPath, "work", "test-project", "completed item 101")

  expect(result.code).toBe(0)
  const memory = await readFile(memoryPath, "utf-8")
  const items = memory.split("\n").filter(line => line.startsWith("- "))

  expect(items).toHaveLength(100)
  expect(items[0]).toContain("completed item 002") // oldest (item 001) dropped
  expect(items[98]).toContain("completed item 100")
  expect(items[99]).toContain("completed item 101") // newly appended
})
