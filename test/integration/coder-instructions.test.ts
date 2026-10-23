import { test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtemp, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderTemplates } from "../../src/render"

// Plan 19 and plan 20 scenario coder-instructions: the rendered coder agent
// carries the unattended-run rules and the decisions-file rules. Lenient, case-insensitive protocol-token checks, as
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

test("coder-instructions: resolves ambiguity itself and never asks the user", () => {
  // Every place that used to ask a human, or stop and wait, must be gone.
  const asking = /\bask (the user|rather than guess|targeted questions|for clarification)/i
  expect(coder).not.toMatch(asking)
  expect(coder).not.toMatch(/stop and explain/i)
})

test("coder-instructions: records decisions in .agents/DECISIONS.md and never commits it", () => {
  expect(has(coder, ".agents/DECISIONS.md")).toBe(true)
  expect(coder).toMatch(/never commit `?\.agents\/DECISIONS\.md/i)
  expect(coder).toMatch(/no longer hold/i)
})

test("coder-instructions: no longer keeps decisions in the plan directory or the final message", () => {
  expect(coder).not.toMatch(/DECISIONS\.md`? in the plan directory/i)
  expect(coder).not.toMatch(/final message instead/i)
})

test("coder-instructions: the ad-hoc workflow commits once the pipeline is green", () => {
  const start = coder.indexOf("## Workflow — Ad-hoc Mode")
  expect(start).toBeGreaterThan(-1)
  const rest = coder.slice(start + 1)
  const next = rest.indexOf("\n## ")
  const adhoc = next === -1 ? rest : rest.slice(0, next)

  expect(has(adhoc, "commit")).toBe(true)
})
