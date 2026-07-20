# LLM FinOps：计量、归因与预算控制面

> “按 token 乘单价”只能得到一个估算，不能构成生产级成本系统。真实 LLM 调用会流式中断、重试、fallback、工具循环、异步批处理和多供应商计费；自建推理还要分摊 GPU、显存、空闲容量和共享网关成本。FinOps 的目标是让每一笔费用从 usage event 进入可对账账本，并在成本真正失控前以确定性的配额、预扣、审批和熔断动作介入。

## 一、30 秒面试回答

**答法：**我会把每次模型、工具和工作流执行抽象为不可变 usage event，带上 request/run/node/attempt、tenant/app/cost center、模型与价格卡版本、输入输出/缓存 token、路由和结果状态。网关在请求前按最大可能消耗做原子预扣，流式完成或取消后按最终 usage 校正，超时/迟到事件按幂等 event id 做冲正而不是重复扣费。账本采用 append-only 分录与可重放聚合，定期将内部计量与供应商账单、自建 GPU 成本对账。预算不是报表告警：软预算触发通知与路由降级，硬预算拒绝新的高成本工作，保留额度和审批则保证关键任务可继续。这样才能解释钱花在谁、哪条 prompt、哪次重试、哪个工具和哪个模型上，并让控制动作可审计、可回滚。

## 二、边界：计量、归因、定价、账本与预算不是同一个概念

| 层 | 回答的问题 | 典型产物 |
| --- | --- | --- |
| 计量 Metering | 实际消耗了什么 | input/output/cache token、GPU 秒、工具次数 |
| 归因 Attribution | 应把消耗算给谁 | tenant、app、feature、workflow node、cost center |
| 定价 Pricing | 消耗按什么规则折算货币 | provider price card、内部 transfer price |
| 账本 Ledger | 余额和费用如何正确演进 | 预扣、实际扣款、释放、冲正分录 |
| 预算 Enforcement | 超限时系统做什么 | 告警、降级、审批、拒绝、熔断 |
| 对账 Reconciliation | 内部记录是否接近外部事实 | provider bill、GPU 集群和采购账单差异 |

只做日志聚合只能回答“最近 token 多了”；没有账本和执行语义，无法在并发、取消和重试下保证不超卖预算，也无法解释余额为什么与供应商账单不一致。

## 三、Usage Event 契约：先定义可重放的事实

推荐将 usage 记录成 append-only 事件，而不是直接更新一行“本月已花费”。一个事件最少包含：

```json
{
  "event_id": "provider-or-internal-stable-id",
  "occurred_at": "2026-07-20T06:00:00Z",
  "request_id": "req_...",
  "run_id": "workflow_...",
  "node_id": "summarize-contract",
  "attempt": 2,
  "tenant_id": "tenant-a",
  "cost_center": "legal-ops",
  "model_revision": "model-x@2026-07-18",
  "route_policy": "low-risk-v4",
  "price_card_version": "provider-a-2026-07",
  "input_tokens": 1800,
  "cached_input_tokens": 1200,
  "output_tokens": 438,
  "tool_cost_units": 0,
  "outcome": "completed"
}
```

事件必须有稳定的 `event_id` 和 source sequence/版本，以承受至少一次投递、回调重放、迟到 usage 和批处理重新导出。聚合器要能去重，账本要能重放；任何“收到 event 就 `spent += amount`”的实现都会在 webhook 重试和消费者恢复时双扣费用。

### 3.1 流式与取消：何时算最终费用

流式响应在首 token 后仍会继续产生输出 token；用户断开连接不等于供应商立即停止计算；有些 API 直到结尾才返回 usage。建议区分：

- `reserved`：入站时为最大输入与预留输出占用的预算；
- `observed`：流中可获得的增量 usage，仅用于估算和告警；
- `settled`：供应商或引擎返回最终 usage 后的可结算事实；
- `reversed`：超时、重复事件或供应商修正后的冲正分录。

若最终 usage 迟到，先以保守预扣保护预算，随后结算差额。对于用户取消，网关应发送上游取消、记录取消时点和已观察 token；最终按 provider 的真实账单结算，不能假设“用户没看到就免费”。

## 四、双分录思维：预扣、结算与冲正

预算控制需要并发安全。一个简化的分录序列如下：

```text
1. reserve  最大预计成本 12 元：available -12，reserved +12
2. settle   实际成本 7.4 元：reserved -12，spent +7.4，available +4.6
3. adjust   迟到账单多 0.3 元：available -0.3，spent +0.3
4. reverse  重复 event：对重复分录做反向分录，不修改历史
```

