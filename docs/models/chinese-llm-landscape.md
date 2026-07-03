# 中文大模型生态全景

> 国内面试有一类高频问题是「你了解国产大模型吗？各家有什么特点？中文评测用什么基准？」。本文参考 [Awesome-Chinese-LLM](https://github.com/HqWu-HITCS/Awesome-Chinese-LLM)（GitHub 20k+ Star 的中文 LLM 资料集）的分类体系，系统盘点**国内厂商模型矩阵、开源系谱、垂直领域模型、中文数据集与中文评测基准**。单个模型架构细节见 [LLaMA 与 Qwen 架构演进](/models/llama-qwen)、[DeepSeek 专题](/models/deepseek)、[2025-2026 前沿模型盘点](/models/frontier-models-2025)。

## 面试先背这几句话

- 国产大模型第一梯队：**DeepSeek（性价比+推理）、Qwen（开源生态最全）、GLM（智谱，ToB 落地多）、Kimi（长上下文起家）、豆包（字节，C 端体量大）**。
- 开源看 **Qwen 系谱**：国内外大量模型基于 Qwen 底座二次训练，衍生生态类似海外的 LLaMA。
- 中文评测基准：**C-Eval / CMMLU 考中文知识，SuperCLUE 综合榜，OpenCompass 是最常用的开源评测框架**。
- 垂直领域（医疗/法律/金融）模型的通用套路：**开源底座 + 领域语料继续预训练（可选）+ 领域 SFT + RAG 补事实**。
- 数据集三类：预训练语料（WuDao/SkyPile/WanJuan）、SFT 指令集（BELLE/COIG/Firefly）、偏好数据（面向 RLHF/DPO）。

## 一、国内厂商模型矩阵

### 1.1 第一梯队（2025-2026 视角）

| 厂商 | 代表模型 | 特点与定位 |
| --- | --- | --- |
| DeepSeek（深度求索） | DeepSeek-V3 / R1 系列 | MLA + MoE 极致性价比；R1 推理模型出圈；开源权重+论文透明度高 |
| 阿里（通义） | Qwen 2.5 / Qwen 3 系列 | **开源生态最完整**：从 0.5B 到百 B 级、Base/Instruct/Coder/VL/Audio 全家桶；国内外二次开发首选底座 |
| 智谱 AI | GLM-4 / GLM-4.5 系列 | 清华系；ToB 私有化部署案例多；早期 ChatGLM-6B 是中文开源启蒙模型 |
| 月之暗面 | Kimi（K 系列） | 长上下文起家（率先 20 万字）；K 系列推理模型；C 端助手活跃 |
| 字节跳动 | 豆包（Doubao）/ Seed 系列 | C 端日活最大之一；火山引擎 ToB 输出；价格战主要发起者 |
| 腾讯 | 混元（Hunyuan） | 深度绑定微信/腾讯系产品；开源了混元部分权重与 3D/视频生成模型 |
| 百度 | 文心（ERNIE） | 最早发布中文类 ChatGPT 产品（文心一言）；2025 年起转向开源 |
| MiniMax | abab / MiniMax-01 系列 | 多模态与语音强；线性注意力大规模落地的探索者（见 [线性注意力与混合架构](/basics/linear-attention)） |
| 阶跃星辰 | Step 系列 | 多模态路线（Step-1V / 语音 / 视频理解） |
| 上海 AI Lab | InternLM（书生）系列 | 科研背景；配套 **OpenCompass 评测 / LMDeploy 部署 / XTuner 微调** 全工具链 |

### 1.2 其他重要玩家

- **百川智能（Baichuan）**：早期开源 Baichuan-7B/13B 影响大，后转向医疗方向。
- **零一万物（01.AI）**：Yi 系列开源模型，后并入阿里体系合作。
- **面壁智能（ModelBest）**：MiniCPM 系列，**端侧小模型**代表（见 [小语言模型与端侧（SLM）](/models/slm)）。
- **讯飞**：星火（Spark），教育/办公场景深耕，全栈基于国产算力训练是其卖点（见 [国产算力与国产化适配](/inference/domestic-ai-stack)）。
- **昆仑万维**：天工（Skywork），开源了高质量中文预训练语料 SkyPile。
- **华为**：盘古（PanGu），全栈昇腾训练，主打政企与行业大模型。

> 面试点：能按「开源生态 / ToB / ToC / 端侧 / 多模态」几个维度把厂商分类说清楚，比背参数量更加分。

## 二、开源系谱：为什么 Qwen 成了「中文 LLaMA」

早期（2023）中文开源模型多基于 **LLaMA 底座 + 中文词表扩充 + 中文继续预训练**（如 Chinese-LLaMA-Alpaca、BELLE），痛点是 LLaMA 中文语料占比低、license 受限。

转折点是 **Qwen 与 GLM、Baichuan、Yi、InternLM 等原生中文开源模型**出现，其中 Qwen 凭借三点成为事实上的中文开源底座：

1. **尺寸全覆盖**：0.5B~110B+，端侧到集群都有对应版本。
2. **变体齐全**：Base / Instruct / Coder / Math / VL / Audio / Embedding / Reranker。
3. **持续迭代 + 宽松 license**：迭代节奏快，商用友好。

如今国内垂直领域模型、企业自研模型大多选择 **Qwen 或 DeepSeek 蒸馏版**做底座；这与海外基于 LLaMA 的衍生生态形成镜像（架构对比见 [LLaMA 与 Qwen 架构演进](/models/llama-qwen)）。

## 三、垂直领域模型盘点

[Awesome-Chinese-LLM](https://github.com/HqWu-HITCS/Awesome-Chinese-LLM) 收录了上百个垂直模型，按行业可归纳为：

| 领域 | 代表项目 | 共同做法 |
| --- | --- | --- |
| 医疗 | HuatuoGPT（华佗）、BenTsao（本草）、DoctorGLM、DISC-MedLLM、WiNGPT、MedicalGPT | 医学文献/问诊对话 SFT；心理方向有 MeChat、SoulChat、MindChat |
| 法律 | LaWGPT、LexiLaw、Lawyer LLaMA、獬豸（LawGPT_zh）、DISC-LawLLM | 法条+判例+法考题微调，普遍配 RAG 查法条 |
| 金融 | 轩辕（XuanYuan）、聚宝盆（Cornucopia）、DISC-FinLLM、FinGLM | 研报/公告/财经问答；对数值准确性要求极高，重 RAG 与工具调用 |
| 教育 | 桃李（TaoLi）、子曰（网易有道）、MathGPT | 学科题库+解题步骤数据；数学方向重 CoT |
| 其他 | 网络安全（SecGPT）、农业（后稷）、电商客服、政务 | 同一套方法论复制到各行业 |

**垂直模型的标准技术路线（面试常考）**：

```
开源底座（Qwen/GLM/DeepSeek 蒸馏版）
  → （可选）领域语料继续预训练：注入领域语感与术语
  → 领域 SFT：指令数据教会任务范式（问诊/法律咨询格式）
  → （可选）偏好对齐：安全与合规约束（医疗尤其重要）
  → RAG 外挂：事实性知识（药品说明书/最新法条）不进权重
```

> 关键认知：**领域知识分两类**——「语感与推理套路」适合训练进权重；「时效性事实」必须走 RAG（原因见 [RAG vs 长上下文 vs 微调](/rag/rag-vs-long-context)）。

## 四、中文数据集

### 4.1 预训练语料

| 数据集 | 规模/特点 |
| --- | --- |
| WuDao（悟道） | 早期最大规模中文语料之一 |
| SkyPile-150B | 昆仑万维开源，150B token 高质量中文网页 |
| WanJuan（万卷） | 上海 AI Lab，文本+图文+视频多模态 |
| MNBVC | 社区驱动的超大中文语料计划，目标对标 ChatGPT 训练量 |
| CCI | 中文互联网语料，BAAI 发布 |

清洗去重方法论（MinHash、质量过滤）见 [数据工程与合成数据](/pretraining/data-engineering)。

### 4.2 SFT 指令数据集

| 数据集 | 特点 |
| --- | --- |
| BELLE 系列 | 最早的大规模中文指令集之一（self-instruct 蒸馏） |
| COIG / COIG-CQIA | BAAI 出品；CQIA 主打「高质量人工筛选」 |
| Firefly（流萤） | 覆盖 23 类中文 NLP 任务的百万级指令 |
| Alpaca-zh / ShareGPT-zh | 英文经典集的中文翻译/收集版 |
| Magpie-zh | 用对齐模型自生成指令的新范式 |

### 4.3 偏好数据集

- **HH-RLHF-cn**、**CValues**（阿里，中文价值观对齐）、**UltraFeedback-zh** 等，服务 RLHF/DPO 训练（见 [RLHF / DPO 对齐](/finetuning/rlhf)）。

## 五、中文评测基准 ★

面试必会区分「考什么」：

| 基准 | 考察内容 | 形式 |
| --- | --- | --- |
| **C-Eval** | 中文学科知识（52 学科，初中到职业考试） | 选择题 |
| **CMMLU** | 中文综合知识（对标 MMLU，67 主题） | 选择题 |
| **AGIEval** | 人类标准化考试（高考/司法/公务员） | 选择题+主观 |
| **GAOKAO-Bench** | 高考真题 | 客观+主观 |
| **SuperCLUE** | 综合能力榜单（含对战式 琅琊榜） | 多维评测 |
| **HalluQA** | 中文幻觉评估 | 对抗性问题 |
| **Safety-Prompts / CValues** | 中文安全与价值观 | 安全场景 |
| **PromptCBLUE** | 中文医疗 NLP 任务 | 领域评测 |

**评测框架/平台**：

- **OpenCompass（司南）**：上海 AI Lab 开源，国内最常用的一站式评测框架，支持数百数据集。
- **FlagEval（天秤）**：BAAI 的评测平台。
- **LMSYS Chatbot Arena**：国际对战榜，国产模型排名常被引用。

已知问题与国际基准通用：**数据污染**（试题泄漏进训练集）、**选择题≠真实能力**、**刷榜**。所以大厂内部都自建评测集（评测方法论见 [评测基准深入](/evaluation/benchmarks)）。

## 六、训练/推理工具链的国产开源力量

| 类别 | 项目 | 说明 |
| --- | --- | --- |
| 微调框架 | **LLaMA-Factory** | 国人主导、全球最流行的微调框架之一（见 [微调训练工具链实战](/finetuning/training-frameworks)） |
| 微调框架 | XTuner / Swift（魔搭） | InternLM 系 / 阿里系微调工具 |
| 推理部署 | **vLLM**（有大量国内贡献者）、LMDeploy、SGLang | 见 [推理框架对比](/inference/serving-frameworks) |
| 评测 | OpenCompass | 见上节 |
| 模型社区 | **ModelScope（魔搭）**、始智 AI（wisemodel） | 国内的 HuggingFace 替代，下载不受网络限制 |
| 全栈教程 | llm-action、self-llm（Datawhale）、llm-universe | 中文实战教程仓库（见 [学习资源汇总](/interview/resources)） |

## 高频追问

1. **国产大模型第一梯队有哪些，各自定位？** DeepSeek（性价比+推理开源）、Qwen（开源生态）、GLM（ToB）、Kimi（长上下文/ToC）、豆包（C 端体量+价格战）；再按开源/闭源、ToB/ToC 分类展开。
2. **为什么国内做垂直模型都用 Qwen 底座？** 尺寸全、变体全、license 宽松、中文能力原生强、迭代快——类似海外 LLaMA 的生态位。
3. **垂直领域模型怎么做？知识放权重还是放 RAG？** 底座+（继续预训练）+SFT+对齐+RAG；语感套路进权重，时效事实走 RAG。
4. **C-Eval 和 CMMLU 什么区别？** 都是中文知识选择题：C-Eval 按 52 个学科考试组织（偏教育考试），CMMLU 对标 MMLU 的 67 主题（偏综合知识）；面试能说出「都存在数据污染风险，不能只看榜」更佳。
5. **中文 SFT 数据集有哪些？质量怎么保证？** BELLE/COIG/Firefly 等；质量手段：人工筛选（CQIA）、去重去污染、reward model 打分过滤（见 [数据工程与合成数据](/pretraining/data-engineering)）。
6. **OpenCompass 是什么？** 上海 AI Lab 开源的一站式评测框架，国内模型发布时的事实标准评测工具，支持自定义数据集与主观评测。
7. **国内模型和 GPT/Claude 的差距还大吗？** 分维度答：中文任务与性价比上第一梯队已可用甚至占优（DeepSeek 出圈）；最前沿推理/多模态/长程 Agent 能力仍有代差，但差距在缩小；工程落地能力（私有化、合规）是国产优势。
