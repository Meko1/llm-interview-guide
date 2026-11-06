---
title: 从 Logits 到损失：Softmax、交叉熵与困惑度
description: >-
  从原始分数到有效 token 损失，复算稳定 Softmax、交叉熵、梯度与 PPL，并辨别平滑目标和跨分词器比较的边界。
level: L1
roles:
  - 在校生
  - 算法研究
  - 应用开发
classification: inferred
---
# 从 Logits 到损失：Softmax、交叉熵与困惑度

> 「写一下交叉熵公式」「PPL 是怎么算的」「softmax 为什么要减最大值」——这些微观数学题是大模型基础面试的照妖镜：背概念的人答不出，真理解的人几分钟讲透。本文把**模型最后一层输出（logits）→ 概率（softmax）→ 损失（交叉熵）→ 评估（困惑度）**这条链一次讲清，含数值稳定性、label smoothing、z-loss 等工程细节。采样侧（温度/top-p 怎么选词）见 [解码与采样策略](/basics/decoding)，训练全景见 [预训练目标与数据](/pretraining/pretrain)，手撕实现见 [手撕代码题解集](/interview/coding-problems)。

## 面试先背这几句话

- LLM 每个位置输出一个 **词表大小的 logits 向量**（未归一化分数），softmax 后变成概率分布，训练目标是**最大化真实下一个 token 的概率** = 最小化交叉熵。
- 语言模型的损失就是**平均每 token 的负对数似然（NLL）**；**困惑度 PPL = exp(平均 NLL)**，直觉是「模型平均在多少个候选里犹豫」。
- softmax 直接算会**上溢**（e^大数 = inf），必须先**减去最大值**——数学上等价（分子分母同除 e^max），数值上安全。
- 实现上用 **log-softmax + NLL**（即 `F.cross_entropy` 内部融合）而不是先 softmax 再取 log，避免 log(0) 和精度损失。
- 标准硬标签 next-token 交叉熵通常不引入采样温度；蒸馏等训练可以使用温度。label smoothing 是另一个目标选择，是否使用要查训练配置，不应背成禁令。

## 一、Logits：模型的原始输出

Transformer 最后一层（LM Head，一个 `d×V` 的线性层）把每个位置的隐藏向量映射成词表上的分数：

$$z = h \cdot W_{lm} \in \mathbb{R}^{V}$$

- $z$ 就是 **logits**：未归一化、可正可负、没有概率含义的「原始偏好分数」。
- $V$ 是词表大小（如 Qwen 约 15 万），所以 LM Head 参数量 = $d \times V$，词表越大这层越重（见 [Tokenizer 与分词](/basics/tokenizer)）。
- **权重共享（weight tying）**：很多模型让 LM Head 与输入 Embedding 共享同一矩阵（转置使用），省 $V\times d$ 参数；大模型时代大词表模型常不共享。

> 面试细节：logits 不是概率！很多下游操作（logit bias、约束解码、温度）都直接作用在 logits 上，因为此时还没归一化、干预最方便（见 [结构化输出详解](/engineering/structured-output)）。

## 二、Softmax：从分数到概率 ★

$$p_i = \frac{e^{z_i}}{\sum_{j=1}^{V} e^{z_j}}$$

性质：所有 $p_i \in (0,1)$ 且和为 1；**保序**（logits 大的概率大）；放大差距（指数效应）。

### 2.1 数值稳定性：为什么要减 max ★

float 表示范围有限：$e^{89}$ 在 float32 下就是 `inf`。logits 完全可能达到几十上百，直接算 softmax 会**上溢成 NaN**。

解法：利用恒等式（分子分母同乘 $e^{-m}$）：

$$\frac{e^{z_i}}{\sum_j e^{z_j}} = \frac{e^{z_i - m}}{\sum_j e^{z_j - m}}, \quad m = \max_j z_j$$

对有限 logits，减 max 后最大指数为 1，可避免指数上溢。尾部下溢仍会损失概率；若再取 log，不能认为无害。全 $-\infty$、已有 NaN 或非有限值仍需单独处理，稳定技巧不是万能修复。

> 延伸：FlashAttention 的 **online softmax** 就是把这个「减 max」在分块计算中动态维护（running max + 补偿因子），这是它能不物化注意力矩阵的数学基础（见 [FlashAttention 深入](/advanced/flash-attention)）。

