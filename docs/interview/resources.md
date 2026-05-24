# 学习资源汇总

> 精选大模型学习的优质课程、书籍、博客、开源项目与实验平台。按「先看哪个」的优先级整理，避免在信息海洋里迷路。

## 必学课程（按优先级）

| 优先级 | 课程 | 平台 | 说明 |
| --- | --- | --- | --- |
| ⭐⭐⭐ | ChatGPT Prompt Engineering for Developers | DeepLearning.AI | Prompt 入门，免费、短小 |
| ⭐⭐⭐ | Building Systems with the ChatGPT API | DeepLearning.AI | 用 API 搭系统 |
| ⭐⭐⭐ | LangChain for LLM Application Development | DeepLearning.AI | 框架入门 |
| ⭐⭐⭐ | Building and Evaluating Advanced RAG | DeepLearning.AI | RAG 核心 |
| ⭐⭐⭐ | AI Agents in LangGraph | DeepLearning.AI | Agent 实战 |
| ⭐⭐ | Finetuning Large Language Models | DeepLearning.AI | 微调入门 |
| ⭐⭐ | 动手学深度学习（李沐） | B站 | 中文、免费、理论+代码 |
| ⭐⭐ | 跟李沐学 AI（论文精读） | B站 | Transformer 等经典论文精讲 |
| ⭐ | Machine Learning Specialization（吴恩达） | Coursera | ML 基础，可旁听 |

## 必读书籍

| 书名 | 说明 |
| --- | --- |
| 《Build a Large Language Model (From Scratch)》 | Sebastian Raschka，从零实现 LLM，理解原理首选 |
| 《Hands-On Large Language Models》 | LLM 应用实战 |
| 《Natural Language Processing with Transformers》 | HuggingFace 官方书 |
| 《Designing Machine Learning Systems》 | Chip Huyen，ML 系统设计 |
| 《动手学深度学习》 | 李沐，中文免费在线 |

## 必读论文（经典 + 前沿）

- **Attention Is All You Need**（Transformer 开山）
- **GPT-3: Language Models are Few-Shot Learners**（涌现 / in-context learning）
- **LoRA: Low-Rank Adaptation**（参数高效微调）
- **InstructGPT / RLHF**（对齐）
- **ReAct**、**Chain-of-Thought**（推理与 Agent）
- **RAG**（检索增强生成原始论文）、**RAGAS**（RAG 评估）
- **DeepSeek-V3 / R1 技术报告**（MLA、MoE、GRPO，必读前沿）
- **LLaMA / Qwen 技术报告**（现代开源架构）

> 论文读法：先读摘要 + 架构图 + 结论，结合李沐精读视频，不必逐行啃公式。

## 优质博客 / 社区

| 资源 | 内容 |
| --- | --- |
| Lilian Weng 博客（lilianweng.github.io） | Agent、Prompt、对齐等深度长文，质量极高 |
| Sebastian Raschka | LLM 原理与训练技术 |
| Jay Alammar（The Illustrated Transformer） | 图解 Transformer，入门神作 |
| Hugging Face Blog | 实用工程技术 |
| 量子位 / 机器之心 | 中文 AI 资讯 |

## 优质开源项目（学产品设计）

| 项目 | 价值 |
| --- | --- |
| **Dify** | 开源 LLMOps 平台，学习 RAG/Agent 产品化设计 |
| **FastGPT** | 开源知识库问答，RAG 工程参考 |
| **LangChain / LlamaIndex** | 应用开发框架，读源码学抽象设计 |
| **LLaMA-Factory** | 一站式微调工具，微调实战首选 |
| **vLLM** | 高性能推理框架，学 PagedAttention/连续批处理 |
| **Transformers（HuggingFace）** | 模型生态基石 |
| **RAGFlow / Ollama** | 分别是 RAG 引擎与本地部署的代表 |

## 实验平台

| 平台 | 用途 | 费用 |
| --- | --- | --- |
| Google Colab | 免费 GPU 实验 | 免费 / Pro 付费 |
| AutoDL | 国内 GPU 租用 | 按小时，经济 |
| Hugging Face Spaces | 模型部署展示 | 免费额度 |
| 国内大模型 API（通义/智谱/文心） | 调用练手 | 价格约为 OpenAI 的 1/5~1/10 |

> 提示：学习阶段优先用国内大模型 API 和免费额度，成本可控。微调实验可用 Colab 免费 GPU 或 AutoDL 低价租卡。

## 跟踪前沿的渠道

- **Hugging Face** Trending / Papers：看最新模型和论文热度。
- **arXiv** cs.CL / cs.LG：最新论文。
- **X（Twitter）/ 知乎 / 即刻**：关注 AI 研究者和工程师。
- **GitHub Trending**：发现新工具和项目。

---

> 本页持续更新。欢迎在 [GitHub](https://github.com/Meko1/llm-interview-guide) 提 PR 补充你认为值得推荐的优质资源。
