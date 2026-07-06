# Foundation Interview Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first publishable phase of the 100k-word LLM interview foundation expansion.

**Architecture:** Reuse the existing VitePress documentation structure. Add one interview hub page for foundation requirements, add four engineering gap pages, strengthen the Agent evaluation page, and connect everything through navigation, real questions, and the 2026 job-market map.

**Tech Stack:** VitePress 1.x, Markdown, existing `docs/.vitepress/config.mts` navigation.

---

### Task 1: Foundation Requirements Hub

**Files:**
- Create: `docs/interview/foundation-requirements.md`
- Modify: `docs/interview/real-questions.md`
- Modify: `docs/interview/job-market-2026.md`

- [x] **Step 1: Create the foundation hub page**

Create `docs/interview/foundation-requirements.md` with these sections:

- `# 大模型基础篇岗位要求总纲`
- `## 面试先背这几句话`
- `## 12 类 Boss/JD 高频技能矩阵`
- `## 按岗位方向怎么准备`
- `## 12 类技能高频追问`
- `## 项目讲法模板`
- `## 4 周基础篇补齐路线`
- `## 站内学习路径`

The page must map these 12 skills to interview requirements and station links:

1. Spring AI 与 Java AI 工程 -> `/engineering/spring-ai`
2. LangChain 应用编排 -> `/engineering/langchain`
3. LangGraph 状态图 Agent -> `/engineering/langgraph`
4. Agent 基础与多步任务 -> `/agent/agent-basics`
5. RAG 与知识库 -> `/rag/rag-basics`
6. Dify 与低代码工作流 -> `/engineering/dify-workflow`
7. 智能工作流与业务编排 -> `/agent/workflow`
8. Function Calling / Tool Calling / MCP -> `/agent/function-calling-mcp`
9. SFT / PEFT / LoRA / QLoRA -> `/finetuning/finetuning`
10. RLHF / DPO / 偏好优化 -> `/finetuning/rlhf`
11. MaaS 平台与模型服务治理 -> `/engineering/maas-platform`
12. Agent 评测、安全与合规 -> `/agent/agent-evaluation`

- [x] **Step 2: Add foundation questions to real questions**

In `docs/interview/real-questions.md`, add a section named `## 基础篇 12 类高频追问` near the existing job-driven questions. Include one compact question cluster for each of the 12 skills above, and link each cluster to the relevant page.

- [x] **Step 3: Link the hub from job-market page**

In `docs/interview/job-market-2026.md`, add a short section after the existing JD mapping table:

- Explain that foundation skills are now prepared through the new hub.
- Link to `./foundation-requirements`.
- Include a compact “先补基础，再讲系统设计” transition.

### Task 2: Spring AI Engineering Page

**Files:**
- Create: `docs/engineering/spring-ai.md`
- Modify: `docs/engineering/langchain.md`

- [x] **Step 1: Create Spring AI page**

Create `docs/engineering/spring-ai.md` with these sections:

- `# Spring AI 基础与面试题`
- `## 面试先背这几句话`
- `## Spring AI 解决什么问题`
- `## 核心抽象`
- `## 企业 Java 接入架构`
- `## Spring AI vs LangChain4j vs LangChain`
- `## 高频面试题`
- `## 项目讲法`
- `## 系统设计追问`
- `## 延伸阅读`

Required topics:

- ChatClient, Prompt Template, Embedding, VectorStore, Tool Calling.
- Spring Boot integration, Spring Security, observability, config management.
- SSE/streaming, timeout, retry, rate limiting, fallback.
- Enterprise constraints: audit logs, permission checks, data isolation, banking/customer-service scenarios.

- [x] **Step 2: Add framework comparison link**

In `docs/engineering/langchain.md`, add a short comparison paragraph that points Java/Spring teams to `/engineering/spring-ai` and points stateful Agent teams to `/engineering/langgraph`.

### Task 3: LangGraph Page

**Files:**
- Create: `docs/engineering/langgraph.md`
- Modify: `docs/agent/agent-basics.md`
- Modify: `docs/agent/multi-agent.md`

- [x] **Step 1: Create LangGraph page**

Create `docs/engineering/langgraph.md` with these sections:

- `# LangGraph 与状态图 Agent`
- `## 面试先背这几句话`
- `## 为什么从 Chain 走向 Graph`
- `## 核心概念`
- `## 一个可面试的 Agent 状态图`
- `## Checkpoint、人审与回放`
- `## LangGraph vs ReAct vs AgentExecutor`
- `## 高频面试题`
- `## 项目讲法`
- `## 系统设计追问`

Required topics:

- State, Node, Edge, Conditional Edge, Command.
- Checkpoint, persistence, resume, human-in-the-loop.
- Failure control: max steps, timeout, duplicate action detection, fallback route.
- Multi-agent orchestration and trace replay.

- [x] **Step 2: Cross-link existing Agent pages**

In `docs/agent/agent-basics.md` and `docs/agent/multi-agent.md`, add one short paragraph each that points readers to `/engineering/langgraph` when the discussion becomes stateful workflow engineering.

### Task 4: Dify Workflow And MaaS Platform Pages

**Files:**
- Create: `docs/engineering/dify-workflow.md`
- Create: `docs/engineering/maas-platform.md`
- Modify: `docs/agent/workflow.md`
- Modify: `docs/engineering/llm-gateway.md`

