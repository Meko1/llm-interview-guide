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
      text: 在 GitHub 上查看
      link: https://github.com/Meko1/llm-interview-guide

features:
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
    details: CLIP、ViT、多模态对齐与 LLaVA 架构，以及 GPT/LLaMA/BERT/DeepSeek 等经典模型盘点。
    link: /multimodal/multimodal
---

## 🔥 必看

- **大模型核心概念总览**（⭐网站核心）：用最短篇幅建立对大模型的整体认知，理清各知识模块之间的关系。
- **Transformer 架构详解**：从 Self-Attention 到多头注意力、残差与 LayerNorm，面试必考底层原理。
- **微调与对齐**：SFT、LoRA/QLoRA、RLHF/DPO 一文打通，区分清楚"训练范式"和"对齐方法"。
- **RAG 与 Agent**：当下大模型应用开发最热门的两大方向，覆盖原理、流程与高频考点。
- **推理优化与部署**：量化、KV Cache、vLLM、投机解码……让你应对中大厂工程化面试趋势。

## 🌟 学习路线建议

1. 先看 [大模型核心概念总览](/basics/overview) 建立全局认知；
2. 打牢 [Transformer](/basics/transformer)、[Attention](/basics/attention) 等基础原理；
3. 理解 [预训练](/pretraining/pretrain) → [微调/对齐](/finetuning/finetuning) 的完整训练链路；
4. 掌握应用开发核心：[Prompt](/prompt/prompt-engineering)、[RAG](/rag/rag-basics)、[Agent](/agent/agent-basics)；
5. 补齐工程能力：[推理优化与部署](/inference/inference-optimization)、[评估](/evaluation/evaluation)。

> 本项目仅用于学习交流，内容持续更新维护。欢迎在 [GitHub](https://github.com/Meko1/llm-interview-guide) 提 Issue / PR 一起完善。
