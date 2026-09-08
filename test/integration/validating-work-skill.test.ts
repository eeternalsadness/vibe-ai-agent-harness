import { test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderTemplates } from "../../src/render"

// Acceptance criteria tests for plan 18: render src/global to a temp dir and
// assert the rendered validating-work skill and coder instructions carry the
// self-verification loop. Each test maps to an ACCEPTANCE.md scenario.

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
  testOutputDir = await mkdtemp(join(tmpdir(), "vibe-validating-work-test-"))
  await renderTemplates(globalDir, testOutputDir, testProfile as never)
})

afterEach(async () => {
  await rm(testOutputDir, { recursive: true, force: true })
})

async function readRendered(relative: string): Promise<string> {
  return readFile(join(testOutputDir, relative), "utf-8")
}

// Lenient, case-insensitive checks: these verify the instruction files carry
// the self-verification protocol tokens, not how they are worded.
function has(content: string, needle: string): boolean {
  return content.toLowerCase().includes(needle.toLowerCase())
}

test("pipeline-skill-defines-loop: rendered validating-work skill describes the run-verify-loop-until-green workflow and points at the runner script", async () => {
  const skill = await readRendered("skills/validating-work/SKILL.md")

  expect(has(skill, "pipeline")).toBe(true)
  expect(has(skill, "loop")).toBe(true)
  expect(has(skill, "green")).toBe(true)
  expect(has(skill, "pipeline_runner.py")).toBe(true)
})

test("coder-loads-pipeline-skill: rendered coder instructions load validating-work to self-verify before advancing or handing off", async () => {
  const coder = await readRendered("agents/coder/coder.md")

  expect(has(coder, "validating-work")).toBe(true)
})
