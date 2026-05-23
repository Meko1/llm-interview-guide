# 推理优化与部署

> 把大模型高效地跑起来对外服务，是工程岗的核心考点。本文梳理推理的瓶颈与主流优化手段。

## 推理的两个阶段

自回归生成分为两个阶段，性能特性截然不同：

- **Prefill（预填充）**：并行处理整个输入 prompt，计算所有 token 的 KV 并生成第一个 token。计算密集（compute-bound），决定**首 token 延迟（TTFT）**。
- **Decode（解码）**：逐个生成后续 token，每步只算一个新 token。访存密集（memory-bound，瓶颈在读取权重和 KV Cache），决定**每 token 延迟（TPOT）**和吞吐。

理解这点是回答推理优化问题的基础：decode 阶段受显存带宽限制，所以很多优化围绕「减少访存」。

## 核心指标

- **TTFT**（Time To First Token）：首字延迟，影响体感响应速度。
- **TPOT / ITL**：生成每个 token 的时间。
- **吞吐（Throughput）**：每秒处理的 token / 请求数。
- **显存占用**：权重 + KV Cache + 激活。

## 主流优化技术

### KV Cache 及其管理

缓存历史 token 的 K、V 避免重复计算（详见 [Attention](/basics/attention)）。但其显存随 `序列长度 × batch` 线性增长，是长上下文/高并发的主要瓶颈。

**PagedAttention（vLLM 核心）**：借鉴操作系统虚拟内存分页思想，把 KV Cache 分块管理，几乎消除显存碎片，大幅提升显存利用率和并发吞吐。

### 量化（Quantization）

把权重/激活从 FP16 降到 INT8/INT4，减小显存和访存、加速推理。

- **GPTQ**：逐层后训练量化（PTQ），基于二阶信息，weight-only INT4，精度损失小。
- **AWQ**：激活感知量化，保护重要权重通道，效果好、速度快。
- **GGUF（llama.cpp）**：面向 CPU/端侧的量化格式。
- 权衡：量化省显存、提速，但可能轻微掉点；INT4 性价比常最高。

### 批处理（Batching）

- **Continuous Batching（连续批处理）**：vLLM 等采用，请求完成即时替换、动态拼批，而非等整批结束，大幅提升 GPU 利用率和吞吐。

### 投机解码（Speculative Decoding）

用一个小的「草稿模型」一次性快速生成多个候选 token，再用大模型**并行验证**一次，接受正确的部分。在不损失质量的前提下加速 decode（小模型猜得准时收益大）。变体：Medusa、Lookahead、EAGLE。

### 算子与并行

- **FlashAttention**：IO 感知的精确注意力，省显存提速。
- **算子融合 / CUDA Graph**：减少 kernel 启动开销。
- **张量并行 / 流水线并行**：单卡放不下时跨多卡切分（见 [预训练](/pretraining/pretrain)）。

## 主流推理框架

- **vLLM**：PagedAttention + 连续批处理，高吞吐，最流行的开源服务框架。
- **TensorRT-LLM**：NVIDIA 官方，极致性能。
- **SGLang**：RadixAttention（前缀复用），适合复杂调用。
- **llama.cpp / Ollama**：端侧、CPU、本地部署。
- **TGI**：Hugging Face 的推理服务。

## 高频追问

**Q：decode 阶段为什么是 memory-bound？** 每生成一个 token 都要把整个模型权重和 KV Cache 从显存读一遍，而实际计算量很小（batch 小），所以瓶颈在显存带宽而非算力。这也是提高 batch、用量化减少访存能提速的原因。

**Q：投机解码为什么不掉精度？** 大模型对草稿 token 做并行验证，只接受与自己分布一致的 token，最终输出分布与大模型单独解码一致，是「加速」而非「近似」。

**Q：长上下文推理的瓶颈与对策？** 瓶颈是 KV Cache 显存。对策：GQA/MQA/MLA 减少 KV、PagedAttention 高效管理、KV Cache 量化、前缀缓存复用。

**Q：如何降低首 token 延迟（TTFT）？** prefill 优化（chunked prefill）、前缀缓存复用（相同 system prompt）、减少输入长度、张量并行加速 prefill。
