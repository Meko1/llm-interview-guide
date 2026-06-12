# 经典模型盘点与架构谱系

> 「盘点一下你了解的大模型」看似开放题，实际考的是**架构谱系认知**：三条技术路线怎么分化、为什么 Decoder-only 赢了、每个代表模型解决了什么问题。按时间背模型名字是低分答案，按「路线 → 动机 → 取舍」组织才是高分答案。

## 三条架构路线的分化

2017 年 Transformer 诞生后，预训练模型沿三条路线分化：

```
                      Transformer (2017)
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Encoder-only        Decoder-only        Encoder-Decoder
   (双向理解)           (自回归生成)          (序列到序列)
        │                   │                   │
   BERT / RoBERTa      GPT 系列 / LLaMA      T5 / BART
   Embedding 模型      Qwen / DeepSeek       早期翻译/摘要
   Rerank 模型         几乎所有现代 LLM       Whisper(语音)
```

| 路线 | 注意力 | 预训练目标 | 擅长 | 现状 |
| --- | --- | --- | --- | --- |
| Encoder-only | 双向 | MLM 完形填空 | 理解、判别、向量表示 | 退出生成赛道，**统治 Embedding/Rerank** |
| Decoder-only | 单向因果 | CLM 预测下一词 | 生成、对话、推理 | **绝对主流** |
| Encoder-Decoder | 编码双向+解码单向 | Span 还原等 | 翻译、摘要等输入输出分明的任务 | 小众（多模态编码器中仍有身影） |

**为什么 Decoder-only 赢了？** 训练目标最简单统一（每个 token 都是监督信号、数据利用率高）、生成式接口能统一一切任务、自回归天然适配 KV Cache 增量推理、规模化经验最成熟、in-context learning 能力随规模涌现。

## BERT：理解路线的巅峰与转身

- **架构**：Encoder-only，双向注意力；**训练目标**：MLM（随机 mask 15% token 做完形填空）+ NSP（后被证明作用不大，RoBERTa 移除）。
- **历史地位**：确立「预训练 + 微调」范式，横扫 2018-2020 的理解类榜单。
- **为什么式微**：双向结构不能自回归生成；每个下游任务都要单独微调，而 GPT-3 证明「一个模型 + 提示」可以通吃。
- **但没有消失**：今天的 **Embedding 模型（BGE、GTE、E5）和 Rerank 模型几乎全是 BERT 系**——理解和表示任务上双向注意力依然占优。RAG 系统里你每天都在用 BERT 的后代，见 [Embedding 与向量数据库](/rag/embedding-vectordb)。

## GPT 系列：一条路线的完整进化史

| 模型 | 年份 | 关键跨越 |
| --- | --- | --- |
| GPT-1 | 2018 | 验证「生成式预训练 + 判别微调」可行 |
| GPT-2 (1.5B) | 2019 | 证明纯预训练模型能 zero-shot 做多任务，「语言模型即多任务学习器」 |
| GPT-3 (175B) | 2020 | **In-context learning**：不更新参数、给几个示例就能学会新任务，开启提示工程时代 |
| Codex | 2021 | 代码预训练，证明代码数据的价值，催生 Copilot |
| InstructGPT | 2022 | **RLHF 对齐**：1.3B 对齐后的模型人类偏好胜过 175B 原始模型——「对齐比规模便宜」 |
| ChatGPT | 2022 | 对话产品化引爆全球 |
| GPT-4 | 2023 | 多模态输入、能力大跨越（业界普遍认为是 MoE 架构） |
| GPT-4o | 2024 | 端到端全模态（文本/语音/视觉统一建模），实时语音交互 |
| o1 / o3 | 2024-25 | **推理路线**：RL + long CoT，用推理时计算换推理能力 |

> 面试金句：GPT 系列每一代回答一个问题——GPT-2「预训练能学到多任务能力吗」、GPT-3「规模能换来什么」（ICL）、InstructGPT「怎么让能力可用」（对齐）、o1「预训练撞墙后还能怎么涨」（test-time scaling）。

## T5 与 Encoder-Decoder 路线

T5（2019）把所有 NLP 任务统一成「文本进、文本出」，用 span corruption（挖掉连续片段让解码器还原）预训练，是「任务统一化」思想的先驱——但统一接口这件事最终被 Decoder-only 用更简单的方式做到了。Encoder-Decoder 如今主要活在翻译、Whisper 语音识别以及部分多模态结构中。

## 开源主线：LLaMA、Qwen 与 Mistral

**LLaMA 与 Qwen** 是开源最重要的两条主线（标准配方、逐代演进、对比选型已独立成篇，见 [LLaMA 与 Qwen 架构演进](/models/llama-qwen)）。一句话版本：LLaMA 确立了「Pre-RMSNorm + SwiGLU + RoPE + GQA」的开源标准架构；Qwen 代表中文/多语言开源最高水平并率先走向「思考/非思考」混合模式。

**Mistral / Mixtral（法国 Mistral AI）**：

