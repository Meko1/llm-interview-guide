# KV Cache 深度专题

> 大模型推理岗**最高频**的面试题就是"KV Cache 讲一下"。它把自回归推理从"每步重算全历史"降到"每步只算新 token"，但也带来了长上下文与高并发的**头号显存瓶颈**。本文把 KV Cache 从原理、显存公式、四条优化路线（架构/系统/量化/驱逐）到面试常问的 prefix cache/PagedAttention/MLA 一次讲透。前置阅读：[Attention 与变体](/basics/attention)、[推理优化与部署](/inference/inference-optimization)、[长上下文专题](/basics/long-context)。

## 面试先背这几句话

- **为什么要有 KV Cache**：自回归 Decode 每步只产生一个新 token，但 Attention 需要"新 Q 对全部历史 K、V"做点积。如果每步都重算前面所有 token 的 K、V，就有 $O(L^2)$ 的重复计算。缓存下来 → 每步只算 **1 个新 token 的 K、V**，Decode 从 $O(L^2)$ 降到 $O(L)$。
- **KV Cache 显存公式（务必背下来）**：$\text{Bytes} = 2 \times B \times L \times N_{\text{layer}} \times N_{\text{kvhead}} \times d_{\text{head}} \times \text{precision}$。前面的 **2 = K 和 V**。
- **一个具体数字**：LLaMA3-70B（80 层，8 个 KV head，head_dim=128，FP16）在 32K 上下文下，单序列 KV = $2 \times 32{,}768 \times 80 \times 8 \times 128 \times 2 \text{B} \approx 10.7 \text{GB}$。当 batch=32、上下文 128K 时，KV Cache 单独就要 **1.3 TB**——这就是长上下文的核心瓶颈。
- **四条优化路线**：① **架构层**（GQA/MQA/MLA，砍 KV head 数或维度）；② **系统层**（PagedAttention 消碎片、Prefix Caching 复用、RadixAttention 树形共享、Offload 到 CPU）；③ **量化层**（KV INT8/INT4/FP8）；④ **驱逐层**（H2O/StreamingLLM/SnapKV/PyramidKV，只保留重要 token）。

## 一、KV Cache 是什么 & 数学推导

### 1.1 为什么 Decode 阶段可以缓存

Transformer 自注意力（简化，省略缩放和 softmax）：

$$\text{Attention}(Q, K, V) = \text{softmax}(QK^\top / \sqrt{d}) \cdot V$$

Decode 第 $t$ 步只有 **1 个新 token** 参与作为 query，但要与前面 $t$ 个 token 的 K、V 做交互：

$$q_t = x_t W_Q, \quad k_t = x_t W_K, \quad v_t = x_t W_V$$

$$o_t = \text{softmax}\left(\frac{q_t [k_1, k_2, \dots, k_t]^\top}{\sqrt{d}}\right) [v_1, v_2, \dots, v_t]^\top$$

关键观察：**$k_1, \dots, k_{t-1}$ 和 $v_1, \dots, v_{t-1}$ 只依赖过去的 $x$，与新 token 无关**——完全可以缓存。这就是 KV Cache。

对比：**Q 不能缓存**，因为每步的新 Q 都是新的，且下一步用不到（自回归结构下，未来 token 不 attention 到过去的 Q）。

### 1.2 复杂度对比

| 阶段 | 无 KV Cache | 有 KV Cache |
| --- | --- | --- |
| Prefill（L 个 token） | $O(L^2 d)$ | $O(L^2 d)$（Prefill 本来就要算全部 K/V） |
| Decode 单步 | $O(t^2 d)$（重算历史） | $O(t d)$（只算新 token 的 K/V + $q_t$ 对 $t$ 个 K 的点积） |
| 生成 L token 总量 | $O(L^3 d)$ | $O(L^2 d)$ |

**Decode 阶段用 KV Cache 后是 memory-bound**（每步都要把整个 KV Cache 从 HBM 读一遍），而不是 compute-bound——这决定了后续所有优化都围绕**减少 KV Cache 大小 / 减少访存**展开。

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

以下按 **单序列、FP16** 计算：

