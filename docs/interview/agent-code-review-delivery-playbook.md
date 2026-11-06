---
title: Agent 代码审查与变更交付证据链：Claude Code / Codex / OpenClaw / Hermes
description: 拆分补丁、finding、验证、合并门禁和发布对账，避免过期 SHA、跳过检查与模型自评成为错误交付证据。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# Agent 代码审查与变更交付证据链：Claude Code / Codex / OpenClaw / Hermes

> Agent 写出 diff 不等于变更可合并；Agent 留下 review comment 也不等于系统应阻断发布。生产交付必须拆开：发现问题、验证问题、修复、验证修复、合并决策和发布对账，避免模型自评、自批、自合并。

> Coding Agent 的隔离与 PR/CI 基础见 [智能编码 Agent 企业操作手册](/interview/coding-agent-production-playbook)，多 Agent handoff 见 [多 Agent 委派与 Handoff 控制平面](/interview/multi-agent-delegation-handoff-playbook)，证据与 effect 对账见 [Agent 观测、取证与事故响应手册](/interview/agent-observability-incident-response)。

## 30 秒总答法

> 我将 Agent 交付分为 author、reviewer、verifier、merge gate 和 deploy controller。Author 在独立 worktree 产生 patch；reviewer 只读 diff 和代码上下文，输出含 `file:line`、证据、严重度、置信度和复现路径的 finding；verifier 用测试、静态分析或最小复现确认 finding；merge gate 聚合 CI、分支保护、人工批准、风险策略和已确认 finding，输出可审计 decision。自动修复必须创建新 commit/attempt 并接受独立复审。每一步用 repo SHA、diff digest、测试报告、review revision、policy/approval 与最终 PR/deploy effect 组成证据链。

## 一、五种结论

| 结论 | 产生者 | 证据 | 能否直接合并 |
| --- | --- | --- | --- |
| Observation | reviewer | 可疑 diff/context | 否 |
| Finding | verifier 或高置信 reviewer | file:line、影响、复现 | 否 |
| Fix | author/fixer | 新 diff、测试意图 | 否 |
| Verification | CI/scanner/test | exit code、报告、artifact | 仍需门禁 |
| Merge decision | branch policy + 人类 | 必需 check/approval | 才能合并 |

自然语言“LGTM”或“发现 bug”都是建议，不是系统状态。门禁读取结构化 evidence，不能从长评语猜测模型态度。

## 二、PR 证据链

```text
issue -> plan -> isolated worktree + base SHA -> patch/commit
  -> CI/test artifacts -> independent review -> finding verification
  -> remediation commit -> re-review + checks -> merge decision -> deploy effect
```

每个节点关联 `task_id`、`repo/base/head SHA`、worktree/image digest、instruction/review profile digest、test command/exit code、finding revision、policy/approval 和 PR/deploy effect ID。发生 rebase 或 push 后，旧 review/CI 必须按 `head_sha` 失效，不能被错误复用。

```json
{"finding_id":"f_19","head_sha":"abc123","file":"src/auth/session.ts","line":142,"severity":"important","claim":"logout 与 refresh 存在竞态","evidence":["file:142","test:repro_7"],"confidence":"verified","status":"OPEN"}
```

推测标记 hypothesis，不能伪装成 verified finding。但尚未证实不等于允许合并：鉴权绕过、数据丢失等高后果问题可进入 `NEEDS_INVESTIGATION`，由负责人排除风险后放行。第二个模型同意不等于独立复现；应提供触发输入、预期/实际行为及确定性代码证据。

证据包同时绑定 base/head SHA、CI 实际测试 SHA（可能是合成 merge commit）、命令、环境、退出码与未执行项。实际读取的 [GitHub 分支保护文档](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)说明，过期 approval 是否撤销取决于配置；required checks 可以接受 `success`、`skipped`、`neutral`。因此“required check 存在”不自动等于“测试实际执行并通过”。下方产品映射只作导航，未逐版本核验。审查费用应同时按 PR 和有效确认 finding 统计，并报告误报与漏报。

**失败案例**：扫描器因无凭证返回 neutral，PR 又只有文档变更而 CI 被跳过。若组织要求安全扫描，门禁必须验证扫描覆盖范围、实际执行状态和匹配的 head SHA，不把平台允许合并当组织风险已被满足；也不能把无凭证改为自动提权。例外需要单独的审批与有效期。

