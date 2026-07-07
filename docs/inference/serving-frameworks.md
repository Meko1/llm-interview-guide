# 推理框架对比（vLLM / SGLang / TensorRT-LLM）

## 为什么需要专用推理框架

直接用 HuggingFace Transformers 推理大模型存在严重性能问题：
- 显存浪费：固定长度预分配 KV Cache
- 吞吐低：无法高效批处理不同长度请求
- 延迟高：缺乏连续批处理（Continuous Batching）

专用推理框架通过 PagedAttention、连续批处理、PD 分离等技术，将吞吐提升 10-30×。

## vLLM

### 核心技术：PagedAttention

**问题**：传统推理为每个请求按最大长度预留 KV Cache 显存，浪费率高达 60-80%。

**PagedAttention 解决方案**：借鉴操作系统虚拟内存的分页机制：

```
传统方式：
Request 1: [████████████░░░░░░░░] 预留 2048，实际用 1200 → 浪费 41%
Request 2: [██████░░░░░░░░░░░░░░] 预留 2048，实际用 600  → 浪费 71%

PagedAttention：
物理块池：[Block1][Block2][Block3][Block4][Block5]...
Request 1: Block1 → Block3 → Block5（按需分配）
Request 2: Block2 → Block4（按需分配）
→ 显存利用率 >95%
```

**关键设计**：
- KV Cache 按固定大小块（Block）管理
- 逻辑块到物理块的映射表（类似页表）
- 支持 Copy-on-Write：多个请求共享相同 prefix 的 KV Cache
- 支持 Prefix Caching：系统 prompt 的 KV 只算一次

### PD 分离（Prefill-Decode Disaggregation）

将 Prefill（预填充）和 Decode（解码）分到不同 GPU 组：

```
┌─────────────────────────────────────────────────┐
│  Prefill GPU 组（计算密集）                      │
│  - 处理所有新请求的 prompt 编码                  │
│  - 一次性计算整个 prompt 的 KV Cache             │
│  - 特点：compute-bound，需要高算力              │
├─────────────────────────────────────────────────┤
│  Decode GPU 组（带宽密集）                       │
│  - 处理逐 token 生成                            │
│  - 每步只处理 1 个新 token                      │
│  - 特点：memory-bound，需要高带宽              │
├─────────────────────────────────────────────────┤
│  KV Cache Transfer                              │
│  - Prefill 完成后将 KV Cache 传输给 Decode 组   │
│  - Layer 级别传输（避免一次性传输瓶颈）          │
│  - PCIe/NVLink 带宽是传输瓶颈                   │
└─────────────────────────────────────────────────┘
```

**为什么要分离？**
- Prefill 和 Decode 对资源的需求完全不同
- 混合部署时互相争抢：长 prompt 编码占计算 → Decode 延迟飙升
- 分离后可独立扩缩容，资源利用率最优

**动态负载均衡**：
- 实时监控两组 GPU 利用率
- 闲置 GPU 可临时切换角色（仅需重新加载模型副本）
- 不需要重启引擎

### vLLM 核心特性一览

| 特性 | 说明 |
|------|------|
| PagedAttention | 高效显存管理 |
| Continuous Batching | 动态合批，新请求随到随处理 |
| Prefix Caching | 系统 prompt KV 复用 |
| Chunked Prefill | 长 prompt 分块处理，避免阻塞 |
| Tensor Parallelism | 多卡并行推理 |
| Speculative Decoding | 支持 EAGLE/Medusa/Draft Model |
| LoRA 热加载 | 运行时切换 LoRA adapter |
| 多模态支持 | 支持 VLM（图片/视频输入） |

## SGLang

### 定位与特点

SGLang（Structured Generation Language）强调结构化生成和高性能推理：

- **RadixAttention**：基于前缀树的 KV Cache 管理，自动发现和复用公共前缀
- **结构化输出**：内置高效的 JSON/正则约束解码
- **EAGLE-3 原生支持**：2026 最高性能的投机解码实现
- **编程式接口**：支持复杂的多轮/分支生成逻辑

### SGLang vs vLLM

| 维度 | vLLM | SGLang |
|------|------|--------|
| KV Cache 策略 | PagedAttention | RadixAttention |
| Prefix 复用 | 手动 / 简单 hash | 自动前缀树 |
| 结构化输出 | 需外部库 | 内置高效实现 |
| 投机解码 | 支持多种 | EAGLE-3 最优 |
| 生态成熟度 | 更成熟 | 快速追赶中 |
| 适用场景 | 通用生产部署 | 高性能 + 结构化输出 |

## TensorRT-LLM

### 定位

NVIDIA 官方推理框架，深度集成 NVIDIA GPU 硬件特性：

