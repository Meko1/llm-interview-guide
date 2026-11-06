---
title: 推理优化与部署
description: >-
  把大模型高效、低成本地跑起来对外服务，是工程岗的核心考点。本文系统讲清推理的两阶段与性能特性、核心指标、KV Cache 与
  PagedAttention、量化、批处理、投机解码、并行与缓存，以及主流推理框架对比。硬件基础见 GPU 与硬件。
level: L2
roles:
  - Infra
  - 后端转型
classification: inferred
---
# 推理优化与部署

> 把大模型高效、低成本地跑起来对外服务，是工程岗的核心考点。本文系统讲清推理的两阶段与性能特性、核心指标、KV Cache 与 PagedAttention、量化、批处理、投机解码、并行与缓存，以及主流推理框架对比。硬件基础见 [GPU 与硬件](/inference/gpu-hardware)。

## 一、推理的两个阶段：Prefill 与 Decode

自回归生成分为两个阶段，性能特性截然不同——理解这点是回答所有推理优化问题的基础：

| 阶段 | 做什么 | 性能特性 | 决定 |
| --- | --- | --- | --- |
| **Prefill（预填充）** | 处理已知输入并建立 KV，供首个 token 采样 | 常偏计算密集；长注意力/小形状需实测 | TTFT 的执行部分，不含全部客户端延迟 |
| **Decode（解码）** | 标准路径每请求每步处理一个新增 token | 小 batch 常偏访存；也可能受计算/通信限制 | 平均 TPOT、ITL 与达标吞吐 |

**为什么小 batch Decode 常偏 memory-bound？** 有效计算难以摊薄权重/KV 访存；更大 batch 可复用权重读取。但 MoE 稀疏激活、cache 层级、kernel 和并行都会改变流量，不能说每个输出 token 必然逐字节读取全部权重和 KV。

> 增大 batch 不是免费收益：可能增加 ITL、排队与 KV 峰值。先制定 [SLO/goodput](/inference/slo-goodput)，再做负载扫描。

## 二、核心指标

| 指标 | 含义 |
| --- | --- |
| **TTFT**（Time To First Token） | 首字延迟，影响体感响应速度，主要由 prefill 决定 |
| **TPOT / ITL** | TPOT 是每请求平均间隔，ITL 是实际间隔分布；chunk 合并需注明可观测性 |
| **吞吐（Throughput）** | 每秒处理的 token / 请求数 |
| **延迟 vs 吞吐** | 二者常此消彼长：增大 batch 提吞吐但单请求延迟上升 |
| **显存占用** | 权重 + KV Cache + 激活 |

> 工程上常按 SLA 权衡：实时对话优先低 TTFT/TPOT，离线批处理优先高吞吐。

## 三、KV Cache 与显存管理

### 3.1 KV Cache

缓存历史 token 的 K、V 避免重复计算（详见 [Attention](/basics/attention)）。它把 Decode 从「每步重算全历史」降为「每步只算新 token」，是自回归推理的基础优化。代价：显存随 `序列长度 × 层数 × 头数 × batch` **线性增长**，是长上下文/高并发的主要瓶颈。

### 3.2 PagedAttention（vLLM 核心）

传统 KV Cache 为每个请求预分配连续大块显存，导致严重的**内部碎片和浪费**（要按最大长度预留）。**PagedAttention** 借鉴操作系统**虚拟内存分页**思想：把 KV Cache 切成固定大小的「块（page）」，按需分配、非连续存储，用块表映射。

