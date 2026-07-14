# Agent 外部副作用事务与补偿：幂等、SAGA、对账与人工接管面试手册

> Agent 最危险的失败不是答错一句话，而是网络超时后重复付款、重复建单、把错误版本部署到生产，或把“已经发生但暂时查不到”的动作当作失败重试。本页讨论如何把模型产生的工具意图收敛为可审计、可恢复的业务事务。

> 本页专门解决多系统写操作的事务语义；长任务断线、检查点与 worker 恢复见 [长运行 Agent 检查点、恢复与人工 Steer](/interview/long-running-agent-recovery-playbook)，授权与撤权见 [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)，事件入口和 outbox 见 [Agent 生命周期事件与 Policy Hook Fabric](/interview/agent-lifecycle-policy-hook-fabric)。

## 一、30 秒总答法

> 我不会让 Agent 直接把自然语言计划翻译成一串没有事务边界的 API 调用。每个外部写操作先产生冻结的 `intent`，经策略、审批和资源校验后变成带 `effect_id`、`idempotency_key`、参数 digest、版本与 TTL 的 `command`。执行器保存下游 receipt，并将结果分为 `CONFIRMED`、`NOT_STARTED`、`IN_PROGRESS`、`UNKNOWN`、`FAILED_COMPENSABLE`，而不是二元成功/失败。跨系统流程采用 SAGA：每一步定义业务补偿、可补偿窗口、不可逆边界和人工 owner；补偿本身也是新的受控 effect，不能把“删除、退款、回滚”当作天然安全的撤销。网络超时先查询和对账，再决定重试、继续、补偿或人工接管。模型只负责提出计划和解释证据，事务状态机、幂等、余额/配额校验和最终写入由确定性服务负责。

这段回答至少要让面试官听到五个关键词：**intent/receipt 分离、业务幂等键、未知状态、SAGA 补偿、人工对账**。

## 二、先纠正三个误解

| 误解 | 为什么不成立 | 正确做法 |
| --- | --- | --- |
| “HTTP 超时就是失败，可以重试” | 请求可能已到下游并已生效，只是响应丢了 | 用同一幂等键查询或对账；未知时停止盲重试 |
| “补偿就是把上一步删掉” | 外部世界、时间和并发状态已经变化 | 定义业务反向动作、前置条件、窗口和审批 |
| “工作流 checkpoint 了就不会重复执行” | crash 可能发生在外部调用已开始、状态尚未落盘之间 | 下游 API 与本地 ledger 都必须支持幂等和 receipt |

事务不是让数据库替 Agent 思考。它是将不确定模型和不可靠网络隔离在一个可验证的 effect protocol 外面。

## 三、四层对象：计划、意图、命令、回执

```text
LLM plan
  -> effect intent       "建议创建工单并通知客户"
  -> immutable command   "在 tenant A 对 ticket T 创建 priority=P2"
  -> provider execution  "下游开始处理"
  -> receipt / reconcile "工单 #381 已创建，参数 digest 一致"
```

| 对象 | 是否可由模型生成 | 是否可变 | 关键字段 |
| --- | --- | --- | --- |
| Plan | 可以 | 可以重规划 | 目标、候选步骤、证据、风险说明 |
| Intent | 可以提出，系统规范化 | 生成后冻结 | action、resource selector、参数摘要、风险 |
| Command | 不应由模型随意改写 | 不可变 | `effect_id`、幂等键、参数 digest、capability、过期时间 |
| Receipt | 只能来自权威下游或对账器 | 追加式 | provider ID、状态、时间、版本、错误/结果摘要 |

例如模型说“给客户退款 500 元”只是 Plan。业务服务需要补齐订单、币种、剩余额度、退款原因、资金账户、冻结时的订单版本和审批记录，得到不可变 Command。下游 receipt 才能证明是否真的退款；模型的文本和工具日志都不是账务事实。

### 一个可审计的 command

```json
{
  "effect_id": "eff_01JZ9",
  "type": "billing.refund.create",
  "task_id": "task_incident_120",
  "tenant_id": "tenant_a",
  "resource": { "order_id": "ord_881", "version": 17 },
  "payload_digest": "sha256:...",
  "idempotency_key": "refund:ord_881:incident_120:v1",
  "capability_id": "cap_72",
  "expires_at": "2026-07-15T12:05:00Z",
  "approval_id": "apr_409",
  "compensation": { "kind": "none", "manual_owner": "billing-oncall" }
}
```

