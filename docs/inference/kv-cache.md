---
title: KV Cache 深度专题
description: 从缓存原理走到可复算的显存账本，区分 GB/GiB、GQA/MLA 与调度边界。
level: L2
roles:
  - Infra
  - 后端转型
classification: reviewed
---
# KV Cache 深度专题

> 主阅读级别 L2，前置要求是 [Attention](/basics/attention) 与自回归生成。先解释缓存为什么有效，再建立显存账本，最后区分架构、存储、量化和驱逐的边界。公式结果不是引擎能接纳的请求数，必须计入运行时与调度。

<LessonLab kind="kv" />

## 容量决策：先列假设，再做乘法

标准 MHA / GQA 缓存、各请求长度可能不同且无共享时，原始缓存预算是：

$$M_{KV}=2N_{layer}N_{kvhead}d_{head}p\sum_i T_i$$

$p$ 是每个缓存元素的字节数，$T_i$ 含 prompt 与已生成 token；批次长度相同才可写成 $BT$。MLA、滑窗、跨层共享、量化元数据与分块分配必须单独核算。

**教学配置**：80 层、8 个 KV 头、head_dim=128、每元素 2 字节。每 token 的 KV 为 327,680 字节。32,768 token 对应 **10 GiB = 10.73741824 GB**。128K token 的单序列为 40 GiB，32 条等长序列为 **1,280 GiB = 1.25 TiB ≈ 1.374 TB**。这是裸缓存，不含权重、工作区、块尾浪费或预留。

```python
def kv_bytes(layers, kv_heads, head_dim, bytes_per_element, lengths):
    return 2 * layers * kv_heads * head_dim * bytes_per_element * sum(lengths)

memory = kv_bytes(80, 8, 128, 2, [32768])
assert memory == 10737418240
print(memory / 2**30, "GiB", memory / 10**9, "GB")
```

运行：保存为 `kv_budget.py`，执行 `python kv_budget.py`；只依赖 Python 标准库，输出 `10.0 GiB 10.73741824 GB`。只验证公式与单位，不构成性能 benchmark。

## 超时、OOM 和缓存命中：三个不同问题

| 现象 | 应记录什么 | 下一步动作 |
| --- | --- | --- |
| 并发提高后 OOM | 请求实际长度、缓存分配块、权重与预留 | 按剩余可用显存与最大生成预算做 admission control |
| 命中前缀但 TPOT 没变快 | 命中 token 数、Prefill 时间、Decode 时间 | 前缀缓存主要复用前缀计算，不承诺消除后续 Decode 的访存 |
| 吞吐提升但 TTFT 变差 | 到达率、队列、批次与长度分布 | 分清排队和执行，调整调度而不只扩大 batch |
| 同样文本却未命中 | 完整 token 前缀、模板、模型版本与位置配置 | 缓存基于实际计算前缀，不按人类语义相似共享 |

## 追问链：从公式到上线判断

- **L1**：为什么缓存 K/V 而通常不保留历史 Q？历史 Q 的输出已算完，未来 query 需要的是历史 K/V；不是说 Q 物理上不能存。
- **L2**：分页减少碎片，是否降低单 token 理论 KV 大小？没有；它改变分配与共享方式。
- **L2**：可用显存除以每请求 KV 就是并发上限吗？还要计入最大输出、块取整、工作区、权重与 SLO，纸面上限不能作为上线承诺。

<details>
<summary>L3：为什么不能直接把 MLA 套进 2 × KV head × head_dim？</summary>

MLA 通常缓存共享压缩 latent 与解耦的位置部分，而不是每头一份标准 K、V。示例中 latent=512、位置维度=64，若均以 2 字节缓存，单层每 token 为 $(512+64)\times2$ 字节。61 层、8,192 token 为 **0.5361328125 GiB**。具体引擎可能缓存不同表示，必须对照模型配置与实现；不能把标准 GQA 公式或仅 latent 的预算当作实际占用。
</details>

