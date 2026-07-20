# LLM 在线流量准入与过载保护：排队、公平与可控降级

当 GPU、上游配额或 KV Cache 已接近上限时，系统最危险的做法是让所有请求一起“再试一次”。这会把排队时间、超时、重试和成本放大成雪崩。在线准入控制的目标不是让所有请求都进入模型，而是在有限容量内优先交付满足 SLO 的请求，并为未准入请求给出一致、可解释、可恢复的结果。

本页聚焦**请求进入推理系统之前**的控制面。容量建模与弹性伸缩见 [LLM 推理容量与弹性伸缩设计](/interview/llm-inference-capacity-autoscaling-playbook)，模型网关的 RPM/TPM 配额见 [模型网关与多模型路由](/engineering/llm-gateway)，已准入流连接的取消、断线与背压见 [LLM 流式应用生产化](/engineering/llm-streaming-production)。

## 一、面试先给出边界：准入控制到底管什么

准入控制回答的是“这个请求此刻能不能占用稀缺推理资源”。它发生在模型调度器之前，输出只有四类：

```text
admit      进入在线推理队列
queue      有界等待，返回排队/重试语义
degrade    改变资源需求后进入可验证的降级路径
reject     快速拒绝，明确原因和恢复建议
```

它不替代自动扩缩容：扩容解决未来几分钟到几十分钟的容量供给，准入控制解决当前秒级到分钟级的突发。它也不替代流式背压：背压处理已开始生成但消费者过慢的连接；准入控制避免不可承受的工作根本进入引擎。

## 二、先把业务目标翻译成 SLO 与预算

至少明确以下 SLO：

| 维度 | 示例目标 | 为什么要单独定义 |
| --- | --- | --- |
| TTFT | P95 小于 2 秒 | 交互体验首先感知排队和 prefill |
| TPOT | P95 小于 80ms | 反映 decode 拥塞与流式卡顿 |
| 最大排队时间 | P0 500ms、P1 5s | 队列不能无限增长 |
| 拒绝率 | 核心租户低于阈值 | 反映容量与策略是否失配 |
| 公平性 | 单租户不挤占全局 | 防止大客户/长请求饿死他人 |
| 成本/预算 | 每租户 token 上限 | 防循环调用和意外烧钱 |

不要只设全局 QPS。LLM 的工作量由输入 token、预估输出 token、上下文长度、模型类型和是否调用工具共同决定。两个“1 QPS”请求可能相差数千倍成本。

## 三、用 token 预估做准入成本模型

请求到达时无法知道精确输出 token，却可以估计并预留预算：

```text
request_cost = input_tokens
             + min(user_max_output, route_max_output)
             + tool/reserve_budget

admit if quota_available
      and concurrency_slot_available
      and predicted_queue_wait <= request_deadline
      and KV/admission headroom is healthy
```

输入 token 可直接 tokenizer 计算；输出 token 用 `max_tokens`、历史分位数和任务类型预测。完成后用实际 usage 结算并返还未使用预留。这个“预留 -> 实际结算”的模型同时服务 TPM 限流、队列调度和成本对账。

必须对异常声明设上限：用户传一个极大 `max_tokens`、Agent 递归调用或超长 RAG context，都不应绕过准入模型。高风险/长上下文请求可走单独资源池或先要求异步化。

## 四、分层配额：不要只在全局限流

成熟系统通常按多层检查配额：

```text
global capacity
  -> region / cluster
    -> provider key or deployment
      -> model pool
        -> tenant
          -> application
            -> user / session
```

每一层可同时包含 RPM、TPM、并发 stream 数、上下文长度、日预算和工具次数。全局配额保护集群；租户配额保护公平；用户配额抑制滥用；模型池配额防止推理模型被普通摘要任务抢满。

工程上不要让每个请求都远程访问中央计数器。常用做法是本地 token bucket 作为快速路径，集中服务分配短期 token lease 或配额分片；这样可减少热点，又能在租户级做一致计量。区域故障时要明确 fail-open 还是 fail-closed：涉及预算和敏感模型时通常偏 fail-closed，追求可用性时则在严格本地上限内短暂 fail-open。

