---
title: 量化实战深入（GPTQ / AWQ / SmoothQuant / KV 量化）
description: >-
  量化是让大模型「跑得起、跑得省」的第一手段，也是推理岗的高频深挖点。本文参考 llm-action
  的量化实战体系，系统讲清量化的数学本质、离群值难题、主流算法（GPTQ/AWQ/SmoothQuant）、W#A# 命名法、KV Cache 量化与
  QAT。压缩总览（含蒸馏/剪枝）见 知识蒸馏与模型
level: L2
roles:
  - Infra
  - 后端转型
classification: inferred
---
# 量化实战深入（GPTQ / AWQ / SmoothQuant / KV 量化）

> 量化是让大模型「跑得起、跑得省」的第一手段，也是推理岗的高频深挖点。本文参考 [llm-action](https://github.com/liguodongiot/llm-action) 的量化实战体系，系统讲清量化的数学本质、离群值难题、主流算法（GPTQ/AWQ/SmoothQuant）、W#A# 命名法、KV Cache 量化与 QAT。压缩总览（含蒸馏/剪枝）见 [知识蒸馏与模型压缩](/inference/model-compression)，推理全景见 [推理优化与部署](/inference/inference-optimization)。

## 面试先背这几句话

- 量化 = 用低比特整数近似表示高精度浮点权重/激活，核心公式 $x \approx s\cdot(q - z)$（scale 与 zero-point）。
- 分类维度：**权重量化 vs 权重+激活量化**、**PTQ（训练后）vs QAT（量化感知训练）**、**对称 vs 非对称**、**per-tensor vs per-channel vs per-group**。
- 大模型量化的最大难题是**激活离群值（outlier）**：少数维度数值极大，导致 per-tensor 量化精度崩。
- 三大主流：**GPTQ**（逐层误差补偿量权重）、**AWQ**（激活感知保护重要权重通道）、**SmoothQuant**（把激活难度迁移到权重，解决 W8A8）。
- 命名法：**W4A16** = 权重 4bit、激活 16bit（省显存、访存友好）；**W8A8** = 权重激活都 8bit（能用 INT8 算力提吞吐）。

## 一、为什么量化有效、代价是什么

- **收益**：FP16→INT4 的权重 payload 理论降为 1/4，元数据和未量化层另算；能否提速取决于反量化/kernel、shape 和当前瓶颈。
- **代价**：精度损失。量化引入舍入误差，比特越低损失越大；关键是**用聪明的算法把损失压到可接受范围**。

小 batch decode 常偏访存，但大 batch 或多卡可能受计算/通信限制。W4A16 降低权重读取并增加反量化工作；不能由位宽直接推出提速或“几乎不掉点”，见 [推理性能压测](/inference/inference-benchmark)。

## 二、量化的数学本质

把浮点 $x$ 映射到 $b$ 比特整数 $q$：

$$q = \operatorname{clip}\left(\operatorname{round}(x / s) + z,q_{min},q_{max}\right), \qquad \hat{x}=s(q-z)$$

- **scale $s>0$**：缩放因子，决定量化步长；全零组需单独约定，不能除以 0。
- **zero-point $z$**：零点偏移。
- **对称量化**：$z=0$，范围关于 0 对称，简单快（权重常用）。
- **非对称量化**：有 $z$，能更好覆盖非对称分布（激活常用）。
- **absmax**：若对称码域选择 $[-(2^{b-1}-1),2^{b-1}-1]$，可取 $s=\max(|x|)/(2^{b-1}-1)$；有符号整数最小码可能另有处理，舍入规则和饱和范围也属于格式定义。

### 可复算：舍入界不覆盖 clipping

构造 4-bit 对称码域 −7…7、s=0.1、z=0：x=0.26 映射 q=3、还原 0.3，误差 0.04≤s/2；x=0.91 饱和到 q=7、还原 0.7，误差 0.21>s/2。过大 scale 使普通值舍入更粗，过小 scale 使 outlier 裁剪；校准是在二者之间权衡，不是消除误差。

128 个 INT4 权重 payload 是 64 bytes；若每组一份 FP16 scale，另加 2 bytes，即仅 scale 已增加 3.125%。zero-point、padding、未量化层和 workspace 再加；因此完整部署不可能直接按 0.5 bytes/参数推断峰值。

**量化粒度**（精度与开销的权衡）：

| 粒度 | 说明 | 精度 |
| --- | --- | --- |
| per-tensor | 整个张量一个 scale | 最省，最容易被离群值毁掉 |
| per-channel | 每个输出通道一个 scale | 权重量化常用 |
| per-group | 每 128 个元素一组一个 scale | GPTQ/AWQ 常用，精度/开销折中 |

## 三、核心难题：激活离群值（Outlier）★

研究发现（LLM.int8() 等）：LLM 的激活中存在**系统性离群值**——极少数特征维度的数值比其他大几十上百倍，且随模型变大越明显。

问题：per-tensor 量化时，离群值把 scale 撑得很大，导致其余正常值被压缩到极少数量化格子里，**精度灾难性下降**。

三种应对思路，对应三种主流算法：

1. **混合精度隔离**（LLM.int8()）：把离群值那几列单独用 FP16 算，其余 INT8。简单但有效，是 8bit 权重量化的基础。
2. **平滑迁移**（SmoothQuant）：把激活的「难量化」按数学等价迁移一部分到权重上。
3. **重要性保护**（AWQ）：识别并保护对输出影响最大的权重通道。

## 四、三大主流算法 ★

### 4.1 GPTQ（权重量化，W4A16）

- **思路**：逐层量化，用二阶信息（Hessian 近似）做**误差补偿**——量化某个权重后，调整同层未量化的权重来抵消引入的误差。
- **特点**：常见低比特权重量化路径保留高精度激活；二阶信息来自校准输入形成的近似，质量依校准分布、阻尼、group 与实现而变。
- **适用**：追求省显存、单请求/中小并发场景；配 ExLlama/Marlin 等 kernel 提速。

### 4.2 AWQ（Activation-aware Weight Quantization，W4A16）

- **思路**：论文观察保护少量 salient 权重有益，使用激活统计选择通道尺度，通过等价缩放改善低比特误差；不是永久保留固定 1% FP16 权重，也不保证全局损失最小。
- **特点**：不依赖反向/Hessian，量化快；泛化性好，常用于部署；同为 4bit 权重量化，与 GPTQ 是主要竞品。

### 4.3 SmoothQuant（W8A8）

- **思路**：激活难量化、权重好量化，那就把激活各通道的「幅度」按等价变换**迁移一部分到权重**：$Y = (X\,\text{diag}(s)^{-1})\cdot(\text{diag}(s)\,W)$，让激活变平滑、权重仍可量化。
- **目标**：实现**权重激活都 INT8（W8A8）**，从而能用硬件的 INT8 Tensor Core 提**吞吐**（这是纯权重量化做不到的）。
- **适用**：高并发、追求吞吐的服务化场景。

> 面试对比：**GPTQ/AWQ 是 W4A16（省显存、提 decode 速度，但计算仍走 FP16）；SmoothQuant 是 W8A8（能用 INT8 算力真正提吞吐）**。选哪个取决于瓶颈是显存还是算力。

## 五、W#A# 命名法与选型

| 方案 | 权重 | 激活 | 收益 | 场景 |
| --- | --- | --- | --- | --- |
| W16A16 | FP16 | FP16 | 基线 | — |
| **W8A8** | INT8 | INT8 | 用 INT8 算力提吞吐 | 高并发服务（SmoothQuant） |
| **W4A16** | INT4 | FP16 | 省显存、提 decode 速度 | 显存受限、中小并发（GPTQ/AWQ） |
| W4A8 / W4A4 | INT4 | INT8/4 | 更激进 | 前沿探索，精度挑战大 |
| FP8（E4M3 等） | 浮点 8bit | 依配方 | 动态尺度、累积与 kernel 决定误差/速度 | 需硬件与引擎支持 |

FP8 有不同指数/尾数分配；INT8 的实际覆盖范围由 scale 决定，不能说 FP8 对所有分布精度更好。FP8 训练还需尺度和累积精度管理，不是简单把权重 cast 一次。

## 六、KV Cache 量化

长上下文/高并发时，**KV Cache 显存可能超过权重本身**。对 KV Cache 做量化（如 KV8、KV4）能显著提升最大并发数：

- Key/Value 分别量化，通常 per-token 或 per-channel。
- 收益：直接增大可容纳的并发请求数（KV Cache 是并发上限的主因）。
- 风险：KV 量化过激进会伤长上下文准确性，需评估。
- 与架构手段互补：MQA/GQA/MLA 从结构上减小 KV（见 [Attention 与变体](/basics/attention)、[推理优化与部署](/inference/inference-optimization)）。

## 七、PTQ vs QAT

| | PTQ（训练后量化） | QAT（量化感知训练） |
| --- | --- | --- |
| 做法 | 训练完直接量化，用少量校准数据 | 训练/微调时插入伪量化节点，让模型「适应」量化 |
| 成本 | 校准与量化，随规模/实现变化 | 额外训练与数据成本 |
| 精度 | 需对目标分布验证 | 可适应量化误差，但不保证普遍优于 PTQ |
| 选择条件 | 无训练预算且误差可接受 | 有训练/验证资源、低比特误差需要进一步适应 |

PTQ 与 QAT 是工程选项，不用“几乎都用”作选型理由。QLoRA 是通过冻结量化基座训练 LoRA，反向仍通过基座传播，不等于常规更新量化权重的 QAT；NF4 也不是整数 INT4。见 [QLoRA](https://arxiv.org/abs/2305.14314)。

## 八、工程落地建议

1. **先定瓶颈**：显存不够 → W4A16（AWQ/GPTQ）；吞吐不够且有 INT8 算力 → W8A8（SmoothQuant）或 FP8。
2. **务必评估精度**：量化后跑业务评测集（不只看 PPL，要看真实任务指标），对比 FP16 基线。
3. **配套 kernel**：量化收益要靠高效 kernel 兑现（Marlin、Machete、TensorRT-LLM 的量化 kernel）。
4. **组合使用**：先分开消融，再测组合；权重/KV kernel、batch 与调度相互作用，收益不能相乘。
5. **别过度量化**：4bit 以下、激活低比特容易崩，收益边际递减而风险陡增。

## 面试专项：量化上线验收清单

量化面试不要只背 GPTQ、AWQ、SmoothQuant 名词，要能讲清「为什么选、怎么验、失败怎么回滚」。

| 决策问题 | 推荐答法 |
| --- | --- |
| 显存不够、想跑更大模型 | 先试 W4A16（AWQ/GPTQ），收益主要是权重显存和 decode 访存 |
| 吞吐不够、硬件有 INT8/FP8 能力 | 评估 W8A8、FP8 或 TensorRT-LLM 配套 kernel |
| 长上下文并发不够 | 评估 KV Cache 量化，但必须覆盖长文本和引用准确性 |
| 端侧或本地部署 | 看 GGUF / llama.cpp 生态，重点是体积、速度和硬件兼容 |
| 业务强依赖结构化输出或工具调用 | 除了准确率，还要测 JSON 合法率、schema 遵循、工具参数正确率 |

上线验收至少三类门禁：

1. **效果门禁**：真实业务集、长上下文集、结构化输出集、安全拒答集，相对 FP16/BF16 基线的掉点可接受。
2. **性能门禁**：TTFT、TPOT、goodput、显存、KV 占用、$/百万 token 必须有可量化收益。
3. **稳定性门禁**：长压、突发并发、极长输入、极长输出、OOM、kernel fallback、灰度和回滚路径。

一句话总结：**量化不是越低比特越好，而是在可接受效果损失内，把有效吞吐和单位成本做到最好**。相关系统题见 [推理部署与成本治理高频问答](/interview/inference-cost-qna)。

## 高频追问

1. **量化的基本原理？** 用低比特整数近似浮点：$x\approx s(q-z)$，scale 定步长、zero-point 定偏移；分对称/非对称、per-tensor/channel/group。
2. **大模型量化最大的难点是什么？** 激活离群值：少数维度数值极大，撑大 scale 导致 per-tensor 量化精度崩，需混合精度/平滑/重要性保护应对。
3. **GPTQ 和 AWQ 区别？** GPTQ 用近似二阶信息补偿量化误差；AWQ 用激活统计搜索等价尺度保护 salient 通道。算法都可有不同位宽/group，kernel 与质量决定选型，不预设谁更快。
4. **SmoothQuant 解决什么问题？** 把激活的量化难度按等价变换迁移到权重，实现 W8A8，从而用 INT8 算力提吞吐——纯权重量化做不到这点。
5. **W4A16 和 W8A8 该选哪个？** 瓶颈是显存/decode 速度选 W4A16；瓶颈是吞吐且硬件有 INT8/FP8 算力选 W8A8/FP8。
6. **为什么要量化 KV Cache？** 长上下文高并发时 KV Cache 占显存超过权重，量化它能直接提升最大并发；但过激会伤长文本精度。
7. **PTQ 和 QAT 什么区别？** PTQ 使用训练后校准/量化，QAT 在训练中显式适应量化；训练预算、目标位宽和质量实验决定选择，不保证 QAT 总更好。
8. **量化一定要验证什么？** 用真实业务评测集对比 FP16 基线（PPL 不够，要看下游任务指标），并确认有配套高效 kernel 兑现速度收益。

## 从误差定位到回滚

固定 token 输入/attention mask/模型 revision，逐层比较相对/绝对误差、clipping 比例与最终 logits 排名；MSE 小也可能改变接近并列的 token 选择。K 的误差进入 `q·δk/√d` 后影响 softmax 权重，V 的误差进入加权和，二者粒度不能只按名称统一。

校准集覆盖语言、长度、代码/工具和 outlier 切片，并与最终质量测试分离，避免用反复调参的集合报告泛化。保存校准 hash、group/axis、scale/zero、舍入、格式、kernel 与回退日志；低比特文件变小但 fallback 到慢路径时，应回滚或更换 kernel，而非继续降低位宽。

一手机制：[GPTQ](https://arxiv.org/abs/2210.17323)、[AWQ](https://arxiv.org/abs/2306.00978)、[SmoothQuant](https://arxiv.org/abs/2211.10438)、[KIVI](https://arxiv.org/abs/2402.02750)。论文结果只支持对应实验；W#A# 没有说明 accumulator、KV、未量化层与硬件实现，不能充当完整部署配置。
