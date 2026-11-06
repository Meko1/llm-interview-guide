---
title: 学习资源汇总
description: 按学习目标选择课程、原论文、官方实现与实验平台，区分一手证据和社区讲解，并用可复现产出检验学习效果；费用与资源可用性另行核对。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 学习资源汇总

> 本页是候选资源索引，不是排名、课程质量认证或全量链接审查。历史“必学/必读”标题保留作锚点，不代表所有岗位都需要学完；星级仅表示编辑建议的入门顺序，按目标和前置知识调整。

## 必学课程（按优先级）

> 想在 B 站学习？先看 [B 站学习路线：从视频到能力证据](/interview/bilibili-learning-resources)，按来源、目标与可验证练习选课，不按合集长度选课。

| 优先级 | 课程 | 平台 | 说明 |
| --- | --- | --- | --- |
| ⭐⭐⭐ | ChatGPT Prompt Engineering for Developers | DeepLearning.AI | Prompt 练习入口；访问与费用以课程页为准 |
| ⭐⭐⭐ | Building Systems with the ChatGPT API | DeepLearning.AI | 用 API 搭系统 |
| ⭐⭐⭐ | LangChain for LLM Application Development | DeepLearning.AI | 框架入门 |
| ⭐⭐⭐ | Building and Evaluating Advanced RAG | DeepLearning.AI | RAG 核心 |
| ⭐⭐⭐ | AI Agents in LangGraph | DeepLearning.AI | Agent 实战 |
| ⭐⭐ | Finetuning Large Language Models | DeepLearning.AI | 微调入门 |
| ⭐⭐ | 动手学深度学习（李沐） | B站 | 中文理论与代码讲解；访问条件另核 |
| ⭐⭐ | 跟李沐学 AI（论文精读） | B站 | Transformer 等经典论文精讲 |
| ⭐⭐ | Neural Networks: Zero to Hero（Karpathy） | YouTube | 从零手写，含 "Let's build GPT"，底层实现练习 |
| ⭐⭐ | Karpathy《Let's build the GPT Tokenizer》 | YouTube | 分词器实现练习 |
| ⭐ | Machine Learning Specialization（吴恩达） | Coursera | ML 基础；旁听/作业权限待核 |
| ⭐ | [Hugging Face LLM / NLP Course](https://huggingface.co/learn/llm-course/chapter1/1) | 官方课程 | 仅提供官方阅读入口；本轮TLS读取失败，课程范围与费用待核 |

## 必读书籍

| 书名 | 说明 |
| --- | --- |
| 《Build a Large Language Model (From Scratch)》 | Sebastian Raschka，从零实现 LLM，模型实现参考 |
| 《Hands-On Large Language Models》 | LLM 应用实战 |
| 《Natural Language Processing with Transformers》 | 由 Transformers 生态作者编写的实践书籍；以书籍版本为准 |
| 《Designing Machine Learning Systems》 | Chip Huyen，ML 系统设计 |
| 《动手学深度学习》 | 李沐，中文在线阅读候选 |

## 必读论文（经典 + 前沿）

- **Attention Is All You Need**（Transformer 开山）
- **GPT-3: Language Models are Few-Shot Learners**（few-shot / in-context learning；不由单篇论文推出所有“涌现”结论）
- **LoRA: Low-Rank Adaptation**（参数高效微调）
- **InstructGPT / RLHF**（对齐）
- **ReAct**、**Chain-of-Thought**（推理与 Agent）
- **RAG**（检索增强生成原始论文）、**RAGAS**（RAG 评估）
- **DeepSeek-V3 / R1 技术报告**（MLA、MoE、GRPO，模型报告阅读候选）
- **LLaMA / Qwen 技术报告**（现代开源架构）

> 论文读法：L1 可先读摘要、任务定义与失败例子；L2 进一步核对数据、基线、硬件和评估分母；L3 需读推导与实验设置并复现关键结果。视频用于辅助理解，不能代替原论文证据。

## 优质博客 / 社区

| 资源 | 内容 |
| --- | --- |
| Lilian Weng 博客（lilianweng.github.io） | Agent、Prompt、对齐等深度长文，作者技术长文 |
| Sebastian Raschka | LLM 原理与训练技术 |
| Jay Alammar（The Illustrated Transformer） | 图解 Transformer，可视化入门讲解 |
| Hugging Face Blog | 实用工程技术 |
| 量子位 / 机器之心 | 中文 AI 资讯 |

## 优质开源项目（学产品设计）

| 项目 | 价值 |
| --- | --- |
| **Dify** | 开源 LLMOps 平台，学习 RAG/Agent 产品化设计 |
| **FastGPT** | 开源知识库问答，RAG 工程参考 |
| **LangChain / LlamaIndex** | 应用开发框架，读源码学抽象设计 |
| **LLaMA-Factory** | 一站式微调工具，微调实现候选 |
| **vLLM** | 高性能推理框架，学 PagedAttention/连续批处理 |
| **Transformers（HuggingFace）** | 模型生态基石 |
| **RAGFlow / Ollama** | 分别是 RAG 引擎与本地部署的代表 |

## 实验平台

| 平台 | 用途 | 费用 |
| --- | --- | --- |
| [Google Colab](https://research.google.com/colaboratory/faq.html) | 托管 Notebook 实验 | 资源不保证且非无限；付费也需核配额 |
| AutoDL | GPU 租用候选 | 机型、区域、存储与计费需另核 |
| Hugging Face Spaces | Demo 展示候选 | 硬件、休眠与费用需按空间配置核对 |
| 模型 API 候选 | 小样本应用实验 | 不比较未经核验的价格倍数；按模型、缓存、重试和税费算总成本 |

> 先设总预算和停止条件，再选平台。Colab FAQ 本轮实读摘录明确资源不保证且非无限；不要把免费 GPU 当可预留容量。大模型训练前先在 CPU/小模型上验证数据、形状与 checkpoint 恢复；计费来源和硬件兼容性均需单独核对。

## 🛠️ 工具与框架速览

按用途整理常用开源工具，覆盖大模型工程全链路：

| 方向 | 代表工具 |
| --- | --- |
| **应用开发框架** | LangChain、LlamaIndex、LangGraph、Haystack、Spring AI（Java） |
| **微调** | LLaMA-Factory、Hugging Face PEFT、Unsloth、TRL、Axolotl |
| **推理部署** | vLLM、SGLang、TGI、TensorRT-LLM、Ollama、llama.cpp、LMDeploy |
| **向量检索与存储** | Milvus、Qdrant、Chroma、Weaviate；pgvector 是 PostgreSQL 扩展，Faiss 是向量检索库而非完整数据库 |
| **RAG / 知识库** | Dify、FastGPT、RAGFlow、QAnything、LangChain |
| **Agent / 多 Agent** | LangGraph、AutoGen、CrewAI、MetaGPT、OpenAI Agents SDK |
| **评估** | RAGAS、TruLens、OpenCompass、lm-evaluation-harness、EvalScope |
| **可观测 / LLMOps** | LangSmith、Langfuse、Phoenix（Arize） |
| **结构化输出 / 约束解码** | Outlines、XGrammar、Instructor、Guidance |
| **本地 / 端侧** | Ollama、LM Studio、llama.cpp、MLX（Apple） |

> 工具迭代极快，理解「问题、接口、失败边界」；复现实验必须记录版本、commit 与模型 revision，不能因不背版本而省略环境锁定。

## 中文社区与专栏

以下是社区讲解与资讯入口，不自动视为一手技术证据；核验产品行为时回到官方规范、实现或报告。

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
| [鱼皮 AI 知识库](https://ai.codefather.cn/) | AI 工具测评阅读入口、Vibe Coding 教程、编程实战 |
| [鱼皮 AI 知识库专题页](https://ai.codefather.cn/library/1936010874183520257) | 适合补 AI 编程工具、项目实战和效率工作流 |
| [掘金 AI Coding](https://aicoding.juejin.cn/) | AI 编程专题入口，适合跟进中文社区的工具实践和项目案例 |
| [Datawhale self-llm](https://github.com/datawhalechina/self-llm) | 开源大模型食用指南，微调/部署教程 |
| [Datawhale so-large-lm](https://github.com/datawhalechina/so-large-lm) | 大模型理论基础，基于 CS324 + 李宏毅课程 |
| [Datawhale llm-universe](https://github.com/datawhalechina/llm-universe) | 面向小白的大模型应用开发教程 |
| [Datawhale llm-cookbook](https://github.com/datawhalechina/llm-cookbook) | 吴恩达 LLM 系列课程中文版 |
| [Datawhale hello-agents](https://github.com/datawhalechina/hello-agents) | Agent 入门实战 + 面试总结 |
| [Datawhale 组织主页](https://github.com/datawhalechina) | 系统查找大模型、Agent、RAG、数据科学相关开源教程 |
| [ProcessOn 复习图谱 1](https://www.processon.com/view/link/6818579ca71fd53a76b8ae51) / [复习图谱 2](https://www.processon.com/view/link/68f8f47505b3f06eb45494c1) | 用思维导图复盘知识树和系统设计链路；面试前适合查漏补缺 |
| [Awesome-LLM-Interview](https://github.com/laoshan-song/Awesome-LLM-Interview) | 系统化 LLM 面试笔记，按模块分文件；更新状态待核 |
| [LLM-Interview-Guidebook](https://github.com/chensi-cs/LLM-Interview-Guidebook) | 面向算法工程师的面试宝典，从基础到推理部署 |
| [llm_interview_note](https://github.com/wdndev/llm_interview_note) | LLM 算法/应用工程师知识及面试题 |
| [小林面试笔记 - 大模型专题](https://xiaolinnote.com/ai/) | 图解大模型练习资料，Agent/RAG/工具调用 |
| [LLMForEverybody](https://github.com/luhengshiwo/LLMForEverybody) | 体系化的大模型原理 + 面试系列文章 |
| [awesome-LLM-resources](https://github.com/WangRongsheng/awesome-LLM-resources) | 大模型资源/工具候选索引 |
| [llm-action](https://github.com/liguodongiot/llm-action) | 大模型训练/推理/压缩/国产化系统实战教程（本站国产化、量化、AI 编译器、压测等页参考） |
| [Awesome-Chinese-LLM](https://github.com/HqWu-HITCS/Awesome-Chinese-LLM) | 中文大模型全景资料集：国产模型/垂直领域/数据集/评测（本站[中文大模型生态全景](/models/chinese-llm-landscape)参考） |
| [AgentGuide](https://adongwanai.github.io/AgentGuide/) | 聚焦 Agent 的学习与面试指南，LangGraph 实战 |
| [happy-llm](https://github.com/datawhalechina/happy-llm) | Datawhale 出品，从原理到实践 |

## 跟踪前沿的渠道

- **Hugging Face** Trending / Papers：看最新模型和论文热度。
- **arXiv** cs.CL / cs.LG：最新论文。
- **X（Twitter）/ 知乎 / 即刻**：关注 AI 研究者和工程师。
- **GitHub Trending**：发现新工具和项目。

---

> 本页持续更新。欢迎在 [GitHub](https://github.com/Meko1/llm-interview-guide) 提 PR 补充你认为值得推荐的优质资源。

## 从资源到能力证据

社区内容用来建立直觉，官方资料用来确认接口，论文用来界定实验结论。除 Colab FAQ 的资源限制摘录外，本轮未逐个读取课程、书籍、社区或仓库，其他条目均仅作阅读入口；商业权限、版权、版本支持和持续维护状态待核。

| 目标 | 最小产出 | 必须暴露的失败模式 |
| --- | --- | --- |
| L1 应用 | 固定10条脱敏样本的解析/检索Demo，记录输入与结果 | 空召回、非法JSON、权限拒绝；不能只展示成功截图 |
| L2 工程 | 同一任务的质量/成本/延迟账本，固定长度与并发配置 | 重试双计费、尾延迟、资源不足、版本漂移 |
| L3 原理 | 一个关键公式推导和受控对照实验 | 数据泄漏、基线不公平、多次挑最优seed |

构造预算例：每周6小时，分配2小时阅读、3小时实现、1小时复盘；两周共12小时，但完成时数不是掌握分数。实验预算上限若为20元，前置单价假设为每轮0.5元，最多40轮；这个占位算例不含失败重试和平台存储费用，应先预留再按真实账单结算。

<details>
<summary>L1：看完课程却无法独立实现怎么办？</summary>

关掉示例，从空目录复述输入/输出契约并实现最小路径；对空输入、权限错误和模型超时给出显式处理。记录哪一步仍需查资料，不以结课证书替代独立实现证据。
</details>

<details>
<summary>L2：如何判断教程能否迁入生产？</summary>

核对版本、许可证、数据隐私、网络出站、幂等和可回滚性。用 mocked 供应商注入429/超时/断流，核算总尝试成本；Demo默认配置不是容量、安全或价格保证。
</details>

<details>
<summary>L3：如何说明论文“复现”边界？</summary>

报告任务、数据切分、模型revision、硬件、随机seed、指标分母和差异；只跑小模型或只读摘要，应称局部验证/阅读，不能宣称复现原论文全部结论。
</details>