把完整 PII、卡号、客户对话或密钥放到受控 vault reference；ledger 中保存 hash、脱敏摘要和最小可查标识。`payload_digest` 同时防止“使用同一幂等键却偷偷换金额或目标”的错误。

## 四、幂等：不是 UUID，也不是“最多一次”

### 幂等键的正确范围

幂等键表达的是“同一个业务意图的重复投递”，不是每次 HTTP 请求的随机 ID。推荐由稳定业务维度构造：

```text
<effect-type>:<business-resource>:<intent-revision>:<semantic-scope>
refund:ord_881:incident_120:v1
deploy:catalog:release_2026_07_15:prod
ticket:create:customer_42:outage_105
```

同一 key 必须绑定同一参数 digest。若调用者想把退款金额从 500 改到 800、把部署 SHA 从 `a1b2` 改到 `c3d4`，那是新意图，需要新 revision、重新授权和新 key，不能复用旧 key。

Stripe 的官方 API 文档是一个直观例子：其幂等层会保存同一 key 的首次状态码和 body，并校验后续请求参数；但只有 endpoint 真正开始执行后才会保存结果。因此“参数校验失败或并发冲突”仍可能需要安全重试，不能把所有错误视为已有结果。[Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)

### 本地 Effect Ledger

仅依赖某个供应商的幂等 header 不够。企业需要自身 ledger 来处理多系统、供应商不支持幂等、key 保留期有限和人工补单：

| 字段 | 用途 |
| --- | --- |
| `effect_id` | 企业内全局主键，关联 trace、审批与补偿 |
| `idempotency_key` + digest | 对同一业务意图去重并拒绝参数漂移 |
| `status` / `attempt` | 表达生命周期，不把超时伪装成失败 |
| `provider_operation_id` | 供查询、取消或对账 |
| `receipt_ref` | 加密保存下游响应、账单或部署记录 |
| `fence` / `owner_revision` | 拒绝旧 worker 或旧计划的迟到写入 |
| `reconcile_after` | 未知或异步操作的下一次权威查询时间 |

### 状态机必须容纳未知

```text
PREPARED -> DISPATCHING -> IN_PROGRESS -> CONFIRMED
                   |            |             |
                   |            v             v
                   |         UNKNOWN      COMPENSATING
                   v                         |
              NOT_STARTED <--- REJECTED      v
                                      COMPENSATED / COMPENSATION_FAILED
```

- `NOT_STARTED`：确定下游没有收到，可在当前有效授权下重新提交。
- `IN_PROGRESS`：下游已接受但未终态，等待或查询，禁止并发再发。
- `UNKNOWN`：连接中断、provider 不可查或 receipt 不一致；默认冻结并对账。
- `CONFIRMED`：有可验证 receipt，不等于整个业务 SAGA 已结束。
- `COMPENSATION_FAILED`：必须显式可见；不能把原 effect 标成“已回滚”。

## 五、SAGA：补偿的是业务承诺，不是数据库 rollback

当流程跨支付、库存、CRM、邮件、部署、工单等服务时，通常没有可用的分布式 ACID 事务。SAGA 将流程拆为局部已提交的 step，并定义反向的业务操作：

```text
reserve inventory -> charge payment -> create shipment -> notify customer
       |                 |                  |                  |
 release reservation <- refund payment <- cancel shipment <- send correction
```

### 每个 step 要有的契约

| 字段 | 例子 | 为什么需要 |
| --- | --- | --- |
| forward action | `inventory.reserve` | 产生什么业务效果 |
| precondition | SKU 有库存、订单版本为 17 | 防止过期计划执行 |
| idempotency scope | `order + fulfillment revision` | 恢复和重投不重复扣减 |
| receipt query | `GET reservation/{id}` | 超时后确认真实状态 |
| compensator | `inventory.release` | 失败后处理局部承诺 |
| compensation window | 30 分钟内且未出库 | 定义何时仍可自动补偿 |
| irreversible boundary | 已出库 / 已清算 | 越过后必须人工处理 |
| owner | fulfillment-oncall | 非技术决策的责任归属 |

**补偿不是反向 API 的无条件调用。** 例如退款需要确认原扣款已成功、金额未被人工处理、账户未关闭，且可能引入新的手续费、库存或审计记录。补偿必须带自己的 `effect_id`、幂等键、capability、审批和 receipt。

### 编排式与协同式 SAGA