收益是按需分块和共享，减少预留与碎片。仍有块尾浪费、元数据和工作区；[PagedAttention 论文](https://arxiv.org/abs/2309.06180)的实验结果不保证自己的服务浪费率或吞吐倍率。相同 token 前缀且模型/模板等计算条件一致时，可复用 KV；文本语义相似不够。

### 3.3 KV Cache 进一步优化

- **GQA / MQA / MLA**：从模型结构上减少 KV（见 [Attention](/basics/attention)）。
- **KV Cache 量化**：把缓存的 K、V 量化到 INT8/INT4。
- **KV 驱逐/压缩**：只保留重要 token 的 KV（如 H2O）。

## 四、量化（Quantization）

把权重/激活从 FP16 降到 INT8/INT4，减小显存和访存、加速推理。

| 方法 | 特点 |
| --- | --- |
| **GPTQ** | 逐层后训练量化（PTQ），基于二阶信息，weight-only INT4，精度损失小 |
| **AWQ** | 激活感知量化，保护重要权重通道，效果好、速度快 |
| **SmoothQuant** | 把激活的量化难度「迁移」到权重，支持 W8A8（权重+激活都量化） |
| **GGUF（llama.cpp）** | 面向 CPU/端侧的量化格式 |
| **FP8** | H100 起原生支持，训练推理都能用，精度损失很小 |

按量化对象分：**weight-only**（只量化权重，最常用，降显存为主）vs **weight+activation（W8A8）**（连激活也量化，能用上 INT8 算力进一步提速）。还有 **KV Cache 量化**。

权衡：权重 payload 变小不保证 kernel 或服务更快；误差可能在特定语言、长上下文或任务中放大。比较对象、格式、group size、校准与 kernel，再按同质量同 SLO 计算成本，不指定 INT4 普遍最优。GGUF 是容器，不是单一量化算法。

## 五、批处理（Batching）

- **静态批处理（Static）**：凑齐一批一起算，必须等最长的请求完成，GPU 利用率低。
- **连续批处理 / In-flight Batching（Continuous）**：vLLM 等采用，**请求完成即时退出、新请求随时插入**，按 token 粒度动态拼批，而非等整批结束。大幅提升 GPU 利用率和吞吐，是高并发服务的关键。

## 六、投机解码（Speculative Decoding）

用一个小的「**草稿模型**」一次性快速生成多个候选 token，再用大模型**并行验证**一次，接受与大模型分布一致的部分。

**何时保持目标分布？** 精确 speculative sampling 需要目标 p/草稿 q 的一致条件上下文、接受概率 `min(1,p/q)`，拒绝后从归一化 `(p−q)+` 残差采样，并回滚拒绝后 KV。Greedy 一致性是另一种保证；Medusa/EAGLE 等具体实现需逐项核查，不能由“并行验证”直接推出全部变体无损。见 [投机采样证明](/inference/speculative-sampling-proof)。

变体：**Medusa**（加多个预测头）、**EAGLE / EAGLE-2**（在特征层做草稿，接受率更高）、**Lookahead Decoding**（无需训练，基于 Jacobi 迭代）、**Self-Speculative**（用自身跳层做草稿，免维护小模型）。

> MTP 可提供草稿能力，不自动保证提速或目标分布。草稿计算、验证宽度、接受长度、额外 KV 与服务调度共同决定收益；当前框架的模型/并行/采样兼容性需按版本支持矩阵核查。

## 七、算子与并行

- **FlashAttention**：IO 感知的精确注意力，省显存提速，见 [深入页](/advanced/flash-attention)。
- **算子融合 / CUDA Graph**：减少 kernel 启动开销。
- **张量并行（TP）/ 流水线并行（PP）**：单卡放不下时跨多卡切分，见 [分布式训练](/pretraining/distributed-training)、[GPU 硬件](/inference/gpu-hardware)。

## 八、缓存与 Prefill 优化

- **前缀缓存（Prefix Caching）**：复用相同前缀（如 system prompt、few-shot）的 KV，省 prefill 计算，显著降低重复场景的 TTFT 和成本。
- **Chunked Prefill**：把长 prompt 的 prefill 切块，与 decode 交错调度，平衡 TTFT 和吞吐、避免长 prompt 阻塞其他请求。
- **语义缓存**：相似问题直接复用历史答案（应用层，见 [LLM 应用开发](/engineering/llm-app-dev)）。

## 九、主流推理框架

| 框架 | 特点 |
| --- | --- |
| **vLLM** | 分块 KV 与动态调度；可作为候选基线，不按流行度定选型 |
| **SGLang** | RadixAttention（前缀树复用 KV），适合复杂/多轮调用 |
| **TensorRT-LLM** | NVIDIA 推理工具链；比较构建、kernel 和服务配置 |
| **TGI** | Hugging Face 的推理服务 |
| **LMDeploy** | 商汤出品，量化与推理性能强 |
| **llama.cpp / Ollama** | 端侧、CPU、本地部署，GGUF 量化 |

选型看：吞吐/延迟需求、是否需量化、硬件、易用性，详见 [AI 系统设计](/engineering/system-design)。

## 九-一、Prefill/Decode 分离（Disaggregated Serving）

把 **Prefill 和 Decode 分到不同 GPU 池**，是一种减少干扰并独立配置资源的方案，不是所有负载都应启用。

- **动机**：Prefill 是计算密集（吃算力），Decode 是访存密集（吃带宽），混跑在同一 GPU 上会互相干扰——Prefill 抢算力时 Decode 延迟飙升，Decode 占满 KV Cache 时 Prefill 没空间。
- **做法**：Prefill 节点算完 KV 后，把 KV Cache 传给 Decode 节点继续生成。两个池子各自独立扩缩容、独立优化。
- **挑战**：KV 传输、布局/精度一致性、接收缓冲和故障重试；分离收益必须覆盖这些开销。[DistServe](https://arxiv.org/abs/2401.09670)报告特定模型与 SLO 下的实验，不能外推成无条件收益。

构造每请求传输 2 GiB KV、有效单向带宽 25 GiB/s，则传输下界 80 ms（未含调度/同步）。若节省的干扰时间不足以抵消传输，分离反而可能降低达标容量。

## 九-二、MLA：从架构上压缩 KV Cache

**MLA（Multi-head Latent Attention）** 是 DeepSeek-V2/V3 的标志性创新。传统 GQA/MQA 通过减少 KV 头数来压缩，MLA 走了不同路线：把 K、V 投影到一个**低维潜空间向量**，只缓存这个压缩向量，推理时再解压还原。

- **效果**：减少特定结构的 KV 存储，不减少全部专家权重；还需缓存解耦位置部分，实际表示按引擎核算。
- **与 GQA 对比**：GQA 减少 KV 头，MLA 缓存压缩 latent 与位置部分，投影可通过吸收优化避免显式完整解压。比例与质量取决于维度和训练，不能统一排名。
- 详见 [DeepSeek 专题](/models/deepseek)。

## 九-三、2025 推理框架格局

| 框架 | 定位 | 2025 进展 |
| --- | --- | --- |
| **vLLM** | 通用候选基线 | 分块 KV、批处理、前缀和草稿支持需按版本/模型核对 |
| **SGLang** | 复杂调用优化 | RadixAttention（前缀树 KV 复用），结构化输出性能强 |
| **TensorRT-LLM** | NVIDIA 官方 | 极致 GPU 性能，支持 FP4/FP8，部署较重 |
| **TGI** | HuggingFace 出品 | 模型支持广、易用 |
| **LMDeploy** | 商汤出品 | 量化与推理性能强 |
| **llama.cpp / Ollama** | 端侧本地 | GGUF 量化，CPU/消费级 GPU |
| **DeepSpeed-FastGen** | 微软出品 | Dynamic Splitfuse 长上下文优化 |

> 选型趋势：vLLM 仍是大多数场景的默认选择；SGLang 在 Agentic/多轮调用场景（大量前缀复用）有优势；追求极致性能且用 NVIDIA 硬件选 TensorRT-LLM。

## 面试专项：推理系统设计与容量规划

面试官让你设计一个私有化推理服务时，不要只列「模型 + GPU + vLLM」。更完整的答法是从业务 SLA 倒推系统：

1. **业务目标**：峰值 QPS、平均输入/输出 token、最长上下文、是否流式、P95/P99 TTFT 和 TPOT。
2. **模型与精度**：模型大小、上下文窗口、FP16/BF16、W4A16、W8A8、FP8、是否需要 LoRA 热加载。
3. **推理引擎**：按硬件/模型/量化/接口支持筛选 vLLM、SGLang、TensorRT-LLM 等候选，再同负载验证，不预设性能赢家。
4. **调度策略**：continuous batching、prefix cache、chunked prefill、长短请求隔离、优先级队列、admission control。
5. **容量估算**：请求需求 RPS 除以同负载单副本请求 goodput（requests/s），得到初始副本估计，再按每副本 GPU 数和冗余计卡数。若用 token/s，分子分母必须同为达标 token 吞吐；多卡副本不能冒充单 GPU。扩容后的调度与流量偏斜仍需复测。
6. **观测与止血**：TTFT、TPOT、排队时间、KV Cache 占用、GPU 利用率、错误率、每租户成本都要能看见。

常见追问是「P99 突然升高怎么定位」。答题时先拆阶段：

- **TTFT 高**：看排队、长 prompt、Prefill 池、prefix cache 命中率、网络和新版本 prompt。
- **TPOT 高**：看 Decode batch、显存带宽、KV Cache 压力、量化 kernel 是否退化、输出长度是否异常。
- **OOM 或并发下降**：先查 KV Cache，因为它随上下文和并发线性增长；再查碎片、长会话、超长输出和副本不均衡。

面试里最加分的一句是：**推理优化不是单点调参，而是在 SLA 内最大化 goodput，并把 $/百万有效 token 降下来**。完整问答见 [推理部署与成本治理高频问答](/interview/inference-cost-qna)。

## 十、高频追问

**Q：Prefill 和 Decode 的区别？** Prefill 并行处理输入 prompt、计算密集、定 TTFT；Decode 逐 token 生成、访存密集、定 TPOT 和吞吐。

**Q：为什么 Decode 是 memory-bound？** 每生成一个 token 都要把整个模型权重和 KV Cache 从显存读一遍，计算量却小，瓶颈在显存带宽。所以提高 batch、用量化减少访存能提速。

**Q：KV Cache 是什么？为什么是瓶颈？怎么优化？** 缓存历史 K、V 避免重算，加速 Decode；显存随序列长度线性增长，是长上下文/高并发瓶颈。优化：GQA/MQA/MLA 减 KV、PagedAttention 管理、KV 量化、前缀缓存复用。

**Q：PagedAttention 解决什么问题？** 传统 KV Cache 连续预分配导致碎片和浪费；PagedAttention 像 OS 分页一样按块非连续分配 KV，几乎消除碎片、提升显存利用率和并发吞吐，并支持前缀共享。

**Q：连续批处理为什么能提吞吐？** 静态批要等最长请求完成、GPU 空转；连续批让完成的请求即时退出、新请求随时插入、按 token 动态拼批，GPU 几乎不空转，吞吐大增。

**Q：常见量化方法及取舍？** GPTQ（逐层 PTQ）、AWQ（激活感知）、SmoothQuant（W8A8）、GGUF（端侧）、FP8（H100）。weight-only INT4 性价比最高（降显存为主）；W8A8 还能用 INT8 算力提速。代价是可能轻微掉点。

**Q：投机解码何时不改变目标分布？** 使用严格接受/残差采样与正确 KV 回滚时，在数学假设下保持目标分布；近似变体、处理器不一致和数值错误可能破坏保证。

**Q：怎么降低 TTFT？** prefill 优化（chunked prefill）、前缀缓存复用（相同 system prompt）、减少输入长度、张量并行加速 prefill。

**Q：长上下文推理的瓶颈与对策？** 瓶颈是 KV Cache 显存。对策：GQA/MQA/MLA 减 KV、PagedAttention 高效管理、KV Cache 量化、前缀缓存复用，详见 [长上下文](/basics/long-context)。

**Q：output token 为什么比 input token 贵？** input（prefill）可并行处理、一次算完；output（decode）必须逐个串行生成、每个都要读一遍全部权重和 KV，单位成本更高，所以 API 对输出计费更贵。

**Q：延迟和吞吐怎么权衡？** 二者常此消彼长：增大 batch 提升吞吐但单请求延迟上升。实时对话优先低延迟（小 batch、低 TTFT/TPOT），离线批量优先高吞吐（大 batch、连续批处理）。

**Q：Prefill/Decode 分离是什么？为什么要分离？** 把 Prefill 和 Decode 分到不同 GPU 池——前者计算密集、后者访存密集，混跑会互相干扰。分离后各自独立优化和扩缩容，代价是 KV Cache 跨节点传输开销。2025 年的趋势方向。

**Q：MLA 和 GQA 有什么区别？** GQA 通过"多个 Q 头共享一组 KV 头"做粗粒度压缩；MLA（DeepSeek-V2/V3）把 KV 投影到低维潜空间，只缓存压缩向量，推理时解压还原。MLA 压缩率更高，但实现更复杂。详见 [DeepSeek 专题](/models/deepseek)。

**Q：vLLM 和 SGLang 怎么选？** 用完整 token 前缀、真实复用率、结构化约束与服务长度分布测试；树/哈希数据结构本身不能保证某引擎命中率或 goodput 更高。

## 优化证据的最小闭环

每次只改一个可归因变量，保存基线/变体的模型与引擎 revision、精度、输入/输出长度、实际到达、缓存状态、成功与 SLO 判定。随机固定 shape 用于机制 benchmark，真实脱敏回放用于服务验收，构造容量算例只作预算。量化、驱逐和语义缓存还要过同一质量门禁；降低生成长度或复用错误答案得来的快不能称优化成功。

前缀语义可核对 [vLLM v0.6.3.post1 APC 说明](https://github.com/vllm-project/vllm/blob/v0.6.3.post1/docs/source/automatic_prefix_caching/apc.rst)，MLA 表示见 [DeepSeek-V3](https://arxiv.org/html/2412.19437v2)。旧“2025”章节标题保留用于原链接，表格不是当前版本完整支持矩阵。
