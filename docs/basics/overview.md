# 大模型核心概念总览

> 本文用最短的篇幅帮你建立对大语言模型（LLM）的整体认知，理清各知识模块之间的关系，方便后续逐章深入。

## 什么是大语言模型（LLM）？

大语言模型（Large Language Model，LLM）是指基于海量文本数据、使用自监督学习训练出来的、参数规模通常在十亿（1B）以上的神经网络语言模型。它们以 Transformer 为基础架构，核心能力是「预测下一个 token」（Next Token Prediction），并在足够大的规模下涌现出上下文学习、推理、指令遵循等能力。

代表性模型包括 GPT 系列、LLaMA 系列、Qwen、DeepSeek、Claude、Gemini 等。

## 一个 LLM 是怎样炼成的？

可以把大模型的生命周期拆成几个阶段，这也是面试时回答「大模型训练流程」类问题的主线：

1. **预训练（Pre-training）**：在万亿级 token 的通用语料上做自监督学习（通常是自回归的下一个 token 预测），让模型学到语言知识和世界知识。这一步最烧算力，产出的是「基座模型 / Base Model」。
2. **监督微调（SFT，Supervised Fine-Tuning）**：用「指令-回答」对（instruction-response）训练模型学会按人类期望的格式作答，产出「指令模型 / Chat 模型」。
3. **对齐（Alignment）**：通过 RLHF（基于人类反馈的强化学习）或 DPO 等方法，让模型输出更符合人类偏好（有用、诚实、无害）。
4. **推理与部署（Inference & Serving）**：通过量化、KV Cache、vLLM 等技术高效地把模型跑起来对外服务。

应用层面又分为两条主线：**Prompt 工程**（不改参数，靠提示词激发能力）、以及 **RAG + Agent**（给模型外挂知识库和工具）。

整个生命周期可以用一张图串起来：

```
                         ┌──────────────┐
  万亿 token 通用语料 ──▶│  预训练 CLM  │──▶ Base 模型（会续写，不会聊天）
                         └──────────────┘
                                │
            指令-回答对 ──▶ ┌────────┐
                            │  SFT   │──▶ Instruct/Chat 模型（会遵循指令）
                            └────────┘
                                │
         人类/AI 偏好数据 ─▶ ┌──────────────┐
                            │ 对齐 RLHF/DPO │──▶ 对齐模型（有用/诚实/无害）
                            └──────────────┘
                                │
                            ┌────────────────────────┐
                            │ 推理部署：量化/KV Cache │──▶ 对外服务
                            │  /vLLM/投机解码         │
                            └────────────────────────┘
        应用层：Prompt 工程 · RAG（外挂知识）· Agent（调用工具）
```

## 知识地图

| 模块 | 关键词 | 解决什么问题 |
| --- | --- | --- |
| 大模型基础 | Transformer、Attention、位置编码、Tokenizer | 模型「长什么样」、底层原理 |
| 预训练 | 自回归、缩放定律、涌现能力 | 知识从哪来 |
| 微调与对齐 | SFT、LoRA/QLoRA、RLHF、DPO | 如何让模型「听话」 |
| Prompt 工程 | Few-shot、CoT、ReAct | 不训练也能用好模型 |
| RAG | 切分、Embedding、向量检索、重排 | 让模型用上外部知识、减少幻觉 |
| Agent | 规划、记忆、Function Calling、MCP | 让模型会「使用工具、做事」 |
| 推理优化 | KV Cache、量化、vLLM、投机解码 | 跑得快、省显存 |
| 评估 | 困惑度、BLEU/ROUGE、LLM-as-Judge、幻觉 | 怎么衡量好坏 |
| 多模态 | CLIP、ViT、LLaVA | 看懂图像、音频 |

