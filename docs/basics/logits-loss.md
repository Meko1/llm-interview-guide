# 从 Logits 到损失：Softmax、交叉熵与困惑度

> 「写一下交叉熵公式」「PPL 是怎么算的」「softmax 为什么要减最大值」——这些微观数学题是大模型基础面试的照妖镜：背概念的人答不出，真理解的人几分钟讲透。本文把**模型最后一层输出（logits）→ 概率（softmax）→ 损失（交叉熵）→ 评估（困惑度）**这条链一次讲清，含数值稳定性、label smoothing、z-loss 等工程细节。采样侧（温度/top-p 怎么选词）见 [解码与采样策略](/basics/decoding)，训练全景见 [预训练目标与数据](/pretraining/pretrain)，手撕实现见 [手撕代码题解集](/interview/coding-problems)。

## 面试先背这几句话

- LLM 每个位置输出一个 **词表大小的 logits 向量**（未归一化分数），softmax 后变成概率分布，训练目标是**最大化真实下一个 token 的概率** = 最小化交叉熵。
- 语言模型的损失就是**平均每 token 的负对数似然（NLL）**；**困惑度 PPL = exp(平均 NLL)**，直觉是「模型平均在多少个候选里犹豫」。
- softmax 直接算会**上溢**（e^大数 = inf），必须先**减去最大值**——数学上等价（分子分母同除 e^max），数值上安全。
- 实现上用 **log-softmax + NLL**（即 `F.cross_entropy` 内部融合）而不是先 softmax 再取 log，避免 log(0) 和精度损失。
- **温度只在推理时用**（重塑分布），训练算损失时不加温度；**label smoothing** 在现代 LLM 预训练中很少用（会扭曲概率校准、抬高 PPL）。

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

减完 max 后最大指数是 $e^0=1$，永不上溢；其余项最多下溢为 0（无害）。**所有深度学习框架的 softmax 都内置了这一步**，但面试要求你能解释为什么。

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
- 为什么是交叉熵？真实分布是 one-hot（下一个词确定是 $y$），交叉熵 $-\sum_i q_i \log p_i$ 在 one-hot 下退化为 $-\log p_y$。

### 3.2 训练细节（面试常追问）

- **Teacher forcing**：训练时每个位置的「前文」用**真实文本**而非模型自己的生成，所以整个序列可**并行**算损失（配合因果掩码，见 [Mask 与 Padding](/basics/masks-padding)）。
- **shift 对齐**：位置 $t$ 的 logits 预测的是 $t+1$ 的 token，实现里要把 labels 左移一位（`logits[:-1]` 对 `labels[1:]`），手撕高频坑。
- **ignore_index**：padding 位置、prompt 部分（SFT 时常只算回答的损失）用 `-100` 屏蔽，不参与损失。
- **梯度形式优美**：softmax+交叉熵对 logits 的梯度是 $p - \text{onehot}(y)$——「预测概率减真实分布」，简洁且数值好，这是这对组合成为标配的深层原因。

### 3.3 Label Smoothing：为什么 LLM 预训练不用

Label smoothing 把 one-hot 目标软化（正确类 $1-\epsilon$，其余均分 $\epsilon$），传统上防过拟合、防过度自信。但现代 LLM 预训练**基本不用**：

- 海量数据下过拟合不是主要矛盾；
- 它系统性抬高损失下限、**扭曲概率校准**（模型输出的概率不再逼近真实条件分布），伤害 PPL 和下游的置信度使用。

## 四、困惑度（Perplexity）★

$$\text{PPL} = \exp\left(\frac{1}{T}\sum_{t=1}^{T} -\log p(x_t|x_{<t})\right) = e^{\mathcal{L}}$$

