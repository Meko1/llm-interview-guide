---
title: 推理框架对比（vLLM / SGLang / TensorRT-LLM）
description: 推理框架对比（vLLM / SGLang / TensorRT-LLM）：原理、设计取舍与面试准备。
level: L2
roles:
  - Infra
  - 后端转型
classification: inferred
---
# 推理框架对比（vLLM / SGLang / TensorRT-LLM）

## 为什么需要专用推理框架

普通逐请求 `generate` 路径不等于生产服务调度器；Transformers 的缓存和批处理能力也随版本变化，不能断言全部固定预留或无法批处理。专用引擎关注请求队列、KV 分配、动态批与服务接口；优势必须以同质量、同负载和 SLO 对照确认，不套 10–30×。

阅读顺序：先理解分配/复用/调度是不同机制，再按支持矩阵筛候选，最后做真实流量验收。本文不是当前版本完整特性认证。

## vLLM

### 核心技术：PagedAttention

**问题**：最大长度连续预留会浪费内存；比例依实际/预留长度分布，不存在通用 60–80%。

**PagedAttention 解决方案**：借鉴操作系统虚拟内存的分页机制：

```
传统方式：
Request 1: [████████████░░░░░░░░] 预留 2048，实际用 1200 → 浪费 41%
Request 2: [██████░░░░░░░░░░░░░░] 预留 2048，实际用 600  → 浪费 71%

PagedAttention：
物理块池：[Block1][Block2][Block3][Block4][Block5]...
Request 1: Block1 → Block3 → Block5（按需分配）
Request 2: Block2 → Block4（按需分配）
→ 按需分块，仍有块尾、元数据与工作区
```

**关键设计**：
- KV Cache 按固定大小块（Block）管理
- 逻辑块到物理块的映射表（类似页表）
- 支持 Copy-on-Write：多个请求共享相同 prefix 的 KV Cache
- 支持 Prefix Caching：系统 prompt 的 KV 只算一次

上图是构造分配，不是 benchmark。若块为 16 token，1200 token 占 75 块无尾浪费，600 token 占 38 块共 608 个位置、空 8 个；不是任意分配都超过 95% 利用率。分页负责分配，前缀缓存负责复用，二者不互为同义词。

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
- 分离后可独立配置资源，但 KV 传输、接收内存和队列开销可能抵消收益；不保证最优

**动态负载均衡**：
- 实时监控两组 GPU 利用率
- 角色切换必须验证模型/engine、KV、通信组和请求 drain；是否能原地切换由实现决定，不能承诺无需重启。
- 图中的层级 KV 传输是可选实现，网络也可能是跨机 NIC，不限 PCIe/NVLink；先测实际端到端搬运。

### vLLM 核心特性一览

| 特性 | 说明 |
|------|------|
| PagedAttention | 高效显存管理 |
| Continuous Batching | 动态合批，新请求随到随处理 |
| Prefix Caching | 系统 prompt KV 复用 |
| Chunked Prefill | 长 prompt 分块处理，避免阻塞 |
| Tensor Parallelism | 多卡并行推理 |
| Speculative Decoding | 核对实际 release 的草稿算法、模型/采样/并行组合 |
| LoRA 热加载 | 运行时切换 LoRA adapter |
| 多模态支持 | 支持 VLM（图片/视频输入） |

## SGLang

### 定位与特点

SGLang（Structured Generation Language）强调结构化生成和高性能推理：

- **RadixAttention**：基于前缀树的 KV Cache 管理，自动发现和复用公共前缀
- **结构化输出**：内置高效的 JSON/正则约束解码
- **投机路径**：按 release、目标/草稿模型与采样策略核查 EAGLE 等支持，不作“最高性能”断言
- **编程式接口**：支持复杂的多轮/分支生成逻辑

### SGLang vs vLLM

