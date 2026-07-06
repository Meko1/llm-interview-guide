# Finetuning Platform Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the third publishable phase of the LLM foundation expansion: finetuning interview playbooks and model-platform governance links.

**Architecture:** Add one interview hub page for finetuning and model-platform questions, strengthen existing finetuning pages with interview decision trees, and connect MaaS/model gateway/evaluation pages through cost, routing, and eval-gate Q&A. Keep every addition as Markdown content and navigation updates so the VitePress site remains static and GitHub Pages deployable.

**Tech Stack:** VitePress 1.x, Markdown, existing `docs/.vitepress/config.mts` navigation.

---

### Task 1: Interview Hub

**Files:**
- Create: `docs/interview/finetuning-platform-qna.md`
- Modify: `docs/interview/foundation-qna.md`
- Modify: `docs/interview/foundation-requirements.md`
- Modify: `docs/.vitepress/config.mts`

- [ ] **Step 1: Add a focused interview hub**

Create `docs/interview/finetuning-platform-qna.md` with sections for SFT/PEFT/LoRA/QLoRA, RLHF/DPO/preference optimization, finetune-vs-RAG decision making, MaaS/model-gateway/eval gates, project storytelling, and a 30-minute pre-interview cram list.

- [ ] **Step 2: Link the hub from existing interview foundation pages**

Add compact cross-links in `docs/interview/foundation-qna.md` and `docs/interview/foundation-requirements.md` so readers moving through the foundation track can discover the new finetuning/platform page.

- [ ] **Step 3: Add navigation entries**

Add `微调与模型平台高频问答` to the top interview dropdown and `/interview/` sidebar in `docs/.vitepress/config.mts`, immediately after `基础篇高频问答加厚版`.

### Task 2: Finetuning Page Thickening

**Files:**
- Modify: `docs/finetuning/finetuning.md`
- Modify: `docs/finetuning/lora.md`
- Modify: `docs/finetuning/rlhf.md`
- Modify: `docs/finetuning/preference-optimization.md`

- [ ] **Step 1: Strengthen SFT/PEFT troubleshooting**

Add an interview section to `docs/finetuning/finetuning.md` covering data template mismatch, low-quality data, overfitting, catastrophic forgetting, missing evaluation sets, RAG-vs-finetune misuse, and output format drift.

- [ ] **Step 2: Strengthen LoRA/QLoRA parameter answers**

Add an interview section to `docs/finetuning/lora.md` that explains how to tune rank, alpha, target modules, dropout, learning rate, batch size, sequence length, and quantization tradeoffs.

- [ ] **Step 3: Strengthen RLHF/DPO project storytelling**

Add an interview section to `docs/finetuning/rlhf.md` that explains preference data pipelines, RM/PPO-vs-DPO decisions, evaluation design, reward hacking, and over-refusal controls.

- [ ] **Step 4: Strengthen preference-method selection**

Add a method-selection table to `docs/finetuning/preference-optimization.md` comparing DPO, KTO, ORPO, SimPO, and GRPO for interview scenarios.

### Task 3: Platform And Evaluation Links

**Files:**
- Modify: `docs/engineering/maas-platform.md`
- Modify: `docs/engineering/llm-gateway.md`
- Modify: `docs/evaluation/evaluation.md`
- Modify: `docs/interview/real-questions.md`

- [ ] **Step 1: Add MaaS rollout gates**

Add a `模型平台上线门禁` section to `docs/engineering/maas-platform.md` covering model catalog, virtual keys, quota, eval pass/fail rules, tenant policy, cost budget, rollout, and rollback.

- [ ] **Step 2: Link gateway routing to platform governance**

Add a concise cost/routing interview section to `docs/engineering/llm-gateway.md` that points readers to the MaaS and finetuning-platform Q&A pages.

- [ ] **Step 3: Connect evaluation to release gates**

Add a finetuning/model-platform eval gate section to `docs/evaluation/evaluation.md` covering golden sets, pairwise preference checks, regression cases, cost and latency budgets, and rollback thresholds.

- [ ] **Step 4: Add real interview prompts**

Add `微调与模型平台追问` to `docs/interview/real-questions.md` with common questions for LoRA/QLoRA/DPO/MaaS/eval-gate interviews.

### Task 4: Verify, Commit, Push, Deploy

**Files:**
- All changed Markdown/config files from Tasks 1-3

- [ ] **Step 1: Check whitespace**

Run `git diff --check`. Expected: no output and exit code 0.

- [ ] **Step 2: Build VitePress**

Run `npx vitepress build docs --outDir ../.vitepress-build-check`. Expected: build completes successfully.

- [ ] **Step 3: Remove local build check output**

Remove `.vitepress-build-check` after verifying the resolved absolute path is inside `D:\github\meko1\llm-interview-guide`.

- [ ] **Step 4: Commit only intended files**

Stage the new plan, new interview hub, changed Markdown pages, and `docs/.vitepress/config.mts`. Do not stage `outputs/`. Commit with `docs: add finetuning platform interview playbook`.

- [ ] **Step 5: Merge to main and push**

Switch to `main`, fast-forward merge `codex/finetuning-platform-expansion`, push to `origin/main`, and monitor the GitHub Actions Pages workflow.

- [ ] **Step 6: Verify live site**

Check the deployed pages contain `微调与模型平台高频问答`, `SFT/PEFT 数据与训练排障`, `LoRA/QLoRA 参数怎么调`, `RLHF/DPO 项目怎么讲`, and `模型平台上线门禁`.
