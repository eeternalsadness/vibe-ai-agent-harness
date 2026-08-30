import { test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderTemplates } from "../../src/render"

// Acceptance criteria tests for plan 17: render src/global to a temp dir and
// assert the rendered planner/coder/reviewer instructions carry the
// acceptance-criteria rules. Each test maps to an ACCEPTANCE.md scenario.

let testOutputDir: string

const testProfile = {
  primary: { providerID: "test-provider", modelID: "test-model-1" },
  memory: { providerID: "test-provider", modelID: "test-model-2" },
  research: { providerID: "test-provider", modelID: "test-model-3" },
  knowledgeBase: { providerID: "test-provider", modelID: "test-model-4" },
  planner: { providerID: "test-provider", modelID: "test-model-5" },
  coder: { providerID: "test-provider", modelID: "test-model-6" },
  reviewer: { providerID: "test-provider", modelID: "test-model-7" },
}

const repoRoot = join(import.meta.dir, "../..")
const globalDir = join(repoRoot, "src/global")

beforeEach(async () => {
  testOutputDir = await mkdtemp(join(tmpdir(), "vibe-acceptance-test-"))
  await renderTemplates(globalDir, testOutputDir, testProfile as never)
})

afterEach(async () => {
  await rm(testOutputDir, { recursive: true, force: true })
})

async function readRendered(relative: string): Promise<string> {
  return readFile(join(testOutputDir, relative), "utf-8")
}

// Lenient, case-insensitive checks: these verify the instruction files carry
// the acceptance-criteria protocol tokens, not how they are worded.
function has(content: string, needle: string): boolean {
  return content.toLowerCase().includes(needle.toLowerCase())
}

test("planner-requires-acceptance-md: rendered planner requires ACCEPTANCE.md alongside PLAN.md", async () => {
  const planner = await readRendered("agents/planner/planner.md")

  expect(has(planner, "ACCEPTANCE.md")).toBe(true)
})

test("planner-defines-acceptance-format: rendered planner documents the ACCEPTANCE.md format", async () => {
  const planner = await readRendered("agents/planner/planner.md")

  // Protocol tokens only — prose may change freely
  expect(has(planner, "Given/When/Then")).toBe(true)
  expect(has(planner, "Verification")).toBe(true)
  expect(has(planner, "Out of Scope")).toBe(true)
  expect(has(planner, "[MANUAL]")).toBe(true)
})

test("planner-todo-verify-references: rendered planner describes the TODO Verify: convention", async () => {
  const planner = await readRendered("agents/planner/planner.md")

  expect(has(planner, "Verify:")).toBe(true)
})

test("coder-reads-acceptance-and-self-verifies: rendered coder reads ACCEPTANCE.md and self-verifies", async () => {
  const coder = await readRendered("agents/coder/coder.md")

  expect(has(coder, "ACCEPTANCE.md")).toBe(true)
  expect(has(coder, "Verify:")).toBe(true)
})

test("reviewer-validates-tests-encode-criteria: rendered reviewer validates tests encode acceptance criteria", async () => {
  const reviewer = await readRendered("agents/reviewer/reviewer.md")

  expect(has(reviewer, "ACCEPTANCE.md")).toBe(true)
})