**基础部分建议的刷题顺序**：先用 [Transformer 架构详解](/basics/transformer) 建立整体骨架 → [Attention 与变体](/basics/attention)、[位置编码](/basics/position-encoding)、[归一化与激活](/basics/normalization) 逐个吃透组件 → [Tokenizer](/basics/tokenizer)、[嵌入层](/basics/embeddings) 补输入侧 → [从 Logits 到损失](/basics/logits-loss)（softmax 数值稳定/交叉熵/PPL）、[Mask 与 Padding](/basics/masks-padding)（因果掩码/左 padding/packing）补输出侧与实现细节——这两页覆盖的微观机制正是手撕题和「简历深挖」最爱考的盲区 → 最后用 [解码与采样](/basics/decoding)、[MoE](/basics/moe)、[长上下文](/basics/long-context) 收尾。

## 高频基础名词速查

- **Token**：模型处理文本的最小单位，介于「字」和「词」之间，由 Tokenizer 切分。一般 1 个汉字约 1～2 个 token，1 个英文单词约 1～1.3 个 token。
- **参数量（Parameters）**：模型中可学习权重的个数，如 7B 表示 70 亿参数。
- **上下文窗口（Context Window）**：模型一次能处理的最大 token 数，如 8K、128K、1M。
- **自回归（Autoregressive）**：逐个生成 token，每次把已生成的内容重新喂回模型预测下一个。
- **温度（Temperature）**：控制采样随机性，越高越发散，越低越确定。
- **涌现能力（Emergent Ability）**：模型规模超过某个阈值后突然出现的能力，如多步推理。
- **幻觉（Hallucination）**：模型一本正经地编造不存在或错误的事实。
- **对齐（Alignment）**：让模型行为符合人类价值与意图的过程。
- **困惑度（Perplexity, PPL）**：exp(平均每 token 损失)，直觉是「模型平均在几个候选里犹豫」，预训练核心监控指标（详见 [从 Logits 到损失](/basics/logits-loss)）。
- **因果掩码（Causal Mask）**：下三角注意力掩码，保证每个位置只能看到前文——decoder-only 模型「不作弊」的关键（详见 [Mask 与 Padding](/basics/masks-padding)）。

## 面试中如何组织回答？

遇到「介绍一下大模型」这类开放问题，建议按 **是什么 → 怎么训练 → 怎么用 → 有什么问题** 的逻辑展开，覆盖广度，也方便面试官顺着任一模块深挖。后续章节逐个击破高频考点。

## 高频追问

**Q：Base 模型和 Chat 模型有什么区别？** Base 模型只做了预训练，本质是「文本续写机」——给它一句话它会接着写，但不会按指令对话。Chat/Instruct 模型在 Base 基础上做了 SFT（+ 对齐），学会了遵循指令、按对话格式作答。直接拿 Base 聊天往往答非所问。

**Q：预训练为什么用「自监督」而不是「监督」学习？** 监督学习需要人工标注，无法覆盖万亿级语料。自监督用「预测下一个 token」这种从数据本身构造的目标，不需要人工标签，才能利用海量无标注文本，这是大模型能 scale 的前提。

**Q：7B 参数到底意味着什么？显存怎么估算？** 7B = 70 亿可学习权重。推理时 FP16 下每参数 2 字节，光权重就约 14GB；再加 KV Cache 和激活，实际显存更高。训练时还要加梯度和优化器状态，约为参数的 8 倍以上（详见 [分布式训练](/pretraining/distributed-training)）。

**Q：上下文窗口是不是越大越好？** 不完全是。更大的窗口能放下更多信息，但带来三个代价：KV Cache 显存随长度线性增长、注意力 O(n²) 计算变慢、以及「lost in the middle」（中间信息易被忽略）。有效利用长上下文比单纯堆长度更重要。

**Q：大模型的「知识」存在哪里？** 主要隐式编码在预训练学到的权重（尤其是 FFN）里，是有损压缩的结果。所以模型会记错长尾事实、知识有截止日期，需要 RAG 外挂实时/私有知识来补充。
