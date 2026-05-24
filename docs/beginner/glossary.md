# 大模型术语速查表

> 大模型领域缩写和黑话特别多。这份速查表帮你快速扫盲，每个词配一句大白话解释。看文章遇到生词随时回来查。

## 基础概念

| 术语 | 大白话解释 |
| --- | --- |
| **LLM** | 大语言模型，海量文本训练出的超大神经网络，会「文字接龙」 |
| **Token** | 模型处理文字的最小单位，约等于字/词的碎片；计费按 token 算 |
| **Tokenizer** | 分词器，把文字切成 token 的工具，详见 [Tokenizer](/basics/tokenizer) |
| **参数（Parameter）** | 模型内部可学习的「旋钮」，7B = 70 亿个 |
| **Embedding（嵌入）** | 把文字/图片变成一串数字（向量），让计算机能算「语义相似度」 |
| **向量（Vector）** | 一串数字，代表某个对象在「语义空间」里的坐标 |
| **上下文窗口（Context Window）** | 模型一次能处理的最大 token 数，如 128K |
| **自回归（Autoregressive）** | 逐个生成 token，每次把已生成的内容再喂回去预测下一个 |

## 架构相关

| 术语 | 大白话解释 |
| --- | --- |
| **Transformer** | 几乎所有大模型的底层架构，详见 [Transformer](/basics/transformer) |
| **Attention（注意力）** | 让模型在理解每个词时「关注」相关的其他词 |
| **MHA / MQA / GQA / MLA** | 注意力的不同变体，主要为省显存，详见 [Attention](/basics/attention) |
| **位置编码（RoPE 等）** | 告诉模型每个词在句子里的位置 |
| **MoE（混合专家）** | 模型有很多「专家」，每次只用其中几个，省算力，详见 [MoE](/basics/moe) |
| **Encoder / Decoder** | 编码器（擅理解，如 BERT）/ 解码器（擅生成，如 GPT） |

## 训练与微调

| 术语 | 大白话解释 |
| --- | --- |
| **预训练（Pre-training）** | 在海量通用文本上「博览群书」，最烧钱的一步 |
| **微调（Fine-tuning）** | 在预训练模型上用少量数据「专项训练」，适配具体任务 |
| **SFT** | 监督微调，用「问-答」对教模型学会听指令 |
| **RLHF** | 基于人类反馈的强化学习，让模型说人类更喜欢的话，详见 [RLHF](/finetuning/rlhf) |
| **DPO** | 比 RLHF 更简单的对齐方法 |
| **LoRA / QLoRA** | 高效微调技术，普通显卡也能微调大模型，详见 [LoRA](/finetuning/lora) |
| **对齐（Alignment）** | 让模型行为符合人类价值（有用、诚实、无害） |
| **蒸馏（Distillation）** | 用大模型当老师，教出一个能力接近的小模型 |
| **Base / Chat 模型** | Base 只会续写；Chat 会对话（经过 SFT/对齐） |

## 应用开发

| 术语 | 大白话解释 |
| --- | --- |
| **Prompt（提示词）** | 你给模型的输入指令 |
| **Prompt Engineering** | 设计提示词的技巧，详见 [Prompt 工程](/prompt/prompt-engineering) |
| **CoT（思维链）** | 让模型「一步步想」再回答，提升推理 |
| **Few-shot** | 在提示里给几个例子引导模型 |
| **RAG（检索增强）** | 先查资料再让模型回答，减少幻觉，详见 [RAG](/rag/rag-basics) |
| **向量数据库** | 专门存 Embedding、做相似度检索的数据库 |
| **Agent（智能体）** | 能自己规划、调用工具、完成任务的 AI，详见 [Agent](/agent/agent-basics) |
| **Function Calling** | 让模型「请求调用」外部函数/工具 |
| **MCP** | 一种标准化协议，统一大模型连接外部工具/数据的方式 |
| **幻觉（Hallucination）** | 模型一本正经地编造错误内容 |

## 推理与部署

| 术语 | 大白话解释 |
| --- | --- |
| **推理（Inference）** | 模型「使用阶段」，即生成回答的过程（对应训练阶段） |
| **KV Cache** | 缓存历史计算结果加速生成，但占显存 |
| **量化（Quantization）** | 把模型权重用更少比特表示，省显存、提速，略掉点 |
| **vLLM** | 最流行的高性能推理框架 |
| **TTFT / TPOT** | 首 token 延迟 / 每个后续 token 的延迟 |
| **吞吐（Throughput）** | 每秒能处理多少 token / 请求 |
| **FlashAttention** | 一种又快又省显存的注意力计算方法 |

## 评估与指标

| 术语 | 大白话解释 |
| --- | --- |
| **Benchmark（基准）** | 标准化考试题集，用来给模型打分，详见 [评测基准](/evaluation/benchmarks) |
| **MMLU / C-Eval** | 知识类基准（英文 / 中文） |
| **GSM8K / HumanEval** | 数学 / 代码能力基准 |
| **困惑度（Perplexity）** | 衡量语言模型预测能力，越低越好 |
| **Chatbot Arena** | 真实用户盲评模型的权威排行榜 |
| **数据污染** | 测试题泄漏进训练数据，导致分数虚高 |

## 前沿热词

| 术语 | 大白话解释 |
| --- | --- |
| **推理模型 / 慢思考** | 回答前先长篇「思考」的模型，如 o1、DeepSeek-R1，详见 [推理模型](/advanced/reasoning-models) |
| **Test-time Compute** | 推理时多花算力（多想一会儿）换取更强能力 |
| **涌现能力** | 模型规模够大后「突然」出现的能力 |
| **Scaling Law（缩放定律）** | 模型越大、数据越多，效果可预测地变好 |
| **多模态** | 能同时处理文字、图片、音频等，详见 [多模态](/multimodal/multimodal) |
| **Mamba / SSM** | 一种挑战 Transformer 的新架构，详见 [状态空间模型](/advanced/state-space-models) |

> 没找到的术语？欢迎到 [GitHub](https://github.com/Meko1/llm-interview-guide) 提 Issue 补充。
