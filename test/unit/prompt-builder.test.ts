import { test, expect, describe } from "bun:test"
import { buildEvaluationPrompt } from "../../src/platforms/opencode/plugins/prompt-builder"

describe("buildEvaluationPrompt", () => {
  test("section structure - New Since Last Evaluation appears before Recent Memory Items", () => {
    const prompt = buildEvaluationPrompt("", "[user]: hello", "# Memory\n\n- item")

    const newIdx = prompt.indexOf("## New Since Last Evaluation")
    const memoryIdx = prompt.indexOf("## Recent Memory Items")

    expect(newIdx).toBeGreaterThanOrEqual(0)
    expect(memoryIdx).toBeGreaterThan(newIdx)
  })

  test("new-only shape - old content is omitted from the prompt", () => {
    const prompt = buildEvaluationPrompt("[user]: old message", "[user]: new message", "# Memory\n\n")

    const newIdx = prompt.indexOf("## New Since Last Evaluation")
    const newContentIdx = prompt.indexOf("[user]: new message")

    expect(prompt).not.toContain("## Previously Evaluated")
    expect(prompt).not.toContain("[user]: old message")
    expect(newContentIdx).toBeGreaterThan(newIdx)
  })

  test("no overlap — old segment text never appears after the New Since Last Evaluation header, new segment text never appears before it", () => {
    const prompt = buildEvaluationPrompt("[user]: only in old", "[user]: only in new", "# Memory\n\n")
    const newIdx = prompt.indexOf("## New Since Last Evaluation")

    const beforeNew = prompt.slice(0, newIdx)
    const afterNew = prompt.slice(newIdx)

    expect(beforeNew).not.toContain("only in old")
    expect(beforeNew).not.toContain("only in new")
    expect(afterNew).not.toContain("only in old")
    expect(afterNew).toContain("only in new")
  })

  test("first-eval shape - empty previously-evaluated input omits the Previously Evaluated section entirely", () => {
    const prompt = buildEvaluationPrompt("", "[user]: hello", "# Memory\n\n")

    expect(prompt).not.toContain("## Previously Evaluated")
    expect(prompt).toContain("## New Since Last Evaluation")
    expect(prompt).toContain("[user]: hello")
  })

  test("recent memory is capped to the latest 20 bullet items", () => {
    const memory = `# Memory\n\n${Array.from({ length: 25 }, (_, i) => `- item-${i + 1}`).join("\n")}\n`
    const prompt = buildEvaluationPrompt("[user]: old", "[user]: new", memory)
    const recentSection = prompt.slice(prompt.indexOf("## Recent Memory Items")).split("\n")

    expect(recentSection).not.toContain("- item-1")
    expect(recentSection).not.toContain("- item-5")
    expect(recentSection).toContain("- item-6")
    expect(recentSection).toContain("- item-25")
  })
})