| 模型 | 层 | KV head | head_dim | Attention | 8K 上下文 | 32K 上下文 | 128K 上下文 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LLaMA2-7B | 32 | 32（MHA） | 128 | MHA | 4.0 GB | 16 GB | 64 GB |
| LLaMA3-8B | 32 | 8（GQA） | 128 | GQA | 1.0 GB | 4.0 GB | 16 GB |
| LLaMA3-70B | 80 | 8（GQA） | 128 | GQA | 2.5 GB | 10 GB | 40 GB |
| Qwen2.5-7B | 28 | 4（GQA） | 128 | GQA | 0.5 GB | 1.75 GB | 7 GB |
| DeepSeek-V3 | 61 | — | — | MLA | ≈0.14 GB | ≈0.6 GB | ≈2.2 GB |

> **DeepSeek-V3 的 MLA** 通过压缩 K、V 到低秩 latent（$d_c \approx 512$），把 KV Cache 从"每 head 一份"变成"整层共享一份 latent"，是**当前最激进的 KV 压缩**。详见 [DeepSeek 专题](/models/deepseek)。

### 2.3 一个"警醒式"的例子

**LLaMA3-70B、batch=64、上下文 128K、FP16**：

$$2 \times 64 \times 131{,}072 \times 80 \times 8 \times 128 \times 2 \text{B} \approx 2.75 \text{ TB}$$

这比 8×H100（640 GB HBM）总显存还多 4 倍——**没有 KV Cache 优化就跑不了长上下文高并发**。

## 三、架构层优化：从模型结构上砍 KV

在 Attention 结构上直接减少每层的 KV 数量，是"训练时就付出的一次性成本，推理端一劳永逸"。演进路径：

| 方案 | 每层 KV 数 | KV Cache 相对量 | 代表模型 |
| --- | --- | --- | --- |
| **MHA**（多头注意力） | $N_{\text{qhead}}$ 份 | 1× | GPT-3、LLaMA2-7B |
| **GQA**（分组查询注意力） | $N_{\text{group}}$ 份（Q head 分组共享 K/V） | 1/4 ~ 1/8× | LLaMA3、Qwen2.5、Mixtral |
| **MQA**（多查询注意力） | 1 份（所有 Q head 共享一组 K/V） | 1/$N_{\text{qhead}}$× | Falcon、PaLM |
| **MLA**（多头潜注意力） | 1 份低秩 latent（$d_c$） | 极小（DeepSeek 报告 <10%） | DeepSeek-V2/V3 |
| **CLA / YOCO**（跨层共享） | 多层共用一份 KV | 减半到 1/4 | 部分研究模型 |

**注意**：GQA/MQA 会略微牺牲能力（K/V 表达变粗），但因为大部分 head 的"注意力多样性"是冗余的，实际 benchmark 下降很小；MLA 更巧妙——K/V 在低秩 latent 里压缩，但在计算时通过 $W_K, W_V$ 投影恢复出等价的多头行为。详见 [Attention 与变体](/basics/attention)。

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

收益：显存浪费 <4%，实际吞吐提升 2-4×。这是 vLLM 的核心黑科技，也是当前推理引擎的事实标准。

### 4.2 Prefix Caching（跨请求前缀复用）

**场景**：多用户共享同一个 system prompt（几百上千 token），传统方案每个请求都重新 Prefill 一次同样的前缀。

**方案**：把 system prompt 对应的 KV block 存下来，新请求命中时**跳过 Prefill 直接从"续写"开始**：
- vLLM：`enable_prefix_caching=True`
- SGLang：**RadixAttention**——用 Radix Tree（基数树）组织所有历史前缀，任意分叉共享，命中率远高于线性哈希。适合 few-shot、多轮对话、Agent tool loop。
- CacheBlend / ChunkAttention：允许**跨请求非前缀 KV 复用**（如 RAG 场景，不同请求引用相同文档 chunk）。

**命中率对 TTFT 的影响**：Prefill 是计算密集型，命中前缀 → TTFT 直接砍 50%~90%。Agent、代码补全、RAG 是最大受益场景。

### 4.3 KV Cache 卸载（Offload）

