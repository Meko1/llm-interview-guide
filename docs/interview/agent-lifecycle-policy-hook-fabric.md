# Agent 生命周期事件与 Policy Hook Fabric：跨运行时事件契约、同步闸门与可靠分发

> 本页不讨论“怎样把一个 Hook 打包发布”，而是讨论运行中的 Agent 事件怎样进入企业控制面：哪些路径能在副作用前阻断，哪些只能异步观察，外部 webhook 怎样可靠接入，以及如何让 Claude Code、Codex、OpenClaw、Hermes 的差异不污染业务策略。

## 一、面试先给结论

> 我会把 Agent 运行时产生的事件统一收敛为 `Policy Hook Fabric`。工具调用、审批、会话、子 Agent、模型回合和外部 webhook 都先被归一化为带版本的事件信封。对会产生外部副作用的动作，在执行路径上经过短时、确定性的同步 Policy Gate；审计、评测、告警、索引和通知走 outbox 进入异步事件总线。这样既不会让一个“记日志 Hook”拖垮主链路，也不会寄希望于 `PostToolUse` 之类的后置观察者补救已经发生的生产写入。

这套回答要主动区分三件事：

1. **生命周期回调不是授权**：Runtime 的 Hook 能提供上下文和局部拦截点，资源服务、数据库、部署平台仍必须做最终鉴权。
2. **观察事件不是策略闸门**：一个已执行后的事件可以触发审计、补偿和告警，不能倒流成“取消已经发出的付款”。
3. **产品名不是公共协议**：Claude Code 的 `PreToolUse`、Hermes 的 `pre_tool_call`、OpenClaw 的 typed plugin hook、Codex App Server 的通知流，语义和失败模型并不相同；业务策略必须通过 adapter 映射。

## 二、先划清四类事件

| 类别 | 例子 | 可否改变主路径 | 正确用途 |
| --- | --- | --- | --- |
| 运行时生命周期事件 | session start、compact、subagent stop、turn complete | 依 Runtime 而定 | 初始化、清理、检查点、状态投影 |
| 同步策略事件 | `tool.requested`、`approval.requested`、`effect.prepared` | 可以，但必须有明确契约 | allow、deny、ask、降权、修改输入 |
| 领域/审计事件 | `tool.completed`、`diff.created`、`deployment.receipt` | 不应改变已完成 effect | 取证、指标、评测、对账、告警 |
| 外部 webhook | GitHub PR、OAuth revoke、CI 完成、工单更新 | 只能触发新的受控工作 | 验签、归一化、入队、派生任务 |

不要把它们统称为“事件总线”。同步策略事件有用户等待和副作用前的时延预算；异步事件追求可重试、可回放和最终一致性；外部 webhook 的载荷默认不可信。三者共用 `event_id` 并不等于共用执行语义。

```text
Runtime / Webhook
       |
       v
  Adapter + normalizer ----> immutable audit envelope
       |
       +--> synchronous Policy Gate --> capability / approval --> tool runner
       |                                                     |
       |                                                     v
       +-------------------- outbox <------------------- effect receipt
                                      |
                                      v
                         event bus / consumers / DLQ
                         audit, eval, alert, index, reconcile
```

## 三、统一事件信封：传摘要，不把机密塞进总线

无论原始事件来自 CLI、App Server、Gateway 还是 GitHub，都先转成企业自己的版本化信封。原始载荷可留在加密的证据存储中，事件总线上只保留允许分发的摘要和受控引用。

```json
{
  "event_id": "evt_01J...",
  "type": "agent.tool.requested",
  "schema_version": 3,
  "occurred_at": "2026-07-15T10:08:11.438Z",
  "tenant_id": "tenant_finance",
  "environment": "prod",
  "runtime": { "kind": "claude_code", "adapter_version": "2.3.1" },
  "actor": { "user_id": "u_42", "agent_id": "release-agent" },
  "execution": {
    "task_id": "task_7b1",
    "session_id": "sess_9c2",
    "turn_id": "turn_18",
    "tool_call_id": "call_51",
    "attempt": 1
  },
  "correlation_id": "corr_abc",
  "causation_id": "evt_previous",
  "policy": { "revision": "policy@2026-07-15.4", "risk": "high" },
  "subject": { "tool": "deploy", "action": "promote", "resource_ref": "ref://release/913" },
  "payload_ref": "vault://agent-events/evt_01J...",
  "payload_digest": "sha256:...",
  "redacted_summary": { "target_environment": "production", "change_sha": "a1b2c3" }
}
```

