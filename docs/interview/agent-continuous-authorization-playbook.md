# 长任务 Agent 持续授权与紧急撤权：Claude Code / Codex / OpenClaw / Hermes

> 一次“允许执行”不能覆盖一个持续数小时、会暂停恢复、会调用多个工具、可能更换资源的 Agent 任务。真实生产问题是：用户批准了读日志，Agent 之后要部署怎么办？审批后 prompt、目标分支或金额变了怎么办？策略刚收紧，正在运行的 job 能否继续？紧急撤权时，已经发到下游的命令如何阻止或对账？本页将审批从一次 UI 点击提升为持续授权状态机。

> 风险分级与 prepare/commit 模式见 [Agent 工具安全与权限边界](/agent/tool-safety)，服务端策略执行见 [企业 Tool Gateway 安全执行设计](/interview/tool-gateway-security-design)，多 Agent 的 owner/lease/孤儿任务见 [多 Agent 委派与 Handoff 控制平面](/interview/multi-agent-delegation-handoff-playbook)。

## 30 秒总答法

> 我不把批准实现成“本会话永久放行”，而是签发绑定 `subject、task、tool、resource selector、action digest、risk、budget、TTL、policy revision` 的短期 capability。每次工具调用、恢复任务、资源切换、风险升阶、策略版本变化和 lease 续期都重新评估；授权状态为 `requested -> granted -> active -> suspended -> revoked/expired -> reviewed`。批准对象必须冻结动作、参数、资源版本、额度和数据分类，避免审批后 TOCTOU。撤权通过 token introspection、短 TTL、fencing token、网关二次鉴权和 effect reconciliation 实现，不能只取消聊天界面。紧急提权需要职责分离、很短时间窗、双人或值班审批、全量审计和事后复核。Claude Code 的 permissions 与 hooks、Codex 的 sandbox/approval/managed requirements、OpenClaw 的 host approvals 与 stricter-wins policy、Hermes 的 approval modes 与 pre-tool hook 都是执行面控制点；企业还要在其外部建立统一授权控制面。

## 一、授权的四种语义

| 类型 | 谁发起 | 权限范围 | 何时失效 | 适用场景 |
| --- | --- | --- | --- |
| Initial grant | 用户/策略 | 首个低风险任务 | TTL、任务完成 | 读取仓库、跑测试 |
| Step-up grant | 审批人/风险引擎 | 一个明确高风险动作 | action 完成或超时 | 创建 PR、写入工单、部署 staging |
| Delegated grant | 父任务控制面 | 父权限的严格子集 | child lease/父任务结束 | 子 Agent 修复模块 |
| Break-glass grant | 值班负责人 + 独立审计 | 紧急且最小的恢复动作 | 很短 TTL、自动复核 | 阻断错误发布、撤销泄露凭证 |

不要把“登录身份有效”“模型有工具列表”“用户点过一次确认”当成可执行权限。它们分别是身份、可见性和历史意图；实际调用还必须同时满足当前策略、有效 grant、资源约束、环境边界和下游鉴权。

## 二、持续授权状态机

```text
REQUESTED -- policy/approval --> GRANTED -- bind lease --> ACTIVE
    |                                  |                     |
    | deny/timeout                     | context/risk change | task ends
    v                                  v                     v
DENIED                              SUSPENDED ----------> COMPLETED
                                        |  |                    |
                         reauthorize --+  +-- revoke/expiry --> REVIEWED
                                                           |
                                                        REVOKED
```

### 状态含义

| 状态 | 是否可产生 effect | 控制面动作 |
| --- | --- | --- |
| `REQUESTED` | 否 | 冻结审批对象，选择审批人/策略路径 |
| `GRANTED` | 否，直到绑定运行尝试 | 签发短期 capability 与审批证据 |
| `ACTIVE` | 是，限 scope/TTL/budget | 每次调用校验 token、policy、lease、fencing |
| `SUSPENDED` | 否 | 保存证据，等待再授权或人工决策 |
| `REVOKED` / `EXPIRED` | 否 | 拒绝新调用，终止/隔离执行器，对账在途 effect |
| `REVIEWED` | 否 | 完成审计、复盘与策略改进 |

系统不能把暂停的 Agent 直接从旧 transcript 恢复到 `ACTIVE`。恢复是一次新的 admission：重新加载 policy revision，检查用户/租户/环境、grant TTL、工具版本、数据分类、预算和未完成 effect。

