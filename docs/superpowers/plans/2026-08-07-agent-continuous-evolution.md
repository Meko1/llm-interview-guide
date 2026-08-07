# Agent Continuous Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-oriented Chinese VitePress guide that explains how an Agent safely turns runtime experience into versioned, validated, and reversible capabilities.

**Architecture:** Keep the new topic in one focused `/agent/` page and connect it through both duplicated Agent navigation lists. The page owns the capability-evolution lifecycle and links to existing memory, evaluation, context, workflow, and safety pages instead of duplicating their implementation details.

**Tech Stack:** VitePress 1.6, Markdown, TypeScript site configuration, GitHub Actions Pages

---

### Task 1: Write the Agent continuous-evolution guide

**Files:**
- Create: `docs/agent/agent-continuous-evolution.md`
- Reference: `docs/superpowers/specs/2026-08-07-agent-continuous-evolution-design.md`

- [ ] **Step 1: Create the page skeleton and positioning**

Use this exact section order:

```markdown
# Agent 持续进化：从运行轨迹到可发布能力

> 页面定位与核心结论

## 一、先划边界：记住不等于学会
## 二、学习信号：从轨迹中提取什么
## 三、更新载体：知识、指令、程序还是参数
## 四、核心架构：在线执行与离线进化双循环
## 五、候选能力的数据模型与生命周期
## 六、验证体系：既评更新器，也评任务 Agent
## 七、安全边界：可信根不能参与自我修改
## 八、失败模式与修复策略
## 九、离线整理：合并、遗忘与能力保鲜
## 十、系统设计题：企业客服 Agent 持续改进平台
## 十一、项目讲法与高频追问
## 十二、与已有专题的分工
## 十三、参考资料
```

- [ ] **Step 2: Fill the conceptual and architecture sections**

The page must include all of these concrete artifacts:

- A comparison table for session context, user memory, experience assets, and parameter updates.
- A result/process/quality evidence table that treats model self-evaluation and external content as untrusted evidence.
- A four-carrier decision matrix for knowledge, Prompt/Skill, program/Harness, and model parameters.
- An original ASCII architecture showing stable online execution separated from offline diagnosis, candidate generation, validation, canary, and rollback.
- The rule “prefer the smallest attributable and reversible change” with customer-service examples.

- [ ] **Step 3: Fill the lifecycle, validation, and safety sections**

Define the state flow exactly as:

```text
proposed -> validated -> canary -> active
    |           |          |         |
 rejected    rejected   rolled_back  deprecated
```

Add a structured candidate record containing `candidate_id`, `artifact_type`, `base_version`, `evidence_refs`, `change`, `risk_level`, `evaluation`, `status`, and `rollback_to`. Explain candidate effectiveness, activation rate, adherence rate, held-out gain, regression rate, safety drift, cost, and rollback rate.

State that policy, evaluators, release thresholds, immutable audit evidence, and stable backups are outside the ordinary evolution write boundary. Cover prompt-injection persistence, reward hacking, survivor bias, self-approval, rule bloat, evaluator contamination, and catastrophic forgetting.

- [ ] **Step 4: Fill the system-design and interview sections**

Use an enterprise customer-service Agent scenario with these boundaries:

- Production runs only an approved stable version.
- Online failures and human corrections append immutable evidence rather than editing production prompts.
- Offline jobs diagnose repeated causes and generate candidate knowledge, Skill, Harness, or parameter updates.
- Independent held-out, regression, and safety gates precede canary rollout.
- High-risk candidates require human approval; degraded metrics trigger rollback.

Finish with a paste-ready project answer, at least six high-frequency questions, cross-links to existing pages, and a reference list that includes the supplied PDF plus primary sources used for durable claims.

- [ ] **Step 5: Run page-level content checks**

Run:

```powershell
$rg = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\override\rg.exe'
& $rg -n '^#{1,3} ' docs/agent/agent-continuous-evolution.md
& $rg -n 'FIXME|待补充|稍后补' docs/agent/agent-continuous-evolution.md
```