- **直觉**：模型平均「在多少个等可能候选里犹豫」。PPL=1 完美预测；PPL=20 相当于每步在 20 个词里均匀猜。
- **换算**：loss 2.0 → PPL ≈ 7.39；loss 每降 0.1，PPL 降约 10%。
- **用途**：预训练过程的核心监控指标、数据质量过滤（给文本算 PPL，异常高的可能是垃圾）、量化/压缩后的质量初筛（见 [量化实战深入](/inference/quantization)）。

**PPL 的坑（面试加分点）**：

1. **不同 tokenizer 不可比**：PPL 是「每 token」的，分词粒度不同的模型 PPL 没有可比性（同一句话 token 数都不一样）。严谨比较用 bits-per-byte/bits-per-character 归一化。
2. **PPL 低 ≠ 下游任务好**：它只衡量拟合语言分布，不等于指令遵循/推理能力——所以评估还需要基准与人评（见 [模型评估与幻觉](/evaluation/evaluation)）。
3. **对上下文长度敏感**：长上下文里后面的 token 更好预测，评测窗口设置影响数值。

## 五、工程细节拾遗

- **z-loss**：给 $\log^2 Z$（配分函数的对数平方）加一个很小的辅助损失，防止 logits 整体漂移过大导致数值不稳（PaLM 等大模型训练用过；MoE 的 router 也常用 router z-loss，见 [MoE 训练与专家并行](/pretraining/moe-training)）。
- **logits 用 FP32 算损失**：混合精度训练里，最后的 softmax+交叉熵常强制转 FP32，因为 $V$ 很大时 BF16 的 logsumexp 精度不够（见 [训练深入](/advanced/training-internals)）。
- **大词表的显存刺客**：logits 张量形状 `[batch, seq, V]`，V=15 万时这一个张量就可能比激活还大——所以有 chunked cross-entropy / 融合 kernel（如 Liger Kernel）按块算损失省显存。
- **推理时的温度**：$p_i = \text{softmax}(z_i/\tau)$，$\tau<1$ 让分布更尖、$\tau>1$ 更平——注意这是**推理期采样**的旋钮，训练损失不加温度（见 [解码与采样策略](/basics/decoding)）。

## 高频追问

1. **写出交叉熵损失并解释 LLM 在优化什么？** $\mathcal{L}=-\frac{1}{T}\sum_t \log p(x_t|x_{<t})$，最大化训练文本的似然；one-hot 目标下交叉熵退化为对正确 token 的负对数概率。
2. **softmax 为什么要减最大值？** 防上溢：$e^{z}$ 在 z 几十时就 inf；分子分母同除 $e^{max}$ 数学等价，减完后最大指数为 1，数值安全。
3. **为什么用 log-softmax + NLL 而不是先 softmax 再 log？** 避免下溢概率取 log 得 -inf，且 logsumexp 一步算完精度更好；框架的 cross_entropy 就是融合实现。
4. **PPL 是什么？loss 2.3 对应 PPL 多少？** PPL=exp(平均每 token NLL)，直觉是平均在几个候选里犹豫；exp(2.3)≈10。
5. **两个模型的 PPL 能直接比吗？** 不能，除非同 tokenizer——PPL 按 token 计，分词粒度不同没有可比性；需 bits-per-byte 归一化。
6. **softmax+交叉熵对 logits 的梯度是什么？** $p - \text{onehot}(y)$：预测分布减真实分布，形式简洁数值稳定，是这对组合成为标配的原因之一。
7. **训练时 labels 怎么对齐？哪些位置不算损失？** logits 与 labels 错一位（shift），padding 与（SFT 中的）prompt 部分用 ignore_index=-100 屏蔽。
8. **为什么 LLM 预训练不用 label smoothing？** 海量数据下过拟合非主要矛盾，且它扭曲概率校准、抬高 PPL，弊大于利。
9. **温度作用在训练还是推理？** 推理采样阶段重塑分布；训练损失不加温度。
10. **大词表模型算损失有什么显存问题？** logits 张量 [B,S,V] 巨大，用 chunked/融合交叉熵（分块计算不物化完整 logits）缓解。