## 三、最小 capability：把批准绑到事实

```json
{
  "capability_id": "cap_9f1",
  "subject": "agent-run:run_104",
  "delegated_from": "user:alice",
  "task_id": "task_482",
  "tool": "deployment.create",
  "resource_selector": "service=checkout,env=staging",
  "action_digest": "sha256:8f...",
  "policy_revision": "policy-2026-07-14.3",
  "risk": "high",
  "limits": {"ttl_seconds": 300, "max_uses": 1, "money": 0},
  "lease_fence": 17,
  "approval_id": "apr_390"
}
```

`action_digest` 应覆盖规范化后的命令/参数、资源 ID、目标环境、金额/数量上限、数据标签和策略义务。对于不可稳定哈希的大对象，审批显示结构化 diff 和 artifact digest；执行器只接受该 digest 引用的受控工件。

批准人看到的是“将 checkout 的 release `abc123` 部署到 staging，一次，5 分钟内，运行 smoke test”，而不是“允许 Agent 发布”。审批对象一旦变化，原 grant 不能复用。

## 四、何时强制再授权

| 触发器 | 为什么不能沿用旧授权 | 推荐动作 |
| --- | --- | --- |
| 工具从 read 变 write | 副作用类别改变 | `SUSPEND`，申请 step-up |
| 资源/环境变化 | 从 staging 转 production 或租户变化 | 新 resource selector + 审批 |
| 参数/金额超界 | 原 action digest 不再匹配 | 拒绝或重新 prepare |
| 会话恢复/worker 重启 | 原 policy、凭证和上下文可能失效 | resume admission |
| policy revision/kill switch | 组织风险姿态改变 | re-evaluate，必要时 revoke |
| 注入/异常信号 | 工具输出或网页可能改变行为 | 降级为只读/人工确认 |
| deadline、预算、lease 到期 | 避免僵尸任务长期持权 | expire，创建新的 attempt |
| delegated owner 改变 | 责任主体改变 | 父 grant 作废，child 重新签发 |

不要依赖模型“意识到风险升高”。风险分类和再授权触发器必须在 tool gateway/PEP、scheduler 和 credential broker 等确定性控制点执行。

## 五、审批流：Prepare、Freeze、Approve、Commit、Reconcile

```text
model intent
  -> policy decision + prepare plan
  -> freeze action/resource/limits/digest
  -> approval request
  -> issue short capability
  -> gateway re-check + commit with idempotency key
  -> downstream receipt + reconciliation
  -> close/review or compensate
```

### TOCTOU 防护

审批后才发生的资源变化是最危险的窗口。网关在 commit 时必须再次读取当前事实：目标分支是否仍是受保护分支、部署窗口是否仍开放、资源版本是否一致、审批人是否仍有角色、预算是否仍可用、token 是否已撤销。任何不一致都使批准失效，而不是“尽量执行”。

对于长流程，把 prepare 的稳定输出存在不可变 artifact store，审批记录保存 digest；不要将原始参数放在可被 Agent 后续编辑的聊天消息或临时文件中。

## 六、撤权不是取消按钮

### 撤权的分层动作

1. **控制面：** 把 grant 标记 revoked，递增 owner/lease fence，阻止新 dispatch。
2. **凭证面：** 令 token introspection 返回失效，撤销短期 OAuth/session、KMS grant、MCP session 或数据库角色。
3. **执行面：** cooperative cancel，超时后 kill container/process/browser；清理 worktree、临时文件和持有锁。
4. **网关面：** 每个写请求二次检查 grant、fence、policy revision 和 idempotency key。
5. **业务面：** 用 effect ID 到下游对账，确认部署/PR/发信/付款是否已经发生；必要时创建新的补偿任务和审批。

### 为什么需要 fencing token

网络分区时，旧 worker 可能没有收到取消消息但仍持有旧凭证。仅靠 TTL 仍可能在边界瞬间竞态。为每次 lease/owner 变更递增 fence，要求下游写 API 只接受最新值；旧 worker 即使恢复网络，也被确定性拒绝。这是分布式锁而非 LLM 推理应承担的职责。

## 七、紧急提权与紧急撤权

Break-glass 不是“打开 YOLO 模式”。它仅适用于已有故障/安全事件且普通路径无法在时限内处理的场景。