- [x] **Step 1: Create Dify workflow page**

Create `docs/engineering/dify-workflow.md` with these sections:

- `# Dify 与低代码智能工作流`
- `## 面试先背这几句话`
- `## Dify 适合什么场景`
- `## Chatflow、Workflow、Knowledge、Tool 怎么分工`
- `## 低代码工作流的上线边界`
- `## Dify vs Coze vs n8n vs LangGraph vs 自研代码`
- `## 高频面试题`
- `## 项目讲法`
- `## 系统设计追问`

Required topics:

- PoC speed, business maintainability, versioning, permission control, evaluation, cost.
- Migration path from Dify PoC to code-based LangGraph or Java/Spring AI service.

- [x] **Step 2: Create MaaS platform page**

Create `docs/engineering/maas-platform.md` with these sections:

- `# MaaS 平台与模型服务治理`
- `## 面试先背这几句话`
- `## MaaS 平台解决什么问题`
- `## 核心能力地图`
- `## 与模型网关、LLMOps、推理平台的关系`
- `## 多租户、计费与观测`
- `## 高频面试题`
- `## 项目讲法`
- `## 系统设计追问`

Required topics:

- Model catalog, virtual keys, quota, billing, routing, fallback, evaluation gates, audit logs.
- Relationship to `/engineering/llm-gateway`, `/engineering/llmops`, and inference pages.

- [x] **Step 3: Cross-link workflow and gateway pages**

In `docs/agent/workflow.md`, link Dify/low-code workflow discussion to `/engineering/dify-workflow`.

In `docs/engineering/llm-gateway.md`, link platform-level governance discussion to `/engineering/maas-platform`.

### Task 5: Agent Evaluation, Safety, And Compliance

**Files:**
- Modify: `docs/agent/agent-evaluation.md`
- Modify: `docs/advanced/safety.md`

- [x] **Step 1: Strengthen Agent evaluation page**

In `docs/agent/agent-evaluation.md`, add sections covering:

- Agent evaluation metric map: task success, tool-call accuracy, trace quality, latency, cost, human intervention rate.
- Safety risks: prompt injection, tool over-permission, data leak, unsafe action, corrupted memory.
- Compliance controls: least privilege, sandbox, audit log, approval workflow, data retention.
- Interview answers for “如何证明 Agent 更可靠” and “高危工具如何审批”.

- [x] **Step 2: Link safety page back to Agent evaluation**

In `docs/advanced/safety.md`, add one paragraph linking Agent-specific safety to `/agent/agent-evaluation`.

### Task 6: Navigation And Build Verification

**Files:**
- Modify: `docs/.vitepress/config.mts`

- [x] **Step 1: Add interview navigation**

In the `/interview/` sidebar, add:

- `基础篇岗位要求总纲` -> `/interview/foundation-requirements`

Place it near `2026 岗位能力地图` and `高频面试题速记`.

- [x] **Step 2: Add engineering navigation**

In the `/engineering/` sidebar, add:

- `Spring AI 基础与面试题` -> `/engineering/spring-ai`
- `LangGraph 与状态图 Agent` -> `/engineering/langgraph`
- `Dify 与低代码工作流` -> `/engineering/dify-workflow`
- `MaaS 平台与模型服务治理` -> `/engineering/maas-platform`

Place them near `LangChain 与应用框架`, `LLM 应用开发实战`, and `模型网关与多模型路由`.

- [x] **Step 3: Run formatting and build checks**

Run:

```powershell
git diff --check
npx vitepress build docs --outDir ../.vitepress-build-check
```

Expected:

- `git diff --check` exits 0.
- VitePress build exits 0.
- Existing chunk-size warning is acceptable.

- [x] **Step 4: Remove temporary build directory**

Run a path-checked removal for `D:\github\meko1\.vitepress-build-check`.

- [ ] **Step 5: Commit and push**

Stage only intended files:

```powershell
git add docs/.vitepress/config.mts docs/interview/foundation-requirements.md docs/interview/real-questions.md docs/interview/job-market-2026.md docs/engineering/spring-ai.md docs/engineering/langchain.md docs/engineering/langgraph.md docs/agent/agent-basics.md docs/agent/multi-agent.md docs/engineering/dify-workflow.md docs/engineering/maas-platform.md docs/agent/workflow.md docs/engineering/llm-gateway.md docs/agent/agent-evaluation.md docs/advanced/safety.md docs/superpowers/plans/2026-07-06-foundation-interview-expansion.md
git commit -m "docs: add foundation interview expansion"
git push origin main
```

Do not stage `outputs/`.

- [ ] **Step 6: Verify GitHub Pages**

Use GitHub Actions API to confirm latest `Deploy VitePress site to Pages` run for the pushed commit completes with `success`.

Verify these live pages return 200 and contain the expected headings:

- `/interview/foundation-requirements.html` contains `12 类 Boss/JD 高频技能矩阵`
- `/engineering/spring-ai.html` contains `Spring AI 解决什么问题`
- `/engineering/langgraph.html` contains `为什么从 Chain 走向 Graph`
- `/engineering/dify-workflow.html` contains `Dify 适合什么场景`
- `/engineering/maas-platform.html` contains `MaaS 平台解决什么问题`
