# KB Maintenance

Audit run: 2026-05-21

Stats:
- 739 total notes
- 82 notes over 100 lines
- 4 orphans (not reachable from Index.md)
- 50 dangling links (link targets with no corresponding .md file)

Legend: `[ ]` pending · `[x]` done · `[-]` skipped

---

## Task 1: Fix dangling links

These `[[wiki-links]]` appear in notes but have no corresponding `.md` file. For each: create the missing note if the topic warrants one (linked into the graph), or remove the link if it's spurious.

- [ ] `[[AI Fundamentals & LLMs]]`
- [ ] `[[Agent Engineering Glossary]]`
- [ ] `[[Agent Skill Design Principles]]`
- [ ] `[[Agent Tool Comparison]]`
- [ ] `[[ArgoCD Application Resource|Applications]]`
- [ ] `[[ArgoCD Core Concepts|AppProject]]`
- [ ] `[[ArgoCD on AWS EKS via Akuity]]`
- [ ] `[[CI/CD Patterns]]`
- [ ] `[[Classifier Based Permissions]]`
- [ ] `[[Cloud Cost Optimization]]`
- [ ] `[[Code Review Best Practices]]`
- [ ] `[[Data Classification]]`
- [ ] `[[DevOps AI Guidelines Framework]]`
- [ ] `[[DevOps Prompt Automation Script Builder]]`
- [ ] `[[DevOps Prompt Cost Optimization Detective]]`
- [ ] `[[DevOps Prompt Disaster Recovery Planner]]`
- [ ] `[[DevOps Prompt Incident Response Commander]]`
- [ ] `[[DevOps Prompt Infrastructure Audit]]`
- [ ] `[[DevOps Prompt Kubernetes Troubleshooter]]`
- [ ] `[[DevOps Prompt Monitoring Architect]]`
- [ ] `[[DevOps Prompt Performance Optimizer]]`
- [ ] `[[DevOps Prompt Production-Ready Code Generator]]`
- [ ] `[[DevOps Prompt Security Compliance Auditor]]`
- [ ] `[[Document Stores]]`
- [ ] `[[EKS Auto Mode]]`
- [ ] `[[Harness vs Framework]]`
- [ ] `[[Incident Response Procedures]]`
- [ ] `[[Initializer Coding Pattern]]`
- [ ] `[[Kubernetes Operations]]`
- [ ] `[[Loft Platform]]`
- [ ] `[[Long Running Harness Design]]`
- [ ] `[[MCP CI/CD Integration]]`
- [ ] `[[Multi Agent Orchestration]]`
- [ ] `[[Nexu Windows Packaging]]`
- [ ] `[[OpenCode Agent Skills]]`
- [ ] `[[OpenCode Plugin Background Agent Patterns]]`
- [ ] `[[OpenCode Plugin Custom Tool Patterns]]`
- [ ] `[[OpenCode Plugin Session Management Patterns]]`
- [ ] `[[OpenCode Primary Agents — Declaration, Switching, and Per-Agent Model Configuration]]`
- [ ] `[[OpenCode Session]]`
- [ ] `[[Prometheus]]`
- [ ] `[[Prompt A/B Testing]]`
- [ ] `[[REMEMBER: ...]]`
- [ ] `[[Sandboxing]]`
- [ ] `[[Sub Agent]]`
- [ ] `[[TurboQuant]]`
- [ ] `[[What Is a Harness]]`
- [ ] `[[Your First Harness]]`
- [ ] `[[tmux Copy Mode and Clipboard]]`
- [ ] `[[tmux Key Concepts]]`
- [ ] `[[tmux Useful Commands]]`

---

## Task 2: Reattach orphans

These notes exist but are not reachable from `Index.md`. Find the correct parent and add a `[[wiki-link]]`.

- [ ] `OpenCode Permission Troubleshooting.md`
- [ ] `OpenCode Plugin Rate Limiting.md`
- [ ] `OpenCode Plugin Response Caching.md`
- [ ] `OpenCode Primary Agents - Declaration, Switching, and Per-Agent Model Configuration.md`

---

## Task 3: Split oversized notes

For each note: trim first while retaining all relevant details. If trimming is not enough, split into smaller atomic notes and update parent links. Table of contents is a last resort.