### 字段为什么这样设计

- `event_id` 是全局去重键；每次真正的新意图都要新 ID，重投或重试保留该 ID 并增加 `attempt`。
- `correlation_id` 串起一次用户目标、父子 Agent 与异步消费者；`causation_id` 只指向直接触发自己的上游事件，便于重建因果图而非只得到一条日志链。
- `schema_version` 与 `adapter_version` 让旧消费者能拒绝未知字段、让事故调查能定位“哪一版产品适配器翻译错了”。
- `payload_ref` 需要按 tenant、数据等级和最小权限单独授权；消息队列主题不是秘密存储。
- `policy.revision`、`capability_id`、审批证据和最终 effect receipt 必须可关联。没有这些，系统只能说明“某个 Agent 好像调用了工具”。

### 事件类型的命名规则

推荐采用 `agent.<noun>.<past-or-intent>`，并把 intent 与事实分开：

| 事件 | 含义 | 常见消费者 |
| --- | --- | --- |
| `agent.tool.requested` | 模型提出工具意图，尚未执行 | 同步 gate、审批服务 |
| `agent.tool.authorized` | 策略和凭证已允许，不代表执行成功 | runner、审计 |
| `agent.tool.completed` | runner 获得成功或失败结果 | trace、评测、结果归档 |
| `agent.effect.prepared` | 高风险操作已冻结对象和参数 | step-up approval |
| `agent.effect.receipted` | 下游返回可对账的 receipt | 对账、补偿、通知 |
| `integration.webhook.accepted` | 外部请求已验签并入库 | 异步派生器 |
| `integration.webhook.rejected` | 验签、时间窗或租户映射失败 | 安全告警、审计 |

不要发布含糊的 `agent.updated` 或 `hook.done`。消费者会被迫猜它是“开始、成功、部分成功还是未知”，重放时更无法判断。

## 四、同步 Policy Gate：只放在副作用前的窄路径

同步 Hook 的职责应是把一个候选动作变成确定性决策，而不是执行任意业务逻辑。推荐顺序如下：

```text
tool intent
  -> schema + input classification
  -> static deny rules
  -> capability / resource authorization
  -> risk scoring + required approval
  -> optional input normalization
  -> immutable execution plan digest
  -> runner executes with short-lived credential
  -> receipt and outbox record
```

### Gate 的最小返回契约

```json
{
  "decision": "require_approval",
  "reason_code": "PROD_DEPLOY_REQUIRES_CHANGE_WINDOW",
  "policy_revision": "policy@2026-07-15.4",
  "plan_digest": "sha256:...",
  "capability": { "id": "cap_8f", "expires_at": "2026-07-15T10:10:00Z" },
  "constraints": { "network": "none", "max_runtime_seconds": 120 }
}
```

允许的决策集合应少且稳定：`allow`、`deny`、`require_approval`、`defer`、`modify`。其中：

- `modify` 只能产生符合工具 schema 的替换输入，并连同原始输入、修改人/策略版本写入审计；禁止把它做成悄悄改生产目标的黑箱。
- `defer` 表示当前无法安全完成决策，例如等待权威资源状态，不是“默认放行”。
- `allow` 也只应签发绑定 `task + tool + resource + plan_digest + TTL` 的短期 capability，不是授予长期万能权限。

### 冲突、优先级和超时

