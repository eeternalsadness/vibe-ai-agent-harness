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

- [x] `[[AI Fundamentals & LLMs]]` — removed from AI Agents for DevOps Overview.md
- [x] `[[Agent Engineering Glossary]]` — removed from Advanced Skill Patterns.md and Common Skill Patterns.md
- [x] `[[Agent Skill Design Principles]]` — removed from Advanced Skill Patterns.md and Common Skill Patterns.md
- [x] `[[Agent Tool Comparison]]` — removed from Advanced Skill Patterns.md
- [x] `[[ArgoCD Application Resource|Applications]]` — rephrased in ArgoCD ApplicationSets.md
- [x] `[[ArgoCD Core Concepts|AppProject]]` — rephrased in ArgoCD Application Resource.md
- [x] `[[ArgoCD on AWS EKS via Akuity]]` — removed from all 5 notes; Akuity section removed from ArgoCD Deployment Options on AWS EKS.md
- [x] `[[CI/CD Patterns]]` — removed from MCP CI-CD Integration.md
- [x] `[[Classifier Based Permissions]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[Cloud Cost Optimization]]` — removed from MCP Cloud Infrastructure Management.md
- [x] `[[Code Review Best Practices]]` — removed from AI Security Output Verification.md
- [x] `[[Data Classification]]` — removed from AI Security Input Validation.md
- [x] `[[DevOps AI Guidelines Framework]]` — removed from AI Readiness Assessment Overview.md, AI Team Implementation Roadmap.md, DevOps AI Prompts Library.md
- [x] `[[DevOps Prompt Automation Script Builder]]` — deleted hub note (10 Essential AI Prompts for DevOps.md); removed backlinks from AI.md, DevOps AI.md, Prompt Engineering.md
- [x] `[[DevOps Prompt Cost Optimization Detective]]` — same
- [x] `[[DevOps Prompt Disaster Recovery Planner]]` — same
- [x] `[[DevOps Prompt Incident Response Commander]]` — same
- [x] `[[DevOps Prompt Infrastructure Audit]]` — same
- [x] `[[DevOps Prompt Kubernetes Troubleshooter]]` — same
- [x] `[[DevOps Prompt Monitoring Architect]]` — same
- [x] `[[DevOps Prompt Performance Optimizer]]` — same
- [x] `[[DevOps Prompt Production-Ready Code Generator]]` — same
- [x] `[[DevOps Prompt Security Compliance Auditor]]` — same
- [x] `[[Document Stores]]` — removed from Knowledge Base Solutions for AI Agents.md
- [x] `[[EKS Auto Mode]]` — removed from EKS Capabilities.md
- [x] `[[Harness vs Framework]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[Incident Response Procedures]]` — removed from AI Security Compliance Monitoring.md
- [x] `[[Initializer Coding Pattern]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[Kubernetes Operations]]` — removed from MCP Kubernetes Management.md
- [x] `[[Loft Platform]]` — removed from Virtual Cluster Approach (vcluster).md
- [x] `[[Long Running Harness Design]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[MCP CI/CD Integration]]` — fixed to [[MCP CI-CD Integration]] in MCP DevOps Use Cases.md
- [x] `[[Multi Agent Orchestration]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[Nexu Windows Packaging]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[OpenCode Agent Skills]]` — removed from Advanced Skill Patterns.md and Common Skill Patterns.md
- [x] `[[OpenCode Plugin Background Agent Patterns]]` — removed from OpenCode Plugin Session Lifecycle Management.md
- [x] `[[OpenCode Plugin Custom Tool Patterns]]` — removed from OpenCode Plugin SDK Tool Context.md
- [x] `[[OpenCode Plugin Session Management Patterns]]` — removed from OpenCode Plugin Session Abort vs Delete.md
- [x] `[[OpenCode Primary Agents — Declaration, Switching, and Per-Agent Model Configuration]]` — fixed em dash to hyphen in OpenCode Agent Types.md and OpenCode Agents.md
- [x] `[[OpenCode Session]]` — rephrased inline in OpenCode Plugin Session Lifecycle Hooks.md
- [x] `[[Prometheus]]` — removed from MCP Monitoring and Observability.md
- [x] `[[Prompt A/B Testing]]` — removed from Prompt Debugging and Optimization.md and Prompt Iterative Optimization.md
- [-] `[[REMEMBER: ...]]` — inside code block in Claude Code Hook Patterns.md, not a real link
- [x] `[[Sandboxing]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[Sub Agent]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[TurboQuant]]` — removed from KV Cache Compression Rotation Variants.md
- [x] `[[What Is a Harness]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[Your First Harness]]` — removed from Nexu Engineering Guide.md (note deleted)
- [x] `[[tmux Copy Mode and Clipboard]]` — removed from tmux.md
- [x] `[[tmux Key Concepts]]` — removed from tmux.md
- [x] `[[tmux Useful Commands]]` — removed from tmux.md

---

## Task 2: Reattach orphans

These notes exist but are not reachable from `Index.md`. Find the correct parent and add a `[[wiki-link]]`.

- [x] `OpenCode Permission Troubleshooting.md` — linked from OpenCode Agent Permissions Quick Reference.md
- [x] `OpenCode Plugin Rate Limiting.md` — deleted (duplicate of OpenCode Plugin Rate Limiting and Caching.md)
- [x] `OpenCode Plugin Response Caching.md` — deleted (duplicate)
- [x] `OpenCode Primary Agents - Declaration, Switching, and Per-Agent Model Configuration.md` — linked from OpenCode Agents Creation.md

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
