# 分岗位面试真题

> [高频面试题速记](/interview/high-frequency) 是考点速查卡；本文按**岗位方向**整理更接近真实面试的题目，包括开放题、场景设计题和手撕题，并标注答案所在章节。建议先自测、答不上来再点链接。

## 怎么用这份题库？

- 按你的目标岗位（算法 / 应用 / 工程）重点刷对应板块。
- 先尝试自己组织答案，再对照链接的详解查漏。
- 开放题没有标准答案，重点练「讲清思路 + 体现权衡」。

---

## 大模型算法 / 研究岗

偏模型结构、训练、微调、对齐的原理深挖。

1. 手推 Self-Attention 公式，并解释为什么除以 √dₖ。→ [Attention](/basics/attention)
2. MHA、MQA、GQA、MLA 的区别？分别解决什么问题？→ [Attention](/basics/attention)
3. 为什么现代大模型用 RMSNorm + Pre-Norm + SwiGLU？各自的好处？→ [归一化与激活](/basics/normalization)
4. RoPE 为什么能表达相对位置？如何扩展到长上下文？→ [位置编码](/basics/position-encoding)
5. MoE 的负载均衡问题怎么解决？DeepSeekMoE 有何创新？→ [MoE](/basics/moe) / [DeepSeek](/models/deepseek)
6. LoRA 为什么有效（低秩假设）？r 和 α 怎么设？为什么不增加推理延迟？→ [LoRA](/finetuning/lora)
7. RLHF 完整流程？PPO 为什么要 4 个模型？DPO 如何简化？→ [RLHF/DPO](/finetuning/rlhf)
8. GRPO 相比 PPO 的改进？为什么适合推理模型训练？→ [DeepSeek](/models/deepseek) / [推理模型](/advanced/reasoning-models)
9. Adam 和 AdamW 的区别？为什么需要学习率 warmup？→ [训练深入](/advanced/training-internals)
10. FlashAttention 是近似算法吗？为什么又快又省显存？→ [FlashAttention 深入](/advanced/flash-attention)
11. Scaling Law 是什么？Chinchilla 的「20:1」怎么来的？→ [缩放定律](/pretraining/scaling-law)
12. 推理模型为什么强？纯 RL（R1-Zero）说明了什么？→ [推理模型](/advanced/reasoning-models)
13. Mamba/SSM 相比 Transformer 的优劣？为什么用混合架构？→ [状态空间模型](/advanced/state-space-models)
14. 灾难性遗忘是什么？怎么缓解？→ [微调范式](/finetuning/finetuning)

---

## 大模型应用开发岗

偏 Prompt、RAG、Agent、落地工程。

1. RAG 的完整流程？离线和在线各做什么？→ [RAG 基础](/rag/rag-basics)
2. RAG 召回不准，你会从哪些环节优化？→ [RAG 进阶](/rag/rag-advanced)
3. 为什么用「向量召回 + Rerank」两段式？bi-encoder 和 cross-encoder 区别？→ [Embedding 与向量库](/rag/embedding-vectordb)
4. 混合检索（向量 + BM25）为什么有用？怎么融合？→ [RAG 进阶](/rag/rag-advanced)
5. chunk 大小怎么定？为什么要 overlap？父子分块解决什么？→ [RAG 基础](/rag/rag-basics)
6. 向量数据库怎么选型？HNSW 和 IVF 的区别？→ [Embedding 与向量库](/rag/embedding-vectordb)
7. Agent 由哪些部分组成？ReAct 范式是什么？→ [Agent 基础](/agent/agent-basics)
8. Function Calling 的流程？模型会自己执行函数吗？→ [Function Calling 与 MCP](/agent/function-calling-mcp)
9. MCP 是什么？解决了什么问题？→ [Function Calling 与 MCP](/agent/function-calling-mcp)
10. 怎么防止 Agent 陷入死循环 / 跑偏？→ [多 Agent](/agent/multi-agent)
11. 什么时候用单 Agent，什么时候用多 Agent？→ [多 Agent](/agent/multi-agent)
12. 怎么让模型稳定输出 JSON？→ [LLM 应用开发实战](/engineering/llm-app-dev)
13. 流式输出怎么实现？用什么协议？→ [LLM 应用开发实战](/engineering/llm-app-dev)
14. CoT、Few-shot 一定更好吗？什么时候用？→ [Prompt 工程](/prompt/prompt-engineering)
15. 微调、RAG、Prompt 三者怎么选？→ [微调范式](/finetuning/finetuning)