- Mistral 7B（2023）：滑动窗口注意力（SWA）+ GQA，以 7B 击败 LLaMA 2 13B，证明「小而精」路线。
- **Mixtral 8x7B（2023.12）**：第一个有影响力的**开源 MoE**（8 专家选 2，总参 47B 激活 13B），把 MoE 从传闻（GPT-4）变成人人可验证的开源现实，直接推动了后来 DeepSeek、Qwen 的 MoE 路线。

**DeepSeek**：以 MLA + MoE + FP8 的极致工程降本和 R1 推理训练成为 2025 最大变量，独立成篇见 [DeepSeek 专题](/models/deepseek)。

## 国内模型生态速览

| 厂商/模型 | 特点 |
| --- | --- |
| Qwen（阿里） | 开源全家桶事实标杆：全尺寸 + 多模态 + Coder/Math，生态最完整 |
| DeepSeek | 极致性价比 + 开源旗舰推理模型，技术报告影响全行业 |
| GLM（智谱） | 早期走自回归填空混合目标路线，国内最早开源的玩家之一 |
| Kimi（月之暗面） | 以长上下文出圈，K 系列推理模型开源 |
| 豆包（字节） | 产品渗透率高，模型走闭源 API 路线 |
| MiniMax | MoE + 线性注意力混合架构探索（超长上下文） |
| Baichuan / Yi | 2023 开源潮代表，后转向行业/闭源 |

## 闭源三巨头一句话定位

- **GPT（OpenAI）**：路线开创者，从规模 → 对齐 → 多模态 → 推理每一步都定义了行业议程。
- **Claude（Anthropic）**：以对齐研究（Constitutional AI）起家，长上下文与代码/Agent 能力著称。
- **Gemini（Google）**：原生多模态训练 + 超长上下文（百万级 token），与搜索/办公生态深度绑定。

## 架构演进趋势小结

| 维度 | 早期 | 现代主流 |
| --- | --- | --- |
| 归一化 | Post-Norm + LayerNorm | Pre-Norm + RMSNorm（+ QK-Norm） |
| 激活函数 | ReLU / GELU | SwiGLU |
| 位置编码 | 绝对/正弦 | RoPE（+ NTK/YaRN 长上下文扩展） |
| 注意力 | MHA | GQA / MLA |
| 规模扩展 | Dense 堆参数 | **MoE 稀疏激活** |
| 能力增长 | 预训练堆数据 | 后训练 RL + 推理时计算 |

「慢思考」推理模型（o 系列、R1、Qwen3 思考模式）是当前能力增长的主轴，详见 [推理模型与慢思考](/advanced/reasoning-models)。

## 面试怎么答「盘点模型」类问题

1. **先给框架**：三条架构路线 → Decoder-only 胜出原因（30 秒）。
2. **再给主线**：GPT 系列的四个里程碑（ICL、RLHF、多模态、推理）+ 开源双雄 LLaMA/Qwen + MoE 转折（Mixtral→DeepSeek）。
3. **落到当下**：推理模型与 test-time scaling 是现在进行时。
4. **加分项**：结合自己用过的模型谈取舍（如「业务上我们选 Qwen 因为中文 token 效率和 Apache 协议」）。

## 高频追问

**Q：BERT 和 GPT 为什么走向不同的命运？**
BERT 双向、为理解优化，不能自回归生成，且每个任务要单独微调；GPT 单向、为生成优化，生成式接口能统一一切任务，规模化后涌现 ICL，免微调通吃。范式之争的本质是「N 个专用模型 vs 一个通用模型」，后者胜出。

**Q：Encoder-Decoder 理论上兼顾理解和生成，为什么没成为 LLM 主流？**
工程与扩展性输了：两套参数结构更复杂、KV Cache 与增量推理优化不如纯 Decoder 顺畅、训练目标（span corruption）的数据利用率不如 CLM、规模化经验积累也少。能力上 Decoder-only 足够大之后理解并不差。

**Q：GPT-2 到 GPT-3 最重要的跨越是什么？**
不是参数大 100 倍本身，而是**涌现出 in-context learning**——模型能从 prompt 里的几个示例「现场学会」新任务，不需要梯度更新。这改变了使用范式：从「微调模型」变成「写提示」。

**Q：为什么 Embedding/Rerank 模型至今还是 BERT 架构？**
表示任务需要看到全句的双向信息，双向注意力天然优于因果注意力；模型小、推理量大，BERT 尺寸（百 M 级）性价比合适。近年也有用 LLM 做 Embedding 的探索（如取最后 token 表示），但工业主流仍是双向编码器。

**Q：Mixtral 的意义是什么？**
第一个被广泛使用的开源 MoE，证明了「47B 总参、13B 激活、对标 70B Dense」的路线可行，把 MoE 从 GPT-4 传闻变成可复现的工程事实，直接影响了 DeepSeek-V2/V3、Qwen-MoE 等后续设计。

**Q：开源和闭源的差距现在怎么看？**
基准上差距已大幅收窄（DeepSeek/Qwen 旗舰在多数榜单进入第一梯队），但闭源在多模态融合、超长上下文、工程化（稳定性/安全）上仍有优势。对企业落地，开源的可控性（私有化、微调、成本）往往比榜单几分差距更重要。
