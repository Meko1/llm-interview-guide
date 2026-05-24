---
layout: home

hero:
  name: "LLMGuide"
  text: "大模型面试指南"
  tagline: 系统整理大模型八股文与高频面试题，覆盖大模型基础、Transformer、预训练、微调、RLHF、Prompt、RAG、Agent、推理优化与部署、评估与多模态。
  image:
    src: /logo.svg
    alt: LLMGuide
  actions:
    - theme: brand
      text: 开始阅读
      link: /basics/overview
    - theme: alt
      text: 零基础入门
      link: /beginner/getting-started
    - theme: alt
      text: 高频面试题速记
      link: /interview/high-frequency
    - theme: alt
      text: 在 GitHub 上查看
      link: https://github.com/Meko1/llm-interview-guide

features:
  - icon: 🌱
    title: 新手入门
    details: 零基础导引、术语速查表、必备数学基础。完全没接触过 AI 也能找到清晰起点，先上手再深入。
    link: /beginner/getting-started
  - icon: 🧠
    title: 大模型基础
    details: Transformer 架构、Attention 及其变体、位置编码（RoPE/ALiBi）、Tokenizer 与分词，把底层原理一次讲透。
    link: /basics/transformer
  - icon: 🏋️
    title: 训练与微调
    details: 预训练目标与数据、缩放定律与涌现能力、SFT/PEFT、LoRA/QLoRA、RLHF/DPO 对齐，覆盖训练全链路。
    link: /pretraining/pretrain
  - icon: ✍️
    title: Prompt 工程
    details: Zero-shot / Few-shot、CoT、ReAct、Prompt 注入与防护，掌握让模型"听话"的核心技巧。
    link: /prompt/prompt-engineering
  - icon: 📚
    title: RAG 检索增强
    details: 从切分、Embedding、向量检索到重排与生成，再到多路召回、查询改写等进阶优化策略。
    link: /rag/rag-basics
  - icon: 🤖
    title: Agent 智能体
    details: Agent 设计范式、规划与记忆、Function Calling、MCP 协议、多 Agent 协作，看懂智能体落地。
    link: /agent/agent-basics
  - icon: 🚀
    title: 推理优化与部署
    details: KV Cache、量化（GPTQ/AWQ）、FlashAttention、vLLM、投机解码、并行策略，搞定工程化落地。
    link: /inference/inference-optimization
  - icon: 📏
    title: 模型评估
    details: 困惑度、BLEU/ROUGE、人评与 LLM-as-a-Judge、幻觉成因与缓解，建立科学的评测体系。
    link: /evaluation/evaluation
  - icon: 🖼️
    title: 多模态与经典模型
    details: CLIP、ViT、多模态对齐与 LLaVA 架构，以及 GPT/LLaMA/BERT/Qwen/DeepSeek（MLA/GRPO）等经典模型盘点。
    link: /multimodal/multimodal
  - icon: 🛠️
    title: 工程实战
    details: LangChain/LlamaIndex、流式输出、Function Calling、结构化输出、服务化与成本控制，把模型做成可上线的服务。
    link: /engineering/langchain
  - icon: 🎯
    title: 面试专题
    details: 高频面试题速记、分岗位面试真题、系统化学习路线、精选学习资源，面试前快速过一遍。
    link: /interview/high-frequency
  - icon: 🔬
    title: 资深深入 & 前沿
    details: FlashAttention、Mamba/SSM、训练优化器与稳定性、推理模型与慢思考、大模型安全，给进阶开发者的深水区。
    link: /advanced/flash-attention
---

## 📊 覆盖一览

<div class="stats-row">

| 📚 内容 | 🧩 板块 | ⭐ 旗舰深度长文 | 🎯 面试追问 |
| :---: | :---: | :---: | :---: |
| **58+** 篇 | **14** 大板块 | **11** 篇 | **数百** 条 |

</div>

> 从「新手入门」到「资深前沿」，覆盖 大模型基础 · 训练微调 · Prompt/RAG/Agent · 推理部署 · 工程实战 · 评估 · 多模态 · 前沿专题 · 面试题库 全链路。

## 🔥 必看

- **[大模型零基础入门](/beginner/getting-started)**（🌱新手必看）：完全没接触过 AI？从这里开始，配 [术语速查表](/beginner/glossary) 和 [必备数学基础](/beginner/math-basics)。
- **[高频面试题速记](/interview/high-frequency)**（⭐网站核心）：全站核心考点浓缩成一问一答速查卡，面试前快速过一遍。
- **[分岗位面试真题](/interview/real-questions)**：按算法/应用/工程岗 + 场景设计 + 手撕题分类的真题库。
- **[大模型学习路线](/interview/learning-path)**：从理论地基到 RAG、Agent、微调部署，一条清晰的进阶路径。
- **[Transformer 架构详解](/basics/transformer)**：从 Self-Attention 到 MHA/MQA/GQA/MLA、RMSNorm、SwiGLU，面试必考底层原理。
- **[微调与对齐](/finetuning/finetuning)**：SFT、LoRA/QLoRA、RLHF/DPO 一文打通，区分清楚"训练范式"和"对齐方法"。
- **[RAG 与 Agent](/rag/rag-basics)**：当下大模型应用开发最热门的两大方向，覆盖原理、流程与高频考点。
- **[推理优化与部署](/inference/inference-optimization)**：量化、KV Cache、PagedAttention、投机解码……应对中大厂工程化面试趋势。
- **[DeepSeek 专题](/models/deepseek)**：MLA、DeepSeekMoE、GRPO、R1 训练流程，当下最热门的前沿考点。
- **[推理模型与慢思考](/advanced/reasoning-models)**：o1/R1、long CoT、test-time compute，理解「会慢慢想」的新范式。

## 🌟 学习路线建议

1. 先看 [大模型核心概念总览](/basics/overview) 建立全局认知；
2. 打牢 [Transformer](/basics/transformer)、[Attention](/basics/attention)、[归一化与激活](/basics/normalization) 等基础原理；
3. 理解 [预训练](/pretraining/pretrain) → [分布式训练](/pretraining/distributed-training) → [微调/对齐](/finetuning/finetuning) 的完整训练链路；
4. 掌握应用开发核心：[Prompt](/prompt/prompt-engineering)、[RAG](/rag/rag-basics)、[Agent](/agent/agent-basics)；
5. 补齐工程能力：[推理优化与部署](/inference/inference-optimization)、[工程实战](/engineering/langchain)、[评估](/evaluation/evaluation)。

> 完整路线见 [大模型学习路线](/interview/learning-path)，资源清单见 [学习资源汇总](/interview/resources)。

> 本项目仅用于学习交流，内容持续更新维护。欢迎在 [GitHub](https://github.com/Meko1/llm-interview-guide) 提 Issue / PR 一起完善。