1. 静态显式 deny、资源服务 deny、撤销状态永远优先，低层 Hook 不能用 `allow` 覆盖。
2. 同层规则使用显式 priority 和稳定 tie-break；记录每条匹配规则，不只记录最终结果。
3. 高风险写入的 Gate 超时、未识别 schema、策略版本缺失均为 fail-closed；只读诊断可以受控 fail-open，但要打上 `policy_unavailable` 标签并限制能力。
4. 同步 Hook 必须有独立小预算，例如 100 至 500 ms 的本地规则或几秒的审批创建；慢速检索、LLM 判断、网络爬取放到异步预计算，不能卡住每一个工具调用。

**反例**：把 `PostToolUse` 当作部署拦截点。部署已经被发送，再阻断对话只能阻止模型继续解释，不能撤回 effect。正确方式是在 `effect.prepared` 或 `tool.requested` 时冻结对象并要求批准，执行后只做 receipt 对账与补偿。

## 五、跨 Runtime 映射：能力适配，不做名称翻译

| Runtime | 可用的关键表面 | 适合映射到 Fabric 的含义 | 不能假设的事 |
| --- | --- | --- | --- |
| Claude Code | `PreToolUse`、`PermissionRequest`、`PostToolUse`、session/subagent/compact 事件 | 前置 gate、审批同步点、后置审计、生命周期投影 | 所有事件都能阻断；后置 Hook 能回滚副作用 |
| Codex | App Server thread/turn/item 事件、客户端 approval request、sandbox 边界 | 将事件流投影为观察事件；把批准和 sandbox 结果接入控制面 | App Server 通知等同于通用可插拔 policy Hook |
| OpenClaw | typed plugin hook `api.on(...)`、内部 Hook、Gateway 事件、tool-result middleware | 有序 middleware/policy、粗粒度侧效应、Gateway 生命周期、结果变换 | `registerHook(...)` 的观察回调具有 typed policy 的优先级和 block/cancel 语义 |
| Hermes | `pre_tool_call`、`pre_llm_call`、`pre_verify`、post/session/subagent hooks | 工具 veto、上下文注入、完成前继续验证、观测 | 所有 Hook 的失败都会阻断；普通 observer 可以替代资源鉴权 |

### Claude Code：前置优先级是产品语义，不是企业授权本身

