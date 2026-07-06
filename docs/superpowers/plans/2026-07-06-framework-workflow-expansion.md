# Framework Workflow Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the fourth publishable phase of the foundation interview expansion: framework selection, Spring AI, LangChain, LangGraph, Dify, workflow, and tool-calling interview playbooks.

**Architecture:** Add one interview hub page for application frameworks and intelligent workflows, then thicken existing framework pages with production troubleshooting, migration, and project-storytelling sections. Keep all changes as Markdown and VitePress navigation updates, preserving the existing static GitHub Pages deployment.

**Tech Stack:** VitePress 1.x, Markdown, existing `docs/.vitepress/config.mts` navigation.

---

### Task 1: Framework Interview Hub

**Files:**
- Create: `docs/interview/framework-workflow-qna.md`
- Modify: `docs/interview/foundation-qna.md`
- Modify: `docs/interview/foundation-requirements.md`
- Modify: `docs/.vitepress/config.mts`

- [ ] **Step 1: Add the hub page**

Create `docs/interview/framework-workflow-qna.md` with sections for Spring AI, LangChain, LangGraph, Dify, Workflow vs Agent, Function Calling, migration paths, project storytelling, and a 30-minute cram list.

- [ ] **Step 2: Link the hub from foundation pages**

Add cross-links in `docs/interview/foundation-qna.md` and `docs/interview/foundation-requirements.md` so readers can jump from the foundation track to framework/workflow questions.

- [ ] **Step 3: Add navigation**

Add `框架与智能工作流高频问答` to the top interview dropdown and `/interview/` sidebar in `docs/.vitepress/config.mts`, near other foundation interview hubs.

### Task 2: Framework Page Thickening

**Files:**
- Modify: `docs/engineering/spring-ai.md`
- Modify: `docs/engineering/langchain.md`
- Modify: `docs/engineering/langgraph.md`
- Modify: `docs/engineering/dify-workflow.md`

- [ ] **Step 1: Add Spring AI production troubleshooting**

Add a section covering SSE disconnects, thread exhaustion, RAG ACL failures, tool authorization, output parsing, gateway fallback, and cost control.

- [ ] **Step 2: Add LangChain production risk controls**

Add a section covering abstraction leakage, version upgrades, hidden prompt changes, callback tracing, test datasets, and when to graduate to a thin SDK wrapper.

- [ ] **Step 3: Add LangGraph state-design patterns**

Add a section covering state schema, reducers, idempotent tool nodes, retry/fallback nodes, human approval, checkpoints, and loop termination.

- [ ] **Step 4: Add Dify production-to-code migration**

Add a section covering how to turn a Dify PoC into Spring AI/LangGraph production service while preserving prompts, knowledge base decisions, tools, logs, and evaluation sets.

### Task 3: Workflow And Tool-Calling Links

**Files:**
- Modify: `docs/agent/workflow.md`
- Modify: `docs/agent/function-calling-mcp.md`
- Modify: `docs/interview/real-questions.md`

- [ ] **Step 1: Add workflow interview decision rules**

Add a section to `docs/agent/workflow.md` explaining when to use Prompt Chaining, Routing, Parallelization, Orchestrator-Workers, Evaluator-Optimizer, Agent, or LangGraph.

- [ ] **Step 2: Add Function Calling production checklist**

Add a section to `docs/agent/function-calling-mcp.md` covering schema design, validation, idempotency, permissions, structured errors, retries, audit, and confirmation.

- [ ] **Step 3: Add real interview prompts**

Add `框架与智能工作流追问` to `docs/interview/real-questions.md` with common questions for Spring AI, LangChain, LangGraph, Dify, Workflow, and Function Calling interviews.

### Task 4: Verify, Commit, Push, Deploy

**Files:**
- All changed Markdown/config files from Tasks 1-3

- [ ] **Step 1: Check whitespace**

Run `git diff --check`. Expected: no output and exit code 0.

- [ ] **Step 2: Build VitePress**

Run `npx vitepress build docs --outDir ../.vitepress-build-check`. Expected: build completes successfully.

- [ ] **Step 3: Remove local build check output**

Remove `D:\github\meko1\.vitepress-build-check` after verifying the resolved absolute path exactly matches that path.

- [ ] **Step 4: Commit only intended files**

Stage the new plan, new interview hub, changed Markdown pages, and `docs/.vitepress/config.mts`. Do not stage `outputs/`. Commit with `docs: add framework workflow interview playbook`.

- [ ] **Step 5: Merge to main and push**

Switch to `main`, fast-forward merge `codex/framework-workflow-expansion`, push to `origin/main`, and monitor the GitHub Actions Pages workflow.

- [ ] **Step 6: Verify live site**

Check the deployed pages contain `框架与智能工作流高频问答`, `Spring AI 生产排障`, `LangChain 生产风险控制`, `LangGraph 状态设计模式`, `Dify PoC 到生产迁移`, `Function Calling 生产检查清单`.
