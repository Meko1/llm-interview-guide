---
title: 自回归训练：Teacher Forcing 与标签构造
description: >-
  从 token 到 labels、可见性和有效监督位置，检查 Teacher Forcing、单次 shift、EOS 与样本拼接的训练边界。
level: L1
roles:
  - 在校生
  - 算法研究
  - 应用开发
classification: inferred
---
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

$\mathcal V$ 是有效监督位置集合，$N=|\mathcal V|$。图中使用提前对齐的标签；另一种约定是 `labels = input_ids`，由损失函数比较当前位置与后一位置。二者只能选一种，不能对已对齐标签再 shift。`-100` 是损失忽略值，不是合法输入 token ID。

## 二、Teacher Forcing 为什么训练可并行

训练时位置 `t` 的前缀使用**真实 token**，不是模型上一步采样结果。这称为 Teacher Forcing。配合 causal mask，一次前向即可并行得到全部位置的 logits：可见性受限于下三角 mask，计算本身仍由矩阵乘并行完成。

推理时下一 token 有数据依赖，普通 decode 逐步生成。投机解码等方案可以批量验证候选，但不消除目标模型的因果分解。这就是同一个概率分解在训练和推理中呈现不同执行形态的原因。

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

EOS 或轮次结束标记提供停止信号；聊天模板可能另用 EOT，两者不能任意替换。连续文本预训练可以选择让拼接文档相互可见；若 SFT 或评测要求独立样本，则必须隔离跨样本注意力，并处理边界监督与 position IDs。插入 EOS 只标记边界，不会自动隔断 attention。

不要机械地把所有截断样本末尾都补 EOS。若原始样本因长度上限被截断，伪造 EOS 会教会模型在中途结束；应区分自然结束、窗口切分和补齐 token。

## 五、最小训练循环的语义

以下是 PyTorch 接口片段，不是完整训练脚本：已构建 `model` 与 `optimizer`；假设模型返回 `[B,T,V]` 的原始 logits、内部没有算 loss，且 `labels` 与 `input_ids` 等长但尚未 shift，至少有一个有效目标。若用 Hugging Face 模型对象，需取 `.logits`；若直接传 `labels` 使用其内部 loss，则不要再做下面的 shift。

```python
optimizer.zero_grad(set_to_none=True)
logits = model(input_ids, attention_mask=attention_mask)
shift_logits = logits[:, :-1, :].contiguous()
shift_labels = labels[:, 1:].contiguous()
loss = torch.nn.functional.cross_entropy(
    shift_logits.reshape(-1, shift_logits.size(-1)),
    shift_labels.reshape(-1),
    ignore_index=-100,
)
loss.backward()
optimizer.step()
```

`cross_entropy` 的类别轴必须正确：不能把 `[B,T,V]` 原样传入却让接口把 T 当类别数。AMP 是否需要 scaler 取决于精度；梯度累积则把 `zero_grad` 与 `step` 放在整个累积窗口的边界。全忽略标签的 batch 应跳过或采用明确的零损失策略，不能把 NaN 当作模型不稳定。

<details>
<summary>自测：用户问题不计 loss，为什么模型还能使用它回答？</summary>

`ignore_index` 只去掉该位置作为预测目标的直接损失，不删除输入，也不屏蔽 attention。用户输入的表示仍影响回答位置，回答损失仍可通过这个上下文路径反传。打印「输入位置、可见 key、目标位置、是否计 loss」四列能发现两类 mask 被混用。

</details>

## 六、面试高频问答

### Q1：causal mask 和 label shift 各自解决什么？

causal mask 约束前向可见性，保证位置不能使用未来 token；label shift 定义当前位置要预测哪个目标。前者防信息泄漏，后者定义监督对齐，二者缺一不可。

### Q2：为什么训练可并行而 decode 不能？

训练的完整真实序列已知，所有位置可在 mask 约束下并行计算；decode 的下一 token 未知，必须先生成并追加，形成真实的数据依赖。

### Q3：如何验证 labels 没有错位？

固定一个短样本，逐位置打印 token、logit 的 argmax 和 label；再做单 batch 过拟合。若格式正确，少量样本应能快速被记住；否则先查 tokenizer、shift、ignore index 和 EOS。

## 七、面试回答模板

> 自回归训练中我会把可见性和监督分开：causal/padding mask 决定 token 能看见什么，labels 与 loss mask 决定哪些位置参与交叉熵。Teacher Forcing 让完整真实前缀已知，所以训练能并行；推理则把模型输出回填，必须顺序生成，这也带来 exposure bias。排查时我会先做短样本逐 token 对齐和单 batch 过拟合，防止 shift、EOS 或模板掩码错误被误判为模型能力问题。

实现参考：[Transformers 因果 LM 损失](https://github.com/huggingface/transformers/blob/main/src/transformers/loss/loss_utils.py)、[PyTorch CrossEntropyLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html)。不同版本的 shift 写法可不同，核对位置语义比复制切片更可靠。