Claude Code 的 Hooks 参考明确列出事件可否阻断：`PreToolUse` 可以阻止工具调用，`PermissionRequest` 可以拒绝权限，`PostToolUse` 则只能在工具已完成后提供反馈。多个 `PreToolUse` 的决策以 `deny > defer > ask > allow` 合并，且同一事件的多个 Hook 可以并行运行。因此企业 Hook 不应假设“一个 deny Hook 让其他 Hook 没有副作用”，审计或网络通知必须本身幂等且无权扩大影响。[Claude Code Hooks](https://code.claude.com/docs/en/hooks) [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)

把 Claude Code 原始事件转换为 `agent.tool.requested`、`agent.permission.requested`、`agent.tool.completed` 和 `agent.session.compacted`，而不是让下游消费者依赖 `PreToolUse` 字符串。企业执行网关还要在真实资源处再次检查 capability，因为模型侧的本地准入并不能替代云 API、数据库或部署平台的授权。

### Codex：把 App Server 的稳定事件流当作观察和交互协议

OpenAI 对 Codex App Server 的公开介绍将它描述为双向 JSON-RPC/JSONL 协议：一个 client request 可产生多条 server notification，`item` 有 started、delta、completed 生命周期；当需要用户输入或审批时，server 发起请求并暂停 turn，直到 client 回应 allow 或 deny。这很适合适配为企业的 thread/turn/item 观测事件和审批工作流。[Unlocking the Codex harness](https://openai.com/index/unlocking-the-codex-harness/)

但它不是“每一个 App Server 事件都可在产品内部拒绝”的承诺。对 Codex，适配器应把客户端审批、sandbox 范围、工具执行结果和 diff 当作事实来源；需要统一强制策略时，把高风险外部工具放到自有 Gateway，并在 Gateway 执行前再次授权。Codex 的审批模式与 sandbox 是安全边界的一部分，不能被事件消费者异步“补上”。[Codex CLI Getting Started](https://help.openai.com/en/articles/11096431)

### OpenClaw：内部 Hook 和 typed plugin hook 是两条不同的路

OpenClaw 文档明确区分：内部 Hook 适合 `/new`、`/reset`、`message:sent`、session compact、Gateway 启停等粗粒度生命周期副作用；需要 priority、merge、block/cancel 的 middleware、工具控制和 prompt shaping 应使用 typed plugin hook `api.on(...)`。另外，tool-result middleware 是工具执行后、结果返回模型前的受控接缝，不能用来假装阻断已经发生的外部执行。[OpenClaw Hooks](https://docs.openclaw.ai/automation/hooks) [OpenClaw Plugins](https://docs.openclaw.ai/plugins) [Plugin SDK overview](https://docs.openclaw.ai/plugins/sdk-overview)

面试里可落到验证命令：变更插件后，用 `openclaw plugins inspect <plugin-id> --runtime --json` 验证运行中的 Gateway 真正注册了哪些 Hook、工具与服务；只看 manifest 或冷配置不能证明线上流量已走新策略。

### Hermes：veto 与 observer 的边界非常清楚

Hermes 的 Event Hooks 文档说明，`pre_tool_call` 可返回 block 来 veto 工具，`pre_llm_call` 可注入上下文，其他大多数回调为 fire-and-forget observer；Hook 出错会记录并跳过，不能让错误插件击穿 Agent 循环。其 shell Hook 使用 JSON stdin/stdout 协议，还需要考虑首次运行授权和非交互环境的显式 allowlist。[Hermes Event Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/)

这提示了一个产品设计原则：将“安全策略必须可用”放在 Gateway/资源服务，而不要把 fail-closed 的最后防线压在故意 fail-open 的观察 Hook 上。`pre_verify` 可以要求 Agent 再跑一次测试，却不应被用来证明已经写入的外部系统满足事务语义。

## 六、外部 Webhook：接收成功不等于业务已执行

一个 GitHub、CI、OAuth 或工单 webhook 的 HTTP 200 只表示入口接受了投递。它不应同步拉起耗时 Agent，也不应把 webhook body 当作可信指令。

### 入站处理流水线

```text
HTTP receive
  -> enforce size/content-type/IP policy
  -> verify provider signature and timestamp window
  -> bind installation/repository to tenant and policy
  -> persist raw encrypted payload + delivery id atomically
  -> dedupe / replay detection
  -> emit integration.webhook.accepted through transactional outbox
  -> async worker fetches authoritative object again
  -> create a fresh, least-privilege Agent task
```

1. **先验证再解析业务语义**：使用原始字节验签；校验 timestamp、nonce 或 provider delivery ID，拒绝时间窗外和重复请求。
2. **持久化与投递原子化**：将 payload metadata、去重记录和 outbox 同事务写入。直接“HTTP handler 发 Kafka”会在数据库成功、消息失败时丢任务，或反过来造成幽灵任务。
3. **重新读取权威对象**：PR 标题、Issue 评论、commit message 都是不可信文本。worker 以安装凭证重新拉取实际 diff、仓库权限和当前分支状态，再构造 Agent 任务。
4. **事件不能携带执行权**：webhook 只能提议“可能需要 review”；发布、合并、支付等动作仍需新的 capability、审批和资源鉴权。

### 去重、重试和 DLQ

| 情况 | 推荐处理 |
| --- | --- |
| 同一 delivery 重投 | 用 `provider + delivery_id` 幂等，返回成功或既有受理状态，不再创建任务 |
| 事件乱序 | 按权威资源 revision 判断；旧 revision 只记审计或丢弃 |
| 暂时性下游错误 | 指数退避重试，同一 `event_id` 和效果幂等键 |
| 未知 effect 是否执行 | 停止盲重试，查询下游 receipt 或进入人工对账 |
| schema 无法解析/持续失败 | 进入带原始引用的 DLQ，修复 consumer 后受控重放 |
| 凭证已撤销 | 停止派生任务，标记 tenant/integration 状态并告警 |

DLQ 不是垃圾桶。必须记录失败分类、consumer 版本、重试次数、payload_ref、重新投递权限与审计责任人；重放也要走当前策略，不能拿旧事件绕开新 deny rule。

## 七、可靠异步分发：outbox、幂等与循环抑制

### Transactional outbox

工具 runner 应在同一业务事务中写入：执行状态、effect receipt 或未知状态、以及待发布 outbox。publisher 使用 at-least-once 投递；消费者以 `event_id` 或业务幂等键去重。这样接受“消息会重复”，但拒绝“关键状态与消息会分叉”。

```text
runner transaction:
  effect_attempt(status, plan_digest, idempotency_key)
  effect_receipt(status, provider_receipt)
  outbox(event_id, type, schema_version, payload_ref)

publisher -> bus (at least once)
consumer -> inbox(event_id unique) -> side effect / projection
```

### 防止 Hook 递归和风暴

Agent 会读取日志、修改文件、触发测试、生成更多工具事件；若每个 observer 又能创建同类型任务，系统会自激。至少需要：

- `causation_id`、`hop_count`、`origin` 与 `automation_depth`，超过上限拒绝新派生任务。
- 明确 `observer` 默认只写审计/指标，不能直接调用高风险工具；派生任务要经过独立 admission。
- 在事件过滤器排除自己的输出，例如格式化 Hook 不监听由自己触发的格式化结果。
- 对 tenant、agent、工具、事件类型分别限流，并记录丢弃、延迟、合并和采样策略。
- 建立“熔断至只读”：异常 fan-out、成本或失败率达到阈值时，停止新副作用，只保留收集证据和人工接管。

## 八、审计、评测与人工接管如何消费同一条事实

不要让每个团队各自解析 runtime 日志。规范化事件可以派生多个只读投影：

| 投影 | 关注字段 | 用途 |
| --- | --- | --- |
| 安全审计 | actor、capability、policy revision、effect receipt | 回答谁批准和实际发生了什么 |
| Trace / OTel | correlation、causation、时延、错误分类 | 定位 Gate、runner 或下游瓶颈 |
| 评测集 | 输入摘要、工具序列、最终状态、人工标注 | 评估工具选择、拒绝和恢复质量 |
| 成本账本 | 模型、工具、网络、wall time、fan-out | 限额、归因和异常检测 |
| 人工接管队列 | `defer`、timeout、unknown effect、DLQ | 带完整证据而非一句“失败了” |

审计消费者永远不能反向批准操作。需要“看到风险后紧急止血”时，调用独立的 Incident API 写入撤销/冻结状态，并由下一次 Gate 或资源服务执行；不要让日志 consumer 自己绕过审批直接删资源。

## 九、系统设计题：Webhook 驱动的企业 Coding Agent 策略平台

**题目**：GitHub PR、CI 和工单系统都会触发 Coding Agent；公司同时使用 Claude Code、Codex、OpenClaw、Hermes。要求低风险 review 自动运行，生产变更必须审批，可追踪每次工具调用，webhook 允许重复和乱序。如何设计？

### 答题骨架

1. **Ingress**：Webhook Gateway 验签、时间窗、防重放、租户映射、限流；加密落库与 outbox 同事务。
2. **Normalizer / Adapter**：把四种 Runtime 和外部来源转为版本化 event envelope；原始载荷留证据库，业务消费者只看脱敏摘要。
3. **Admission**：从权威 GitHub/CI API 二次读取对象，计算 repo、branch、数据等级、目标环境和风险，创建 immutable task manifest。
4. **Policy Fabric**：工具 intent 先经同步 gate；deny 优先、短超时、capability 绑定 plan digest；需要人工时冻结对象与参数，批准后重新校验。
5. **Execution Gateway**：工具在沙箱或受控 worker 内执行，外部写入经过最小凭证、幂等键和资源服务二次鉴权。
6. **Reliability Plane**：effect 和 outbox 同事务，bus at-least-once，consumer inbox 去重，DLQ 受控重放，未知 effect 进入 reconciliation。
7. **Observability / Incident**：Trace、审计、成本、评测共用 correlation；异常时撤销 capability、暂停新任务、保留证据并允许人工 steer。

### 一段值得说出来的取舍

> 我不会把每个 Hook 都同步调用一个远程策略服务。读文件、格式化和 trace 事件可以异步或本地缓存；只有推送、部署、删数据、外发等副作用前走强同步 Gate。Gate 不可用时，高风险动作拒绝或挂起；异步审计失败则保留 outbox 重试和告警。这样安全与可用性都有明确边界。

### 高频追问

**Q：Hook 决策和资源服务的授权冲突怎么办？**

> 资源服务 deny 是最终事实，不能被 Runtime Hook allow 覆盖。Hook 的 allow 只表示当前 Agent loop 可以继续尝试；执行 Gateway 仍验证 capability、资源状态、租户和 plan digest。

**Q：多个 Gate 都返回不同决定如何处理？**

> 先按不可覆盖 deny、撤销和静态合规规则处理；再按明确优先级合并。最小权限原则下，`deny` 优先于 `require_approval`，后者优先于 `allow`。每个匹配项和合并依据写入审计，便于解释。

**Q：Post-tool 检查发现秘密泄露，难道无能为力？**

> 对已经外发的 effect 不能假装回滚，但可以立刻吊销令牌、隔离后续任务、通知 owner、启动补偿/轮转、标记证据和阻止后续传播。真正的预防应在 egress 前 Gateway 和资源服务。

**Q：如何给同一条 PR webhook 重放历史事件？**

> 重放的是标准化 event 和原始证据引用，先在 sandbox / shadow consumer 验证，再以当前的 tenant、策略、凭证和仓库状态创建新任务。绝不能直接复用过去的 capability 或批准。

## 十、上线检查表

### 事件与适配

- [ ] 定义 `event_id`、correlation/causation、schema/adaptor version、tenant、task、tool、attempt 与数据分级。
- [ ] 原始载荷不直接广播；以加密 `payload_ref` 和脱敏摘要分层访问。
- [ ] 每种 Runtime 都列出“可阻断、仅观察、需要用户输入、未知”的能力矩阵，禁止按名称猜测。
- [ ] adapter 变更有契约测试、样本回放和 canary，未知 schema 默认隔离而不是静默吞掉。

### 同步安全路径

- [ ] 只有副作用前的窄路径使用同步 Gate；post-event 不承担预防职责。
- [ ] deny、revocation、资源服务授权不可被较低层 allow 覆盖。
- [ ] capability 绑定 task、tool、资源、plan digest、TTL、预算和 policy revision。
- [ ] 高风险 Gate timeout、审批超时、schema 不兼容默认 fail-closed / suspend。

### 可靠性与运行

- [ ] ingress 验签、时间窗、去重、租户绑定、限流、加密落库和 outbox 具备自动化测试。
- [ ] runner / publisher / consumer 都有幂等键、重试分类、DLQ、受控重放和未知 effect 对账。
- [ ] 有 hop/depth/fan-out 限额、循环检测、成本熔断与只读降级。
- [ ] 通过 correlation 能关联用户、Agent、Hook、审批、capability、工具、receipt、队列消费和最终任务状态。

## 延伸阅读

- [跨运行时 Agent 扩展生产治理](/interview/agent-skills-production-governance)：Hook/Plugin/Skill 的供应链、签名、灰度与撤销。
- [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)：capability lease、step-up approval 与资源侧最终鉴权。
- [Agent 自动化与后台编排生产设计](/interview/agent-automation-orchestration-playbook)：cron、后台会话、delivery、dead-letter 与成本控制。
- [Agent 观测、取证与事故响应](/interview/agent-observability-incident-response)：trace、证据包、告警与事后响应。
- [Agent 工具安全与权限边界](/agent/tool-safety)：工具 schema、Gateway、审批与最小权限。
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)、[OpenClaw Hooks](https://docs.openclaw.ai/automation/hooks)、[Hermes Event Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/)：各运行时的原始能力与语义。
- [OpenAI: Unlocking the Codex harness](https://openai.com/index/unlocking-the-codex-harness/)：Codex App Server 的 thread、turn、item 与审批事件模型。
