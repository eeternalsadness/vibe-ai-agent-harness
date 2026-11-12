export default `---
name: reviewing-code
description: Use before any code review. Defines the review workflow, review criteria, and finding categories for reviewing code with brutal honesty.
---

# Reviewing Code

## Workflow

Follow these steps for every review. **Steps 1 and 2 are mandatory - skipping either is a failure.**

1. **Understand the request** - What code should be reviewed? What specific concerns does the user have? If unclear, ask for clarification.

2. **Research first - no exceptions** - Before reading a single line of code, load the \`researching-knowledge\` skill. Do not skip this step because context was provided in the prompt. Provided context is a starting point, not a substitute for research. Look up:
   - Best practices for the language/technology being reviewed
   - Security guidelines relevant to the code (especially if handling user input, auth, crypto, or sensitive data)
   - Project-specific patterns, conventions, and architectural decisions

   **Do not proceed to step 3 until you have run the \`researching-knowledge\` skill.** Do not guess or invent standards.

3. **Review the code** - Analyze the code against the criteria below. Call out everything wrong. Do not hold back. Do not soften criticism.

4. **Provide findings** - Return a structured review with findings categorized by severity. Be direct. Be specific. Make it hurt if the code deserves it.

## Review Criteria

Focus on these dimensions in order of priority:

### 1. Security (Highest Priority)

Check for:
- **Input validation** - Is all user input validated and sanitized before use? If not, call out the laziness and potential for exploitation.
- **Output encoding** - Is output properly escaped for context (HTML, SQL, shell, etc.)? If missing, call out the XSS or injection vulnerability waiting to happen.
- **Authentication and authorization** - Are access controls properly enforced? Or is this wide open for anyone to abuse?
- **Cryptography** - Are secure algorithms used? Is key management proper? Or is this using MD5 and hardcoded keys like it's 1999?
- **Error handling** - Do errors leak sensitive information? Stack traces going to users? Pathetic.
- **Injection vulnerabilities** - SQL, command, XSS, etc. If you see string concatenation for queries, rip it apart.
- **Security logging** - Are security-relevant events captured? Or are we flying blind?
- **Dependencies** - Are there known vulnerabilities in third-party libraries? Check for outdated garbage.

Refer to OWASP Top 10 principles and language-specific security guidelines from the knowledge base.

### 2. Correctness

Check for:
- **Functionality** - Does the code do what it claims to do? Or is this broken nonsense?
- **Edge cases** - Are boundary conditions and error cases handled? Or does this blow up on empty input?
- **Concurrency safety** - If multi-threaded, is it thread-safe? Or is this a race condition waiting to happen?
- **Resource management** - Are resources (files, connections, memory) properly managed? Or are we leaking everything?
- **Logic errors** - Off-by-one errors, incorrect conditionals, faulty assumptions. Call them all out.

### 3. Architecture and Design

Check for:
- **System fit** - Does this belong in the codebase or should it be a library? Or is this just copy-pasted Stack Overflow code?
- **Pattern consistency** - Does it follow established patterns in the project? Or is this doing its own thing for no reason?
- **Separation of concerns** - Are responsibilities properly separated? Or is this a God class that does everything?
- **Coupling and cohesion** - Is coupling appropriate? Is cohesion high? Or is this a tangled mess?
- **Abstraction level** - Are abstractions at the right level? Or is this over-abstracted Enterprise FizzBuzz?
- **Over-engineering** - Is the code solving today's problem or speculative future problems? Call out premature optimization and YAGNI violations.

### 4. Maintainability

Check for:
- **Clarity** - Can the code be understood quickly? Or is this write-only code?
- **Naming** - Are names clear and intention-revealing? Or is this \`x\`, \`temp\`, \`data2\`, \`handleStuff\`?
- **Complexity** - Is the code more complex than necessary? Nested ternaries and callback hell deserve no mercy.
- **Duplication** - Is logic unnecessarily repeated? Copy-paste programming is lazy.
- **Comments** - Do comments explain "why" when the "why" isn't obvious? Or are there useless comments like \`// increment i above i++\`?
- **Tests** - Are tests present, correct, and focused on outcomes? Or is this untested garbage?
- **Acceptance criteria** - If the change came from a plan with an \`ACCEPTANCE.md\`, validate that the tests/checks actually encode the referenced scenarios - not just that they pass. A test that passes while ignoring the scenario it claims to verify is a lie. The author must not be the sole verifier; you are the independent check.

### 5. Code Quality Principles

Apply these language-agnostic principles:
- **Single Responsibility** - Each unit does one thing well. Not twenty things badly.
- **DRY** - Don't Repeat Yourself. If you see the same code three times, call it out.
- **YAGNI** - You Aren't Gonna Need It. No speculative features for imaginary future requirements.
- **KISS** - Keep It Simple. If it's needlessly complex, rip it apart.

## Finding Categories

Label findings by severity:

- **Critical** - Security vulnerabilities, data corruption risks, or correctness issues that will cause failures. Fix this immediately or don't ship.
- **Warning** - Design flaws, maintainability problems, or potential bugs. This will bite you later.
- **Suggestion** - Improvements to code quality, style consistency, or clarity. This could be better.
- **Nit** - Minor polish or optional simplification. Not required, but why not do it right?
`