| 模式 | 特征 | 何时选 |
| --- | --- | --- |
| 编排式 orchestration | 一个确定性 orchestrator 持有步骤、状态和补偿顺序 | 高风险、强审计、需要可视化人工接管的 Agent 流程 |
| 协同式 choreography | 服务订阅领域事件并各自推进 | 低耦合、事件稳定、步骤较少的内部流程 |

Agent 面向企业操作通常优先编排式：模型可以建议分支，但不能自行隐式广播消息让多个系统各自猜测下一步。编排器能冻结 plan revision、逐步签发 capability，并把“暂缓补偿”交给正确的人。

## 六、未知结果的对账协议

网络超时是生产中的常态。正确路径是 query-first：

```text
timeout after submit
   -> mark UNKNOWN
   -> query by provider operation ID / idempotency key
   -> receipt consistent?  yes -> CONFIRMED
                           no  -> wait / bounded poll
                           unavailable -> reconciliation queue + human owner
```

### 对账器的职责

1. 用权威下游 API、账单、部署历史或数据库查询读取事实，不相信 Agent transcript。
2. 比较 provider receipt 与本地的 resource version、payload digest、金额/目标环境等不变量。
3. 发现已发生但参数不一致时立即冻结后续 SAGA，创建 incident；不得自动“再执行一次正确的”。
4. 按资源风险定义查询次数、最长等待、升级人和证据保留期。
5. 对人工确认的结果写不可变 reconciliation record，并生成后续的新 command，而不是篡改旧记录。

### 金融、部署、工单的差异

| 场景 | 权威 receipt | 自动补偿边界 | 典型人工升级 |
| --- | --- | --- | --- |
| 退款/付款 | payment intent、账务流水、余额变动 | 金额、结算状态、监管窗口都匹配 | 重复扣款、账务不平、跨币种 |
| 生产部署 | release ID、commit SHA、环境健康检查 | 未切流或可安全 rollback | schema migration、部分流量、数据回填 |
| 创建工单/消息 | provider object ID、消息 delivery | 未被人工编辑、未触发下游流程 | 已发送外部客户、触发 SLA/自动化 |
| 数据写入 | row version、审计日志、业务版本 | optimistic lock 未冲突 | 被其他用户修改、批量不可逆变更 |

## 七、与 Agent / 工作流框架的正确衔接

### LangGraph：interrupt 恢复会重跑 node

LangGraph 的 Interrupt 文档明确说明，恢复时 node 会从头重新执行，因此 interrupt 前发生的 side effect 必须幂等；推荐将副作用放在 interrupt 后或独立 task 中。它的 Functional API 也建议把外部调用封装为 task，并以幂等 key 或既有结果校验应对 resume 后的重执行。[LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) [LangGraph Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api)

面试中不能只说“LangGraph 有 checkpoint，所以没有重复调用”。正确说法是：checkpoint 使恢复可行，但 effect service 的幂等和 receipt 查询决定恢复是否安全。

```python
@task
def create_ticket(command: TicketCommand) -> TicketReceipt:
    # Gateway verifies capability, parameter digest and idempotency key.
    return ticket_gateway.execute(command)

def approval_then_execute(state):
    approved = interrupt({"kind": "ticket-create", "digest": state["digest"]})
    if not approved:
        return {"status": "REJECTED"}
    return {"receipt": create_ticket(state["command"]).result()}
```

这里 `interrupt` 在 effect 之前；实际 Gateway 仍负责幂等、授权和 ledger，不能把这些不变量留在 Python node 里。

### Claude Code、Codex、OpenClaw、Hermes：统一走 Effect Gateway

这四类运行时都有各自的 Hook、approval、sandbox、插件或 session 能力，但都不应直接承担跨业务系统事务：

- Claude Code 的 `PreToolUse`/`PermissionRequest` 适合在本地工具前提供策略插槽；高风险工具改为调用企业 Effect Gateway。
- Codex 的 App Server 能向 client 流式展示 tool、approval、diff 等事件；client approval 不替代下游 receipt 和对账。
- OpenClaw 的 typed plugin hook 适合控制工具调用与有序 middleware；真正的财务、发布和工单写入仍通过受控 provider adapter。
- Hermes 的 `pre_tool_call` 能 veto、`pre_verify` 可阻止过早完成；它们应调用确定性 policy/effect 服务，而不是在 Hook 脚本里自行维护事务状态。