单卡显存不够时，把冷 KV 存到 CPU 内存甚至 SSD：
- **DeepSpeed-Inference / FlexGen**：静态卸载，简单但慢；
- **LMCache**：跨请求的分布式 KV 缓存池（内存+SSD 分层），命中率优先，冷启动兜底；
- **Mooncake（月之暗面）**：Prefill/Decode 分离 + 全局 KV 池，专门服务长上下文对话。

代价：PCIe/CXL 带宽比 HBM 慢 10-100 倍，卸载得**尽量只搬"预计短期不用的"KV**，配合调度策略。

### 4.4 Chunked Prefill 与 Continuous Batching

不算 KV Cache 优化本身，但和它紧密相关：
- **Continuous Batching**（vLLM）：不等 batch 里所有请求结束，token 级别动态加入/退出 batch，充分利用 KV block；
- **Chunked Prefill**：把长 prompt 的 Prefill 拆成小块与 Decode 交错执行，平滑 GPU 利用率、避免长 Prefill 卡住 Decode 请求。

## 五、量化层优化：把 KV Cache 压小

KV 量化的好处比权重量化更纯粹——**只影响长上下文/高并发下的显存与带宽**，几乎不影响首 token 速度。

| 精度 | 显存/带宽 | 质量影响 | 代表 |
| --- | --- | --- | --- |
| **FP16 / BF16** | 1× | 无 | 基线 |
| **FP8（E4M3）** | 0.5× | 几乎无损 | H100 原生支持、TensorRT-LLM |
| **INT8** | 0.5× | 长上下文微降 | vLLM 内置、SmoothQuant KV |
| **INT4** | 0.25× | 有可感知损失，需仔细调 | KIVI、KVQuant |
| **KIVI 2-bit** | 0.125× | 需 per-channel 校准 | 学术前沿 |

**K 和 V 独立处理**是一个反直觉但重要的技巧：
- **K** 通常有**较宽的动态范围**（尤其某些 outlier channel），量化时需要 **per-channel** scale；
- **V** 分布相对均匀，**per-token** scale 就够。

**混合精度策略**：热 KV 保持 FP16、冷 KV 量化到 INT4（H2O 类思路的扩展）。详见 [量化实战深入](/inference/quantization)。

## 六、驱逐/压缩层：只保留重要 token 的 KV

如果承认"不是所有历史 token 都同等重要"，可以直接**扔掉**一部分 KV：

| 方法 | 核心思想 | 保留策略 |
| --- | --- | --- |
| **StreamingLLM** | 发现最开头几个 token（**Attention Sink**）对稳定性至关重要 | 保留前 4 个 sink token + 最近窗口 W |
| **H2O**（Heavy Hitter Oracle） | 有些 token 长期获得高注意力权重 | 用累计 attention 分数选 top-k 保留 |
| **SnapKV** | 观察 prompt 尾部的注意力"投票" | 用 prompt 最后几 token 的 attention 决定要留哪些 |
| **PyramidKV** | 底层保留更多 KV、高层保留更少 | 按层递减，节省更多 |
| **Scissorhands** | 关键 token 的重要性会持续 | 训练时就学"哪些 token 会被后续持续关注" |

**收益 vs 代价**：能把 KV Cache 缩到 10%~30% 而质量近似无损，但**牺牲了任意回溯能力**——如果被驱逐的 token 后面突然需要用到（"大海捞针"任务），性能会掉。所以适合聊天/流式生成，不适合精确检索。

**与 [长上下文](/basics/long-context) 的关系**：驱逐 = "有损压缩到定长"，SSM/Mamba = "从架构上就是定长隐藏状态"，[扩散语言模型](/advanced/diffusion-llm) = "没有 KV Cache，每步双向重算"——三条路都在处理"L 增长时 KV 也线性增长"的根问题。

## 七、KV Cache 在其他架构里怎么样？