### 2.2 log-softmax：训练时的正确姿势

训练要的是 $\log p_i$。**先 softmax 再 log** 有两个问题：下溢的 $p_i=0$ 会得到 `log(0)=-inf`；两步计算精度差。所以用数学化简后的 **log-softmax**：

$$\log p_i = z_i - m - \log\sum_j e^{z_j - m}$$

PyTorch 的 `F.cross_entropy` = `log_softmax + nll_loss` 融合实现，既稳又快。**手撕面试题**常考：不许调库，写出数值稳定的 softmax/cross-entropy（关键就是减 max 和 logsumexp）。

## 三、交叉熵损失：语言模型在优化什么 ★

### 3.1 公式与直觉

对一个长度为 $T$ 的序列，自回归语言模型的损失：

$$\mathcal{L} = -\frac{1}{T}\sum_{t=1}^{T} \log p_\theta(x_t \mid x_{<t})$$

逐位置看：真实下一个 token 是 $y$，模型给它的概率是 $p_y$，该位置损失就是 $-\log p_y$：

- 模型给对答案 90% 概率 → 损失 0.105；给 1% → 损失 4.6。**答对且自信，损失才低**。
- 这就是**最大似然估计（MLE）**：让训练数据在模型下的概率最大。
- 每条样本使用观察到的硬标签，目标编码为 one-hot，交叉熵退化为 $-\log p_y$；这不意味着现实中只有一种合理续写。

### 3.2 训练细节（面试常追问）

- **Teacher forcing**：训练时每个位置的「前文」用**真实文本**而非模型自己的生成，所以整个序列可**并行**算损失（配合因果掩码，见 [Mask 与 Padding](/basics/masks-padding)）。
- **shift 对齐**：位置 $t$ 的 logits 预测的是 $t+1$ 的 token，实现里要把 labels 左移一位（`logits[:-1]` 对 `labels[1:]`），手撕高频坑。
- **ignore_index**：padding 位置、prompt 部分（SFT 时常只算回答的损失）用 `-100` 屏蔽，不参与损失。
- **梯度形式**：单个无权重硬标签项对 logits 的梯度为 $p-\text{onehot}(y)$；平均损失还要除有效目标数量，平滑、类权重等会改变具体形式。

### 3.3 Label Smoothing：为什么 LLM 预训练不用

Label smoothing 是把硬标签与另一分布混合。PyTorch 使用均匀分布：$q_i=(1-\epsilon)\mathbf{1}_{i=y}+\epsilon/V$，正确类也得到均匀项；另一种「仅分给错误类」约定并不相同。

它改变目标与梯度，可用于正则化，但校准和下游收益不是普遍单向结论。计算标准 PPL 时应用原始硬标签 NLL，而不是把平滑 loss、z-loss 或其他辅助项一并取指数。保留旧标题是为锚点兼容，正文不主张所有 LLM 禁用 smoothing。

## 四、困惑度（Perplexity）★

$$\text{PPL} = \exp\left(\frac{1}{T}\sum_{t=1}^{T} -\log p(x_t|x_{<t})\right) = e^{\mathcal{L}}$$

- **直觉**：目标 token 概率倒数的几何平均。PPL=20 可类比等概率 20 选 1 的负对数似然，但不表示每一步真的均匀选 20 个词。
- **换算**：loss 2.0 → PPL ≈ 7.39；loss 每降 0.1，PPL 降约 10%。
- **用途**：预训练过程的核心监控指标、数据质量过滤（给文本算 PPL，异常高的可能是垃圾）、量化/压缩后的质量初筛（见 [量化实战深入](/inference/quantization)）。

**PPL 的坑（面试加分点）**：

1. **不同 tokenizer 不可比**：PPL 是「每 token」的，分词粒度不同的模型 PPL 没有可比性（同一句话 token 数都不一样）。严谨比较用 bits-per-byte/bits-per-character 归一化。
2. **PPL 低 ≠ 下游任务好**：它只衡量拟合语言分布，不等于指令遵循/推理能力——所以评估还需要基准与人评（见 [模型评估与幻觉](/evaluation/evaluation)）。
3. **对上下文长度敏感**：长上下文里后面的 token 更好预测，评测窗口设置影响数值。

