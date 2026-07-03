# 推理性能压测与服务化指标

> 「你怎么评估一个 LLM 推理服务够不够快、扛不扛得住？」这是推理/工程岗的必考题。本文参考 [llm-action](https://github.com/liguodongiot/llm-action) 的推理性能压测经验，讲清核心指标（TTFT/TPOT/吞吐/goodput）、压测方法论、性能与成本的权衡曲线，以及常见调优手段。推理原理见 [推理优化与部署](/inference/inference-optimization)，框架选型见 [推理框架对比](/inference/serving-frameworks)。

## 面试先背这几句话

- LLM 推理两阶段：**Prefill（处理 prompt，算力密集）** 和 **Decode（逐 token 生成，访存密集）**，指标要分开看。
- 用户侧看**延迟**：**TTFT（首 token 延迟）** 和 **TPOT/ITL（每 token 间隔）**；系统侧看**吞吐**：总 token/s、请求 QPS。
- **吞吐和延迟是矛盾的**：batch 越大吞吐越高但单请求延迟越高，要找满足 SLA 前提下的最大吞吐。
- **goodput**（满足 SLA 的有效吞吐）比裸吞吐更有意义——吞吐再高但都超时也没用。
- 压测要区分**离线批处理**（追求吞吐/成本）和**在线服务**（追求延迟 SLA），两者优化目标完全不同。

## 一、先分清两个阶段

| 阶段 | 特征 | 瓶颈 | 对应指标 |
| --- | --- | --- | --- |
| **Prefill** | 并行处理整个 prompt，一次算完 | **算力（compute-bound）** | TTFT |
| **Decode** | 自回归逐个生成 token，每步读全部权重+KV | **访存带宽（memory-bound）** | TPOT |

理解这点才能解释很多现象：为什么长 prompt 拖慢首字（prefill 变长）、为什么 decode 阶段 GPU 算力利用率低（卡在读显存）、为什么 batching 对 decode 提升巨大（摊薄权重读取）。详见 [推理优化与部署](/inference/inference-optimization)。

## 二、核心指标详解 ★

### 2.1 延迟类（用户体验）

- **TTFT（Time To First Token，首 token 延迟）**：从请求发出到吐出第一个字。决定「体感响应速度」，聊天场景最敏感。主要受 prompt 长度、prefill 速度、排队时间影响。
- **TPOT（Time Per Output Token）/ ITL（Inter-Token Latency）**：生成阶段每个 token 的间隔。决定「打字速度」。要求通常是**比人阅读速度快**即可（如 <50ms/token）。
- **端到端延迟（E2E Latency）** = TTFT + TPOT × 输出 token 数。
- **归一化延迟**：E2E / 输出长度，便于跨不同长度请求比较。

### 2.2 吞吐类（系统效率）

- **Token 吞吐**：每秒生成的总 token 数（所有并发请求加总），衡量硬件利用效率。
- **请求吞吐（QPS/RPS）**：每秒完成的请求数。
- **并发数**：同时在处理的请求数。

### 2.3 goodput（有效吞吐）★

裸吞吐会骗人：把 batch 拉满吞吐很高，但每个请求都超了延迟 SLA，用户全跑了。**goodput = 满足延迟 SLA（如 TTFT<1s 且 TPOT<50ms）的请求所贡献的吞吐**。生产上真正要优化的是 goodput，不是峰值吞吐。

## 三、延迟 vs 吞吐的权衡曲线 ★

这是推理服务设计的核心矛盾：

```
吞吐 ↑
  |          ___----  饱和（延迟开始暴涨）
  |     __--
  |   /  ← 甜点区（吞吐高且延迟可接受）
  | /
  +-------------------→ 并发/batch size
```

- **batch size / 并发增大** → 吞吐上升（权重读取被摊薄）、但排队和单请求延迟上升。
- 存在一个**拐点**：超过后延迟急剧恶化而吞吐几乎不再涨。
- 压测的目标就是**在满足 SLA 的前提下找到最大并发/batch**，即甜点区。

**Continuous Batching（连续批处理）** 让不同长度的请求动态进出 batch，大幅提升 GPU 利用率，是 vLLM/SGLang 等框架吞吐高的关键（见 [推理框架对比](/inference/serving-frameworks)）。

## 四、压测方法论

### 4.1 明确目标与场景

- **在线服务**：固定 SLA（TTFT/TPOT），压出最大 goodput 和支持的并发。
- **离线批处理**：不看单请求延迟，压最大总吞吐 / 最低单 token 成本。

### 4.2 控制变量

压测结果强依赖这些参数，报告必须写清：

- **输入/输出长度分布**：128→128、2048→256 等，长度差异对结果影响巨大。
- **并发数 / 请求到达模式**：固定并发 vs 泊松到达（更贴近真实流量）。
- **模型 + 精度 + 并行方式**：72B FP16 TP4 和 INT8 TP2 完全不可比。
- **硬件**：卡型、卡数、互联。

### 4.3 常用工具

- **vLLM 自带 benchmark 脚本**（benchmark_serving/throughput）。
- **LLMPerf**、**GenAI-Perf（NVIDIA）**、**locust** 等压测框架。
- 关注输出：TTFT/TPOT 的 P50/P90/P99 分布，而非只看均值（长尾才是用户投诉来源）。

### 4.4 报告怎么写

一份可信的压测报告应包含：场景与 SLA、输入输出长度、并发梯度、TTFT/TPOT 分位数、吞吐、goodput、GPU 利用率与显存占用、成本（$/百万 token）。**只给一个「吞吐 X token/s」的数字是不合格的**。

## 五、影响性能的关键因素与调优

| 因素 | 影响 | 调优手段 |
| --- | --- | --- |
| Batch 策略 | 吞吐 | Continuous batching、动态 batch |
| KV Cache 显存 | 最大并发 | PagedAttention、KV 量化、MQA/GQA/MLA |
| 量化 | 吞吐/显存/精度 | W8A8、W4A16、KV Cache 量化（见 [量化实战](/inference/quantization)） |
| 并行策略 | 延迟/吞吐 | TP 降延迟、PP/DP 提吞吐 |
| 投机解码 | Decode 延迟 | 小模型草稿 + 大模型验证（见 [投机解码](/inference/speculative-decoding)） |
| Prefill/Decode 分离 | 长尾延迟 | Disaggregated serving，两阶段各自扩缩 |
| Chunked Prefill | TTFT 长尾 | 把长 prompt 的 prefill 切块，与 decode 交错，避免阻塞 |

## 六、成本视角

推理成本通常以 **$/百万 token** 或 **单请求成本** 衡量：

- 成本 ≈ (GPU 单价/小时) / (每小时吞吐 token 数)。**提吞吐 = 降成本**。
- 长上下文昂贵：prefill 算力随长度增长，KV Cache 随长度线性占显存。
- 优化杠杆：量化提吞吐、连续批处理提利用率、缓存（Prefix Cache 复用系统提示）、模型路由（简单请求走小模型）。

面试表达：**推理优化的终极目标是在满足延迟 SLA 的前提下，把单位 token 成本压到最低**。

## 高频追问

1. **评估 LLM 推理性能看哪些指标？** 延迟看 TTFT 和 TPOT/ITL，吞吐看 token/s 和 QPS，综合看 goodput（满足 SLA 的有效吞吐）。
2. **TTFT 和 TPOT 分别由什么决定？** TTFT 由 prompt 长度+prefill 速度+排队决定；TPOT 由 decode 阶段访存带宽、batch、KV Cache 决定。
3. **为什么吞吐和延迟矛盾？** batch 越大摊薄权重读取吞吐越高，但排队和单请求延迟上升；要在 SLA 内找最大 batch（甜点区）。
4. **为什么要看 goodput 而不是裸吞吐？** 裸吞吐可能全是超时请求，goodput 只算满足延迟 SLA 的有效吞吐，更贴近业务价值。
5. **Prefill 和 Decode 哪个是算力瓶颈、哪个是访存瓶颈？** Prefill 算力密集（compute-bound），Decode 访存密集（memory-bound），所以 batching 主要提升 decode。
6. **压测报告要控制哪些变量？** 输入/输出长度、并发/到达模式、模型+精度+并行、硬件；只报一个吞吐数字不可信。
7. **有哪些手段能同时提吞吐降成本？** 连续批处理、量化、PagedAttention/KV 量化、Prefix Cache 复用、Prefill/Decode 分离、模型路由。
