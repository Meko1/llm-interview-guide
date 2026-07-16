# LLM 推理容量规划与弹性伸缩系统设计

> “多加几张 GPU 卡”不是容量规划。LLM 服务的上限由请求到达模式、输入输出 token 分布、KV Cache、调度器、模型并行、队列和 SLA 共同决定。面试官真正关心的是：流量突增时你如何保护首字、避免 OOM，并在峰谷之间控制成本。

## 一、30 秒面试回答

我会先把业务目标翻译为 token 级容量模型：按场景区分交互式、批处理、长上下文和 Agent 流量，采集峰值到达率、输入/输出 token 分位数、TTFT/TPOT SLO 和可接受排队时间。压测不是只测裸 tokens/s，而是在真实长度分布和到达模式下得到单副本的 SLA goodput。生产中将 prefill 与 decode 压力、KV Cache 使用率、队列等待和错误率分开观察；扩缩容以排队与可用容量为主信号，GPU 利用率只是辅助。过载时按租户和优先级准入、限流、降级、异步化，而不是让所有请求一起把显存打满。每次模型、量化、框架或 Prompt 长度变化后，重新跑基准并更新容量预算。

## 二、先把“容量”说清楚

| 指标 | 含义 | 为什么不能单独看 |
| --- | --- | --- |
| QPS | 每秒请求数 | 一个请求可能是 20 token，也可能是 20k token |
| input/output tokens/s | 真正消耗的推理工作量 | 不直接代表用户等待时间 |
| TTFT | 首 token 时间 | 交互式体验的关键，受排队和 prefill 影响大 |
| TPOT | token 间时间 | 影响流式生成是否“卡顿” |
| Goodput | 满足 SLO 的有效吞吐 | 吞吐高但 P99 超时不算可用容量 |
| KV Cache 利用率 | 会话状态占用压力 | 接近上限时最容易 OOM 或拒绝长请求 |
| Queue wait | 请求进入引擎前的等待 | 高 GPU 利用率不一定慢，长队列才说明服务已饱和 |

容量规划的目标不是“平均 GPU 利用率最高”，而是在指定负载和故障假设下，以可接受成本满足 SLO。

## 三、把业务流量拆成工作负载画像

不要用一个“平均 prompt 长度”代表全部用户。至少按下列维度分桶：

```text
scene: chat / RAG / code / batch / agent
priority: P0 interactive / P1 normal / P2 offline
input_tokens: p50 / p95 / p99
output_tokens: p50 / p95 / p99
arrival: steady / burst / scheduled batch
model: small / main / reasoning / multimodal
```

| 场景 | 主要瓶颈 | 典型策略 |
| --- | --- | --- |
| 在线客服 | TTFT、突发、短输出 | 小 batch 窗口、优先级队列、流式 |
| 企业 RAG | 长 prefill、检索波动 | context 上限、chunk 压缩、prefill 隔离 |
| 代码 Agent | 长上下文、长会话、工具等待 | 预算、checkpoint、独立资源池 |
| 批量摘要 | 总吞吐、成本 | 异步队列、大 batch、低优先级 |
| 推理/搜索 | 多次采样、输出长尾 | 限制预算、按任务路由、可中断执行 |

不同场景共享同一个 GPU 池会相互伤害：离线长文档 prefill 会拉高聊天首字，长输出会长期占住 KV Cache。优先逻辑隔离，再根据规模决定物理隔离。

## 四、从 SLO 反推容量：用 Goodput，不用理论峰值

一个简化的估算过程：

1. 定义服务目标，例如 P95 TTFT、P95 TPOT、失败率和最大排队时间。
2. 以真实输入输出长度、并发和到达模式压测某个模型/精度/引擎/硬件组合。
3. 找到仍满足 SLO 的单副本 token goodput，而不是把 batch 拉到极限后的最大 tokens/s。
4. 用峰值 token 需求除以单副本 SLA goodput，加入故障余量、增长余量和发布余量。

```text
peak_required_tokens_per_second
  = peak_rps * (expected_input_tokens + expected_output_tokens)

replicas
  = ceil(peak_required_tokens_per_second / replica_slo_goodput)
    * redundancy_factor
```

这只是预算起点。输入 token 的 prefill 与输出 token 的 decode 代价不同，长请求会占据 KV Cache 更久，因此最终必须用分位数压测和仿真校正。不要在面试中声称“一个固定 tokens/s 就能算出所有模型的卡数”。

## 五、单副本资源模型：权重、KV 与临时空间

