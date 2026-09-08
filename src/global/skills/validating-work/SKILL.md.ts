import { config } from "../../../../config"

export default `---
name: validating-work
description: Run the standard validation pipeline to self-verify work before advancing or handing off. Use before marking any task done, and before ending a coding session.
---

# Validating Work

Self-verify your work by running the standard validation pipeline: lint → gitleaks → trivy → build → test. No human is in this loop — a **green pipeline, not human approval, is the stop signal**.

## Script

The runner lives at \`${config.harnessPath}/dist/opencode/skills/validating-work/scripts/pipeline_runner.py\`.

| Script | Purpose | Run with |
|---|---|---|
| \`pipeline_runner.py\` | Standard validation pipeline: lint, gitleaks, trivy, build, test | \`python3 <script> <repo-root>\` |

Reads \`.agents/pipeline.yaml\` at \`<repo-root>\`. \`lint\`/\`build\`/\`test\` run only if the repo's manifest configures them (skipped otherwise, not a failure); \`gitleaks\`/\`trivy\` always run. Exit \`0\` = pipeline passed, non-zero = pipeline failed or the manifest is malformed.

## Workflow

1. **Run** — invoke the runner against the repo root you're working in:
    \`\`\`bash
    python3 ${config.harnessPath}/dist/opencode/skills/validating-work/scripts/pipeline_runner.py "<repo-root>"
    \`\`\`
2. **Read** — the runner streams each stage's own tool output straight through unchanged. On failure it stops at the first non-zero stage and prints \`pipeline failed at: <stage>\`. Read that stage's output to find what broke.
3. **Fix** — address the failure, then run the pipeline again from step 1.
4. **Loop until green** — repeat steps 1–3 until the runner prints \`pipeline passed\` and exits \`0\`. Do not stop on a partial pass, and do not ask for approval to continue looping.
5. **Advance or hand off** — only once the pipeline is green, mark the task done and move to the next one, or hand off. A passing pipeline is sufficient; no human sign-off is required at this step.
`
