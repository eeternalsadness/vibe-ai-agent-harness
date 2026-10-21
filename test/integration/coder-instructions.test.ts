import { test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtemp, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderTemplates } from "../../src/render"

// Plan 19 scenario coder-instructions: the rendered coder agent carries the
// unattended-run rules. Lenient, case-insensitive protocol-token checks, as
// in acceptance-criteria.test.ts.

const testProfile = {
  primary: { providerID: "test-provider", modelID: "test-model-1" },
  memory: { providerID: "test-provider", modelID: "test-model-2" },
  research: { providerID: "test-provider", modelID: "test-model-3" },
  knowledgeBase: { providerID: "test-provider", modelID: "test-model-4" },
  planner: { providerID: "test-provider", modelID: "test-model-5" },
  coder: { providerID: "test-provider", modelID: "test-model-6" },
  reviewer: { providerID: "test-provider", modelID: "test-model-7" },
}

const globalDir = join(import.meta.dir, "../../src/global")

let outputDir: string
let coder: string

beforeAll(async () => {
  outputDir = await mkdtemp(join(tmpdir(), "vibe-coder-instructions-test-"))
  await renderTemplates(globalDir, outputDir, testProfile as never)
  coder = await readFile(join(outputDir, "agents/coder/coder.md"), "utf-8")
})

afterAll(async () => {
  await rm(outputDir, { recursive: true, force: true })
})

function has(content: string, needle: string): boolean {
  return content.toLowerCase().includes(needle.toLowerCase())
}

test("coder-instructions: commits after each task whose pipeline is green, and never pushes", () => {
  expect(has(coder, "commit")).toBe(true)
  expect(has(coder, "never push")).toBe(true)
})

test("coder-instructions: installs dependencies in its working directory when needed", () => {
  expect(has(coder, "install dependencies")).toBe(true)
})

test("coder-instructions: stops and explains in its final message instead of asking the user", () => {
  expect(has(coder, "final message")).toBe(true)

  // Every place that used to ask a human must be gone.
  const asking = /\bask (the user|rather than guess|targeted questions|for clarification)/i
  expect(coder).not.toMatch(asking)
})