所以跨 Runtime 的 Tool schema 应以业务 command 为中心，而不是暴露 `curl`, `kubectl`, `psql` 这类宿主机原语。例：`deployment.promote(release_id, environment, expected_revision)` 比 `bash(command)` 更易授权、幂等、审计和补偿。

## 八、系统设计题：构建生产变更 Agent 的 Effect Gateway

**题目**：Agent 可以分析告警、修复代码、开 PR、申请 staging/production 发布。要求网络重试不重复部署；审批后 SHA 或环境变化必须重新批准；一半下游成功时可以安全处理。如何设计？

### 答题骨架

1. **Planner**：只产生候选 DAG、风险和证据；不持有生产 token。
2. **Prepare service**：读取当前 release、环境、变更窗口和 policy，冻结 command，计算 payload digest 和 `effect_id`。
3. **Approval / capability**：批准绑定 command digest、target、SHA、窗口、预算和单次 effect；任何变更产生新 revision。
4. **Effect Gateway**：CAS 写 ledger、使用 provider 幂等键、最小凭证调用部署服务、保存 receipt/outbox。
5. **SAGA orchestrator**：按确定性状态机推进；例如 staging 验证失败则停止，不自动把已经成功的生产步骤解释成“可忽略”。
6. **Reconciler**：对 `UNKNOWN`、异步 provider 和网络分区查询权威事实，驱动 continue、compensate 或 human escalation。
7. **Operator UI**：显示 intent、receipt、差异、已越过的不可逆边界和可选动作；人工操作也经同一 Gateway。

### 追问：为什么不用两阶段提交？

> 大多数 SaaS、支付、部署和消息 provider 不支持共同的 prepare/commit 协议，长时间锁定也会降低可用性。我们用局部事务、幂等 command、receipt 查询、SAGA 补偿和人工对账实现可恢复的一致性。对账务等强约束场景，业务账本自身仍须采用领域允许的强一致模型；不能用 Agent 编排替代会计规则。

### 追问：补偿失败怎么办？

> `COMPENSATION_FAILED` 是独立终态，立即停止自动链路、冻结后续能力、保留原 effect 与补偿证据，通知对应业务 owner。后续处理是新的受控 task，例如人工退款、数据修复或客户沟通，绝不循环重试到“看起来成功”。

### 追问：模型改了计划，旧的幂等键还能用吗？

> 只有语义完全相同、参数 digest 和资源版本相同的重试才能复用。目标、金额、SHA、租户、时间窗、数据等级或审批上下文变化都要创建新的 intent revision、重新做 policy/approval，并让旧 capability 失效。

## 九、反面回答清单

- “HTTP 500 或超时就重试三次。”
- “幂等键每次都随机生成，避免冲突。”
- “补偿就是调用 delete 或 rollback。”
- “Agent 的日志写了部署成功，所以不用查 provider。”
- “批准过 deploy，就允许任何后续 SHA 部署。”
- “checkpoint 能保证外部 API 只调用一次。”
- “未知状态先标失败，免得卡住流程。”
- “compensation 失败后继续执行下一步，最后一起修。”

## 十、上线检查表

- [ ] 每个写工具接受业务 command，而非任意 shell/SQL；command 有 effect ID、参数 digest、业务幂等键、TTL 与 capability。
- [ ] 本地 effect ledger 与 provider receipt 都可查询；`UNKNOWN` 不自动重试高风险写入。
- [ ] 同一幂等键参数漂移会被拒绝；新计划 revision 使旧 grant 和 key scope 失效。
- [ ] 每个 SAGA step 明确 precondition、receipt query、补偿、窗口、不可逆边界和业务 owner。
- [ ] 补偿走独立 command、授权、幂等与审计；失败有可见终态和人工队列。
- [ ] 对 timeout、重复投递、worker crash、乱序 receipt、并发编辑、provider 半成功和补偿失败做演练。
- [ ] 账务、库存、部署和客户外发等高影响领域有权威对账、冻结和职责分离机制。

## 延伸阅读

- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) 与 [Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api)：恢复重跑、task 封装和副作用幂等。
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)：幂等键、参数漂移与首次执行结果的具体 API 语义。
- [长运行 Agent 检查点、恢复与人工 Steer](/interview/long-running-agent-recovery-playbook)：effect 状态、lease/fence 与恢复 admission。
- [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)：prepare/freeze/approve/commit/reconcile 与 capability。
- [Agent 生命周期事件与 Policy Hook Fabric](/interview/agent-lifecycle-policy-hook-fabric)：outbox、DLQ、事件信封和同步策略路径。
