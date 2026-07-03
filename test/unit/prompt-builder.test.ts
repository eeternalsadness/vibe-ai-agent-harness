import { test, expect, describe } from "bun:test"
import { buildEvaluationPrompt } from "../../src/platforms/opencode/plugins/prompt-builder"

describe("buildEvaluationPrompt", () => {
  test("section structure — New Since Last Evaluation appears before Existing Memory", () => {
    const prompt = buildEvaluationPrompt("", "[user]: hello", "# Memory\n\n- item")

    const newIdx = prompt.indexOf("## New Since Last Evaluation")
    const memoryIdx = prompt.indexOf("## Existing Memory")

    expect(newIdx).toBeGreaterThanOrEqual(0)
    expect(memoryIdx).toBeGreaterThan(newIdx)
  })

  test("marker split — old content lands under Previously Evaluated, new content lands under New Since Last Evaluation", () => {
    const prompt = buildEvaluationPrompt("[user]: old message", "[user]: new message", "# Memory\n\n")

    const prevIdx = prompt.indexOf("## Previously Evaluated (context only)")
    const newIdx = prompt.indexOf("## New Since Last Evaluation")
    const oldContentIdx = prompt.indexOf("[user]: old message")
    const newContentIdx = prompt.indexOf("[user]: new message")

    expect(prevIdx).toBeGreaterThanOrEqual(0)
    expect(oldContentIdx).toBeGreaterThan(prevIdx)
    expect(oldContentIdx).toBeLessThan(newIdx)
    expect(newContentIdx).toBeGreaterThan(newIdx)
  })

  test("no overlap — old segment text never appears after the New Since Last Evaluation header, new segment text never appears before it", () => {
    const prompt = buildEvaluationPrompt("[user]: only in old", "[user]: only in new", "# Memory\n\n")
    const newIdx = prompt.indexOf("## New Since Last Evaluation")

    const beforeNew = prompt.slice(0, newIdx)
    const afterNew = prompt.slice(newIdx)

    expect(beforeNew).toContain("only in old")
    expect(beforeNew).not.toContain("only in new")
    expect(afterNew).not.toContain("only in old")
    expect(afterNew).toContain("only in new")
  })

  test("first-eval shape — empty previously-evaluated input omits the Previously Evaluated section entirely", () => {
    const prompt = buildEvaluationPrompt("", "[user]: hello", "# Memory\n\n")

    expect(prompt).not.toContain("## Previously Evaluated")
    expect(prompt).toContain("## New Since Last Evaluation")
    expect(prompt).toContain("[user]: hello")
  })

  test("context preserved — old content is relocated, not dropped", () => {
    const prompt = buildEvaluationPrompt("[user]: important context", "[user]: new turn", "# Memory\n\n")

    expect(prompt).toContain("important context")
  })
})