可用显存不是整张卡的标称显存。要预留运行时、通信、CUDA 图、碎片和安全余量：

```text
GPU memory budget
  = model weights
  + KV cache for active sequences
  + activation/workspace
  + runtime/communication reserve
  + fragmentation and safety headroom
```

KV Cache 随层数、hidden size、上下文长度和活动序列数增长。它是长上下文高并发服务的主要容量边界。PagedAttention、chunked prefill、KV 量化和 prefix cache 可以提高有效利用率，但不会消除“更多上下文和更多并发需要更多状态空间”的基本约束。

面试中要强调：遇到 OOM 先区分是权重装不下、KV 已满、碎片、异常超长请求还是并发策略失控；不同原因的修复完全不同。

## 六、调度：把 prefill、decode 与队列看成一个系统

### 6.1 为什么 TTFT 和 TPOT 要拆开

- **TTFT** 由排队、长 prompt prefill、检索/工具前置、冷启动和网关缓冲共同决定。
- **TPOT** 更多受 decode 调度、显存带宽、活跃序列数和流式发送影响。

为了避免长 prefill 阻塞正在 decode 的会话，可以采用 chunked prefill、prefill/decode 分离池，或在调度器中限制每轮 prefill token 预算。选择哪种取决于模型、流量和硬件，不是所有场景都值得物理拆池。

### 6.2 多级队列与公平性

```text
Gateway admission
  -> tenant quota / token budget
  -> P0 interactive queue
  -> P1 standard queue
  -> P2 batch queue
  -> model scheduler
```

- 限流要同时考虑 RPM、并发数和 TPM；只限 QPS 会被超长 prompt 绕过。
- 队列应有最大等待时间和可观测拒绝原因，不能无限积压。
- 使用加权公平队列或每租户配额，避免大客户挤占全局 KV Cache。
- 对 P2 批处理宁可延迟、暂停或改走低价模型，也不要破坏 P0 的首字 SLO。

## 七、自动扩缩容：GPU 利用率不是唯一信号

仅以 GPU utilization 扩容常常太晚：GPU 已满、队列已经堆积，拉起新 GPU 实例又需要数分钟。建议把信号分为需求、饱和和体验三类：

| 信号 | 用途 | 误区 |
| --- | --- | --- |
| 入队 token/s、活动请求数 | 提前预测需求 | 不区分长短请求 |
| 队列等待、拒绝率 | 判断服务不足 | 只看瞬时尖峰可能抖动 |
| KV 使用率、可分配块 | 防止显存耗尽 | 高使用率不等于立刻扩容 |
| TTFT/TPOT P95 | 衡量用户体验 | 延迟指标有滞后 |
| GPU SM/显存利用率 | 辅助诊断 | 高利用率本身可能是健康状态 |

扩容策略通常是“预测或队列阈值触发 + 稳定窗口 + 最小副本数”。缩容更保守：等待在途请求 drain、缓存价值下降、冷却时间结束后再释放实例。对模型加载慢的集群，应维护 warm pool、镜像预拉取、模型权重本地缓存和可快速加入的 GPU 节点。

## 八、过载保护：先保护正确的用户体验

当需求超过可用容量，系统需要事先定义处置顺序：

1. 命中安全的精确缓存或 prefix cache。
2. 对低优先级请求延迟入队或转异步任务。
3. 压缩上下文、降低输出上限、关闭昂贵的自一致性/搜索。
4. 路由到经过验证的更小或更便宜模型。
5. 对非核心租户做 TPM 限流或快速失败。
6. 对 P0 场景保留容量，必要时返回可解释的繁忙提示。

“无限排队直到成功”会同时扩大 TTFT、超时重试和成本。错误的降级也会造成质量事故，所以每个 fallback 必须有能力约束、离线回归和清晰的可观测标签。

## 九、多模型、多集群与故障域

模型副本并不天然可互换。路由决策至少考虑能力、上下文窗口、工具/视觉能力、数据驻留、成本、当前排队与剩余 KV 容量。跨集群容灾时还要考虑：

- 会话和 prefix cache 是否可迁移，还是仅让新请求切走。
- 模型权重、tokenizer、量化版本和 prompt 格式是否一致。
- 熔断是否避免把主集群故障扩散到备用集群。
- 降级模型对结构化输出、工具调用和安全策略是否仍满足最低要求。
- DNS/负载均衡切换、数据驻留和账单归属是否可审计。

不要承诺“任意模型都能无感切换”。正确做法是为每类能力建立兼容矩阵，并在发布前压测 fallback 路径。

## 十、压测设计：固定并发不够