## 五、队列隔离与公平调度

把交互聊天、长上下文 Agent 和离线批处理放进同一 FIFO 队列，会形成 head-of-line blocking：一个长 prefill 或长 decode 足以拖慢一批短聊天请求。至少做逻辑隔离：

```text
P0 interactive chat     小等待预算、优先保证 TTFT
P1 normal/RAG           常规队列、长度和租户限额
P2 agent/long context   独立并发池、强预算、可中断
P3 batch/offline        仅消费剩余容量，可暂停
```

FIFO 简单但不公平。可选择：

- **加权公平队列（WFQ）**：按租户权重轮转服务，适合多租户平台。
- **最短预计作业优先（SJF）**：短请求更快得到响应，但必须配合老化机制，避免长请求永远饥饿。
- **Deadline-aware**：优先服务接近 TTFT/SLA 截止的请求，但要防止客户端伪造极短 deadline。
- **每租户并发上限**：防止一个客户用大量长 stream 占满 KV Cache。

高分表达是：公平不是所有请求相同等待，而是按购买等级、业务优先级与工作量，在公开规则下避免无边界挤占。

## 六、有界队列、背压与动态并发

无限队列不是高可用，而是把故障延后。队列越长，用户越容易超时重试，系统又会收到更多重复工作。每个优先级队列都应有最大 item 数、最大 token debt 和最大等待时间。

动态并发控制可根据最近的 TTFT、TPOT、KV 使用率、队列等待和 OOM/驱逐信号调整 in-flight 上限：

```text
if P95_TTFT breaches or KV headroom drops:
    decrease admission concurrency
elif queue grows and SLO remains healthy:
    cautiously increase concurrency
```

控制器应有平滑窗口、最小调整间隔和滞回，避免指标轻微抖动就反复扩缩/收缩。GPU 利用率高未必需要拒绝，关键是 goodput 是否仍满足 SLO；GPU 利用率低也可能因 KV Cache 或上游 TPM 已经无法准入。

## 七、排队、拒绝与降级的决策阶梯

过载时应按能力契约从温和到强硬处理：

1. 命中安全的精确缓存或 prefix cache，直接返回。
2. 允许短等待的请求进入有界队列，返回可观测的排队状态。
3. 压缩可选上下文、降低输出上限、关闭非必要 rerank 或自一致性采样。
4. 路由到已离线验证过的低成本/低延迟模型。
5. 将非交互任务转为异步作业，保留进度查询。
6. 快速拒绝并附带 `retry_after`、原因码和幂等重试语义。

降级不是任意换模型。每个 fallback 都需要定义能力边界：是否支持工具调用、JSON Schema、语言、数据驻留、引用或安全策略。未验证的降级比明确拒绝更容易形成质量事故。

## 八、重试预算与重试风暴

429、网络超时和连接重置并不都适合重试。在线请求应有**总 deadline、最大尝试次数和 token/费用预算**。重试应使用指数退避加抖动，并只针对可能瞬时恢复的错误；客户端和网关不能同时无限重试。

最危险的情况是：服务因排队变慢 -> 客户端超时重试 -> 重复请求更占资源 -> 排队更慢。用 idempotency key 把同一业务请求折叠为一个后端工作单元，并在响应中区分“已排队”“正在生成”“不可重试的业务错误”。工具写操作还要在工具层使用幂等键，避免模型重试造成重复扣款或重复发送。

## 九、一个可落地的控制面架构

```text
Client
  -> Gateway: auth, idempotency key, coarse rate limit
  -> Admission API: token estimate, quota lease, policy decision
  -> Priority queues: P0/P1/P2/P3 + tenant fairness
  -> Model scheduler: dynamic concurrency, KV/cache headroom
  -> Provider/vLLM pool

Control plane
  -> quota ledger, policy config, model capability registry
  -> SLO metrics, queue/KV telemetry, audit and incident switches
```

