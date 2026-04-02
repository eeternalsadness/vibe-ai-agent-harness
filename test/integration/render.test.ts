import { test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtemp, rm, readFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderTemplates, findTemplates } from "../../src/render"

let testOutputDir: string

beforeEach(async () => {
  testOutputDir = await mkdtemp(join(tmpdir(), "vibe-render-test-"))
})

afterEach(async () => {
  await rm(testOutputDir, { recursive: true, force: true })
})

const fixturesDir = join(import.meta.dir, "../fixtures")

const testProfile = {
  primary: { providerID: "test-provider", modelID: "test-model-1" },
  memory: { providerID: "test-provider", modelID: "test-model-2" },
  research: { providerID: "test-provider", modelID: "test-model-3" },
  knowledgeBase: { providerID: "test-provider", modelID: "test-model-4" },
  planner: { providerID: "test-provider", modelID: "test-model-5" },
  coder: { providerID: "test-provider", modelID: "test-model-6" },
  reviewer: { providerID: "test-provider", modelID: "test-model-7" },
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

test("findTemplates discovers all .md.ts files", async () => {
  // Act
  const templates = await findTemplates(fixturesDir)

  // Assert
  expect(templates.length).toBe(3) // static.md.ts, dynamic.md.ts, nested/deep.md.ts
  expect(templates.some(t => t.endsWith("static.md.ts"))).toBe(true)
  expect(templates.some(t => t.endsWith("dynamic.md.ts"))).toBe(true)
  expect(templates.some(t => t.endsWith("nested/deep.md.ts"))).toBe(true)
})

test("findTemplates ignores non-.md.ts files", async () => {
  // Act
  const templates = await findTemplates(fixturesDir)

  // Assert - should not include ignored.ts
  expect(templates.some(t => t.endsWith("ignored.ts"))).toBe(false)
})

test("renders static template as-is", async () => {
  // Act
  await renderTemplates(fixturesDir, testOutputDir, testProfile)

  // Assert
  const content = await readFile(join(testOutputDir, "static.md"), "utf-8")
  expect(content).toBe("# Static Template\n\nThis is a simple static template.\n")
})

test("renders dynamic template with profile interpolation", async () => {
  // Act
  await renderTemplates(fixturesDir, testOutputDir, testProfile)

  // Assert
  const content = await readFile(join(testOutputDir, "dynamic.md"), "utf-8")
  expect(content).toContain("test-provider/test-model-1") // primary
  expect(content).toContain("test-provider/test-model-2") // memory
})

test("preserves directory structure in output", async () => {
  // Act
  await renderTemplates(fixturesDir, testOutputDir, testProfile)

  // Assert
  const nestedExists = await fileExists(join(testOutputDir, "nested/deep.md"))
  expect(nestedExists).toBe(true)
  
  const content = await readFile(join(testOutputDir, "nested/deep.md"), "utf-8")
  expect(content).toBe("# Nested Template\n\nThis template is in a subdirectory.\n")
})

test("creates output directory if it doesn't exist", async () => {
  // Arrange
  const deepOutputDir = join(testOutputDir, "some/deep/path")

  // Act
  await renderTemplates(fixturesDir, deepOutputDir, testProfile)

  // Assert
  const exists = await fileExists(join(deepOutputDir, "static.md"))
  expect(exists).toBe(true)
})

test("renders all discovered templates", async () => {
  // Act
  await renderTemplates(fixturesDir, testOutputDir, testProfile)

  // Assert - all 3 templates should be rendered
  expect(await fileExists(join(testOutputDir, "static.md"))).toBe(true)
  expect(await fileExists(join(testOutputDir, "dynamic.md"))).toBe(true)
  expect(await fileExists(join(testOutputDir, "nested/deep.md"))).toBe(true)
})

test("different profiles produce different output for dynamic templates", async () => {
  // Arrange
  const profile1 = { ...testProfile, primary: { providerID: "provider-a", modelID: "model-a" } }
  const profile2 = { ...testProfile, primary: { providerID: "provider-b", modelID: "model-b" } }
  
  const output1 = await mkdtemp(join(tmpdir(), "vibe-test-1-"))
  const output2 = await mkdtemp(join(tmpdir(), "vibe-test-2-"))

  try {
    // Act
    await renderTemplates(fixturesDir, output1, profile1)
    await renderTemplates(fixturesDir, output2, profile2)

    // Assert
    const content1 = await readFile(join(output1, "dynamic.md"), "utf-8")
    const content2 = await readFile(join(output2, "dynamic.md"), "utf-8")
    
    expect(content1).toContain("provider-a/model-a")
    expect(content2).toContain("provider-b/model-b")
    expect(content1).not.toBe(content2)
  } finally {
    await rm(output1, { recursive: true, force: true })
    await rm(output2, { recursive: true, force: true })
  }
})