## 三、独立性与自动修复

| 风险 | 错误设计 | 正确设计 |
| --- | --- | --- |
| 自评偏差 | author 自己批准 | reviewer/verifier 与 author 隔离 context/worktree |
| 修复漂移 | comment 直接改 main | 新 task、新 commit、重新审查 |
| 过期结论 | rebase 后沿用旧 checks | finding 绑定 head SHA，push 后重验 |
| 注入 | PR 文本指挥 reviewer 执行命令 | payload 只作数据，拉取真实 diff，最小工具面 |
| 噪声 | 所有模型意见阻断 | 严重度、证据阈值、反馈闭环和结构化 gate |

## 四、Runtime 映射

### Claude Code

[Claude Code Review](https://code.claude.com/docs/en/code-review) 与 [Desktop](https://code.claude.com/docs/en/desktop) 保留为产品入口；本轮未核验其固定版本的 check run、finding 导出和 UI 行为。接入前实际验证能否取得机器可解析结果；没有受支持接口时，将审查作为人工建议，不抓取长评语推测严重度，更不宣称它已形成阻断门禁。

### Codex

[Codex](https://openai.com/codex/) 将 worktree、cloud environment、Skills 和多 Agent 工作流用于并行变更。工程上把 thread 的 diff、测试输出、worktree/环境与 PR 关联为 author evidence，再交独立 CI/reviewer 和分支保护决定 merge；Agent 完成消息不能等价于批准。

### OpenClaw

OpenClaw 可由 webhook/cron 触发审查，但 PR payload 是不可信输入。审查任务只读、按 repo/PR/head SHA 拉取实际 diff；评论与合并使用不同 capability，CI/branch policy 是最终 authority。

### Hermes

[Hermes GitHub PR Webhook Guide](https://hermes-agent.nousresearch.com/docs/guides/webhook-github-pr-review) 明确 PR 标题、描述和提交信息是 attacker-controlled，应以 `gh pr diff` 获取真实变更。其 [PR Review Agent](https://hermes-agent.nousresearch.com/docs/guides/github-pr-review-agent) 展示 skill、cron/webhook 与 GitHub review 组合；`gh` 凭证必须限制 repo scope，自动 `request-changes` 与普通 comment 分开授权。

## 五、合并门禁与系统设计题

```yaml
merge_gate:
  required: [head_sha_matches_review_and_ci, required_tests_executed_and_passed, no_unresolved_high_risk_findings, codeowner_approval]
  optional: [agent_review_advisory]
  forbidden: [agent_merges_own_patch, stale_review_reused]
```

这段 YAML 是组织门禁的伪配置，不是 GitHub 或某个 Agent 的可直接加载配置。L1 应能拿一个 finding 说明触发输入与实际行为；L2 应说明隔离 reviewer 只降低上下文污染，并不保证统计独立，测试也可能由同一作者错误编写；L3 若声称漏报更少，需有盲标缺陷集、按严重度的召回与误报、相同代码快照及人工仲裁，不能用“两个模型都赞同”作实验结论。

设计企业 PR Agent 时，每个 PR/head SHA 创建 author attempt 和只读 reviewer attempt；finding 有证据/置信度/生命周期；high severity 经 verifier 或规则确认；fixer 创建新 commit 使旧 finding/check 失效并重跑；CI/CodeOwner/branch policy 才能 merge，生产发布另需 environment approval/effect 对账。

- [ ] PR、base/head SHA、worktree、diff、测试与 finding 可关联。
- [ ] webhook/PR 文本视作不可信数据，工具/凭证最小化。
- [ ] author、reviewer、verifier、merge/deploy gate 职责分离。
- [ ] 自动修复创建新 attempt/commit，并经过独立复审和 CI。
- [ ] merge 与 deploy 有独立 policy/approval/effect evidence；Agent 不能自批自合。

## 延伸阅读

- [Claude Code Review](https://code.claude.com/docs/en/code-review)：并行审查、severity 与 neutral check run。
- [Codex](https://openai.com/codex/)：worktree、云环境与多 Agent 变更工作流。
- [Hermes Webhook PR Review](https://hermes-agent.nousresearch.com/docs/guides/webhook-github-pr-review)：不可信 webhook 与真实 diff 审查。