数据面决策必须低延迟，采用本地缓存的策略和短期 lease；控制面负责异步结算、配额补发、策略发布、告警与审计。将两者拆开，才能在配额服务短暂波动时避免所有在线请求同步阻塞。

## 十、指标、告警与故障演练

按**模型、租户、优先级、区域和请求长度桶**观察：

| 指标 | 说明 |
| --- | --- |
| admission allow/queue/degrade/reject ratio | 策略正在如何影响用户 |
| queue wait P50/P95/P99 | 是否快接近 SLA 断崖 |
| token debt / reserved vs actual | 预估是否系统性过松或过紧 |
| per-tenant fair-share | 是否存在资源挤占 |
| retry rate 与 duplicate collapse rate | 是否有重试风暴或幂等失效 |
| TTFT/TPOT SLO burn rate | 体验是否快速消耗错误预算 |
| KV headroom、eviction、OOM | 引擎是否需要立即收紧准入 |

演练至少包括：某个租户突然发送超长 prompt；上游 TPM 降额；P0 和 batch 同时高峰；一个模型池 OOM；客户端重试放大十倍；跨区域配额服务失联。每次演练都应验证错误是否可解释、是否避免重复扣费，以及核心租户 SLO 是否被保护。

## 十一、面试高频追问

### Q1：为什么不能只按 QPS 限流？

因为 LLM 的服务成本由 token、上下文和并发状态决定。一个超长 prompt 或长输出可以消耗远多于普通请求的 prefill、decode 和 KV Cache。QPS 只能做粗粒度保护，必须结合 TPM、并发和长度预算。

### Q2：如何避免大租户把小租户饿死？

在全局上限之外设置租户级 token/concurrency 配额，并用 WFQ、轮转或保底份额调度。对长请求设独立池和上限，队列使用老化机制，既保护短交互也保证合规的长任务最终有机会执行。

### Q3：排队和快速失败怎么选择？

看 deadline 和用户体验。P0 聊天的等待预算很小，预估超过预算应降级或快速拒绝；离线任务可排队。关键是队列有界、等待时间可预测，不能把超时转嫁给用户。

### Q4：动态并发为什么不直接跟随 GPU 利用率？

GPU 利用率是滞后且不完整的信号。TTFT、TPOT、队列等待、KV headroom 和 OOM 预警更直接反映是否还能交付 SLO。利用率高但体验健康可能是正常，利用率低但上游配额耗尽也可能无法准入。

### Q5：降级到小模型会不会导致事故？

会，所以 fallback 必须是经过离线回归、明确能力范围的产品策略。对需要工具调用、结构化输出、数据驻留或高风险回答的请求，不能只按成本把它们切到任意小模型。

### Q6：分布式配额如何保证不超卖？

用集中账本或分片配额发放短期 lease，本地快速消耗 lease；完成后按实际 token 结算。允许的短期误差要小于安全余量，并在 lease 失效、区域隔离时采用保守策略。完全强一致会增加延迟，完全本地又容易超卖，需要按风险分级。

### Q7：为什么重试预算是准入控制的一部分？

重试同样占用稀缺容量。没有预算的重试会在过载时放大流量，反而降低成功率。将 retry 视为一种需要准入的工作，才能阻断正反馈雪崩。

## 十二、60 秒系统设计回答

> 我会把在线准入看成一个 token 感知的控制面。入口先通过幂等键、用户/租户/模型多级配额和 token 预估做快速判定；随后按交互、普通、长上下文 Agent 和批处理进入隔离队列，用加权公平与并发上限保护小租户和 P0 的 TTFT。队列始终有界，控制器根据 TTFT、TPOT、队列等待和 KV headroom 动态收紧或放宽准入。过载时按缓存、短等待、压缩上下文、已验证模型降级、异步化、快速拒绝的阶梯处理，并给每次重试设 deadline 和预算。最后按租户、优先级和长度桶监控准入结果、token debt、公平份额与 SLO burn rate，定期演练上游降额、OOM 和重试风暴。
