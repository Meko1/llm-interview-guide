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
| ⭐⭐ | Neural Networks: Zero to Hero（Karpathy） | YouTube | 从零手写，含 "Let's build GPT"，理解底层神器 |
| ⭐⭐ | Karpathy《Let's build the GPT Tokenizer》 | YouTube | 彻底搞懂分词器 |
| ⭐ | Machine Learning Specialization（吴恩达） | Coursera | ML 基础，可旁听 |
| ⭐ | Hugging Face LLM / NLP Course | huggingface.co/learn | 免费、实操，配套 Transformers |

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

## 🛠️ 工具与框架速览

按用途整理常用开源工具，覆盖大模型工程全链路：

| 方向 | 代表工具 |
| --- | --- |
| **应用开发框架** | LangChain、LlamaIndex、LangGraph、Haystack、Spring AI（Java） |
| **微调** | LLaMA-Factory、Hugging Face PEFT、Unsloth、TRL、Axolotl |
| **推理部署** | vLLM、SGLang、TGI、TensorRT-LLM、Ollama、llama.cpp、LMDeploy |
| **向量数据库** | Milvus、Qdrant、Chroma、Weaviate、pgvector、Faiss |
| **RAG / 知识库** | Dify、FastGPT、RAGFlow、QAnything、LangChain |
| **Agent / 多 Agent** | LangGraph、AutoGen、CrewAI、MetaGPT、OpenAI Agents SDK |
| **评估** | RAGAS、TruLens、OpenCompass、lm-evaluation-harness、EvalScope |
| **可观测 / LLMOps** | LangSmith、Langfuse、Phoenix（Arize） |
| **结构化输出 / 约束解码** | Outlines、XGrammar、Instructor、Guidance |
| **本地 / 端侧** | Ollama、LM Studio、llama.cpp、MLX（Apple） |

> 工具迭代极快，记住「每类的代表 + 它解决什么问题」即可，别死记版本。

## 中文社区与专栏

中文一手资讯和实战经验的高质量来源：

| 渠道 | 内容 |
| --- | --- |
| 掘金（juejin.cn） | 大量大模型实战、面经、源码解析专栏 |
| 知乎 | 算法原理深度讨论、论文解读、行业观察 |
| CSDN | 教程、踩坑记录、环境配置实操 |
| 公众号：机器之心 / 量子位 / 新智元 | 中文 AI 资讯与技术报道 |
| 公众号：李rumor / 真中合欢 / 关于NLP那些你不知道的事 | NLP / 大模型技术干货 |
| B 站 | 李沐、Karpathy 搬运、各类大模型实战课 |

## 同类优秀开源指南（致敬 & 延伸阅读）

本项目站在巨人的肩膀上，也推荐这些优秀的开源学习/面试资源：

| 项目 | 特点 |
| --- | --- |
| [JavaGuide](https://javaguide.cn/) | 后端面试指南标杆，本项目的形式灵感来源 |
| [JavaGuide - AI 应用开发面试指南](https://javaguide.cn/ai/) | JavaGuide 的 AI 面试专栏，覆盖 LLM/Agent/RAG/MCP/系统设计 |
| [JavaGuide - AI 编程实战](https://javaguide.cn/ai-coding/) | Claude Code/Cursor/Codex/Trae 使用技巧与面试题 |
| [AIGuide（Snailclimb）](https://github.com/Snailclimb/AIGuide) | 对标 JavaGuide 的 AI 应用开发与编程实战指南 |
| [鱼皮 AI 知识库](https://ai.codefather.cn/) | 免费 AI 工具测评、Vibe Coding 教程、编程实战 |
| [Datawhale self-llm](https://github.com/datawhalechina/self-llm) | 开源大模型食用指南，微调/部署教程（31k+ stars） |
| [Datawhale so-large-lm](https://github.com/datawhalechina/so-large-lm) | 大模型理论基础，基于 CS324 + 李宏毅课程 |
| [Datawhale llm-universe](https://github.com/datawhalechina/llm-universe) | 面向小白的大模型应用开发教程（13k+ stars） |
| [Datawhale llm-cookbook](https://github.com/datawhalechina/llm-cookbook) | 吴恩达 LLM 系列课程中文版（24k+ stars） |
| [Datawhale hello-agents](https://github.com/datawhalechina/hello-agents) | Agent 入门实战 + 面试总结 |
| [Awesome-LLM-Interview](https://github.com/laoshan-song/Awesome-LLM-Interview) | 系统化 LLM 面试笔记，按模块分文件，持续更新 |
| [LLM-Interview-Guidebook](https://github.com/chensi-cs/LLM-Interview-Guidebook) | 面向算法工程师的面试宝典，从基础到推理部署 |
| [llm_interview_note](https://github.com/wdndev/llm_interview_note) | LLM 算法/应用工程师知识及面试题 |
| [小林面试笔记 - 大模型专题](https://xiaolinnote.com/ai/) | 600+ 张图解大模型面试题，Agent/RAG/工具调用 |
| [LLMForEverybody](https://github.com/luhengshiwo/LLMForEverybody) | 体系化的大模型原理 + 面试系列文章 |
| [awesome-LLM-resources](https://github.com/WangRongsheng/awesome-LLM-resources) | 极全的大模型资源/工具索引 |
| [AgentGuide](https://adongwanai.github.io/AgentGuide/) | 聚焦 Agent 的学习与面试指南，LangGraph 实战 |
| [happy-llm](https://github.com/datawhalechina/happy-llm) | Datawhale 出品，从原理到实践 |

## 跟踪前沿的渠道

- **Hugging Face** Trending / Papers：看最新模型和论文热度。
- **arXiv** cs.CL / cs.LG：最新论文。
- **X（Twitter）/ 知乎 / 即刻**：关注 AI 研究者和工程师。
- **GitHub Trending**：发现新工具和项目。

---

> 本页持续更新。欢迎在 [GitHub](https://github.com/Meko1/llm-interview-guide) 提 PR 补充你认为值得推荐的优质资源。
