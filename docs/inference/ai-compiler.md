---
title: AI 编译器与图优化
description: >-
  解释抓图、IR、融合与调度，并以 graph break、动态形状和冷启动账本判断编译优化是否改善真实推理服务。
level: L2
roles:
  - Infra
  - 后端转型
classification: inferred
---
# AI 编译器与图优化

> 「模型从 PyTorch 代码到高效跑在 GPU 上，中间发生了什么？」这是推理优化与系统岗的深水区问题。本文参考 [llm-action](https://github.com/liguodongiot/llm-action) 的 AI 编译器章节，讲清 AI 编译器要解决什么、计算图与中间表示（IR）、核心优化（算子融合/内存规划）、主流工具（XLA/TVM/TensorRT/torch.compile），以及它与 LLM 推理框架的关系。推理框架见 [推理框架对比](/inference/serving-frameworks)，FlashAttention 见 [FlashAttention 深入](/advanced/flash-attention)。

## 面试先背这几句话

- AI 编译器负责把「模型的高层描述」翻译并优化成「特定硬件上的高效执行代码」，弥合框架灵活性与硬件性能的鸿沟。
- 核心抽象是**计算图 + 多层 IR（中间表示）**：高层图优化（算子融合、常量折叠）→ 低层调度（tiling、循环优化）→ 生成 kernel。
- 常见优化是**算子融合（operator fusion）**：减少中间张量访存与启动开销；寄存器压力增加或占用率降低时也可能变慢。
- PyTorch 侧的入口是 **torch.compile**（TorchDynamo 抓图 + TorchInductor 生成代码）；推理部署侧是 **TensorRT/TensorRT-LLM**。
- LLM 领域趋势是**手写高性能 kernel（FlashAttention）+ 编译器（如 Triton、Mojo）**结合，而非纯自动编译。

## 一、AI 编译器要解决什么

深度学习有个根本矛盾：

- **上层**：研究者用 PyTorch 这种动态、灵活、易调试的框架写模型。
- **下层**：硬件（GPU/NPU）要求高度优化的、融合的、并行的机器代码才能跑满算力。

手写每个模型的高效 kernel 不现实（模型太多、硬件太多，是 $M\times N$ 问题）。**AI 编译器就是这中间的自动化翻译+优化层**，目标是「写一次模型，自动在多种硬件上跑得快」。

类比传统编译器：源代码（模型）→ 前端（转成 IR）→ 中端（优化）→ 后端（生成目标硬件代码）。

## 二、计算图与中间表示（IR）★

### 2.1 计算图

单次展开的张量计算常表示成**有向无环图（DAG）**：节点是算子，边是数据流；有控制流和循环的程序 IR 不一定整体是 DAG，捕获一个形状的 trace 也不等于捕获所有程序路径。

- **静态图**（TensorFlow 1.x、部署态）：先定义后执行，便于全局优化，但难调试。
- **动态图**（PyTorch eager）：边定义边执行，灵活易调试，但优化空间小。
- **折中**：用 trace/JIT 把动态图**捕获**成静态图再优化（torch.compile、torch.jit）。

### 2.2 多层 IR

编译器通常有多级 IR，逐层下降（progressive lowering）：

- **高层图 IR**：接近算子语义，做图级优化（融合、消冗、常量折叠）。
- **中层 IR**：如 **MLIR**（可复用的多层 IR 基础设施）、Relay/TVM IR，做布局、调度决策。
- **低层 IR**：接近硬件（loop nest、tiling），最终生成 CUDA/PTX 或其他后端代码。

**MLIR** 是当前基础设施的重要趋势：提供统一框架让不同 dialect（方言）共存，很多新编译器基于它构建。

## 三、核心优化技术 ★

### 3.1 算子融合（Operator Fusion）★★

把可合法融合的连续算子合并成一个 kernel：

- **为什么有效**：GPU 上每个 kernel 都要「从显存读输入 → 算 → 写回显存」。多个小算子链式执行，中间结果反复往返显存（HBM 带宽是瓶颈）。融合后中间结果留在寄存器/共享内存，**大幅减少访存**。
- **例子**：`矩阵乘 + 加偏置 + GELU` 融成一个 kernel；LayerNorm 的多步归约融合。
- **极致案例**：**FlashAttention** 本质就是把注意力的 QK^T、softmax、加权求和融合，避免物化巨大的注意力矩阵（见 [FlashAttention 深入](/advanced/flash-attention)）。

### 3.2 其他图级优化

- **常量折叠**：编译期就算好常量表达式。
- **公共子表达式消除 / 死代码消除**。
- **布局优化（layout）**：选最优内存排布（NCHW vs NHWC），减少 transpose。
- **内存规划**：复用不再使用的张量显存（inplace、buffer 复用），降低峰值显存。
- **常量传播、代数化简**。

### 3.3 低层调度优化

- **Tiling（分块）**：把大循环切块以适配缓存/共享内存。
- **循环变换**：展开、重排、向量化。
- **自动调优（auto-tuning）**：TVM 的 AutoTVM/Ansor 搜索最优调度参数。

## 四、主流工具 ★

| 工具 | 定位 | 特点 |
| --- | --- | --- |
| **torch.compile** | PyTorch 编译入口 | Dynamo 抓图；Inductor 是常用后端，是否提速需实测冷/热路径 |
| **TensorRT / TensorRT-LLM** | NVIDIA 推理部署 | 图优化、量化与 kernel 选择；支持形状、插件与构建配置需逐项核查 |
| **XLA** | Google（JAX/TF） | 加速线性代数编译器，TPU 首选，做激进融合 |
| **TVM** | Apache 开源 | 跨硬件（含国产/边缘），自动调度搜索 |
| **OpenAI Triton** | GPU kernel 语言 | 用 Python 写高性能 GPU kernel，比 CUDA 易，被 Inductor/vLLM 广泛采用 |
| **MLIR** | 编译器基础设施 | 多层 IR 框架，很多新编译器的底座 |
| **昇腾 CANN/GE** | 华为 | 国产栈的图引擎与算子编译（见 [国产化适配](/inference/domestic-ai-stack)） |

## 五、AI 编译器 vs LLM 推理框架

面试易混淆点：**vLLM/TensorRT-LLM 是「推理框架」，它们内部用/是编译器，但更上层**。

- **AI 编译器**（torch.compile、TVM、XLA）：聚焦「把计算图编译成高效 kernel」，是通用的图→代码优化。
- **LLM 推理框架**（vLLM、SGLang、TensorRT-LLM）：在编译/kernel 之上，解决 LLM 特有的**调度问题**——连续批处理、PagedAttention、KV Cache 管理、投机解码（见 [推理框架对比](/inference/serving-frameworks)）。
- 二者协作：推理框架用手写 kernel（FlashAttention）+ 编译器（Triton）+ 系统级调度，共同榨干性能。

> 一句话：**编译器优化「单次前向怎么算得快」，推理框架优化「大量请求怎么调度得高效」**。

## 六、为什么 LLM 时代没有「纯自动编译一把梭」

关键 Attention kernel 往往结合人工选择的算法和编译工具链；不能断言任何手写实现都胜过任何编译结果。原因：

- Attention 的融合涉及在线 softmax、复杂的分块与数值技巧，自动搜索很难发现。
- 硬件迭代快，最优实现要贴着新硬件特性手调。

所以当下是**「手写高性能库 + 编译器兜底通用算子 + 易用 kernel 语言（Triton）降低手写门槛」**的混合格局。理解这一点，能答好「为什么还需要 FlashAttention 而不是让编译器自动优化」。

## 高频追问

1. **AI 编译器解决什么问题？** 弥合上层框架灵活性与底层硬件性能的鸿沟，把计算图自动翻译+优化成特定硬件的高效代码，避免 M 模型×N 硬件的手写爆炸。
2. **最重要的优化是什么，为什么有效？** 算子融合：把多个小算子合成一个 kernel，减少中间结果的显存往返（HBM 访存瓶颈）和 kernel 启动开销。
3. **FlashAttention 和编译器什么关系？** FlashAttention 提供 IO-aware 注意力算法与实现，编译器提供代码生成与调度；算法选择和代码生成不是互斥方案，胜负需要同形状实测。
4. **torch.compile 是怎么工作的？** TorchDynamo 在运行时抓取计算图，TorchInductor 做图优化并生成 Triton/C++ kernel，兼顾 eager 的易用与编译的性能。
5. **AI 编译器和 vLLM 有什么区别？** 编译器优化「单次前向算得快」（图→kernel）；vLLM 等推理框架在其上优化「多请求调度」（连续批处理、PagedAttention、KV 管理）。
6. **什么是 MLIR？** 多层中间表示的编译器基础设施，允许不同 dialect 共存、逐层下降，是很多现代 AI 编译器的底座。
7. **为什么 LLM 时代不是纯自动编译？** 关键算子（Attention）手写 kernel 性能更强，硬件迭代快需手调；现状是手写库+编译器+Triton 混合，Triton 降低了手写 kernel 门槛。

## 是否值得编译：从冷启动到服务收益

先用 eager 建立正确性基线，再分别测 prefill（多 token）与 decode（通常每请求单 token）的实际形状。`torch.compile` 的 guards 可能因 dtype、设备、形状或 Python 状态变化失效，引发重新编译；graph break 会退回 Python/eager，不能只看某段 kernel 的加速。

构造例：编译花 30 s，热路径每调用节省 2 ms，忽略重编译时约需 `30/0.002=15000` 次调用摊平。若输入长度频繁触发新图，这个交叉点不成立；CUDA Graph 捕获、编译缓存和 continuous batching 也不是同一机制。

排障记录 graph break/guard 失效原因、图数、首次与稳态耗时、峰值显存和逐层数值误差。融合改变运算次序可能带来浮点偏差；最后仍用真实到达流量检查 TTFT/逐 token 延迟与 [SLO goodput](/inference/slo-goodput)，不能拿孤立算子 benchmark 代替服务收益。

抓图与 guards 语义依据 [PyTorch v2.5.1 Dynamo 官方说明](https://github.com/pytorch/pytorch/blob/v2.5.1/docs/source/torch.compiler_dynamo_overview.rst)。当前编译参数、后端与动态形状支持需按安装版本核验；此处不承诺一行调用必然提速。
