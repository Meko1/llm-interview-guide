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

仅推测的内容标记 hypothesis，不作阻断合并的 finding；高风险 finding 应有最小复现、静态规则或第二独立 reviewer。

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

[Claude Code Review](https://code.claude.com/docs/en/code-review) 对 PR 使用多个专门 Agent 并行分析、验证、去重和分级发布 finding。其 check run 是 neutral，默认不阻断合并；若要门禁，应让组织 CI 读取机器可解析的严重度结果。这正是 reviewer 与 merge gate 分离。[Desktop](https://code.claude.com/docs/en/desktop) 支持逐文件 diff 审阅和通过 `gh` 展示 checks。

### Codex

[Codex](https://openai.com/codex/) 将 worktree、cloud environment、Skills 和多 Agent 工作流用于并行变更。工程上把 thread 的 diff、测试输出、worktree/环境与 PR 关联为 author evidence，再交独立 CI/reviewer 和分支保护决定 merge；Agent 完成消息不能等价于批准。

### OpenClaw

OpenClaw 可由 webhook/cron 触发审查，但 PR payload 是不可信输入。审查任务只读、按 repo/PR/head SHA 拉取实际 diff；评论与合并使用不同 capability，CI/branch policy 是最终 authority。

### Hermes

[Hermes GitHub PR Webhook Guide](https://hermes-agent.nousresearch.com/docs/guides/webhook-github-pr-review) 明确 PR 标题、描述和提交信息是 attacker-controlled，应以 `gh pr diff` 获取真实变更。其 [PR Review Agent](https://hermes-agent.nousresearch.com/docs/guides/github-pr-review-agent) 展示 skill、cron/webhook 与 GitHub review 组合；`gh` 凭证必须限制 repo scope，自动 `request-changes` 与普通 comment 分开授权。

## 五、合并门禁与系统设计题

```yaml
merge_gate:
  required: [head_sha_matches_review_and_ci, tests_pass, no_verified_important_findings, codeowner_approval]
  optional: [agent_review_advisory]
  forbidden: [agent_merges_own_patch, stale_review_reused]
```

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