## 一手参考

- [PagedAttention / vLLM 论文](https://arxiv.org/abs/2309.06180)：分块缓存、共享与论文实验；倍数不是任意服务的承诺。
- [vLLM Prefix Caching 文档](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)：前缀复用语义与约束，版本升级时重新核查。
- [GQA 论文](https://arxiv.org/abs/2305.13245)：结构层减少 KV 头的取舍。
- [DeepSeek-V3 技术报告](https://arxiv.org/abs/2412.19437)：MLA 表示与模型配置；需核对实际 serving 实现。

## 核心机制速查

- **为什么要有 KV Cache**：因果前缀不随新 token 改变，历史 K/V 可复用。固定层/头维度时，单步全前缀注意力重算约 $O(t^2d)$，缓存后新 query 注意力约 $O(td)$；这是注意力长度项，不是包括 FFN、通信与访存的完整延迟模型。
- **KV Cache 显存公式（务必背下来）**：$\text{Bytes} = 2 \times B \times L \times N_{\text{layer}} \times N_{\text{kvhead}} \times d_{\text{head}} \times \text{precision}$。前面的 **2 = K 和 V**。
- **一个具体数字**：上述 80 层 GQA 教学配置在 32K 下为 10 GiB；batch=32、128K 下为 1.25 TiB ≈ 1.374 TB。区分二进制和十进制单位，且这不代表模型原生支持这些上下文长度。
- **四条优化路线**：① **架构层**（GQA/MQA/MLA，砍 KV head 数或维度）；② **系统层**（PagedAttention 消碎片、Prefix Caching 复用、RadixAttention 树形共享、Offload 到 CPU）；③ **量化层**（KV INT8/INT4/FP8）；④ **驱逐层**（H2O/StreamingLLM/SnapKV/PyramidKV，只保留重要 token）。

## 一、KV Cache 是什么 & 数学推导

### 1.1 为什么 Decode 阶段可以缓存

Transformer 自注意力（省略 batch、head 与位置编码维度）：

$$\text{Attention}(Q, K, V) = \text{softmax}(QK^\top / \sqrt{d}) \cdot V$$

Decode 第 $t$ 步只有 **1 个新 token** 参与作为 query，但要与前面 $t$ 个 token 的 K、V 做交互：

$$q_t = x_t W_Q, \quad k_t = x_t W_K, \quad v_t = x_t W_V$$

$$o_t = \text{softmax}\left(\frac{q_t [k_1, k_2, \dots, k_t]^\top}{\sqrt{d}}\right) [v_1, v_2, \dots, v_t]^\top$$

关键观察：**$k_1, \dots, k_{t-1}$ 和 $v_1, \dots, v_{t-1}$ 只依赖过去的 $x$，与新 token 无关**——完全可以缓存。这就是 KV Cache。

对比：标准自回归推理通常**不需要缓存历史 Q**：历史输出已完成，下一步的新 Q 查询的是历史 K/V，而不是历史 Q。不是说 Q 不能被存储。

### 1.2 复杂度对比

| 阶段 | 无 KV Cache | 有 KV Cache |
| --- | --- | --- |
| Prefill（L 个 token） | $O(L^2 d)$ | $O(L^2 d)$（Prefill 本来就要算全部 K/V） |
| Decode 单步 | $O(t^2 d)$（重算历史） | $O(t d)$（只算新 token 的 K/V + $q_t$ 对 $t$ 个 K 的点积） |
| 生成 L token 总量 | $O(L^3 d)$ | $O(L^2 d)$ |

小 batch 的 Decode 常受权重与 KV 访存限制；长上下文下 KV 读写更突出。大 batch、并行通信或其他瓶颈可能改变这一判断，应通过 profiler 验证，不能把所有 Decode 都归为同一种瓶颈。

## 二、显存公式与真实数字

### 2.1 完整公式

$$\text{KV Bytes} = \underbrace{2}_{K + V} \times B \times L \times N_{\text{layer}} \times N_{\text{kvhead}} \times d_{\text{head}} \times \text{precision (bytes)}$$

| 符号 | 含义 |
| --- | --- |
| $B$ | batch size |
| $L$ | 序列长度（含 prompt + 已生成部分） |
| $N_{\text{layer}}$ | Transformer 层数 |
| $N_{\text{kvhead}}$ | **KV head 数**（MHA=Q head 数；GQA 少于 Q head；MQA=1） |
| $d_{\text{head}}$ | 每个 head 的维度 |
| precision | FP16/BF16=2, FP8=1, INT8=1, INT4=0.5 |

### 2.2 常见模型 KV Cache 大小对照

以下是根据表中结构参数计算的**单序列 FP16 裸缓存预算**；单位统一为 GiB，K=1,024。表中的长度只用于容量外推，不保证模型原生支持。量化元数据、块取整与工作区不计入。

| 模型 | 层 | KV head | head_dim | Attention | 8K 上下文 | 32K 上下文 | 128K 上下文 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 32 层 MHA 示例（LLaMA2-7B 结构） | 32 | 32 | 128 | MHA | 4 GiB | 16 GiB | 64 GiB |
| 32 层 GQA 示例（LLaMA3-8B 结构） | 32 | 8 | 128 | GQA | 1 GiB | 4 GiB | 16 GiB |
| 80 层 GQA 示例（LLaMA3-70B 结构） | 80 | 8 | 128 | GQA | 2.5 GiB | 10 GiB | 40 GiB |
| 28 层 GQA 示例（Qwen2.5-7B 结构） | 28 | 4 | 128 | GQA | 0.4375 GiB | 1.75 GiB | 7 GiB |
| 61 层 MLA 示例（latent=512、位置=64、均为 FP16） | 61 | — | — | MLA | 0.5361 GiB | 2.1445 GiB | 8.5781 GiB |

> MLA 的缓存表示与标准 K/V 不同；还要计入位置部分，具体以引擎实现为准。详见上方算例与 [DeepSeek 专题](/models/deepseek)。

### 2.3 一个"警醒式"的例子

**LLaMA3-70B、batch=64、上下文 128K、FP16**：

$$2 \times 64 \times 131{,}072 \times 80 \times 8 \times 128 \times 2 \text{B} \approx 2.75 \text{ TB}$$

上式为 2.5 TiB ≈ 2.749 TB 的裸缓存预算。是否能承载还取决于 GPU 配置、权重与并行方式；因此需要容量控制与缓存优化，不把理论外推等同于具体集群压测。

## 三、架构层优化：从模型结构上砍 KV

在 Attention 结构上直接减少每层的 KV 数量，是"训练时就付出的一次性成本，推理端一劳永逸"。演进路径：

| 方案 | 每层 KV 数 | KV Cache 相对量 | 代表模型 |
| --- | --- | --- | --- |
| **MHA**（多头注意力） | $N_{\text{qhead}}$ 份 | 1× | GPT-3、LLaMA2-7B |
| **GQA**（分组查询注意力） | $N_{\text{group}}$ 份（Q head 分组共享 K/V） | $N_{kvhead}/N_{qhead}$，相同 head_dim/精度 | LLaMA3、Qwen2.5、Mixtral |
| **MQA**（多查询注意力） | 1 份（所有 Q head 共享一组 K/V） | 1/$N_{\text{qhead}}$× | Falcon、PaLM |
| **MLA**（多头潜注意力） | 共享 latent 与位置部分 | 按两部分维度与引擎缓存表示计算 | DeepSeek-V2/V3 |
| **CLA / YOCO**（跨层共享） | 特定层共享 KV | 依赖架构和实际缓存层，不套统一比例 | 部分研究模型 |

**注意**：[GQA 论文](https://arxiv.org/abs/2305.13245)的 uptraining 实验支持其设置下质量接近 MHA，不证明所有头冗余或任何结构只会略微掉点。MLA 投影可通过权重吸收避免完整显式解压，但不等于把任意现成 MHA 无损转成 MLA；通常需要对应训练和实现，见 [Attention 与变体](/basics/attention)。

## 四、系统层优化：把 KV Cache 管起来

### 4.1 PagedAttention（vLLM）

**问题**：传统 KV Cache 为每个请求预分配"最大长度"的连续显存块，产生两种浪费：
- **内部碎片**：请求实际只用了 512 token，却按 4096 分配，浪费 87%；
- **外部碎片**：不同请求块大小不一，显存无法整合；
- **无法预留过大**：动态请求进来 KV 塞不下、要驱逐。

**PagedAttention** 借鉴操作系统**虚拟内存分页**思想：
- 把 KV Cache 切成固定大小的 **block**（如 16 token 一块）；
- 每个请求维护一张 **block table**（虚拟位置 → 物理块地址）；
- 按需分配、非连续存储；
- **写时复制（Copy-on-Write）** 支持前缀共享。

论文在其评测设置中报告了较低的缓存浪费和吞吐提升；这是特定模型、基线和工作负载的实验结论。上线时重新测量块尾浪费、前缀共享和调度收益，不承诺固定倍数。

### 4.2 Prefix Caching（跨请求前缀复用）

**场景**：多用户共享同一个 system prompt（几百上千 token），传统方案每个请求都重新 Prefill 一次同样的前缀。

**方案**：新请求复用完整 token 前缀与计算条件一致的已缓存 KV，跳过共享部分的 prefill；未命中的后缀仍需计算，首个输出采样也仍需正确的最后位置 logits：
- vLLM：`enable_prefix_caching=True`
- SGLang：**RadixAttention** 用树管理前缀与分叉；是否比哈希管理命中更多取决于缓存预算、驱逐策略和请求分布，树结构不保证更高命中率。
- CacheBlend / ChunkAttention 等研究探索更复杂复用；不能把非前缀文档 KV 当作任意上下文下天然相同，需检查位置、跨片段依赖与重算/近似策略。

**命中率对 TTFT 的影响**：共享前缀减少 prefill 计算，不消除排队、后缀与 decode。分别报告命中 token 数、冷/暖缓存、prefill 和客户端 TTFT；不承诺 50%~90% 的固定下降。

### 4.3 KV Cache 卸载（Offload）

单卡显存不够时，把冷 KV 存到 CPU 内存甚至 SSD：
- **DeepSpeed-Inference / FlexGen**：静态卸载，简单但慢；
- **LMCache**：跨请求的分布式 KV 缓存池（内存+SSD 分层），命中率优先，冷启动兜底；
- **Mooncake（月之暗面）**：Prefill/Decode 分离 + 全局 KV 池，专门服务长上下文对话。

代价是跨层级搬运与同步。构造 1 GiB 缓存、有效搬运速率 16 GiB/s，则单向下界 62.5 ms；回迁、并发和软件开销另算，不把标称 HBM/PCIe 带宽之比当端到端减速倍率。

### 4.4 Chunked Prefill 与 Continuous Batching

不算 KV Cache 优化本身，但和它紧密相关：
- **Continuous Batching**（vLLM）：不等 batch 里所有请求结束，token 级别动态加入/退出 batch，充分利用 KV block；
- **Chunked Prefill**：把长 prompt 的 Prefill 拆成小块与 Decode 交错执行，平滑 GPU 利用率、避免长 Prefill 卡住 Decode 请求。

## 五、量化层优化：把 KV Cache 压小

KV 量化改变缓存容量、读写/反量化开销与注意力误差，既可能影响 prefill 首 token，也可能影响 decode。权重已固定而 KV 增长的负载中更值得比较；不能说只影响显存而不影响 TTFT。

| 精度 | 显存/带宽 | 质量影响 | 代表 |
| --- | --- | --- | --- |
| **FP16 / BF16** | 1× 元素 payload | 本身仍有浮点误差 | 基线，二者数值格式不同 |
| **FP8（E4M3）** | 理论元素约 0.5× | 需验证模型、尺度与任务，非无损保证 | 支持条件取决于硬件与引擎 |
| **INT8** | 0.5× 元素 payload | 依赖尺度、粒度与任务 | 引擎支持需按版本核验 |
| **INT4** | 0.25× 元素 payload | 不预设统一掉点程度 | 低比特 KV 研究/实现 |
| **KIVI 2-bit** | 0.125× 元素 payload | K per-channel、V per-token，另有高精度残留与元数据 | tuning-free 研究配方，不是全缓存压到 1/8 |

**K 和 V 独立处理**是一个反直觉但重要的技巧：
- **K**：KIVI 所研究模型呈通道 outlier，采用 per-channel 分组；
- **V**：其设置下采用 per-token 分组更合适。其他模型与格式需重新核验，不能据此证明任何 V 都不需要更细处理。

**混合精度策略**：部分实现保留近期高精度 residual，旧块低比特存储；“热/冷”是否预测未来重要性是另一假设，不自动等同于 H2O。详见 [量化实战深入](/inference/quantization) 与 [KIVI 原论文](https://arxiv.org/abs/2402.02750)。

## 六、驱逐/压缩层：只保留重要 token 的 KV

如果承认"不是所有历史 token 都同等重要"，可以直接**扔掉**一部分 KV：

| 方法 | 核心思想 | 保留策略 |
| --- | --- | --- |
| **StreamingLLM** | 发现最开头几个 token（**Attention Sink**）对稳定性至关重要 | 保留前 4 个 sink token + 最近窗口 W |
| **H2O**（Heavy Hitter Oracle） | 有些 token 长期获得高注意力权重 | 用累计 attention 分数选 top-k 保留 |
| **SnapKV** | 观察 prompt 尾部的注意力"投票" | 用 prompt 最后几 token 的 attention 决定要留哪些 |
| **PyramidKV** | 底层保留更多 KV、高层保留更少 | 按层递减，节省更多 |
| **Scissorhands** | 测试时利用重要性持续假设 | 无需微调，按历史注意力提高重要 token 保留概率 |

**收益 vs 代价**：丢 KV 是有损改变可访问历史，不存在统一 10%~30% 且无损的保证。[Scissorhands](https://arxiv.org/abs/2305.17118)明确是测试时无需微调的预算压缩。评测需包含被删早期事实、多跳依赖、位置变化和自然长对话；聊天场景也不能免除精确回溯需求。

**与 [长上下文](/basics/long-context) 的关系**：驱逐 = "有损压缩到定长"，SSM/Mamba = "从架构上就是定长隐藏状态"，[扩散语言模型](/advanced/diffusion-llm) = "没有 KV Cache，每步双向重算"——三条路都在处理"L 增长时 KV 也线性增长"的根问题。

## 七、KV Cache 在其他架构里怎么样？

| 架构 | 有没有 KV Cache | 说明 |
| --- | --- | --- |
| 标准 Transformer（AR） | 有 | 本文主角 |
| **MLA**（DeepSeek） | 有，但缓存表示不同 | 依模型维度与缓存实现核算，不套 1/10 |
| **Mamba / SSM** | **无** | 用固定大小隐藏状态代替，见 [SSM 页](/advanced/state-space-models) |
| **Jamba / Hybrid**（少量注意力层） | 部分层有 | 只有注意力层需要，SSM 层不需要 |
| **扩散语言模型（DLM）** | 不能直接套标准因果 KV 复用 | refinement 会改变 token 表示；缓存优化是否精确由架构/实现决定 |
| **Encoder-only（BERT）** | 无 | 一次性 encode，不做增量 |

## 八、推理引擎的 KV Cache 支持对照

| 引擎 | PagedAttention | Prefix Cache | KV 量化 | 卸载 | 其他 |
| --- | --- | --- | --- | --- | --- |
| **vLLM** | 分块机制 | APC | dtype/scale 按版本查 | 按实现查 | 核模型、并行与缓存组合 |
| **SGLang** | KV 管理 | RadixAttention | 按 backend 查 | 按 backend 查 | 不按结构宣称性能最强 |
| **TensorRT-LLM** | KV 管理 | 需核配置 | 按 engine/GPU 查 | 按配置查 | 核构建与运行格式一致性 |
| **LMDeploy** | 按 backend 查 | 按 backend 查 | 权重量化与 KV 格式分开查 | 待核 | AWQ 不是 KV 格式 |
| **HuggingFace TGI** | 按 release 查 | 按 release 查 | 待核 | 待核 | 不作性能排名 |
| **llama.cpp** | 连续/统一池等实现需核 | 前缀状态复用需核 | K/V 类型分别查 | CPU/GPU 布局需核 | 不默认所有低比特格式都支持 |

此表是验收检查项，不是当前特性支持认证。固定版本语义见 [vLLM APC 归档实现说明](https://github.com/vllm-project/vllm/blob/v0.6.3.post1/docs/source/automatic_prefix_caching/details.md)，当前文档链接保留但访问/版本需再次核验。详见 [推理框架对比（vLLM/SGLang）](/inference/serving-frameworks)。

## 九、面试可背的公式速记

**显存公式**：$\text{KV Bytes} = 2 \cdot B \cdot L \cdot N_{\text{layer}} \cdot N_{\text{kvhead}} \cdot d_{\text{head}} \cdot P$（$P$ 为精度字节数）

**GQA 显存节省**：$N_{\text{kvhead}} / N_{\text{qhead}}$（如 8/32 = 1/4）

**Decode 阶段单步访存**：权重（几十 GB）+ KV Cache（几~几百 GB），二者都要读一遍 → 带宽是瓶颈。

**带宽受限上界（粗略）**：$\text{tokens/s} \lesssim \frac{\text{有效带宽（bytes/s）}}{\text{平均每输出 token 搬运字节}}$。batch 内权重复用需摊销，不能将整个权重大小重复计到每请求；计算、通信和 kernel 开销仍可能限制吞吐。

## 高频追问

**Q：为什么只缓存 K 和 V，不缓存 Q？**
因为 Attention 的公式是 $\text{softmax}(QK^\top)V$：
- **过去的 K、V** 会被**每一个未来的 token** 反复用到 → 缓存有收益；
- **过去的 Q** 只在**当时那一步**用一次，之后再也不出现（因为未来的 token 不 attend 到过去的 Q）→ 缓存没意义。
这是 causal mask + 自回归结构的直接推论。

**Q：为什么长上下文推理显存会爆炸？**
标准全注意力 KV 随长度、缓存层数与请求数增长。80 层 GQA 教学配置的 128K 为 40 GiB / 42.95 GB，32 条为 1.25 TiB / 1.374 TB；分页、量化、驱逐、卸载和架构改动解决不同问题，不把无损管理与有损删除混为一谈。

**Q：GQA、MQA、MLA 的核心区别？为什么要减少 KV 存储？**
- **MHA**：每个查询头有独立 KV。
- **MQA**：全部查询头共享一组 KV。
- **GQA**：按组共享；例如 32 个 Q 头与 8 个 KV 头时，标准 KV 元素数为相应 MHA 的 1/4。
- **MLA**：缓存压缩表示与位置部分，按具体表示而非标准 KV 头公式核算。
这些结构降低资源需求的方式不同，质量没有脱离训练和任务的统一排序，也不存在无条件「最优解」。

**Q：PagedAttention 到底解决了什么问题？**
解决缓存的分块分配、碎片与共享问题。使用虚拟块表映射非连续物理块，按需分配；不会改变相同结构与精度下每 token 的裸 KV 元素数。论文倍数不能作为生产承诺，需要用自己的长度分布与调度策略重测。

**Q：Prefix Caching 和 PagedAttention 是一回事吗？**
不是同一件事，但强耦合：
- **PagedAttention 是显存管理机制**，允许非连续块存储；
- **Prefix Caching 是复用策略**——因为块可以非连续 + 引用计数，同一个 system prompt 的物理块可以被多个请求引用（COW）。
没有 PagedAttention 也可以实现前缀缓存；效率由分配/复制和驱逐策略决定。树和哈希都能管理同一前缀集合，不能从数据结构名称推断必然命中率。

**Q：KV 量化到 INT4 会不会掉性能？**
掉多少取决于**校准**和**量化粒度**：
- **naive per-tensor INT4** → 掉点明显（K 有 outlier channel）；
- **per-channel INT4 K + per-token INT4 V**（KIVI 思路）→ 分别处理 K/V 的分布差异，实际质量需按任务实测；
- **热 KV FP16 + 冷 KV INT4** → 更保险。
误差也可能表现为早期事实遗忘、概率偏移或推理错误，而不是乱码；需比较长短上下文、位置切片与真实任务，单一 needle 测试不充分。

**Q：H2O / StreamingLLM 为什么能"扔掉"KV 而不崩？**
观察到两个现象：
- **Attention Sink**：Softmax 的归一化让**开头几个 token**（无论内容）持续吸收大量注意力权重——扔掉它们会让整个 attention 分布崩塌；
- **Heavy Hitter**：只有少数 token（高信息量的 keyword、句法枢纽）长期被后续 token 关注，其他大部分历史 token 权重接近 0。
这些是不同方法的保留依据，不是拼在一起就保证聊天无感。必须测预算、保留规则与任务质量；被删除的历史无法从缓存直接恢复，后续依赖可能出错。

**Q：为什么 Mamba 和扩散 LLM 都不需要传统 KV Cache？**
- **Mamba**：把历史压缩到一个**固定大小的隐藏状态** $h$，每步递推更新，天然是定长 → 无 KV，无线性增长；见 [SSM 页](/advanced/state-space-models)；
- **扩散 LLM**：双向注意力，每轮 refine 都对全序列重算 K/V，没有"过去 K/V 只需算一次"的假设 → 传统 KV Cache 无效，但可以有 prefix cache；见 [扩散语言模型](/advanced/diffusion-llm)。
这两种架构都在挑战"KV 随 L 线性增长"这个根本问题，是长上下文推理的另两条路线。

**Q：投机解码和 KV Cache 是什么关系？**
[投机解码](/inference/speculative-decoding)（Speculative Decoding）是"小模型出草稿 → 大模型批量验证"的一次多 token 生成方案。它**依赖 KV Cache 正确性**：
- 草稿被接受时 → KV Cache 顺利前推 $k$ 个 token，节省 $k-1$ 次 forward；
- 草稿被拒时 → **需要回滚 KV Cache**（丢掉被拒的 K/V 分量）。
实现必须保证目标和草稿各自的已提交前缀一致；可用分页截断、池回收或其他机制，不能把 PagedAttention 当投机解码唯一前提。记录验证宽度、接受长度、KV 提交/回滚位置与额外内存。

**Q：Prefill/Decode 分离（Disaggregation）为什么和 KV Cache 高度相关？**
分离旨在减少阶段干扰并独立配置资源，但需支付 KV 传输和一致性开销。cache dtype、位置、模型/adapter、分片布局与生成状态均需对齐；只搬一个 token 缓冲区不够。收益以目标到达率下 TTFT/ITL 和 [goodput](/inference/slo-goodput)验证，不按“热门方向”认定值得上线。
