# 推理优化与部署

> 把大模型高效、低成本地跑起来对外服务，是工程岗的核心考点。本文系统讲清推理的两阶段与性能特性、核心指标、KV Cache 与 PagedAttention、量化、批处理、投机解码、并行与缓存，以及主流推理框架对比。硬件基础见 [GPU 与硬件](/inference/gpu-hardware)。

## 一、推理的两个阶段：Prefill 与 Decode

自回归生成分为两个阶段，性能特性截然不同——理解这点是回答所有推理优化问题的基础：

| 阶段 | 做什么 | 性能特性 | 决定 |
| --- | --- | --- | --- |
| **Prefill（预填充）** | 并行处理整个输入 prompt，算出所有 token 的 KV，生成第 1 个 token | 计算密集（compute-bound） | 首 token 延迟 TTFT |
| **Decode（解码）** | 逐个生成后续 token，每步只算 1 个新 token | 访存密集（memory-bound） | 每 token 延迟 TPOT、吞吐 |

**为什么 Decode 是 memory-bound？** 每生成一个 token，都要把**整个模型权重**和 **KV Cache** 从显存读一遍，而实际计算量很小（batch 小时尤甚）。所以瓶颈在**显存带宽**而非算力——这解释了为什么提高 batch、用量化减少访存能提速。

> 一个直接推论：**Decode 阶段 GPU 算力大量闲置**，提高并发 batch 能「免费」提升吞吐（在显存允许范围内）。

## 二、核心指标

| 指标 | 含义 |
| --- | --- |
| **TTFT**（Time To First Token） | 首字延迟，影响体感响应速度，主要由 prefill 决定 |
| **TPOT / ITL** | 生成每个后续 token 的时间 |
| **吞吐（Throughput）** | 每秒处理的 token / 请求数 |
| **延迟 vs 吞吐** | 二者常此消彼长：增大 batch 提吞吐但单请求延迟上升 |
| **显存占用** | 权重 + KV Cache + 激活 |

> 工程上常按 SLA 权衡：实时对话优先低 TTFT/TPOT，离线批处理优先高吞吐。

## 三、KV Cache 与显存管理

### 3.1 KV Cache

缓存历史 token 的 K、V 避免重复计算（详见 [Attention](/basics/attention)）。它把 Decode 从「每步重算全历史」降为「每步只算新 token」，是自回归推理的基础优化。代价：显存随 `序列长度 × 层数 × 头数 × batch` **线性增长**，是长上下文/高并发的主要瓶颈。

### 3.2 PagedAttention（vLLM 核心）

传统 KV Cache 为每个请求预分配连续大块显存，导致严重的**内部碎片和浪费**（要按最大长度预留）。**PagedAttention** 借鉴操作系统**虚拟内存分页**思想：把 KV Cache 切成固定大小的「块（page）」，按需分配、非连续存储，用块表映射。

收益：几乎消除显存碎片（浪费 <4%）、显存利用率大幅提升 → 能容纳更多并发请求 → 吞吐大增；还支持**前缀共享**（多个请求共用相同 system prompt 的 KV 块，写时复制）。

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

权衡：量化省显存、提速，但可能轻微掉点；**INT4 weight-only 性价比常最高**。

## 五、批处理（Batching）

- **静态批处理（Static）**：凑齐一批一起算，必须等最长的请求完成，GPU 利用率低。
- **连续批处理 / In-flight Batching（Continuous）**：vLLM 等采用，**请求完成即时退出、新请求随时插入**，按 token 粒度动态拼批，而非等整批结束。大幅提升 GPU 利用率和吞吐，是高并发服务的关键。

## 六、投机解码（Speculative Decoding）

用一个小的「**草稿模型**」一次性快速生成多个候选 token，再用大模型**并行验证**一次，接受与大模型分布一致的部分。

**为什么不掉精度？** 大模型对草稿 token 做并行验证，只接受与自己分布一致的 token，最终输出分布与大模型单独解码**完全一致**——是「加速」而非「近似」。草稿越准、接受率越高、收益越大。

变体：**Medusa**（加多个预测头）、**EAGLE**（在特征层做草稿，接受率更高）、**Lookahead**。本质都是「用并行验证换 Decode 的串行步数」。

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
| **vLLM** | PagedAttention + 连续批处理，高吞吐，最流行的开源服务框架 |
| **SGLang** | RadixAttention（前缀树复用 KV），适合复杂/多轮调用 |
| **TensorRT-LLM** | NVIDIA 官方，极致性能，部署较重 |
| **TGI** | Hugging Face 的推理服务 |
| **LMDeploy** | 商汤出品，量化与推理性能强 |
| **llama.cpp / Ollama** | 端侧、CPU、本地部署，GGUF 量化 |

选型看：吞吐/延迟需求、是否需量化、硬件、易用性，详见 [AI 系统设计](/engineering/system-design)。

## 十、高频追问

**Q：Prefill 和 Decode 的区别？** Prefill 并行处理输入 prompt、计算密集、定 TTFT；Decode 逐 token 生成、访存密集、定 TPOT 和吞吐。

**Q：为什么 Decode 是 memory-bound？** 每生成一个 token 都要把整个模型权重和 KV Cache 从显存读一遍，计算量却小，瓶颈在显存带宽。所以提高 batch、用量化减少访存能提速。

**Q：KV Cache 是什么？为什么是瓶颈？怎么优化？** 缓存历史 K、V 避免重算，加速 Decode；显存随序列长度线性增长，是长上下文/高并发瓶颈。优化：GQA/MQA/MLA 减 KV、PagedAttention 管理、KV 量化、前缀缓存复用。

**Q：PagedAttention 解决什么问题？** 传统 KV Cache 连续预分配导致碎片和浪费；PagedAttention 像 OS 分页一样按块非连续分配 KV，几乎消除碎片、提升显存利用率和并发吞吐，并支持前缀共享。

**Q：连续批处理为什么能提吞吐？** 静态批要等最长请求完成、GPU 空转；连续批让完成的请求即时退出、新请求随时插入、按 token 动态拼批，GPU 几乎不空转，吞吐大增。

**Q：常见量化方法及取舍？** GPTQ（逐层 PTQ）、AWQ（激活感知）、SmoothQuant（W8A8）、GGUF（端侧）、FP8（H100）。weight-only INT4 性价比最高（降显存为主）；W8A8 还能用 INT8 算力提速。代价是可能轻微掉点。

**Q：投机解码为什么不掉精度？** 大模型对草稿模型生成的 token 做并行验证，只接受与自己分布一致的 token，最终输出分布与大模型单独解码一致，是加速而非近似。

**Q：怎么降低 TTFT？** prefill 优化（chunked prefill）、前缀缓存复用（相同 system prompt）、减少输入长度、张量并行加速 prefill。

**Q：长上下文推理的瓶颈与对策？** 瓶颈是 KV Cache 显存。对策：GQA/MQA/MLA 减 KV、PagedAttention 高效管理、KV Cache 量化、前缀缓存复用，详见 [长上下文](/basics/long-context)。

**Q：output token 为什么比 input token 贵？** input（prefill）可并行处理、一次算完；output（decode）必须逐个串行生成、每个都要读一遍全部权重和 KV，单位成本更高，所以 API 对输出计费更贵。

**Q：延迟和吞吐怎么权衡？** 二者常此消彼长：增大 batch 提升吞吐但单请求延迟上升。实时对话优先低延迟（小 batch、低 TTFT/TPOT），离线批量优先高吞吐（大 batch、连续批处理）。