| 架构 | 有没有 KV Cache | 说明 |
| --- | --- | --- |
| 标准 Transformer（AR） | 有 | 本文主角 |
| **MLA**（DeepSeek） | 有，但压成低秩 latent | 显存量降到 1/10 |
| **Mamba / SSM** | **无** | 用固定大小隐藏状态代替，见 [SSM 页](/advanced/state-space-models) |
| **Jamba / Hybrid**（少量注意力层） | 部分层有 | 只有注意力层需要，SSM 层不需要 |
| **扩散语言模型（DLM）** | **无标准 KV Cache** | 双向注意力，每步 refine 都重算全序列，只有 prefix cache |
| **Encoder-only（BERT）** | 无 | 一次性 encode，不做增量 |

## 八、推理引擎的 KV Cache 支持对照

| 引擎 | PagedAttention | Prefix Cache | KV 量化 | 卸载 | 其他 |
| --- | --- | --- | --- | --- | --- |
| **vLLM** | ✅ 原生 | ✅ | INT8/FP8 | 部分 | 事实标准 |
| **SGLang** | ✅ | ✅ RadixAttention | FP8 | ✅ | Agent/多轮最强 |
| **TensorRT-LLM** | ✅ | ✅ | FP8 原生 | ✅ | Hopper/Blackwell 首选 |
| **LMDeploy** | ✅ | ✅ | AWQ + KV INT8 | ✅ | 国内活跃 |
| **HuggingFace TGI** | ✅ | ✅ | INT8 | 部分 | 生态好、性能次之 |
| **llama.cpp** | 有限 | 有限 | 强（KV INT4/INT2） | ✅ CPU/GPU 混合 | 端侧首选 |

详见 [推理框架对比（vLLM/SGLang）](/inference/serving-frameworks)。

## 九、面试可背的公式速记

**显存公式**：$\text{KV Bytes} = 2 \cdot B \cdot L \cdot N_{\text{layer}} \cdot N_{\text{kvhead}} \cdot d_{\text{head}} \cdot P$（$P$ 为精度字节数）

**GQA 显存节省**：$N_{\text{kvhead}} / N_{\text{qhead}}$（如 8/32 = 1/4）

**Decode 阶段单步访存**：权重（几十 GB）+ KV Cache（几~几百 GB），二者都要读一遍 → 带宽是瓶颈。

**吞吐上限（roofline，粗略）**：$\text{tokens/s} \approx \frac{\text{HBM 带宽}}{\text{单 token 需读字节数}}$。这解释了为什么减小 KV Cache 能直接提吞吐。

## 高频追问

**Q：为什么只缓存 K 和 V，不缓存 Q？**
因为 Attention 的公式是 $\text{softmax}(QK^\top)V$：
- **过去的 K、V** 会被**每一个未来的 token** 反复用到 → 缓存有收益；
- **过去的 Q** 只在**当时那一步**用一次，之后再也不出现（因为未来的 token 不 attend 到过去的 Q）→ 缓存没意义。
这是 causal mask + 自回归结构的直接推论。

**Q：为什么长上下文推理显存会爆炸？**
KV Cache 显存随**序列长度 L 线性、层数 N 线性、batch B 线性**共同放大。LLaMA3-70B 单序列 128K 就要 40 GB KV，batch=32 时 1.28 TB，远超单卡显存。所以长上下文推理有三条现实路径：① 从架构上砍（MLA）；② 从系统上省（PagedAttention + 驱逐 + Offload）；③ 从量化上压（KV INT8/INT4）。

**Q：GQA、MQA、MLA 的核心区别？为什么现在旗舰模型都选 GQA 或 MLA？**
- **MHA**：Q/K/V head 一一对应，KV 最多，质量最好，显存爆；
- **MQA**：所有 Q head 共享 1 组 K/V，显存最省但质量有可感知下降；
- **GQA**：折中——Q head 分组，每组共享 1 组 K/V，$G=8$ 时 KV 是 MHA 的 1/4；质量几乎无损；
- **MLA**：把 K、V 压到低秩 latent（$d_c \ll d_{\text{model}}$），推理时 latent 就是 KV Cache，显存最小，质量最好；训练成本略高。
旗舰模型选 GQA 是"最保守的最优解"，DeepSeek 选 MLA 是"最激进的最优解"。