| 压测方式 | 适合回答 | 需要补充 |
| --- | --- | --- |
| 固定并发 | 单副本极限与甜点区 | 容易低估真实突发排队 |
| 阶梯并发 | 找到拐点和饱和行为 | 记录每级队列与 KV 指标 |
| 泊松到达 | 模拟随机在线到达 | 使用真实 token 分布 |
| 突发流量 | 验证 autoscaling 和限流 | 观察冷启动、恢复时间 |
| 长尾样本 | 验证 OOM 与 P99 | 包含最大上下文/输出限制 |
| 故障注入 | 验证容灾和过载策略 | 模拟节点丢失、provider 429 |

压测报告至少固定：模型版本、量化、推理框架、硬件、并行策略、prompt 模板、输入输出分布、缓存状态、到达模式、并发梯度和 SLO。否则不同报告之间没有可比性。

## 十一、观测与告警

建议按 `model + deployment + tenant tier + route` 维度记录：

```text
request rate, input/output tokens, queue wait, TTFT, TPOT,
active sequences, KV blocks used, OOM/reject/timeout,
GPU utilization, replica count, cold-start duration, cost
```

排障顺序：

1. 先拆 E2E 延迟为网关、排队、prefill、decode 和网络发送。
2. 看请求长度分布和到达突发是否变化，避免只盯平均 QPS。
3. 看 KV、显存碎片、活跃序列与 OOM，判断是否容量或调度问题。
4. 看路由、fallback、重试和缓存命中，判断是否某条策略放大压力。
5. 最后关联最近的模型、Prompt、量化、框架和集群配置发布。

告警不要只在 GPU 到 95% 时响。更有效的是“P95 队列等待持续上升 + 可用副本不足”“KV 分配失败”“P99 TTFT 超过 SLO 且拒绝率增长”等组合条件。

## 十二、高频面试问答

**Q：如何估算一个模型需要多少张卡？**

先按业务场景收集峰值到达率、输入输出 token 分布和 TTFT/TPOT SLO；用目标硬件与推理框架压测真实负载，得到单副本在 SLA 内的 goodput；再加入 N+1、扩容冷启动和发布余量。还要验证权重和峰值 KV 是否装得下，不能只做 token/s 除法。

**Q：GPU 利用率很低但用户首字慢，为什么？**

可能卡在网关队列、请求被限流、RAG/鉴权前置、模型冷启动、batch 策略或长 prompt prefill。GPU 平均利用率低不代表每个时段都没有短时排队；要从 trace 拆 TTFT 的每一段。

**Q：为什么长上下文会导致服务突然 OOM？**

权重显存相对固定，但每个活跃序列的 KV Cache 随上下文和输出增长。若多个长请求同时进入，KV 会快速耗尽或碎片化。应做 token 级准入、最大上下文/输出限制、PagedAttention 或 KV 量化，并把长任务隔离或异步化。

**Q：自动扩缩容为什么经常救不了流量突发？**

因为 GPU 节点申请、镜像拉取、模型加载和健康检查都有延迟。突发到来时要依赖预留容量、队列/限流、缓存和优先级保护；autoscaling 用于恢复持续需求，而不是当作零延迟保险。

**Q：怎么在吞吐和延迟之间选择 batch？**

增大 batch 通常提高吞吐，但排队和单请求延迟也可能上升。选择应以不同优先级的 SLO goodput 为准：交互式业务设置更小窗口和严格 TTFT，离线业务用更大 batch 吃满吞吐；连续批处理能缓解但不能消除权衡。

## 十三、项目讲法模板

> 我负责模型服务的容量与弹性治理。我们不再用平均 QPS 估卡数，而是按在线聊天、RAG 长上下文和批处理拆分 token 分布与 SLO，在真实到达模式下压测各模型副本的 SLA goodput。运行时将排队、TTFT、TPOT、KV 使用率和 GPU 指标分开监控；扩容由队列和可用 KV 驱动，缩容等待在途会话 drain。高峰期通过按租户的 TPM 配额、优先级队列、上下文预算和经评测的模型降级保护核心交互，因此既降低了 OOM 和 P99 超时，也避免了长期过度预留 GPU。

继续学习：[推理成本与性能优化](/interview/inference-cost-qna)、[推理优化与加速](/inference/inference-optimization)、[KV Cache 与 PagedAttention](/inference/kv-cache)、[推理框架选型](/inference/serving-frameworks)、[LLM 流式输出与会话恢复设计](/interview/llm-streaming-session-resilience-playbook)。