账本应使用不可变分录和关联键，而不是原地覆盖余额。这样审计时可以回答每一笔费用为何出现、由哪个事件触发、后来是否被冲正。余额是分录聚合的物化视图，可重建；分录才是源事实。

### 4.1 预扣应该预留多少

对已知输入，`input_tokens` 可精确或近似计算；输出未知，可用 `max_output_tokens`、任务历史分位数或业务上限预留。预留过低会使并发请求透支，过高会让正常任务因“虚假余额不足”被拒绝。实践中可按任务类型维护预测模型并定期校准：摘要、抽取、Agent、多工具任务的输出分布不同，不能用一个固定值。

### 4.2 原子性与分布式配额

多实例网关需要对同一预算池做原子 reserve。常见实现是数据库乐观锁/行锁、Redis Lua 脚本、令牌桶配合周期性账本结算，或把预算分片为租户局部额度。选择取决于 QPS、可接受的短暂超卖和一致性要求。高风险/硬预算场景宁可保守拒绝；低风险场景可允许小范围超卖并异步修正，但必须量化并告警。

## 五、归因模型：一笔费用不只属于“某个用户”

LLM 工作流常由多次模型调用、检索、OCR、浏览器、代码执行和重试组成。归因维度建议分层：

```text
organization -> cost_center -> tenant -> application -> feature
  -> workflow/run -> node/step -> request -> attempt -> provider/model
```

它支持三类不同问题：财务问“法务部门花了多少”；产品问“合同摘要功能是否赚钱”；工程问“为什么这个 run 比上周贵三倍”。若只保留 app 和 model，遇到 Agent 循环、retry storm 或 prompt 变长时无法定位根因。

### 5.1 共享成本怎么分摊

供应商 API 可按 usage 精确归因；自建 GPU、缓存、网关、向量库和空闲冗余则是共享成本。常见方法：

- **直接归因**：按实际 token/GPU 秒归属，适合可观测的推理请求。
- **比例分摊**：按 token、请求、峰值保留容量或存储用量分配共同成本。
- **保留费 + 使用费**：高优先级/专属模型先收容量保留费，再按实际使用收费。
- **showback 与 chargeback**：先展示成本促进优化，再决定是否真实内部结算。

不存在唯一“正确”的分摊规则。关键是口径版本化、可解释、在一个预算周期内稳定，且账单报表能够同时显示直接成本、共享分摊和未分摊平台成本。

## 六、价格卡与对账：不要把单价写死在代码里

价格会因模型 revision、输入/输出、cache read/write、批处理折扣、区域、承诺量和时间而变化。建立 price card registry：

```text
provider + model + revision + region + meter_type + effective_time_range
  -> unit_price + currency + pricing_rule_version
```

计量事件应引用生成时可用的价格卡版本；价格修正后以 adjustment 分录而非改写历史。每个账期对账至少比较：内部 token/请求汇总、provider usage export、provider invoice、信用额度/折扣、异常退款与未结算的迟到事件。

差异不是总能避免，但应被解释：时区边界、事件迟到、供应商计量粒度、缓存 token 口径、失败但收费的调用、内部估算与最终账单不同。设置差异阈值和处理 SLO，例如超过 1% 或金额阈值自动开工单，禁止在差异未解释时把内部报表作为财务结算依据。

## 七、预算政策：告警、降级、审批、拒绝的确定性行为

预算不是单一数字，而是层级策略：组织月度、部门月度、租户日度、应用小时、feature/run 单次上限。每层可定义动作：

| 阈值/条件 | 动作 | 适用场景 |
| --- | --- | --- |
| 软预算 70% | 通知 owner，展示归因和预测 burn rate | 早期预警 |
| 预警 85% | 限制低优先级 batch，建议小模型/缓存 | 可降级任务 |
| 硬预算 100% | 拒绝新请求或仅允许低成本路径 | 防止资金失控 |
| 保留额度 | 只允许指定 critical feature 使用 | 客服、合规、生产修复 |
| 超额审批 | 临时额度、有效期、审批人和审计原因 | 月末/事故恢复 |
| 异常速率 | 熔断 key、冻结路由或停止 workflow fan-out | bug/retry storm |

行动要可预测、可查询且可解释。不能出现同一余额下一个实例返回 200、另一个返回 429 的随机体验；也不要把预算超限悄悄改成廉价模型而不记录，因为质量和安全约束可能不同。所有自动降级都应记录 policy decision、替代模型、预期节省和回滚条件。

