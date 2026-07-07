# Rag Memory Eval Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next publishable phase of the LLM interview guide: RAG production, Memory, Agent evaluation, and safety-compliance interview playbooks.

**Architecture:** Add one interview hub page for RAG/Memory/Evaluation/Safety questions, connect it from existing foundation interview pages and navigation, then thicken the highest-signal production pages with interview-specific troubleshooting and launch-gate sections. Keep all changes static Markdown and VitePress navigation updates.

**Tech Stack:** VitePress 1.x, Markdown, existing `docs/.vitepress/config.mts` navigation.

---

### Task 1: RAG Memory Evaluation Interview Hub

**Files:**
- Create: `docs/interview/rag-memory-eval-qna.md`
- Modify: `docs/interview/foundation-qna.md`
- Modify: `docs/interview/foundation-requirements.md`
- Modify: `docs/.vitepress/config.mts`

- [ ] **Step 1: Add the hub page**

Create `docs/interview/rag-memory-eval-qna.md` covering RAG production, chunking/retrieval, permissions, deletion/caching consistency, Agent memory, Agent evaluation, and safety-compliance launch gates.

- [ ] **Step 2: Link from foundation pages**

Add cross-links in `docs/interview/foundation-qna.md` and `docs/interview/foundation-requirements.md` for RAG/Memory/Agent evaluation and safety-compliance questions.

- [ ] **Step 3: Add VitePress navigation**

Add `RAG、Memory 与评测安全高频问答` to the top interview dropdown and `/interview/` sidebar in `docs/.vitepress/config.mts`.

### Task 2: RAG Production Thickening

**Files:**
- Modify: `docs/rag/rag-basics.md`
- Modify: `docs/rag/rag-production.md`
- Modify: `docs/rag/rag-evaluation.md`

- [ ] **Step 1: Add RAG interview diagnosis summary**

Add a compact `面试专项：RAG 排障四步法` section to `docs/rag/rag-basics.md`, emphasizing retrieval vs rerank vs context vs generation.

- [ ] **Step 2: Add consistency checklist**

Add `面试专项：权限、删除与缓存一致性` to `docs/rag/rag-production.md`, covering ACL in vector/BM25/rerank/generation, delete propagation, index version, cache keys, audit evidence.

- [ ] **Step 3: Add RAG evaluation launch gates**

Add `面试专项：RAG 上线评估门禁` to `docs/rag/rag-evaluation.md`, covering golden set, retrieval metrics, generation faithfulness, citation support, refusal, latency, cost, and regression thresholds.

### Task 3: Memory, Agent Evaluation, Safety

**Files:**
- Modify: `docs/agent/agent-memory.md`
- Modify: `docs/agent/agent-evaluation.md`
- Modify: `docs/advanced/governance.md`
- Modify: `docs/interview/real-questions.md`

- [ ] **Step 1: Add memory governance checklist**

Add `面试专项：记忆写入门禁与错误记忆治理` to `docs/agent/agent-memory.md`, covering write policies, conflict resolution, privacy, user visibility, deletion, expiry, and evaluation.

- [ ] **Step 2: Add Agent launch acceptance checklist**

Add `面试专项：Agent 上线验收清单` to `docs/agent/agent-evaluation.md`, covering outcome, trajectory, cost, safety, tool permission, HITL, memory pollution, and rollback gates.

- [ ] **Step 3: Add governance review checklist**

Add `面试专项：RAG/Agent 合规评审清单` to `docs/advanced/governance.md`, focusing on data classification, data outbound policy, audit, PII, retention, deletion, and human review.

- [ ] **Step 4: Add real interview prompts**

Add `RAG、Memory 与评测安全追问` to `docs/interview/real-questions.md` with practical questions for production RAG, memory, Agent evaluation, and compliance.

### Task 4: Verify, Commit, Push, Deploy

**Files:**
- All changed Markdown/config files from Tasks 1-3

- [ ] **Step 1: Check whitespace**

Run `git diff --check`. Expected: no output and exit code 0.

- [ ] **Step 2: Build VitePress**

Run `npx vitepress build docs --outDir ../.vitepress-build-check`. Expected: build completes successfully.

- [ ] **Step 3: Remove local build check output**

Remove `D:\github\meko1\.vitepress-build-check` after verifying the resolved absolute path exactly matches that path.

- [ ] **Step 4: Commit intended files only**

Stage the new plan, new interview hub, changed Markdown pages, and `docs/.vitepress/config.mts`. Do not stage `outputs/`. Commit with `docs: add rag memory evaluation interview playbook`.

- [ ] **Step 5: Merge to main and push**

Switch to `main`, fast-forward merge `codex/rag-memory-eval-expansion`, push to `origin/main`, and monitor GitHub Actions Pages.

- [ ] **Step 6: Verify live site**

Check deployed pages contain `RAG、Memory 与评测安全高频问答`, `RAG 排障四步法`, `权限、删除与缓存一致性`, `记忆写入门禁与错误记忆治理`, `Agent 上线验收清单`, and `RAG/Agent 合规评审清单`.
