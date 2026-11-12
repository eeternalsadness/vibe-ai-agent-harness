import { config } from "../../../../config"

export default `---
name: writing-plans
description: Use before any planning work - gathering requirements, determining scope and complexity, and writing the plan files. Defines the planning workflow, research and context, and directory auto-numbering. The plan file formats live in reference/plan-format.md.
---

# Writing Plans

## Workflow

Follow these steps in order for every planning session:

1. **Requirements** - Hash out what the user wants. Ask clarifying questions until you understand the problem, goals, and constraints. **Dig deeper than the surface request.** Uncover the real problem, the context around it, why existing solutions won't work, and what success actually looks like. Do not proceed until the picture is clear.

2. **Scope** - Ask the user: project-level plan (stored in \`.agents/plans/\`) or global plan (stored in \`${config.repoPath}/vibe-coding/vibe-context/plans/\`)?

3. **Complexity** - Decide whether the task is complex enough to warrant an IMPLEMENTATION.md (detailed step-by-step breakdown). **State your recommendation with reasoning.** Be opinionated - if the task is complex, say so and why. If the user is overcomplicating something simple, push back. The user can disagree, but make your case.
   - Simple: PLAN.md + ACCEPTANCE.md + TODO.md
   - Complex: PLAN.md + ACCEPTANCE.md + IMPLEMENTATION.md + TODO.md

4. **Write files** - Determine the next directory number by reading existing directories in the target location, including its \`archive/\` subdirectory if present (see Auto-numbering). Create the directory and write the files. **Every plan must include an \`ACCEPTANCE.md\` file alongside \`PLAN.md\` - no exceptions.** A plan means work significant enough to define done, and done is defined by acceptance criteria, not by a human eyeballing a diff. Always ask the user for approval before writing each file - user approval means the plan is good.

5. **Review** - Walk the user through what was written. Discuss and reach consensus. Update files if needed.

## Research and Context

Before making recommendations or writing plans, **load the \`researching-knowledge\` skill** for anything you are not absolutely certain about. You need to understand:
- Whether similar patterns or decisions exist in the knowledge base
- The existing architecture and how the proposed change fits
- Documented constraints, conventions, or prior attempts
- Related systems that might be affected

Do not make plans in a vacuum. Ground your recommendations in what actually exists. If you're uncertain about technical details, architecture, or feasibility, load the \`researching-knowledge\` skill before proceeding.

## Auto-numbering

Numbering is flat and global - finished plans move to \`archive/\` but keep their number, so archived plans still count toward the sequence.

Before creating a directory, list existing directories in the target location **and** its \`archive/\` subdirectory (if present) to find the highest existing number across both. Use the next number. If no directories exist in either location, start at \`01\`.
`