| 维度 | vLLM | SGLang |
|------|------|--------|
| KV 管理/复用 | 分块分配与 APC | KV 管理与 Radix 前缀复用 |
| Prefix 复用 | 核相同 token/计算条件、hash 与驱逐 | 核树索引、驱逐和实际复用分布 |
| 结构化输出 | 核 backend、schema 子集与版本 | 核 backend、schema 子集与版本 |
| 投机解码 | 模型/算法/并行组合待核 | 模型/算法/并行组合待核 |
| 运维 | 灰度、恢复、接口与观测需 POC | 灰度、恢复、接口与观测需 POC |
| 决策依据 | 同负载质量、SLO、成本 | 同负载质量、SLO、成本 |

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
| 生产级 API 服务 | vLLM / SGLang 等候选 | 先过模型/接口/并行门禁再比较达标容量 |
| 结构化输出 | 支持目标 schema 的引擎 | 不只测 JSON 合法率，还测语义与参数正确率 |
| NVIDIA GPU 部署 | TensorRT-LLM / 其他支持引擎 | 比较构建、精度、shape 与实际 SLO |
| 本地/端侧部署 | llama.cpp / Ollama | 低门槛，CPU 友好 |
| 多模型 + LoRA 热切换 | 有兼容支持的引擎 | 核并发 adapter、缓存隔离、切换和回滚 |
| 投机解码 | 支持目标/草稿组合的引擎 | 比较接受长度、额外显存与同 SLO goodput |

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

连续批减少等待整批结束的空槽，收益依长度、队列和 token 预算；新请求通常在调度边界加入，并非到达瞬间无限接纳。不能套 2–10×。

## 面试专项：vLLM / SGLang / TensorRT-LLM 选型答法

框架选型不要背功能清单，要按「场景 - 约束 - 验证」来答：

| 场景 | 优先选择 | 面试表达 |
| --- | --- | --- |
| 通用在线 API、兼容接口、多模型服务 | 通过门禁的服务引擎 | 核 endpoint/stream/错误语义，而非只看 API 名称 |
| Agent 多轮调用、前缀复用、结构化输出 | vLLM / SGLang 等实测候选 | 相同 token 前缀、缓存预算与 schema 约束下比较 |
| NVIDIA GPU 统一、流量大 | TensorRT-LLM 与候选基线 | 将模型构建与版本升级成本计入，而非宣称极致性能 |
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

5. **RadixAttention 与 PagedAttention 是同层比较吗？**
   - 前者强调前缀复用与管理，后者强调分块 Attention 存储/访问；不同层机制可结合，树索引本身不保证比哈希复用率高。

6. **生产环境中推理框架的监控指标有哪些？**
   - TTFT（首 token 延迟）、TPOT（token 间延迟）、吞吐（tokens/s）、P95/P99 延迟、GPU 利用率、KV Cache 命中率

## 真正决定选型的 POC

先固定模型/tokenizer revision、硬件 SKU、量化格式和支持的 context/LoRA/MoE/structured/speculation 组合；不支持的项写明确回退与代价。然后用随机固定 shape 做机制测量，用脱敏真实输入和到达回放做服务验收。冷/暖缓存分开，记录有效 prefix token、实际输出长度、失败/超时与逐请求 SLO 判定。

TPOT 平均值与 ITL 尾部不同；输出 chunk 含多 token 时保留 token 数。比较同质量条件下 requests/s goodput 与总费用，不能用降低 max_tokens 得来的更快结果宣称引擎更优。PD 分离、量化和 speculation 逐项消融，组合支持必须在同一版本验证。

一手机制来源：[PagedAttention](https://arxiv.org/abs/2309.06180)、[SGLang](https://arxiv.org/abs/2312.07104)、[DistServe](https://arxiv.org/abs/2401.09670)、[vLLM APC 归档说明](https://github.com/vllm-project/vllm/blob/v0.6.3.post1/docs/source/automatic_prefix_caching/details.md)、[TensorRT-LLM 官方仓库](https://github.com/NVIDIA/TensorRT-LLM)。论文实验不是当前版本排行榜；默认分支/README 会变，上线前固定 tag/commit 与 engine 参数。详见 [推理性能压测](/inference/inference-benchmark) 与 [SLO goodput](/inference/slo-goodput)。