**Q：PagedAttention 到底解决了什么问题？**
解决**KV Cache 显存碎片**问题。传统按最大长度预分配连续块，实际浪费 60%+；PagedAttention 用固定块（如 16 token）+ 虚拟块表按需分配，浪费 <4%。省下的显存可以塞更多并发请求，吞吐直接翻 2-4 倍。副产品是**前缀共享**：多个请求共用 system prompt 的物理 KV 块。

**Q：Prefix Caching 和 PagedAttention 是一回事吗？**
不是同一件事，但强耦合：
- **PagedAttention 是显存管理机制**，允许非连续块存储；
- **Prefix Caching 是复用策略**——因为块可以非连续 + 引用计数，同一个 system prompt 的物理块可以被多个请求引用（COW）。
没有 PagedAttention 也可以做 Prefix Caching（连续显存下按整块拷贝），但效率低、灵活性差。SGLang 的 RadixAttention 进一步用 Radix Tree 管前缀，命中率高于线性哈希。

**Q：KV 量化到 INT4 会不会掉性能？**
掉多少取决于**校准**和**量化粒度**：
- **naive per-tensor INT4** → 掉点明显（K 有 outlier channel）；
- **per-channel INT4 K + per-token INT4 V**（KIVI 思路）→ 长上下文几乎无损；
- **热 KV FP16 + 冷 KV INT4** → 更保险。
质量掉的形式通常是"长上下文任务上乱码"，需要在 needle-in-a-haystack 等任务上专门测。

**Q：H2O / StreamingLLM 为什么能"扔掉"KV 而不崩？**
观察到两个现象：
- **Attention Sink**：Softmax 的归一化让**开头几个 token**（无论内容）持续吸收大量注意力权重——扔掉它们会让整个 attention 分布崩塌；
- **Heavy Hitter**：只有少数 token（高信息量的 keyword、句法枢纽）长期被后续 token 关注，其他大部分历史 token 权重接近 0。
所以"保留 sink + 保留 heavy hitter + 保留最近窗口"三件套就能把 KV 缩到 20%~30%，聊天/流式场景无感。代价是**大海捞针类任务**性能显著下降。

**Q：为什么 Mamba 和扩散 LLM 都不需要传统 KV Cache？**
- **Mamba**：把历史压缩到一个**固定大小的隐藏状态** $h$，每步递推更新，天然是定长 → 无 KV，无线性增长；见 [SSM 页](/advanced/state-space-models)；
- **扩散 LLM**：双向注意力，每轮 refine 都对全序列重算 K/V，没有"过去 K/V 只需算一次"的假设 → 传统 KV Cache 无效，但可以有 prefix cache；见 [扩散语言模型](/advanced/diffusion-llm)。
这两种架构都在挑战"KV 随 L 线性增长"这个根本问题，是长上下文推理的另两条路线。

**Q：投机解码和 KV Cache 是什么关系？**
[投机解码](/inference/speculative-decoding)（Speculative Decoding）是"小模型出草稿 → 大模型批量验证"的一次多 token 生成方案。它**依赖 KV Cache 正确性**：
- 草稿被接受时 → KV Cache 顺利前推 $k$ 个 token，节省 $k-1$ 次 forward；
- 草稿被拒时 → **需要回滚 KV Cache**（丢掉被拒的 K/V 分量）。
所以推理引擎实现投机解码时，KV 分配、写入、回滚都要和 PagedAttention 深度配合——SGLang、vLLM 都是这么做的。

**Q：Prefill/Decode 分离（Disaggregation）为什么和 KV Cache 高度相关？**
Prefill 是 compute-bound、Decode 是 memory-bound，混在一起会**互相拖累**：长 Prefill 卡住 Decode 队列、Decode 又浪费 Prefill 的算力。分离部署（Prefill 集群 + Decode 集群）能各自最大化利用率，但代价是**要在两个集群之间搬运 KV Cache**（几 GB 到几十 GB）。所以分离的核心工程难点就是"KV 传输"：DeepSeek/Kimi 的 Mooncake、微软 Splitwise 都在做 KV 高速网络传输 + 全局 KV 池。这是 2025-2026 大模型推理最热的方向之一。