| 控制 | 要求 |
| --- | --- |
| 触发依据 | incident ID、影响范围、预定义 runbook 和最小目标资源 |
| 职责分离 | 请求者与批准者分离；高风险生产动作使用双人或轮值确认 |
| 范围 | 一工具/一资源/一动作/一时间窗，禁止通配符全开 |
| 环境 | 尽量使用受控 bastion/sandbox，网络和命令 allowlist 收紧 |
| 记录 | 原因、批准者、前后状态、全部工具调用、effect ID、结束时间 |
| 自动收敛 | TTL 到期自动撤销；事件后强制 review、密钥轮换/策略修订 |

紧急止血可以临时提高速度，不能降低事实校验。比如“关闭错误功能开关”仍应冻结具体 flag/key，执行后读取下游回执；不应批准“让 Agent 自己修复生产”。

## 八、四类 Runtime 的官方控制面映射

### Claude Code：Hook 先行，deny 仍有最高优先级

[Claude Code permissions](https://code.claude.com/docs/en/agent-sdk/permissions) 描述的顺序是 Hook、deny rules、permission mode、allow rules、`canUseTool`。Hook 的 allow 不会覆盖匹配 deny rule，这正好适合作为“策略不可被低层自动批准绕过”的实施原则。[Hooks](https://code.claude.com/docs/en/hooks) 的 `PreToolUse` 和 `PermissionRequest` 可决定 block/deny 或修改被允许的输入；但 HTTP hook 的网络/超时错误默认是非阻断的，因此高风险策略服务不能只依赖“请求失败就自然安全”，需要明确 fail-closed 的本地网关或命令 hook。

企业应使用 managed permission rules、sandbox 与 MCP 限制来锁定下限。官方 [组织配置](https://code.claude.com/docs/en/admin-setup) 还列出可禁用 bypass permission mode、限制 HTTP hook URL 和只加载托管 Hook 的控制面。一次会话内的“always allow”不应替代生产 capability token。

### Codex：把 sandbox、审批、网络和托管要求组合起来

[Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/) 将 sandbox boundary、approval policy、managed network policy、managed requirements 与 agent-native telemetry 组合；对越过 sandbox 的请求要求 review，并说明低风险可经 auto-review、较高风险应显式停下。正确映射是：Codex 的本地/云端审批是执行体验，企业必须把每个关键 effect 绑定到外部 policy/approval/evidence。

该文也强调网络 allow/deny 与对未知域名的审批。业务系统不要把“允许网络”当成一种永久 grant，而应将域名、API scope、数据分类和 TTL 纳入 resource selector。Codex plugins 同样继承 workspace app 的读/写、确认、源系统 RBAC 和域名限制，见 [Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/)；插件不能突破原系统权限。

### OpenClaw：执行主机审批取更严格者，并绑定批准计划

[OpenClaw Exec approvals](https://docs.openclaw.ai/tools/exec-approvals) 明确 host exec 只有在 config policy、allowlist 和可选用户批准都同意时才运行，并且 host-local approval 可以收紧上层配置。其 node approval 会保存 canonical execution plan；批准后若 command、cwd、agent 或 session 被修改，转发会因 mismatch 拒绝。这是冻结审批对象的直接运行时例子。

[OpenClaw Policy](https://docs.openclaw.ai/cli/policy) 可检查 workspace-only、exec security、ask posture、host、elevated 和工具元数据等基线；[Permission modes](https://docs.openclaw.ai/tools/permission-modes) 则区分 host 位置和批准模式。生产上应继续在外部业务网关做资源级/租户级授权，不能把 CLI 模式作为全部业务权限模型。

### Hermes：批准模式与 Hook 是同一条风险链上的不同关口

[Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security/) 提供 manual/smart/off approval mode、超时及 cron 场景的 deny/approve 策略，且允许 user-defined deny patterns 在 YOLO/off 下仍强制阻止匹配命令。[Hermes Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/) 的 `pre_tool_call` 可 veto 调用，`pre_approval_request` 能在所有交互表面发出审批通知。

把 `off`、全局 allowlist 或自动批准视为“持续授权”是危险的。它们只影响本地 runner 的决策；业务写操作仍需要绑定 task/resource/effect 的 capability，且 Hook 配置本身是高权限代码，应版本化、审查并通过 `hooks doctor` 检查。

## 九、系统设计题：生产发布 Agent 的分级授权

> 设计一个 Agent：它可以分析 CI、修复代码、创建 PR、部署 staging；生产发布只能在变更窗口内由两位值班人员批准。任务可持续两小时，并可能在中间暂停恢复。

### 推荐设计

1. **默认态：** 只读 repo/CI、独立 worktree、无生产网络；每个 run 有 task、tenant、lease、budget 和 trace。
2. **修复/PR：** 以路径 scope 的临时写 capability 创建 worktree/PR；CI success 只是 artifact，不自动升级为 deploy 权限。
3. **staging：** prepare deployment manifest，冻结 release SHA、service、environment、window、smoke test 和 TTL；通过单人/策略审批签发一次性 staging capability。
4. **production：** 在窗口内触发新的 prepare；双人批准、当前 on-call/role 和 change ticket 都在 commit 时复核；capability 只允许一份不可变 manifest 和一个 effect。
5. **暂停恢复：** 旧 grant 不恢复。重新 admission、刷新 policy/风险/预算，未执行的 production plan 必须再次确认。
6. **撤权：** 值班人员可 revoke capability；gateway 阻断新调用，runner 停止，deployment provider 以 effect ID 查询真实状态；若已开始，用独立补偿/rollback task 处理。

### 高频追问

**Q：为什么不能给 release Agent 一个两小时的 production token？** 因为目标、代码 SHA、审批人角色、变更窗口和风险可能在两小时内变化。应给两小时的只读/分析 lease，而生产 effect 使用短期、一次性、绑定 manifest digest 的 step-up grant。

**Q：审批超时如何处理？** 默认 deny/suspend，不循环提醒或偷偷降级到更宽的权限；将 request、原因、冻结计划保留给下一位审批人，并在 plan 已过期时重新 prepare。

**Q：策略变更会不会把正在跑的任务全部杀掉？** 策略引擎需要声明变更语义：立即 revoke 高风险 grant、允许只读步骤完成、或在下一 tool boundary re-evaluate。无论哪种，都要记录 policy revision 和 effect 对账；不能让不同 worker 各自猜测。

**Q：怎样降低审批疲劳？** 用风险分级、稳定 allowlist、最小 scope、可解释 prepare 和可靠自动批准处理低风险动作，而不是拉长 TTL 或把危险命令全局放行。审批质量高于点击次数少。

## 十、上线检查表

### 授权状态与契约

- [ ] capability 绑定 subject、task、tool、资源、action digest、预算、TTL、policy revision 和审批证据。
- [ ] 恢复、资源切换、写操作、风险升阶、策略变化、lease/预算到期均会重新授权。
- [ ] `GRANTED` 与 `ACTIVE` 分离，执行前二次检查冻结对象和当前事实。
- [ ] 默认 deny；任何自动批准均不能覆盖明确 deny rule 或下游资源鉴权。

### 撤权与应急

- [ ] revoke 会同时使 capability、凭证、lease 和网关写入失效，并使用 fencing token 拒绝 stale worker。
- [ ] 关键 effect 有 idempotency key、下游 receipt 和 reconciliation 状态。
- [ ] break-glass 有 incident/runbook、职责分离、短 TTL、最小 scope、全量审计和强制 review。
- [ ] 策略/Hook/审批配置走代码审查、测试、灰度和回滚，不允许在事故中静默永久修改。

### 度量与演练

- [ ] 监控 approval latency、timeout、deny/allow、step-up、grant expiry、revocation lag、stale write reject 与 effect reconciliation coverage。
- [ ] 演练审批后参数改变、worker 断网恢复、策略紧急收紧、生产窗口关闭和下游已执行但无回执。
- [ ] 审计可关联用户、审批人、owner、task、policy revision、capability、工具和 effect，且内容按数据等级脱敏。

## 延伸阅读

- [Claude Code Permission Evaluation](https://code.claude.com/docs/en/agent-sdk/permissions)、[Hooks](https://code.claude.com/docs/en/hooks)、[组织配置](https://code.claude.com/docs/en/admin-setup)：Hook、deny/allow、sandbox、托管配置。
- [Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/) 与 [Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/)：审批、sandbox、网络策略、插件与源系统权限。
- [OpenClaw Exec approvals](https://docs.openclaw.ai/tools/exec-approvals)、[Policy](https://docs.openclaw.ai/cli/policy)、[Permission modes](https://docs.openclaw.ai/tools/permission-modes)：严格策略、冻结执行计划和本机审批。
- [Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security/) 与 [Event Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/)：批准模式、不可覆盖 deny 与工具 Hook。