构造复算：两个有效 token 的目标概率为 0.5 与 0.125，平均 NLL 为 $(-\ln0.5-\ln0.125)/2=\ln4$，PPL=4；不是两个倒数 2 与 8 的算术平均 5。跨 batch 汇总应加总 NLL 与有效 token 数，不平均各 batch 的 PPL。

bits-per-byte 还需要同一原始文本、相同规范化与覆盖、确定的编码及一致计分窗口；不能只把不同模型的 PPL 除以字节数就完成转换。总 NLL 除以 $\ln2$ 后再除原始字节数才得到该口径的数值。

## 五、工程细节拾遗

- **z-loss**：给 $\log^2 Z$（配分函数的对数平方）加一个很小的辅助损失，防止 logits 整体漂移过大导致数值不稳（PaLM 等大模型训练用过；MoE 的 router 也常用 router z-loss，见 [MoE 训练与专家并行](/pretraining/moe-training)）。
- **logits 用 FP32 算损失**：混合精度训练里，最后的 softmax+交叉熵常强制转 FP32，因为 $V$ 很大时 BF16 的 logsumexp 精度不够（见 [训练深入](/advanced/training-internals)）。
- **大词表的显存刺客**：logits 张量形状 `[batch, seq, V]`，V=15 万时这一个张量就可能比激活还大——所以有 chunked cross-entropy / 融合 kernel（如 Liger Kernel）按块算损失省显存。
- **温度**：正温度重塑分布；标准 next-token loss 通常直接用 logits，而蒸馏等目标可有自己的温度协议（见 [解码与采样策略](/basics/decoding)）。

## 高频追问

1. **写出交叉熵损失并解释 LLM 在优化什么？** $\mathcal{L}=-\frac{1}{T}\sum_t \log p(x_t|x_{<t})$，最大化训练文本的似然；one-hot 目标下交叉熵退化为对正确 token 的负对数概率。
2. **softmax 为什么要减最大值？** 防上溢：$e^{z}$ 在 z 几十时就 inf；分子分母同除 $e^{max}$ 数学等价，减完后最大指数为 1，数值安全。
3. **为什么用 log-softmax + NLL 而不是先 softmax 再 log？** 避免下溢概率取 log 得 -inf，且 logsumexp 一步算完精度更好；框架的 cross_entropy 就是融合实现。
4. **PPL 是什么？loss 2.3 对应 PPL 多少？** PPL=exp(平均每 token NLL)，直觉是平均在几个候选里犹豫；exp(2.3)≈10。
5. **两个模型的 PPL 能直接比吗？** 不能，除非同 tokenizer——PPL 按 token 计，分词粒度不同没有可比性；需 bits-per-byte 归一化。
6. **softmax+交叉熵对 logits 的梯度是什么？** $p - \text{onehot}(y)$：预测分布减真实分布，形式简洁数值稳定，是这对组合成为标配的原因之一。
7. **训练时 labels 怎么对齐？哪些位置不算损失？** logits 与 labels 错一位（shift），padding 与（SFT 中的）prompt 部分用 ignore_index=-100 屏蔽。
8. **为什么不能把 label smoothing loss 当作标准 PPL？** 它优化混合目标而非观察 token 的原始 NLL；应另外用硬标签计分，是否使用 smoothing 需查配置。
9. **温度作用在训练还是推理？** 常见于采样，也可用于蒸馏等训练；分清采样配置与训练目标。
10. **大词表模型算损失有什么显存问题？** logits 张量 [B,S,V] 巨大，用 chunked/融合交叉熵（分块计算不物化完整 logits）缓解。

<details>
<summary>自测：全部 labels 都是 -100，平均损失该除以多少？</summary>

有效目标数为零，普通均值没有定义。应在训练协议中定义跳过或零损失策略，并检查空回答、截断和模板错误；不要把 NaN 靠替换数值掩盖。

</details>

实现依据：[PyTorch CrossEntropyLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html)、[Transformers 因果 LM loss](https://github.com/huggingface/transformers/blob/main/src/transformers/loss/loss_utils.py)。本页数字是教学复算，不是模型成绩。