## 八、异常成本与事故处置

典型异常包括 prompt 版本变长、缓存命中断崖、模型误路由、Agent 无限循环、输出上限失效、重复回调、批处理错误重放和供应商价格变更。排障顺序：

1. 用账本按 tenant/app/feature/run/node/model/prompt 切片，确认增长来自哪一维。
2. 区分实际 usage 增长、价格卡变化、归因规则变化和事件重复。
3. 检查 retry amplification、output token 分布、tool loop 次数、cache/prefix hit 和 fallback 命中。
4. 先执行止血：冻结 key、暂停低优先级 batch、限制输出、回滚路由/prompt、收紧工具循环预算。
5. 保留事件与价格卡证据，再修复根因并用回归集验证。

“成本下降”也要调查：可能是缓存成功、模型路由优化，也可能是计量丢失、事件管道堵塞或大量任务被预算拒绝。FinOps 既要防多花，也要防少记。

## 九、系统设计题：企业统一 LLM 成本控制面

```text
Gateway / Agent Runtime / Batch Workers
   -> usage event outbox -> durable event bus -> metering consumer
   -> reserve API <-> budget ledger / quota store
   -> pricing service -> cost calculator -> attribution warehouse
   -> reconciliation jobs <-> provider exports / GPU cluster metrics
   -> policy engine -> alerts / approvals / route controls / kill switch
```

### 9.1 关键设计点

- 网关和 worker 采用 outbox，业务响应成功后仍能可靠投递 usage event；消费者幂等。
- 预算 reserve 在调用前完成，最终结算由 usage event 驱动；超时有 reservation expiry，但不能在调用仍可能继续时过早释放。
- 价格卡、归因规则、policy 都版本化，报表和行为可追溯。
- 高并发余额走强一致的热路径，长期报表走异步明细与数仓；不要用数仓延迟数据做实时拒绝。
- 所有预算动作保留审计事件：谁的什么请求被何种规则降级/拒绝、当时余额和价格卡是什么。

## 十、高频面试问答

### Q1：流式调用被用户取消后怎么计费？

**答法：**请求前按输入和保留输出做预扣；取消时向上游发送 cancel 并记录已观察 usage，但最终以供应商/引擎的 settled usage 为准。若最终 usage 迟到，保留额度在可配置窗口内不立即释放，结算后做差额调整。不能用“用户没看到完整答案”推断没有成本。

### Q2：为什么预算系统需要账本而不是 Redis 计数器？

**答法：**计数器适合限流，但无法解释预扣、实际结算、迟到事件、退款、价格修正和重复投递。账本以不可变分录保留因果关系，余额只是聚合视图；发生争议或故障时可重放和对账。热路径仍可以用 Redis/Lua 做原子 reserve，但必须与持久账本协同。

### Q3：如何处理同一个 Agent run 的成本归因？

**答法：**每个模型、工具、重试和子任务事件都携带 run_id、node_id、attempt 和父子 trace，按组织到 attempt 的层级归因。报表既能聚合到部门/应用，也能定位某一个工具循环或失败重试。不能只在入口请求记一次总成本，否则无法区分真正的业务成本与系统浪费。

### Q4：自建 GPU 成本如何归因？

**答法：**直接部分按请求 token、GPU 秒或模型实例使用归因；共享部分按约定的 token、峰值容量、保留实例或存储比例分摊，并展示未分摊平台成本。规则版本化，避免每月修改口径导致趋势不可比。自建成本应包含折旧、云 GPU、网络、存储、空闲容量和运维，而不只是显卡小时价。

## 十一、项目讲法

> “我们把模型调用从日志统计升级成了 FinOps 控制面：网关和异步 worker 都通过 outbox 发出幂等 usage event，事件记录 run/node/attempt、prompt、模型、缓存和价格卡版本。调用前按预测 token 原子预扣，流式结束后按最终 usage 结算，重复或迟到事件以冲正分录处理。成本按部门、应用、功能和工作流节点归因，并按账期与供应商账单、自建 GPU 指标对账。预算采用软告警、硬拒绝、关键额度保留和超额审批，异常时自动冻结低优先级 batch 或回滚高价路由。这样我们能在分钟级定位成本突增来自 prompt、缓存、模型还是重试，而不是月底才发现超支。”

这套叙述把“成本优化”从几个零散技巧，提升为可审计、可执行、可对账的企业级能力。
