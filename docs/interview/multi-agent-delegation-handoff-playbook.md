# 多 Agent 委派与 Handoff 控制平面：Claude Code / Codex / OpenClaw / Hermes

> 多 Agent 不是“多开几个聊天窗口”。它是一个有身份、能力、预算、资源租约、副作用和最终责任的分布式任务系统。面试中最容易失分的回答是：把任务分给几个 Agent，最后汇总。真正需要讲清的是谁仍然拥有控制权，交接何时生效，子任务失联后谁停止副作用，多份结论冲突时谁裁决，以及如何证明最终交付确实发生。

> 后台 job、定时触发和执行器生命周期见 [Agent 自动化与后台编排生产设计](/interview/agent-automation-orchestration-playbook)，跨组织/跨运行时协议见 [A2A 跨 Agent 互操作生产设计](/interview/a2a-production-interoperability-qna)，可观测、回放与事故证据见 [Agent 观测、取证与事故响应手册](/interview/agent-observability-incident-response)。

## 30 秒总答法

> 我会把多 Agent 系统分为控制平面和执行平面。控制平面持久化 `task`、`delegation`、`assignee`、`lease`、`budget`、`approval`、`artifact` 和 `effect`，决定谁能接活、接到什么权限、何时收回；执行 Agent 只在明确的任务契约和租约内行动。委派时父任务保留责任和可取消权，handoff 则通过 offer、validate、accept、activate、ACK 五步把 owner、预算和交付责任显式转移。并行执行必须隔离上下文、工作区、凭证和副作用；fan-in 以验收条件而不是“所有 Agent 都说完成”为准。父任务取消或崩溃后，reconciler 根据 lease、heartbeat、effect ID 和 idempotency key 查找孤儿任务，冻结新副作用、对账已发生动作并回收资源。Claude Code 可让子 Agent 在独立 context 或 worktree 中运行；Codex 用 worktree 与云端环境承载并行工作；OpenClaw 把深度、工具面、子数上限和级联停止写进运行时策略；Hermes 用隔离 child session、toolset 与并行批次委派。产品功能只是实现映射，生产正确性仍来自这一套控制面。

## 一、四个概念必须分开

| 概念 | 控制权/责任 | 典型场景 | 父任务终态 |
| --- | --- | --- | --- |
| Delegation 委派 | 父方保留 owner、审批和最终验收 | 让 reviewer 检查设计，让 worker 写一个独立模块 | 父方根据结果继续或拒绝 |
| Handoff 交接 | 新 owner 接受后负责继续推进和交付 | 值班转交、从本地转云端、从规划 Agent 转执行 Agent | 父方撤销写权，转为观察/协助 |
| Escalation 升级 | 交给人或更高权限实体裁决 | 高风险付款、合并冲突、策略不确定 | 等待人工 decision，不能假定批准 |
| Broadcast / Consultation | 分发只读问题，产物仅作为意见 | 多模型审阅、检索、风险分析 | 父方自行综合，不能把意见当 effect |

**关键判断题：** 如果父 Agent 仍能随时取消、改目标、收回权限并对交付负责，这是 delegation；如果接收方接受后拥有独立的预算、SLO、审批链和交付确认，则是 handoff。把两者混淆，会导致取消无效、责任断裂或两个 Agent 同时写同一资源。

## 二、控制平面数据模型

执行 transcript 适合调试，不足以作为调度真相。需要一个可查询、可并发控制的状态模型：

```text
Task(task_id, parent_task_id, owner, state, goal, acceptance)
  |
  +-- Delegation(delegation_id, issuer, candidate, scope, deadline, status)
  |       |
  |       +-- Lease(lease_id, holder, expires_at, heartbeat_at, fencing_token)
  |
  +-- CapabilityGrant(grant_id, tools, resources, credential_ref, max_effect)
  +-- Budget(token, time, money, steps, child_limit)
  +-- Artifact(ref, digest, classification, producer, consumer)
  +-- Effect(effect_id, idempotency_key, external_ref, reconciliation_status)
  +-- Decision(policy_revision, approval_id, owner_revision, audit_event)
```

