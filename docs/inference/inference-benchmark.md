---
title: 推理性能压测与服务化指标
description: >-
  「你怎么评估一个 LLM 推理服务够不够快、扛不扛得住？」这是推理/工程岗的必考题。本文参考 llm-action
  的推理性能压测经验，讲清核心指标（TTFT/TPOT/吞吐/goodput）、压测方法论、性能与成本的权衡曲线，以及常见调优手段。推理原理见
  推理优化与部署，框架选型见 推理框架对比。
level: L2
roles:
  - Infra
  - 后端转型
classification: inferred
---
# 推理性能压测与服务化指标

> 「你怎么评估一个 LLM 推理服务够不够快、扛不扛得住？」这是推理/工程岗的必考题。本文参考 [llm-action](https://github.com/liguodongiot/llm-action) 的推理性能压测经验，讲清核心指标（TTFT/TPOT/吞吐/goodput）、压测方法论、性能与成本的权衡曲线，以及常见调优手段。推理原理见 [推理优化与部署](/inference/inference-optimization)，框架选型见 [推理框架对比](/inference/serving-frameworks)。

## 面试先背这几句话

- LLM 推理两阶段：Prefill 处理 prompt，Decode 逐步生成；前者常偏算力密集，后者常偏访存密集，实际瓶颈还取决于形状、batch、硬件与通信。
- 用户侧看**延迟**：TTFT、每请求平均 TPOT 与实际间隔 ITL；系统侧看**吞吐**：明确输入/输出 token/s 与请求完成 RPS 的口径。
- 增大 batch 可摊销权重读取，但可能增加排队/执行延迟；吞吐不会无上限增长，按 SLO 找达标容量，而不是最大 batch。
- **goodput**（满足 SLA 的有效吞吐）比裸吞吐更有意义——吞吐再高但都超时也没用。
- 压测要区分**离线批处理**（追求吞吐/成本）和**在线服务**（追求延迟 SLA），两者优化目标完全不同。

## 一、先分清两个阶段

| 阶段 | 特征 | 瓶颈 | 对应指标 |
| --- | --- | --- | --- |
| **Prefill** | 并行处理已知 prompt | 常偏算力密集，需验证硬件与形状 | 影响 TTFT，客户端 TTFT 还含排队等 |
| **Decode** | 自回归生成，读取权重与相关 KV | 常偏访存密集，batch/上下文/通信会改变瓶颈 | TPOT 与间隔分布 |

理解这点才能解释很多现象：为什么长 prompt 拖慢首字（prefill 变长）、为什么 decode 阶段 GPU 算力利用率低（卡在读显存）、为什么 batching 对 decode 提升巨大（摊薄权重读取）。详见 [推理优化与部署](/inference/inference-optimization)。

## 二、核心指标详解 ★

### 2.1 延迟类（用户体验）

- **TTFT（Time To First Token，首 token 延迟）**：从请求发送到首个有效 token 响应；token 不等于汉字，也不计空角色事件。客户端计时包含网络、队列、tokenization、prefill 和序列化；服务端计时需另标边界。
- **TPOT（Time Per Output Token）**：每请求首 token 后的平均生成间隔；**ITL（Inter-Token Latency）** 是间隔观测及分布。若事件合并多个 token，不能把 chunk 间隔冒充 token 间隔；阈值由产品体验目标定义。
- **最后 token 延迟** = TTFT + (输出 token 数 − 1) × 平均 TPOT（输出数 > 1，且采用一致的逐 token 计时边界）。若 E2E 计到协议结束，应说明尾部开销；单 token 的 TPOT 未定义。完整计算见 [SLO 与 goodput 账本](/inference/slo-goodput)。
- **归一化延迟**：E2E / 输出长度可作为附加描述，但长固定 TTFT 会被长输出摊薄，不能拿它代替 TTFT、TPOT 或公平的长度分桶。

### 2.2 吞吐类（系统效率）

- **Token 吞吐**：每秒生成的总 token 数（所有并发请求加总），衡量硬件利用效率。
- **请求吞吐（QPS/RPS）**：每秒完成的请求数。
- **并发数**：同时在处理的请求数。

### 2.3 goodput（有效吞吐）★

请求 goodput = 成功且满足所有适用 SLO 的请求数 / 测试秒数；不同于达标请求的输出 token/s。失败保留在提交分母，计时窗口与 drain 要明确。可运行示例见 [推理 SLO 账本](/inference/slo-goodput)。

构造门槛可以是 TTFT≤1 s、平均 TPOT≤50 ms、E2E≤任务期限，同时满足质量与错误约束；这些不是行业统一 SLO。请求 goodput 的单位是 requests/s，达标输出吞吐是 tokens/s，二者必须分开命名。SLO 是操作目标，SLA 是服务约定。

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
- **离线批处理**：可不强调流式 ITL，但仍有任务完工期限、成功率和质量要求，不能只看总 token/s。

### 4.2 控制变量

压测结果强依赖这些参数，报告必须写清：

- **输入/输出长度分布**：128→128、2048→256 等，长度差异对结果影响巨大。
- **并发数 / 请求到达模式**：闭环固定并发、开环目标到达率、突发与实际流量回放；泊松只是一个随机基线，不必然贴近真实流量。
- **模型 + 精度 + 并行方式**：同条件做机制消融；不同精度/卡数也可做产品选型，但先通过同质量门禁并归一硬件成本，不将差异归因于单一优化。
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
| 并行策略 | 延迟/吞吐 | TP/PP/DP 的收益取决于通信、batch 与显存，不作固定角色承诺 |
| 投机解码 | Decode 延迟 | 小模型草稿 + 大模型验证（见 [投机解码](/inference/speculative-decoding)） |
| Prefill/Decode 分离 | 长尾延迟 | Disaggregated serving，两阶段各自扩缩 |
| Chunked Prefill | 干扰与尾延迟 | 减少 decode 阻塞，但分块过小可能增加长 prompt TTFT/调度开销 |

## 六、成本视角

推理成本通常以 **$/百万 token** 或 **单请求成本** 衡量：

- 单位输出成本可按 `总运行费用 / 有效输出 token × 10^6` 统计；请求成本按成功且达标请求数统计。增加卡数、重试或降低质量时，裸吞吐提高不保证单位完成任务成本降低。
- 长上下文昂贵：prefill 算力随长度增长，KV Cache 随长度线性占显存。
- 优化杠杆：量化提吞吐、连续批处理提利用率、缓存（Prefix Cache 复用系统提示）、模型路由（简单请求走小模型）。

面试表达：**推理优化的终极目标是在满足延迟 SLA 的前提下，把单位 token 成本压到最低**。

## 面试专项：压测报告与 goodput 门禁

一份能经得起追问的压测报告，建议按下面模板写：

| 模块 | 必写内容 | 常见坑 |
| --- | --- | --- |
| 场景 | 在线聊天、Agent 工具调用、RAG 问答、离线批处理 | 把离线吞吐当在线能力 |
| SLA | TTFT、TPOT、E2E、错误率、超时阈值 | 只看平均值，不看 P95/P99 |
| 数据 | 输入/输出长度分布、采样参数、是否流式 | 用固定短 prompt 冒充真实流量 |
| 到达模式 | 固定并发、阶梯并发、泊松到达 | 忽略突发流量和排队时间 |
| 结果 | throughput、goodput、TTFT/TPOT 分位数、GPU/KV 占用 | 只报 tokens/s |
| 成本 | GPU 小时价、每小时有效 token、$/百万 token | 用超 SLA 吞吐算低成本 |

**闭环固定并发**在服务变慢时会自动降低新请求发送速率，可能掩盖真实到达下的过载；**开环压测**按计划发送并记录实际发送偏差，才能看到排队增长。泊松基线之外要回放真实突发与长短请求相关性，并检查压测客户端没有 CPU/连接瓶颈。

### 实测、随机输入与构造账本分开报告

随机 token/固定长度适合控制 shape 和 kernel 负载，不能代表真实内容质量、EOS 长度分布或 prefix cache 命中。真实回放需冻结脱敏样本、模型/tokenizer 与采样参数；冷缓存/暖缓存、忽略 EOS/自然终止分开测，不能把预热后的重复短提示结果当全流量容量。

保存逐请求发送/首 token/末 token/协议结束、输出长度、状态、取消/超时、SLO 判定及逐事件 token 数。明确统计窗口是否包含 drain；不丢失败和未完成请求，只对成功子集算延迟会造成幸存者偏差。复测至少报告窗口、样本数和波动，不将教学账本当线上 benchmark。

工具也可能同名异义：[GenAI-Perf 官方指标定义](https://github.com/triton-inference-server/perf_analyzer/tree/main/genai-perf#metrics)的 ITL 是响应间隔除以后一个响应 token 数，不是不可观测的逐 token 原始时间。归档 [vLLM v0.6.3.post1 benchmark_serving.py](https://github.com/vllm-project/vllm/blob/v0.6.3.post1/benchmarks/benchmark_serving.py)提供随机长度/前缀参数；当前 CLI 已可能变更，正式运行锁定版本并检查 `--help`。

排障时按阶段看：

- TTFT 长尾：排队时间、长 prompt、prefill 阻塞、prefix cache 污染、批量任务挤占在线池。
- TPOT 长尾：decode batch 过大、KV Cache 接近上限、显存带宽打满、量化 kernel 退化、输出长度异常。
- 成本异常：模型路由失效、缓存命中率下降、prompt 版本变长、输出 token 失控、低优先级任务跑到高价模型。

## 高频追问

1. **评估 LLM 推理性能看哪些指标？** 延迟看 TTFT 和 TPOT/ITL，吞吐看 token/s 和 QPS，综合看 goodput（满足 SLA 的有效吞吐）。
2. **TTFT 和 TPOT 分别由什么决定？** TTFT 由 prompt 长度+prefill 速度+排队决定；TPOT 由 decode 阶段访存带宽、batch、KV Cache 决定。
3. **为什么吞吐和延迟矛盾？** batch 越大摊薄权重读取吞吐越高，但排队和单请求延迟上升；要在 SLA 内找最大 batch（甜点区）。
4. **为什么要看 goodput 而不是裸吞吐？** 裸吞吐可能全是超时请求，goodput 只算满足延迟 SLA 的有效吞吐，更贴近业务价值。
5. **Prefill 和 Decode 哪个是算力瓶颈、哪个是访存瓶颈？** 前者常偏算力、后者常偏访存，但不能脱离 batch、上下文、硬件与通信直接定性；用同条件压测和 profiling 检验。
6. **压测报告要控制哪些变量？** 输入/输出长度、并发/到达模式、模型+精度+并行、硬件；只报一个吞吐数字不可信。
7. **有哪些手段能同时提吞吐降成本？** 连续批处理、量化、PagedAttention/KV 量化、Prefix Cache 复用、Prefill/Decode 分离、模型路由。
