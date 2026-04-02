# Code Reviewer Agent

## Problem

The harness currently has coder and planner agents, but no way to verify code quality, security, or architectural fit. Users need a way to get expert review feedback on code without manually checking against best practices or hunting through knowledge base notes.

## Goals

Create a reviewer subagent that:
- Handles ad-hoc code review requests (files, functions, snippets)
- Analyzes current state of code (no git history unless user asks)
- Focuses on high-level concerns: correctness, security (priority), architectural fit
- Provides advisory findings with reasoning (not blocking/enforcing)
- Leverages global best practices (knowledge base) + project-specific conventions (repo)
- Works across languages and technologies (not TypeScript-specific)

## Design Decisions

**Subagent, not primary agent**
Reviewer is invoked by primary agents or explicitly by user. No automatic integration into coder workflow (keeps it simple and flexible).

**Advisory, not prescriptive**
Returns findings categorized by severity (critical/warning/suggestion) with reasoning. User decides what to act on. No auto-fixes, no blocking.

**Security as priority focus**
Given existing knowledge base coverage of AI security guidelines (input validation, output verification, data handling), security analysis is the highest-value contribution.

**Research-first approach**
Before reviewing, delegate to @research to gather:
- Relevant best practices from knowledge base (language-specific standards, security, testing)
- Project-specific patterns and conventions
- Architecture context for the code being reviewed

**Current-state analysis**
Reviews the code as it exists now. No diff analysis or git history unless user explicitly requests it (keeps scope tight).

**Language-agnostic design**
Agent adapts review criteria based on the language/technology being reviewed. Leverages knowledge base for language-specific best practices when available, applies general software engineering principles otherwise.