---

## 大模型工程 / 推理部署岗

偏推理优化、部署、性能、成本。

1. Prefill 和 Decode 阶段的区别？为什么 decode 是 memory-bound？→ [推理优化](/inference/inference-optimization)
2. KV Cache 是什么？为什么是长上下文瓶颈？怎么优化？→ [推理优化](/inference/inference-optimization) / [长上下文](/basics/long-context)
3. vLLM 的 PagedAttention 原理？连续批处理为什么能提吞吐？→ [推理优化](/inference/inference-optimization)
4. 量化方法有哪些（GPTQ/AWQ/GGUF）？分别适合什么场景？→ [推理优化](/inference/inference-optimization)
5. 投机解码为什么不掉精度？→ [推理优化](/inference/inference-optimization)
6. TTFT、TPOT、吞吐怎么权衡？如何降低 TTFT？→ [推理优化](/inference/inference-optimization)
7. 训练一个 7B 模型大概需要多少显存？怎么估算？→ [分布式训练](/pretraining/distributed-training)
8. DP、TP、PP 怎么选？ZeRO 三个阶段分别分片什么？→ [分布式训练](/pretraining/distributed-training)
9. 混合精度训练 FP16 和 BF16 怎么选？loss scaling 干嘛的？→ [训练深入](/advanced/training-internals)
10. 怎么降低大模型服务的成本？→ [LLM 应用开发实战](/engineering/llm-app-dev)
11. output token 为什么比 input token 贵？→ [推理优化](/inference/inference-optimization)

---

## 系统设计 / 场景题

考综合架构能力，没有标准答案，重在思路与权衡。

1. **设计一个企业知识库问答系统**：从文档接入、切分、Embedding 选型、检索、Rerank、Prompt、评估、增量更新到权限隔离。→ [AI 项目实战](/engineering/projects)
2. **设计一个支持 10 万用户的高并发大模型服务**：推理框架、批处理、限流降级、缓存、多副本、监控。→ [LLM 应用开发实战](/engineering/llm-app-dev)
3. **设计一个大模型私有化部署方案**：模型选型与量化、显卡选型与成本、推理框架、高可用、数据安全。
4. **设计一个 Text-to-SQL / ChatBI 系统**：Schema 检索、SQL 生成与纠错循环、安全、评估。→ [AI 项目实战](/engineering/projects)
5. **如何评估和监控一个上线的 RAG 系统？** 检索与生成分开评（RAGAS）、线上反馈、bad case 分析、持续迭代。
6. **客服场景下怎么降低幻觉、保证可信？** RAG 溯源 + Prompt 约束 + 拒答机制 + 人工兜底。→ [模型评估与幻觉](/evaluation/evaluation)

---

## 手撕 / 编码题

算法岗常考，准备时建议能手写核心逻辑。

1. 用 NumPy/PyTorch 实现 **Self-Attention**（含缩放、mask、softmax）。
2. 实现 **Multi-Head Attention** 的拆分与拼接。
3. 实现 **Softmax**（含数值稳定：减最大值）。
4. 实现 **LoRA** 的前向（`Wx + (α/r)·BAx`）。
5. 实现 **温度采样 / top-k / top-p（核采样）** 的解码逻辑。→ [解码与采样](/basics/decoding)
6. 实现 **交叉熵损失** 或一个简化的 **beam search**。
7. 给定 logits，实现带 **重复惩罚** 的采样。
8. 实现 **RoPE** 的旋转操作（进阶）。

> 准备建议：手撕题重在「能写出核心逻辑 + 讲清每步在干嘛」，先吃透 [Attention](/basics/attention) 和 [解码采样](/basics/decoding) 的公式。

## 软性 / 项目题

1. 介绍一个你做过的大模型项目，重点讲难点和你的决策。→ [AI 项目实战](/engineering/projects)
2. 你做的项目，效果是怎么评估的？提升了多少？
3. 遇到过最棘手的大模型问题是什么？怎么解决的？
4. 你怎么跟进大模型领域的最新进展？→ [学习资源汇总](/interview/resources)
5. 为什么从原岗位转向（或选择）大模型方向？

> 项目题的关键：**量化结果 + 体现工程权衡 + 展示持续学习**。别只罗列功能，要讲清「为什么这么做」。