### 必需不变量

1. **唯一 owner：** 任一时刻只允许一个可写 owner；旁观者与协作者可多名，但不能共享写 lease。
2. **能力不能放大：** 子任务得到的 tool、目录、网络、数据域和额度必须是父权限的子集，除非独立审批产生新的 grant。
3. **lease 有围栏：** 所有写工具带 `fencing_token` 或等价版本号；旧 worker 即使网络恢复，也不能覆盖新 owner 的结果。
4. **effect 可对账：** 付款、部署、PR、发信、数据库更新均有 `idempotency_key` 和外部 `effect_id`，自然语言“已完成”不算完成。
5. **终态不可倒流：** `CANCELLED`、`EXPIRED`、`REJECTED` 后不能直接重新执行；要创建新的 attempt，并保存因果链。

## 三、任务契约：派活前先写清边界

一份可生产的 delegation 不是一句“帮我修 bug”，至少包含以下字段：

```yaml
delegation_offer:
  task_id: task_482
  parent_task_id: task_117
  objective: "定位并修复支付回调重复记账"
  acceptance: "新增回归测试；不修改账务历史；CI 通过"
  inputs:
    artifact_refs: [repo@sha:..., incident-summary@sha256:...]
    context_summary: "仅包含问题、约束和已验证事实"
  capability_grant:
    tools: [read_repo, edit_worktree, run_test]
    denied: [deploy_prod, payment_write, secrets_read]
    workspace: worktree:task_482
  budget:
    token: 180000
    wall_clock_minutes: 45
    max_tool_calls: 80
    max_children: 0
  lease:
    ttl_seconds: 900
    heartbeat_seconds: 60
  delivery:
    artifact_contract: patch + test_report + decision_summary
    return_channel: task_result
```

“给完整聊天记录”“可以用所有工具”“成功后通知我”都不是契约。完整历史会让子 Agent 带入无关指令和敏感内容；全工具会放大能力；只有通知没有验收标准，会把结果判断留给模型的自我声明。

## 四、隔离不是只有 worktree

| 隔离层 | 需要隔离的对象 | 常见失败 | 防线 |
| --- | --- | --- | --- |
| Context | 对话、记忆、系统提示、检索结果 | 子任务继承错误指令或私人信息 | fresh context + 最小摘要/manifest |
| Workspace | 文件、分支、临时产物 | 两个 Agent 覆盖同一文件 | worktree、分支、路径锁、merge queue |
| Capability | 工具、网络、目录、MCP | 研究子任务误执行写操作 | allowlist、只读 profile、审批升级 |
| Credential | token、KMS、数据库账号 | 父权限被横向带走 | 短期 scoped credential、每 task 绑定 |
| Business data | tenant、工单、客户数据 | 跨租户检索/发送 | tenant claim、resource selector、DLP |
| Effect | 部署、写库、发信、付款 | 重试造成重复副作用 | idempotency、outbox、reconciliation |

