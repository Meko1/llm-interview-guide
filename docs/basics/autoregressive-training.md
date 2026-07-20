# 自回归训练：Teacher Forcing 与标签构造

大模型“预测下一个 token”是一句正确但不够工程化的话。面试中更重要的是说明：一段原始文本如何被整理成 `input_ids`、`labels`、attention mask 和 loss mask；训练为什么可以并行，推理为什么却必须逐 token 进行。

本页只解决训练样本和监督信号的闭环。交叉熵细节见 [从 Logits 到损失](/basics/logits-loss)，注意力可见性见 [Mask 与 Padding](/basics/masks-padding)，模型内部计算见 [Transformer 架构详解](/basics/transformer)。

## 一、从文本到一条 next-token 样本

设分词结果为：

```text
tokens: [BOS, 我, 喜欢, 学习, LLM, EOS]
input_ids: [BOS, 我, 喜欢, 学习, LLM]
labels:    [我, 喜欢, 学习, LLM, EOS]
```

位置 `t` 的 hidden state 只能看见 `x_0...x_t`，目标是预测 `x_{t+1}`。损失为：

$$L=-\frac{1}{N}\sum_{t\in\mathcal V}\log p_\theta(x_{t+1}\mid x_{\leq t})$$

`mathcal V` 是有效监督位置集合。实际框架中常把完整序列同时传给模型，再在 loss 内部做 shift；也可能在 data collator 中预先右移。两种方式都可以，但必须只做一次 shift。标签错位一位，是“loss 能算但模型学不会”的经典故障。

## 二、Teacher Forcing 为什么训练可并行

训练时位置 `t` 的前缀使用**真实 token**，不是模型上一步采样结果。这称为 Teacher Forcing。配合 causal mask，一次前向即可并行得到全部位置的 logits：可见性受限于下三角 mask，计算本身仍由矩阵乘并行完成。

推理时没有真实未来 token，模型输出的新 token 必须回填为下一步输入，因此生成不可并行。这就是同一个概率分解在训练和推理中呈现不同执行形态的原因。

### Exposure Bias：为什么训练 loss 很低仍可能多轮跑偏

训练时条件分布是“真实前缀”；推理时条件分布是“模型自己生成的前缀”。一次早期错误会改变后续条件，错误可能累积。它不是靠把训练 loss 压得更低就必然消失的问题。更可靠的缓解手段是覆盖真实业务轨迹的数据、长链路评测、拒答/工具协议训练和推理阶段约束；不要把 scheduled sampling 当作所有 LLM 的默认答案。

## 三、Attention Mask 和 Loss Mask 是两件事

| 掩码 | 影响对象 | 典型用途 | 是否改变 token 可见性 |
| --- | --- | --- | --- |
| causal mask | attention score | 禁止偷看未来 | 是 |
| padding/key mask | attention score | 忽略 pad 或无效 key | 是 |
| loss mask / ignore index | 交叉熵位置 | 只监督 assistant 回答 | 否 |

以 chat SFT 为例，用户问题通常应让模型看见，但不一定应把用户 token 计入 loss；assistant 回复则既可见又被监督。把 loss mask 错当 attention mask 会造成两类反向错误：要么模型看不到应有上下文，要么在不该学习的 prompt 模板上浪费监督。

## 四、EOS、轮次边界与文档拼接

EOS 同时承担“文本结束”的训练信号和推理停止候选。训练语料拼接时应在文档边界保留 EOS 或等价边界标记；否则模型可能把一篇文档结尾和下一篇开头当成真实连续语境。高吞吐预训练常将多个短样本 pack 到同一长度桶，此时还要用 block-diagonal 或 segment-aware mask 防止跨样本注意力泄漏。

不要机械地把所有截断样本末尾都补 EOS。若原始样本因长度上限被截断，伪造 EOS 会教会模型在中途结束；应区分自然结束、窗口切分和补齐 token。

## 五、最小训练循环的语义

```python
optimizer.zero_grad(set_to_none=True)
logits = model(input_ids, attention_mask=attention_mask)
loss = cross_entropy(logits[:, :-1], labels[:, 1:], ignore_index=-100)
loss.backward()
optimizer.step()
```

真实框架可能在模型内部 shift labels，AMP 下还会有 loss scaling，分布式下会做梯度同步；但语义不变。`zero_grad`、`backward`、`step` 缺任何一个都不是“训练慢”，而是根本没有正确更新。

## 六、面试高频问答

### Q1：causal mask 和 label shift 各自解决什么？

causal mask 约束前向可见性，保证位置不能使用未来 token；label shift 定义当前位置要预测哪个目标。前者防信息泄漏，后者定义监督对齐，二者缺一不可。

### Q2：为什么训练可并行而 decode 不能？

训练的完整真实序列已知，所有位置可在 mask 约束下并行计算；decode 的下一 token 未知，必须先生成并追加，形成真实的数据依赖。

### Q3：如何验证 labels 没有错位？

固定一个短样本，逐位置打印 token、logit 的 argmax 和 label；再做单 batch 过拟合。若格式正确，少量样本应能快速被记住；否则先查 tokenizer、shift、ignore index 和 EOS。

## 七、面试回答模板

> 自回归训练中我会把可见性和监督分开：causal/padding mask 决定 token 能看见什么，labels 与 loss mask 决定哪些位置参与交叉熵。Teacher Forcing 让完整真实前缀已知，所以训练能并行；推理则把模型输出回填，必须顺序生成，这也带来 exposure bias。排查时我会先做短样本逐 token 对齐和单 batch 过拟合，防止 shift、EOS 或模板掩码错误被误判为模型能力问题。
