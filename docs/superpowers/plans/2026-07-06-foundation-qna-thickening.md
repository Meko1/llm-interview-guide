# Foundation Q&A Thickening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the second publishable phase of the LLM foundation expansion: high-frequency interview Q&A and troubleshooting playbooks.

**Architecture:** Add one interview Q&A hub page and strengthen existing Function Calling/MCP, RAG, Agent, Workflow, and framework pages with focused interview-ready answer blocks. Reuse VitePress navigation and existing topic pages instead of creating many isolated pages.

**Tech Stack:** VitePress 1.x, Markdown, existing `docs/.vitepress/config.mts` navigation.

---

### Task 1: Add Foundation Q&A Hub

**Files:**
- Create: `docs/interview/foundation-qna.md`
- Modify: `docs/interview/foundation-requirements.md`
- Modify: `docs/interview/high-frequency.md`

- [x] **Step 1: Create `foundation-qna.md`**

Create a hub page titled `大模型基础篇高频问答加厚版`.

Required sections:

- `## 怎么用这页`
- `## Function Calling / MCP`
- `## RAG 生产排障`
- `## Agent / Workflow / LangGraph`
- `## 框架选型：Spring AI / LangChain / Dify`
- `## 微调与偏好优化速答`
- `## 安全合规与评估`
- `## 面试前 30 分钟速背`

Each section should contain interview questions with compact but complete answers, and link to existing deep-dive pages.

- [x] **Step 2: Link from foundation requirements**

In `docs/interview/foundation-requirements.md`, add a short link to `/interview/foundation-qna` near the top, explaining that it is the “面试前问答加厚版”.

- [x] **Step 3: Link from high-frequency page**

In `docs/interview/high-frequency.md`, add a short paragraph near the intro linking to `/interview/foundation-qna` for deeper foundation Q&A.

### Task 2: Strengthen Function Calling And MCP

**Files:**
- Modify: `docs/agent/function-calling-mcp.md`
- Modify: `docs/agent/mcp.md`

- [x] **Step 1: Add tool-call troubleshooting table**

In `docs/agent/function-calling-mcp.md`, add a section named `## 面试专项：工具调用排障怎么答` before `## 高频追问`.

Include:

- trigger failure
- wrong tool
- wrong arguments
- tool timeout
- permission denied
- unsafe side effect
- tool result injection

For each item, list symptom, diagnosis signal, and fix.

- [x] **Step 2: Add MCP production checklist**

In `docs/agent/mcp.md`, add a compact production checklist covering server ownership, auth, tool schema versioning, resource permissions, audit logs, and fallback.

### Task 3: Strengthen RAG Q&A

**Files:**
- Modify: `docs/rag/rag-production.md`
- Modify: `docs/rag/rag-evaluation.md`
- Modify: `docs/rag/rag-advanced.md`

- [x] **Step 1: Add RAG bad-case diagnostic playbook**

In `docs/rag/rag-production.md`, add a section named `## 面试专项：RAG bad case 怎么定位`.

Include a table for:

- query rewrite failed
- retrieval miss
- metadata/permission filter issue
- rerank issue
- context assembly issue
- generation hallucination
- stale index / cache issue

- [x] **Step 2: Add RAG evaluation split**

In `docs/rag/rag-evaluation.md`, add a short section explaining how to separate retrieval evaluation from generation evaluation.

- [x] **Step 3: Add advanced RAG quick comparison**

In `docs/rag/rag-advanced.md`, add a compact comparison of hybrid search, multi-query, HyDE, rerank, parent-child chunking, contextual compression, and GraphRAG.

### Task 4: Strengthen Agent, Workflow, And Framework Selection

**Files:**
- Modify: `docs/agent/agent-basics.md`
- Modify: `docs/agent/workflow.md`
- Modify: `docs/engineering/langchain.md`
- Modify: `docs/engineering/spring-ai.md`
- Modify: `docs/engineering/dify-workflow.md`

- [x] **Step 1: Add Agent failure answer block**

In `docs/agent/agent-basics.md`, add a section named `## 面试专项：Agent 失败怎么排查`.

Include failure types:

- planning wrong
- tool wrong
- memory polluted
- loop
- context overflow
- unsafe action

- [x] **Step 2: Add workflow selection examples**

In `docs/agent/workflow.md`, add examples that map real interview scenarios to Workflow, Orchestrator-Workers, Agent, or Dify.

- [x] **Step 3: Add framework selection table**

In `docs/engineering/langchain.md`, add a table comparing Spring AI, LangChain, LangGraph, Dify, and direct SDK for interview selection.

- [x] **Step 4: Add cross-links from Spring AI and Dify pages**

In `docs/engineering/spring-ai.md` and `docs/engineering/dify-workflow.md`, link to the new foundation Q&A hub.

### Task 5: Navigation, Build, Commit, Push, Deploy

**Files:**
- Modify: `docs/.vitepress/config.mts`

- [x] **Step 1: Add interview navigation**

Add `基础篇高频问答加厚版` -> `/interview/foundation-qna` to the `/interview/` sidebar and the top interview dropdown.

- [x] **Step 2: Run checks**

Run:

```powershell
git diff --check
npx vitepress build docs --outDir ../.vitepress-build-check
```

Expected: both commands succeed. Existing chunk-size warning is acceptable.

- [x] **Step 3: Remove temporary build directory**

Path-check and remove `D:\github\meko1\.vitepress-build-check`.

- [ ] **Step 4: Commit and merge to main**

Stage only intended files and commit:

```powershell
git add docs/.vitepress/config.mts docs/interview/foundation-qna.md docs/interview/foundation-requirements.md docs/interview/high-frequency.md docs/agent/function-calling-mcp.md docs/agent/mcp.md docs/rag/rag-production.md docs/rag/rag-evaluation.md docs/rag/rag-advanced.md docs/agent/agent-basics.md docs/agent/workflow.md docs/engineering/langchain.md docs/engineering/spring-ai.md docs/engineering/dify-workflow.md docs/superpowers/plans/2026-07-06-foundation-qna-thickening.md
git commit -m "docs: thicken foundation interview qna"
git switch main
git merge --ff-only codex/foundation-qna-thickening
git push origin main
```

Do not stage `outputs/`.

- [ ] **Step 5: Verify Pages**

Wait for the latest `Deploy VitePress site to Pages` GitHub Actions run for the pushed commit to complete with success.

Verify live pages:

- `/interview/foundation-qna.html` contains `面试前 30 分钟速背`
- `/agent/function-calling-mcp.html` contains `工具调用排障怎么答`
- `/rag/rag-production.html` contains `RAG bad case 怎么定位`
- `/agent/agent-basics.html` contains `Agent 失败怎么排查`