[Claude Code Worktrees](https://code.claude.com/docs/en/worktrees) 明确将并行 session 的文件修改放到独立 git worktree，避免相互覆盖；其 [Subagents](https://code.claude.com/docs/en/sub-agents) 还允许配置 tools、permission mode、max turns 和 worktree isolation。隔离工作区并不自动隔离 `.env`、远端 API、共享缓存和部署凭证，企业仍需补齐后四层。

## 五、两阶段 Handoff：先接收，再撤权

直接把 `owner = child` 写进数据库会在网络重试、拒绝、重复消息和 parent crash 时留下悬空责任。建议使用小型两阶段协议：

```text
OFFERED  -- child validates contract --> ACCEPTED
   |                                      |
   | reject/timeout                       | control plane grants lease + capabilities
   v                                      v
REJECTED / EXPIRED                     ACTIVATING
                                             |
                              child durable ACK + audit record
                                             v
                                         ACTIVE
                                             |
                  accepted delivery / explicit return / escalation
                                             v
                                     COMPLETED / HANDED_BACK
```

### 每一步做什么

1. **Offer：** 父方创建不可变契约草案，尚不授予写凭证。
2. **Validate：** 候选者检查 schema、输入完整性、工具可用性、预算、数据域、worktree 和依赖；不能满足就带 reason 拒绝。
3. **Accept：** 子方声明接受 `delegation_id` 与预期 `owner_revision`，此时仍不应产生外部 effect。
4. **Activate：** 控制面原子地发 grant/lease、递增 owner revision、记录父方撤权；任何延迟的旧命令因 fencing token 被拒绝。
5. **ACK：** 子方持久化 session/workspace/effect policy 后确认；未 ACK 的 activation 在 TTL 后恢复给父方或进入人工队列。

高风险变更还需两个人类动作：**批准 handoff** 不等于 **批准 effect**。前者同意谁负责推进，后者同意一次具体部署、付款或数据写入。

## 六、Fan-out 与 Fan-in：并行不是把答案拼起来

### Fan-out 准入

并发前先检查任务是否独立。可并行的维度是只读研究、互不重叠的模块或有明确 resource lock 的步骤；数据库迁移、同一文件大范围重构、共享速率限制和同一客户工单往往应串行化或使用 coordinator。

```text
planner
  -> static-analysis (read-only)
  -> test-reproducer (isolated sandbox)
  -> patch-worker-A (service A worktree)
  -> patch-worker-B (service B worktree)
  -> security-review (read-only)
                        |
                     fan-in gate
                        |
              tests + diff + policy + human approval
```

每个 parent 都应有 `max_children`、全局并发配额、每 tenant 预算、每工具速率和 delegation depth。否则模型的“再找一个 Agent”会演变成指数 fan-out。

### Fan-in 收敛规则

| 情况 | 推荐规则 | 错误做法 |
| --- | --- | --- |
| 全部成功且无冲突 | 验证 artifact digest、运行集成测试后完成 | 只看每个 child 的 success 文本 |
| 一部分失败 | 判断失败是否影响 acceptance；可降级则交付 partial result | 为了绿灯忽略关键失败 |
| straggler 迟到 | 到 deadline 取消或隔离结果；保留证据 | 无期限等待，或把过期 patch 自动合入 |
| 结论冲突 | 以可验证证据、测试、数据 owner 或人类仲裁决胜 | 让另一个 LLM 投票就直接执行 |
| 推测执行 | 只用于无副作用工作；选定 winner 后取消 loser | 两个 worker 都拥有生产写权限 |

fan-in 的结果必须是一个新的可验证 artifact，例如 merge candidate、证据矩阵或审批请求，而不是把子 Agent 的自然语言摘要拼接给用户。

## 七、取消、失联与孤儿任务

取消是意图，停止是执行器状态，副作用对账是业务事实，三者不能等同。推荐状态机：

```text
parent cancel
  -> stop new dispatch
  -> revoke/expire child leases
  -> send cooperative cancel
  -> wait bounded grace period
  -> kill sandbox/process if still active
  -> reconcile external effects by idempotency_key
  -> archive evidence + release worktree/credential/lock
```

### 孤儿检测器

定期扫描满足任一条件的 run：父任务终止但 child 仍 `ACTIVE`；lease 已过期；连续 N 个 heartbeat 缺失；worker 注册消失；使用旧 `owner_revision` 提交 effect；超出 deadline/budget。检测器不是直接删除 session，而是：

1. 将状态标记为 `SUSPECT_ORPHAN` 并冻结新的 capability grant；
2. 查询外部系统与 outbox，确认 effect 是否已发生；
3. 令旧 lease 失效，并用 fencing 拒绝迟到写入；
4. 由 reconciler 回收 container、worktree、浏览器、临时凭证和锁；
5. 将 trace、最后 heartbeat、退出码、artifact digest 和 effect 对账结果写入 evidence bundle。

“取消成功”必须至少证明：不再接收任务、所有有效写 lease 已撤销、长进程已退出或被隔离、关键 effect 已对账。对不可逆操作，补偿动作也要按新任务和新审批建模，不能让 cleanup Agent 静默执行。

## 八、四类 Runtime 的实现映射

| Runtime | 公开能力 | 生产控制面应怎样使用 |
| --- | --- | --- |
| Claude Code | custom subagents、background work、agent view、worktree isolation | 用 agent definition 限工具和 turns；文件写入使用 worktree；不要把 parent 宽权限默认传给 child；会话结束前审阅/合并或保留变更 |
| Codex | app 中的多 Agent、built-in worktrees、云环境、后台 threads、skills/automations | 将每个 thread 映射到 task；worktree/diff 是 artifact 而非验收；通过 review、CI、审批与环境回执完成 fan-in；云端和本地 handoff 要重新校验凭证与资源边界 |
| OpenClaw | subagent session、optional sandbox、深度策略、child 上限、announce chain、cascade stop | 维持默认 leaf 最小工具面；仅让显式 orchestrator 在受控深度继续 spawn；用 `/stop` 的级联语义配合业务 effect 对账；不要依赖 announce 文本判断完成 |
| Hermes | `delegate_task` child session、restricted toolsets、parallel batch、configurable concurrency/profiles | 给 child 明确 toolset 和 goal/context 摘要；将不同租户/目的分 profile；同步 delegation 不适合必须跨中断长期存活的作业，改用 cron/background executor 与持久控制面 |

Claude Code 的 [Run agents in parallel](https://code.claude.com/docs/en/agents) 将子 Agent、Agent view、teams 和 worktrees 区分为不同并行形态；不是所有“并行”都具有同样的隔离和交接语义。[OpenAI Codex](https://openai.com/codex/) 公开描述 app 的 worktree 与 cloud environments 并行工作方式，并强调命令中心式的监督；[Codex App 介绍](https://openai.com/index/introducing-the-codex-app/) 也明确默认 sandbox 与项目级规则的边界。

[OpenClaw Sub-agents](https://docs.openclaw.ai/tools/subagents) 给出了非常可借鉴的防失控机制：按深度收紧 tool policy、限制 active children、默认隔离 session、通过 announce 链返回结果，并在停止 orchestrator 时级联停止子任务。不要把这些运行时限制误解为自动业务正确性，仍需 idempotency 和 effect reconciliation。

[Hermes Delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation) 说明 child Agent 使用 fresh conversation、受限 toolset 和独立 terminal，只将最终摘要返回父方；并行批次默认最多三个并发 worker，且 parent 中断会取消 active children。对于长生命周期业务任务，这一事实正说明要将 durable job/lease 放到运行时之外的控制平面。

## 九、企业 Coding Agent 系统设计题

### 题目

> 设计一个“自动修复失败 CI”的多 Agent 系统：可以同时分析日志、复现问题、修改不同模块，但不得让两个 Agent 修改同一文件，不得自动部署生产，父任务崩溃后不能留下仍在写代码或占用凭证的子 Agent。

### 高分解法

1. **Admission：** webhook 以 `repo/commit/ci_run` 作为幂等键，创建 parent task；先判定 PR 是否可写、预算是否可用、是否存在同一提交的 active run。
2. **Plan：** planner 输出 file/module ownership 与 DAG；只读 diagnostician 和 reproducer 可并发，修改 worker 必须获得路径/模块 lock 与独立 worktree。
3. **Delegation：** 每个 worker 拿到最小 context、受限工具、短期 CI token、TTL lease 和不含 deploy 的 capability grant。
4. **Fan-in：** orchestrator 校验 patch digest、路径锁、测试报告、静态扫描、冲突 diff；合并候选只创建 PR/commit，生产部署仍需独立 pipeline 与审批。
5. **Failure：** 取消或 parent crash 后 revoke lease、停止 runner、清理 worktree/token；reconciler 根据 CI/PR APIs 检查已有 commit、评论或 workflow，保证重试不会重复发评论或重复创建 PR。
6. **Audit：** 记录任务图、owner revision、所有 grant/deny、artifact 和 effect；把最终交付明确为 `PR_CREATED + CI_EVIDENCE + REVIEW_STATE`，不接受“修好了”的文本。

### 常见追问与回答

**Q：两个 Agent 都改到了同一个共享库，怎么处理？** 先在计划阶段让同一写集合串行；若运行时发现冲突，fan-in 拒绝自动合并，保留两个 patch，重新派给 integrator 在新 worktree 中解决。不能按时间戳覆盖，也不能让两个 Agent 都 rebase 后强推。

**Q：handoff 后原 Agent 又恢复网络并继续写怎么办？** 每一次写请求都携带 lease 的 fencing token 和 owner revision；工具网关只接受当前版本。旧 worker 的继续执行会被拒绝并记录为 stale writer，而不是靠“请它停止”的自然语言承诺。

**Q：如何防止子 Agent 无限递归派活？** 默认 leaf 不具有 spawn 能力；orchestrator 只获得深度、子数、预算和任务类型均受限的 delegation capability。每次 spawn 要由控制面扣除预算并写入 delegation graph，超过上限进入人工/队列，而不是继续调用模型。

**Q：为什么子 Agent 的最终 summary 不能作为唯一交接物？** summary 是非结构化、可丢失细节的陈述。交接至少还要带 artifact refs、digest、环境/模型/工具版本、未完成项、测试证据、effect 状态和权限/lease 终态；接收方需要验证这些可引用事实。

## 十、上线检查表

### 任务与权限

- [ ] 每个 child 有 parent、owner、目标、acceptance、deadline、budget 和租约。
- [ ] grant 是父权限子集，写能力、网络、凭证、tenant 和副作用单独约束。
- [ ] handoff 使用 offer/accept/activate/ACK，只有激活后才撤销父方写 lease。
- [ ] 每个关键写工具检查 owner revision/fencing token，并保留 policy/approval evidence。

### 并发与收敛

- [ ] 写集合有 worktree、路径锁、资源锁或串行策略；只读和写任务不会被混为同一队列。
- [ ] fan-out 有任务图、深度、并发、预算和速率限制。
- [ ] fan-in 按 acceptance、artifact、测试和 effect 对账收敛，处理 partial、timeout、conflict 和 late result。
- [ ] 推测执行不拥有生产写 capability，loser 的资源会显式回收。

### 回收与审计

- [ ] parent cancel/crash 后会 revoke lease、停止执行器、回收 worktree/container/browser/token/lock。
- [ ] orphan detector、heartbeat、deadline、budget 和 effect reconciliation 有独立告警。
- [ ] 取消、失败和过期任务保留证据，但不能重用旧终态直接执行。
- [ ] 关键交付包括外部 effect ID 与验收证据，绝不以 Agent 的“done”文本作为事实。

## 延伸阅读

- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)、[Run agents in parallel](https://code.claude.com/docs/en/agents)、[Worktrees](https://code.claude.com/docs/en/worktrees)：隔离 context、工作区和多会话运行方式。
- [Codex](https://openai.com/codex/) 与 [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)：worktrees、云环境、多 Agent 管理与 sandbox 边界。
- [OpenClaw Sub-agents](https://docs.openclaw.ai/tools/subagents)：session 隔离、深度/工具策略、active-child 上限、归档和级联停止。
- [Hermes Subagent Delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation) 与 [Delegation patterns](https://hermes-agent.nousresearch.com/docs/guides/delegation-patterns/)：fresh child context、toolset、并行批次及中断语义。