- **FP8 量化**：H100/H200 硬件原生支持
- **自定义 CUDA Kernel**：手写 Attention/GEMM kernel
- **Inflight Batching**：连续批处理实现
- **多 GPU 并行**：TP/PP 原生支持

### 适用场景

- NVIDIA GPU 专属部署
- 对延迟有极致要求（如实时语音对话）
- 需要 FP8 量化（H100 生态）

## llama.cpp / Ollama

### 定位

CPU + 少量 GPU 的端侧/桌面推理：

- **GGUF 格式**：统一的量化模型格式
- **Metal/CUDA/Vulkan**：多后端加速
- **极低门槛**：`ollama run llama3` 一行启动
- **适用场景**：本地开发、隐私敏感、无 GPU 环境

## 选型决策矩阵

| 场景 | 推荐框架 | 理由 |
|------|----------|------|
| 生产级 API 服务 | vLLM | 成熟稳定，PagedAttention |
| 高性能 + 结构化输出 | SGLang | RadixAttention + 内置约束 |
| NVIDIA GPU 极致性能 | TensorRT-LLM | 硬件深度优化 |
| 本地/端侧部署 | llama.cpp / Ollama | 低门槛，CPU 友好 |
| 多模型 + LoRA 热切换 | vLLM | LoRA adapter 管理最成熟 |
| 投机解码最佳性能 | SGLang + EAGLE-3 | 2026 最高加速比 |

## Continuous Batching（连续批处理）

传统静态批处理 vs 连续批处理：

```
静态批处理：
Batch 1: [Req1(完成), Req2(完成), Req3(完成)] → 全部完成才处理下一批
                                                   Req1 已完成但在等

连续批处理：
Step 1: [Req1, Req2, Req3]
Step 2: [Req1(完成→移除), Req2, Req3, Req4(新加入)]
Step 3: [Req2, Req3(完成→移除), Req4, Req5(新加入)]
→ 任意请求完成立即腾出位置，新请求随到随处理
```

优势：吞吐提升 2-10×，尤其在请求长度差异大时效果显著。

## 面试专项：vLLM / SGLang / TensorRT-LLM 选型答法

框架选型不要背功能清单，要按「场景 - 约束 - 验证」来答：

| 场景 | 优先选择 | 面试表达 |
| --- | --- | --- |
| 通用在线 API、OpenAI 兼容、多模型服务 | vLLM | 成熟度、社区、PagedAttention、continuous batching、LoRA 管理更均衡 |
| Agent 多轮调用、固定系统提示多、结构化输出重 | SGLang | RadixAttention 更利于公共前缀复用，结构化生成链路更顺 |
| NVIDIA GPU 统一、流量大、追极致性能 | TensorRT-LLM | FP8/INT8、kernel、图优化能力强，但构建和运维复杂 |
| 端侧、本地开发、离线演示、消费级硬件 | llama.cpp / Ollama | GGUF 生态和本地运行门槛低，不适合作为高并发在线主力 |
| Hugging Face 模型快速服务化 | TGI | 上手快，和 HF 生态衔接顺，但高阶调度能力要结合场景验证 |

落地时要补三句：

1. **不靠名字选型**：同一模型、同一长度分布、同一 SLA 下压测 TTFT、TPOT、goodput、显存和成本。
2. **考虑运维约束**：模型格式、量化 kernel、K8s 部署、滚动升级、LoRA 热加载、监控指标是否打通。
3. **保留回退路径**：框架升级可能改变调度和输出行为，生产要有灰度、回滚和基线压测。

## 高频面试追问

1. **PagedAttention 的核心思想？和操作系统虚拟内存的类比？**
   - 把 KV Cache 按固定大小块管理，逻辑连续但物理不连续；类比 OS 的分页机制解决内存碎片

2. **为什么要做 PD 分离？不分离有什么问题？**
   - Prefill 是 compute-bound，Decode 是 memory-bound；混合部署导致互相干扰，分离后可独立优化

3. **vLLM 的 Prefix Caching 如何工作？**
   - 对系统 prompt 计算哈希，相同前缀的请求共享 KV Cache 物理块（Copy-on-Write）

4. **Continuous Batching 和 Static Batching 的本质区别？**
   - Static 等所有请求完成再处理下一批；Continuous 逐 token 调度，完成即移除、新请求即加入

5. **SGLang 的 RadixAttention 相比 PagedAttention 的优势？**
   - 自动发现任意长度的公共前缀（不限于系统 prompt），用前缀树管理，复用率更高

6. **生产环境中推理框架的监控指标有哪些？**
   - TTFT（首 token 延迟）、TPOT（token 间延迟）、吞吐（tokens/s）、P95/P99 延迟、GPU 利用率、KV Cache 命中率