- [ ] `TypeScript Unit Testing.md` (820 lines)
- [ ] `TypeScript Test Organization Patterns.md` (577 lines)
- [ ] `Testing File IO Operations - Mocking vs Temp Directories.md` (558 lines)
- [ ] `OpenCode Plugin Development Best Practices.md` (528 lines)
- [ ] `TypeScript Best Practices.md` (503 lines)
- [ ] `OpenCode Plugin SDK Troubleshooting.md` (502 lines)
- [ ] `AWS Security Best Practices for Terraform.md` (477 lines)
- [ ] `Bun Test Runner Overview.md` (442 lines)
- [ ] `OpenCode Plugin Session Lifecycle Management.md` (429 lines)
- [ ] `Testing Template Rendering Logic.md` (421 lines)
- [ ] `OpenCode Plugin SDK Tool Context.md` (366 lines)
- [ ] `AWS Provider v6 Breaking Changes and Deprecated Arguments.md` (334 lines)
- [ ] `OpenCode Plugin SDK Hook Reference.md` (329 lines)
- [ ] `Claude Code Hook Patterns.md` (321 lines)
- [ ] `OpenCode Plugin SDK Client API.md` (314 lines)
- [ ] `CIS AWS Foundations Benchmark v2.0 for Infrastructure Code.md` (312 lines)
- [ ] `AI.md` (301 lines)
- [ ] `Crossplane Connection Details and Readiness Checks.md` (299 lines)
- [ ] `GitHub Actions for Ephemeral Environments.md` (294 lines)
- [ ] `Crossplane Function Patch and Transform.md` (279 lines)
- [ ] `In-Context Memory vs External Knowledge Bases.md` (276 lines)
- [ ] `Kubernetes TTL and Cleanup Mechanisms.md` (274 lines)
- [ ] `Crossplane for Ephemeral Infrastructure.md` (259 lines)
- [ ] `Knowledge Base Scaling and Performance.md` (257 lines)
- [ ] `RAG Architecture Overview.md` (255 lines)
- [ ] `Kratix for Ephemeral Environments.md` (237 lines)
- [ ] `Garden.io for Local and Remote Environments.md` (233 lines)
- [ ] `AWS WebSocket Connection Cost Calculation Examples.md` (233 lines)
- [ ] `Managed vs Self-Hosted Knowledge Bases.md` (229 lines)
- [ ] `OpenCode Plugin SDK Overview.md` (223 lines)
- [ ] `Embedding Models Overview.md` (222 lines)
- [ ] `Vector Database Overview.md` (216 lines)
- [ ] `AWS ECS Fargate Task Networking.md` (215 lines)
- [ ] `Terraform Module Design.md` (214 lines)
- [ ] `Helm-Based Application Delivery.md` (209 lines)
- [ ] `Terraform State Management.md` (208 lines)
- [ ] `OpenCode Plugin Debugging.md` (201 lines)
- [ ] `Ephemeral Environment Patterns.md` (201 lines)
- [ ] `Terraform Testing.md` (195 lines)
- [ ] `Composition Functions Overview.md` (191 lines)
- [ ] `Hybrid Rendering Architectures.md` (190 lines)
- [ ] `Terraform Best Practices.md` (188 lines)
- [ ] `Testkube for Ephemeral Environments.md` (177 lines)
- [ ] `Flux for GitOps.md` (175 lines)
- [ ] `Local Development Environments.md` (169 lines)
- [ ] `Claude Code Agent Patterns.md` (167 lines)
- [ ] `Composition Function Pipelines.md` (165 lines)
- [ ] `AWS Lambda Best Practices.md` (165 lines)
- [ ] `Terraform Resource Lifecycle.md` (164 lines)
- [ ] `Composite Resource Claims.md` (161 lines)
- [ ] `Document Database Patterns.md` (156 lines)
- [ ] `Argo Workflows for Ephemeral Environments.md` (151 lines)
- [ ] `Shipwright for Ephemeral Environments.md` (146 lines)
- [ ] `Composition Function Development.md` (145 lines)
- [ ] `Porter for Ephemeral Environments.md` (143 lines)
- [ ] `Small Language Models.md` (140 lines)
- [ ] `OpenCode Plugin Patterns.md` (139 lines)
- [ ] `IAM Role Chaining and Delegation.md` (136 lines)
- [ ] `Claude Code Hooks.md` (134 lines)
- [ ] `Graph Database Patterns.md` (133 lines)
- [ ] `Claude Code Slash Commands.md` (133 lines)
- [ ] `Virtual Environment Approaches.md` (131 lines)
- [ ] `Terraform Provider Configuration.md` (128 lines)
- [ ] `ArgoCD ApplicationSet.md` (127 lines)
- [ ] `Telepresence for Local Development.md` (126 lines)
- [ ] `llama-server CLI Reference.md` (119 lines)
- [ ] `XRD Field Validation.md` (117 lines)
- [ ] `Llama.cpp Overview.md` (117 lines)
- [ ] `ArgoCD App of Apps Pattern.md` (114 lines)
- [ ] `OpenCode Plugin Initialization.md` (113 lines)
- [ ] `aws_kinesis_firehose_delivery_stream Terraform Resource.md` (113 lines)
- [ ] `ArgoCD GitOps Workflow.md` (113 lines)
- [ ] `ArgoCD Core Concepts.md` (110 lines)
- [ ] `Composite Resource Composition.md` (104 lines)
- [ ] `Namespace-Per-PR Environment Pattern.md` (102 lines)
- [ ] `Kinesis Data Streams Overview.md` (102 lines)
- [ ] `Composition Function Error Handling.md` (102 lines)
- [ ] `ArgoCD Sync Policies.md` (102 lines)
- [ ] `Why Use a Knowledge Base.md` (101 lines)
- [ ] `Qwen3.6-27B.md` (101 lines)
- [ ] `Ollama Overview.md` (101 lines)