Expected: all thirteen H2 sections appear in order; the placeholder search returns no matches.

### Task 2: Connect the page to VitePress navigation

**Files:**
- Modify: `docs/.vitepress/config.mts:65-82`
- Modify: `docs/.vitepress/config.mts:338-360`

- [ ] **Step 1: Add the top Agent menu entry**

Insert after `Agent 评估与可靠性工程` and preserve the existing order:

```ts
{ text: 'Agent 持续进化与能力生命周期', link: '/agent/agent-continuous-evolution' }
```

- [ ] **Step 2: Add the Agent sidebar entry**

Insert the identical entry after `Agent 评估与可靠性工程` in the `/agent/` sidebar list. Do not reformat unrelated lines.

- [ ] **Step 3: Verify both entries and every internal target**

Run:

```powershell
Select-String -LiteralPath 'docs\.vitepress\config.mts' -Pattern '/agent/agent-continuous-evolution' -Encoding utf8
```

Expected: exactly two matches. Check every `/agent/`, `/interview/`, `/engineering/`, and `/finetuning/` link added to the page against a real `.md` file.

### Task 3: Validate and commit the implementation

**Files:**
- Validate: `docs/agent/agent-continuous-evolution.md`
- Validate: `docs/.vitepress/config.mts`
- Preserve: `outputs/`
- Preserve: `scripts/build_hrbp_docx.py`

- [ ] **Step 1: Run whitespace validation**

Run:

```powershell
git diff --check
```

Expected: exit code 0 with no output.

- [ ] **Step 2: Run the requested VitePress production build**

Run:

```powershell
npx vitepress build docs --outDir ../.vitepress-build-check
```

Expected: exit code 0 and `build complete` output.

- [ ] **Step 3: Remove the temporary build and inspect status**

Run:

```powershell
Remove-Item -LiteralPath '.vitepress-build-check' -Recurse -Force
git status --short
```

Expected: `.vitepress-build-check` is absent; `outputs/` and `scripts/build_hrbp_docx.py` remain untracked and untouched.

- [ ] **Step 4: Stage only the intended implementation files**

Run:

```powershell
git add -- docs/agent/agent-continuous-evolution.md docs/.vitepress/config.mts
git diff --cached --check
git diff --cached --name-only
```

Expected staged names: only the new guide and VitePress config. The design specification and implementation plan are already committed separately.

- [ ] **Step 5: Commit the implementation**

Run:

```powershell
git commit -m "docs: add agent continuous evolution guide"
```

Expected: one commit containing only the intended documentation and navigation files.

### Task 4: Push, monitor Pages, and verify production

**Files:**
- Read: `.github/workflows/deploy.yml`

- [ ] **Step 1: Rebase-safety check and push main**

Run:

```powershell
git fetch origin main
git status --short --branch
git push origin main
```

Expected: local `main` pushes without force and becomes synchronized with `origin/main`.

- [ ] **Step 2: Identify and monitor the Pages workflow run**

Use GitHub CLI or GitHub API to locate the newest `Deploy VitePress site to Pages` run for the pushed commit. Poll until both build and deploy finish.

Expected: workflow conclusion `success`; do not report completion while queued or in progress.

- [ ] **Step 3: Verify the deployed page over HTTPS**

Request:

```text
https://meko1.github.io/llm-interview-guide/agent/agent-continuous-evolution
```

Expected: HTTP 200 and the rendered page contains `Agent 持续进化` plus a distinctive section title such as `在线执行与离线进化双循环`.

- [ ] **Step 4: Final repository hygiene check**

Run:

```powershell
git status --short --branch
Test-Path -LiteralPath '.vitepress-build-check'
```

Expected: branch synchronized; only the user's existing untracked `outputs/` and `scripts/build_hrbp_docx.py` remain; build directory result is `False`.
