# 经典模型盘点

> 了解代表性模型的设计取舍，能帮你在面试中横向对比、举一反三。

## BERT（2018，Google）

- **架构**：Encoder-only，双向注意力。
- **训练目标**：MLM（掩码语言建模）+ NSP（下一句预测）。
- **定位**：擅长理解类任务（分类、NER、检索），不能直接生成。开启了「预训练 + 微调」范式。

## GPT 系列（OpenAI）

- **架构**：Decoder-only，自回归（CLM）。
- **演进**：GPT-2 验证规模化生成；GPT-3（175B）展示 Few-shot 上下文学习；InstructGPT 引入 RLHF 对齐；ChatGPT 引爆应用；GPT-4 多模态、能力大幅提升。
- **意义**：确立了 Decoder-only + 自回归 + 对齐 的主流路线。

## T5（2019，Google）

- **架构**：Encoder-Decoder。
- **思想**：「Text-to-Text」，把所有 NLP 任务统一成「文本进、文本出」，用 span corruption 预训练。

## LLaMA 系列（Meta，开源基石）

- **架构**：Decoder-only，多项现代化改进：**RMSNorm + Pre-Norm、SwiGLU 激活、RoPE 位置编码**；LLaMA 2/3 用 **GQA**。
- **意义**：高质量开源权重，催生了庞大的开源生态（Alpaca、Vicuna 等微调模型），是学术与工业界事实上的开源基座。

## 国产代表

- **Qwen（通义千问，阿里）**：开源全家桶，中文强，覆盖多尺寸 + 多模态（Qwen-VL）+ Coder/Math 等专用模型，社区生态活跃。
- **DeepSeek**：以高性价比著称。**DeepSeek-V3** 用 MoE + **MLA（多头潜在注意力）** 大幅降本；**DeepSeek-R1** 通过大规模强化学习（GRPO）激发强推理能力，是推理模型的代表。
- **GLM（智谱）**、**Baichuan**、**Yi（零一万物）** 等也是重要的中文开源力量。

## 架构演进趋势小结

| 维度 | 早期 | 现代主流 |
| --- | --- | --- |
| 归一化 | Post-Norm + LayerNorm | Pre-Norm + RMSNorm |
| 激活函数 | ReLU / GELU | SwiGLU |
| 位置编码 | 绝对/正弦 | RoPE（+ 长上下文扩展） |
| 注意力 | MHA | GQA / MLA |
| 规模扩展 | Dense 堆参数 | MoE（稀疏激活） |

## 推理模型（Reasoning Models）

近期热点是「慢思考」推理模型（OpenAI o 系列、DeepSeek-R1 等），通过强化学习训练模型生成长链思维（long CoT），在数学、代码、逻辑等任务上大幅提升。核心是**用更多推理时计算（test-time compute）换取更强的推理能力**，并能展现自我反思、回溯等行为。详见 [推理模型与慢思考](/advanced/reasoning-models)。

## 高频追问

**Q：BERT 和 GPT 为什么走向不同？** BERT 双向、为理解优化，难以自回归生成；GPT 单向、为生成优化，且生成式范式更易统一各种任务和规模化，最终成为大模型主流。

**Q：LLaMA 做了哪些"现代化"改造？** RMSNorm、Pre-Norm、SwiGLU、RoPE、（2/3 代）GQA——这些几乎成了当代 Decoder-only 模型的标配组合，值得记牢。

**Q：MoE 模型为什么省成本？** 总参数大但每个 token 只激活少数专家，单次推理计算量远小于同等总参数的 Dense 模型，实现「大容量、低单次成本」。
