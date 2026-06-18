# LLM Course 中文版路线图（Maxime Labonne）

> 本页是对 Maxime Labonne 开源项目 [**mlabonne/llm-course**](https://github.com/mlabonne/llm-course)（GitHub 80k+ Star）的**中文翻译与整理**。原项目是一份广受欢迎的大模型学习路线图，配有大量 Colab Notebook 与精选资源。
>
> 📌 **版权声明**：原项目基于 [Apache License 2.0](https://github.com/mlabonne/llm-course/blob/main/LICENSE) 开源。本页为中文译本，遵循该许可证再分发，**著作权归原作者 Maxime Labonne 所有**。译文在忠实原意的基础上做了少量本地化，并补充了指向本站对应章节的链接，方便中文读者深入。原始英文版本请访问 [mlabonne/llm-course](https://github.com/mlabonne/llm-course)。
>
> 想要本站自己的转型路线，请看 [大模型学习路线](/interview/learning-path)；想要更全的资源清单，看 [学习资源汇总](/interview/resources)。

整个课程分为三大部分：

1. 🧩 **LLM 基础（LLM Fundamentals）**：可选部分，覆盖数学、Python、神经网络等基础知识。
2. 🧑‍🔬 **LLM 科学家（The LLM Scientist）**：聚焦如何用最新技术训练出尽可能强的大模型。
3. 👷 **LLM 工程师（The LLM Engineer）**：聚焦如何构建并部署基于大模型的应用。

> 原作者基于本课程合著了《[LLM Engineer's Handbook](https://packt.link/a/9781836200079)》，一本从设计到部署、端到端讲解大模型应用的实战书。课程永久免费。

---

## 📝 Notebooks（实战笔记本）

原作者整理的关于大模型的 Notebook 与文章合集。

### 工具类（Tools）

| 名称 | 说明 |
| --- | --- |
| 🧐 [LLM AutoEval](https://github.com/mlabonne/llm-autoeval) | 用 RunPod 自动评测你的大模型 |
| 🥱 LazyMergekit | 一键用 MergeKit 轻松合并模型 |
| 🦎 LazyAxolotl | 一键在云端用 Axolotl 微调模型 |
| ⚡ AutoQuant | 一键将大模型量化为 GGUF / GPTQ / EXL2 / AWQ / HQQ 格式 |
| 🌳 Model Family Tree | 可视化合并模型的「家族树」 |
| 🚀 ZeroSpace | 用免费 ZeroGPU 自动创建 Gradio 聊天界面 |
| ✂️ AutoAbliteration | 用自定义数据集自动对模型做 abliteration（去审查） |
| 🧼 AutoDedup | 用 Rensa 库自动对数据集去重 |

### 微调（Fine-tuning）

| Notebook | 说明 | 文章 |
| --- | --- | --- |
| 用 Unsloth 微调 Llama 3.1 | 在 Colab 中极致高效地做有监督微调 | [Article](https://mlabonne.github.io/blog/posts/2024-07-29_Finetune_Llama31.html) |
| 用 ORPO 微调 Llama 3 | 用 ORPO 在单阶段内更便宜更快地微调 | [Article](https://mlabonne.github.io/blog/posts/2024-04-19_Fine_tune_Llama_3_with_ORPO.html) |
| 用 DPO 微调 Mistral-7b | 用 DPO 提升有监督微调模型的表现 | [Article](https://mlabonne.github.io/blog/posts/Fine_tune_Mistral_7b_with_DPO.html) |
| 用 QLoRA 微调 Mistral-7b | 在免费 Colab 中用 TRL 微调 Mistral-7b | — |
| 用 Axolotl 微调 CodeLlama | SOTA 微调工具的端到端指南 | [Article](https://mlabonne.github.io/blog/posts/A_Beginners_Guide_to_LLM_Finetuning.html) |
| 用 QLoRA 微调 Llama 2 | 在 Colab 中分步微调 Llama 2 | [Article](https://mlabonne.github.io/blog/posts/Fine_Tune_Your_Own_Llama_2_Model_in_a_Colab_Notebook.html) |

### 量化（Quantization）

| Notebook | 说明 | 文章 |
| --- | --- | --- |
| 量化入门 | 用 8-bit 量化优化大模型 | [Article](https://mlabonne.github.io/blog/posts/Introduction_to_Weight_Quantization.html) |
| 用 GPTQ 做 4-bit 量化 | 量化开源大模型，使其能在消费级硬件运行 | [Article](https://mlabonne.github.io/blog/4bit_quantization/) |
| 用 GGUF 与 llama.cpp 量化 | 量化 Llama 2 并上传 GGUF 版本到 HF Hub | [Article](https://mlabonne.github.io/blog/posts/Quantize_Llama_2_models_using_ggml.html) |
| ExLlamaV2：最快的推理库 | 量化并运行 EXL2 模型 | [Article](https://mlabonne.github.io/blog/posts/ExLlamaV2_The_Fastest_Library_to_Run%C2%A0LLMs.html) |

### 其他（Other）

| Notebook | 说明 | 文章 |
| --- | --- | --- |
| 用 MergeKit 合并大模型 | 无需 GPU，轻松创建自己的模型 | [Article](https://mlabonne.github.io/blog/posts/2024-01-08_Merge_LLMs_with_mergekit%20copy.html) |
| 用 MergeKit 创建 MoE | 把多个专家合并成一个 frankenMoE | [Article](https://mlabonne.github.io/blog/posts/2024-03-28_Create_Mixture_of_Experts_with_MergeKit.html) |
| 用 abliteration 给模型去审查 | 无需重训练的「去审查」微调 | [Article](https://mlabonne.github.io/blog/posts/2024-06-04_Uncensor_any_LLM_with_abliteration.html) |
| 用知识图谱增强 ChatGPT | 用知识图谱补强 ChatGPT 的回答 | [Article](https://mlabonne.github.io/blog/posts/Article_Improve_ChatGPT_with_Knowledge_Graphs.html) |
| 大模型的解码策略 | 从 beam search 到 nucleus sampling 的文本生成指南 | [Article](https://mlabonne.github.io/blog/posts/2022-06-07-Decoding_strategies.html) |

---

## 🧩 第一部分：LLM 基础（LLM Fundamentals）

本部分介绍数学、Python 和神经网络的必备知识。**可选**——你不一定要从这里开始，按需查阅即可。

> 💡 本站对应：[大模型必备数学基础](/beginner/math-basics)、[大模型零基础入门](/beginner/getting-started)。

### 1. 机器学习数学基础

在掌握机器学习之前，理解支撑这些算法的核心数学概念很重要。

- **线性代数**：理解众多算法（尤其是深度学习）的关键。核心概念包括向量、矩阵、行列式、特征值与特征向量、向量空间、线性变换。
- **微积分**：很多机器学习算法涉及连续函数的优化，需要理解导数、积分、极限与级数。多元微积分和梯度概念也很重要。
- **概率与统计**：理解模型如何从数据中学习并做出预测的关键。核心概念包括概率论、随机变量、概率分布、期望、方差、协方差、相关性、假设检验、置信区间、最大似然估计、贝叶斯推断。

📚 资源：

- [3Blue1Brown - 线性代数的本质](https://www.youtube.com/watch?v=fNk_zzaMoSs&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab)：用几何直觉讲解这些概念的视频系列。
- [StatQuest - 统计学基础](https://www.youtube.com/watch?v=qBigTkBLU6g&list=PLblh5JKOoLUK0FLuzwntyYI10UQFUhsY9)：对许多统计概念给出简单清晰的解释。
- [Seeing Theory](https://seeing-theory.brown.edu/)：布朗大学出品的概率统计可视化入门。
- [Immersive Linear Algebra](https://immersivemath.com/ila/learnmore.html)：另一份线性代数的可视化解读。
- [Khan Academy - 线性代数](https://www.khanacademy.org/math/linear-algebra)：用非常直观的方式讲解概念，适合初学者。
- [Khan Academy - 微积分](https://www.khanacademy.org/math/calculus-1)：覆盖微积分全部基础的交互式课程。
- [Khan Academy - 概率与统计](https://www.khanacademy.org/math/statistics-probability)：易于理解的讲解。

### 2. 机器学习的 Python

Python 凭借其可读性、一致性和强大的数据科学生态，尤其适合机器学习。

- **Python 基础**：需要掌握基本语法、数据类型、错误处理和面向对象编程。
- **数据科学库**：熟悉 NumPy（数值运算）、Pandas（数据处理与分析）、Matplotlib 与 Seaborn（数据可视化）。
- **数据预处理**：特征缩放与归一化、缺失值处理、异常值检测、类别特征编码、划分训练/验证/测试集。
- **机器学习库**：熟练使用 Scikit-learn。理解如何实现线性回归、逻辑回归、决策树、随机森林、K 近邻（K-NN）、K-means 聚类等算法。PCA、t-SNE 等降维技术对高维数据可视化也很有帮助。

📚 资源：

- [Real Python](https://realpython.com/)：覆盖初级到高级 Python 概念的文章与教程。
- [freeCodeCamp - 学习 Python](https://www.youtube.com/watch?v=rfscVS0vtbw)：完整介绍 Python 全部核心概念的长视频。
- [Python Data Science Handbook](https://jakevdp.github.io/PythonDataScienceHandbook/)：学习 Pandas、NumPy、Matplotlib、Seaborn 的免费电子书。
- [freeCodeCamp - 人人皆可机器学习](https://youtu.be/i_LwzRVP7bg)：面向初学者的各类机器学习算法实战入门。
- [Udacity - 机器学习入门](https://www.udacity.com/course/intro-to-machine-learning--ud120)：覆盖 PCA 等概念的免费课程。

### 3. 神经网络

神经网络是众多机器学习模型（尤其是深度学习）的基础。要有效使用它们，必须全面理解其设计与机制。

- **基础**：理解神经网络结构，如层、权重、偏置、激活函数（sigmoid、tanh、ReLU 等）。
- **训练与优化**：熟悉反向传播和各类损失函数（均方误差 MSE、交叉熵）。理解梯度下降、随机梯度下降、RMSprop、Adam 等优化算法。
- **过拟合**：理解过拟合（训练集表现好但泛化差），学习各种正则化手段（dropout、L1/L2 正则、早停、数据增强）来预防。
- **实现多层感知机（MLP）**：用 PyTorch 构建一个 MLP（全连接网络）。

📚 资源：

- [3Blue1Brown - 什么是神经网络？](https://www.youtube.com/watch?v=aircAruvnKk)：对神经网络及其内部机制的直观讲解。
- [freeCodeCamp - 深度学习速成课](https://www.youtube.com/watch?v=VyWAvY2CF9c)：高效介绍深度学习最重要的概念。
- [Fast.ai - 实用深度学习](https://course.fast.ai/)：面向有编程经验者的免费深度学习课程。
- [Patrick Loeber - PyTorch 教程](https://www.youtube.com/playlist?list=PLqnslRFeH2UrcDBWF5mfPGpqQDSta6VK4)：面向零基础的 PyTorch 视频系列。

### 4. 自然语言处理（NLP）

NLP 是连接人类语言与机器理解的人工智能分支，在翻译、情感分析、聊天机器人等众多应用中扮演关键角色。

- **文本预处理**：学习分词、词干提取（stemming）、词形还原（lemmatization）、停用词去除等预处理步骤。
- **特征提取技术**：将文本转换为机器学习算法可理解的格式。核心方法包括词袋（BoW）、TF-IDF、n-gram。
- **词嵌入（Word Embeddings）**：让语义相近的词拥有相近表示。核心方法包括 Word2Vec、GloVe、FastText。
- **循环神经网络（RNN）**：理解处理序列数据的 RNN，以及能学习长期依赖的两个变体 LSTM 与 GRU。

📚 资源：

- [Lena Voita - 词嵌入](https://lena-voita.github.io/nlp_course/word_embeddings.html)：对初学者友好的词嵌入课程。
- [RealPython - 用 spaCy 做 NLP](https://realpython.com/natural-language-processing-spacy-python/)：spaCy 库的详尽指南。
- [Kaggle - NLP 指南](https://www.kaggle.com/learn-guide/natural-language-processing)：动手实践 NLP 的 Notebook 与资源。
- [Jay Alammar - 图解 Word2Vec](https://jalammar.github.io/illustrated-word2vec/)：理解 Word2Vec 架构的好参考。
- [Jake Tae - 从零实现 PyTorch RNN](https://jaketae.github.io/study/pytorch-rnn/)：RNN/LSTM/GRU 的简洁实现。
- [colah's blog - 理解 LSTM 网络](https://colah.github.io/posts/2015-08-Understanding-LSTMs/)：关于 LSTM 的经典理论文章。

---

## 🧑‍🔬 第二部分：LLM 科学家（The LLM Scientist）

本部分聚焦如何用最新技术训练出尽可能强的大模型。

> 💡 本站对应：[Transformer 架构详解](/basics/transformer)、[预训练目标与数据](/pretraining/pretrain)、[微调范式（SFT/PEFT）](/finetuning/finetuning)、[RLHF / DPO 对齐](/finetuning/rlhf)、[模型评估与幻觉](/evaluation/evaluation)。

### 1. LLM 架构

不需要对 Transformer 架构有极深的了解，但理解现代大模型的主要步骤很重要：通过分词把文本转成数字、经过含注意力机制的多层处理、最后用各种采样策略生成新文本。

- **架构总览**：理解从编码器-解码器 Transformer 演进到 GPT 这类仅解码器架构的过程——它们是现代大模型的基础。重点关注模型在高层次上如何处理和生成文本。
- **分词（Tokenization）**：学习分词原理——文本如何转换为大模型可处理的数值表示。探索不同分词策略及其对性能与输出质量的影响。
- **注意力机制**：掌握注意力机制（尤其是自注意力及其变体）的核心概念，理解它如何让大模型处理长程依赖并保持上下文。
- **采样技术**：探索各种文本生成方法及其权衡。对比确定性方法（greedy、beam search）与概率方法（temperature、nucleus sampling）。

📚 参考：

- [Transformer 可视化入门](https://www.youtube.com/watch?v=wjZofJX0v4M) by 3Blue1Brown：面向零基础的 Transformer 可视化介绍。
- [LLM Visualization](https://bbycroft.net/llm) by Brendan Bycroft：大模型内部结构的交互式 3D 可视化。
- [nanoGPT](https://www.youtube.com/watch?v=kCc8FmEb1nY) by Andrej Karpathy：2 小时从零重写 GPT 的视频，他还做了一期[分词](https://www.youtube.com/watch?v=zduSFxRajkE)视频。
- [Attention? Attention!](https://lilianweng.github.io/posts/2018-06-24-attention/) by Lilian Weng：注意力机制的历史综述。
- [大模型的解码策略](https://mlabonne.github.io/blog/posts/2023-06-07-Decoding_strategies.html) by Maxime Labonne：用代码与可视化介绍各种解码策略。

### 2. 预训练模型

预训练计算密集且昂贵。虽然不是本课程重点，但理解模型如何预训练（尤其是数据与参数层面）很重要。爱好者也能用 <1B 的小模型小规模做预训练。

- **数据准备**：预训练需要海量数据集（如 Llama 3.1 训练了 15 万亿 token），需要精心整理、清洗、去重和分词。现代预训练流水线会用复杂的过滤来去除低质或问题内容。
- **分布式训练**：组合不同并行策略——数据并行（DP）、流水线并行（PP）、张量并行（TP），需要在 GPU 集群间做优化的网络通信与内存管理。
- **训练优化**：使用带 warmup 的自适应学习率、梯度裁剪、归一化来防止爆炸；混合精度训练提升内存效率；现代优化器（AdamW、Lion）配合调好的超参。
- **监控**：用仪表盘跟踪关键指标（loss、梯度、GPU 状态），为分布式训练问题做定向日志，做性能 profiling 找出计算与通信瓶颈。

📚 参考：

- [FineWeb](https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1) by Penedo 等：复现大规模预训练数据集（15T）的文章，含高质量子集 FineWeb-Edu。
- [RedPajama v2](https://www.together.ai/blog/redpajama-data-v2) by Weber 等：另一个大规模预训练数据集，含大量有趣的质量过滤器。
- [nanotron](https://github.com/huggingface/nanotron) by Hugging Face：极简大模型训练代码库，用于训练 SmolLM2。
- [并行训练](https://www.andrew.cmu.edu/course/11-667/lectures/W10L2%20Scaling%20Up%20Parallel%20Training.pdf) by Chenyan Xiong：优化与并行技术总览。
- [分布式训练](https://arxiv.org/abs/2407.20018) by Duan 等：分布式架构上高效训练大模型的综述。
- [OLMo 2](https://allenai.org/olmo) by AI2：含模型、数据、训练与评估代码的开源语言模型。
- [LLM360](https://www.llm360.ai/)：含训练与数据准备代码、数据、指标、模型的开源大模型框架。

### 3. 后训练数据集

后训练数据集有精确的结构：指令+答案（有监督微调），或指令+被选/被拒答案（偏好对齐）。对话式结构比预训练用的原始文本稀缺得多，因此常需处理种子数据并精炼，以提升样本的准确性、多样性与复杂度。更多示例见原作者的 [💾 LLM Datasets](https://github.com/mlabonne/llm-datasets) 仓库。

- **存储与对话模板**：因为是对话结构，后训练数据集常以 ShareGPT 或 OpenAI/HF 等特定格式存储，再映射到 ChatML、Alpaca 等对话模板生成最终训练样本。
- **合成数据生成**：用 GPT-4o 等前沿模型基于种子数据创建指令-回答对，灵活可扩展。关键在于设计多样的种子任务和有效的系统提示。
- **数据增强**：用已验证输出（单元测试或求解器）、拒绝采样的多答案、[Auto-Evol](https://arxiv.org/abs/2406.00770)、思维链、Branch-Solve-Merge、人物设定（personas）等技术增强样本。
- **质量过滤**：传统手段包括规则过滤、去重（MinHash 或嵌入近似去重）、n-gram 去污染。奖励模型与裁判 LLM 提供细粒度、可定制的质量控制。

📚 参考：

- [Synthetic Data Generator](https://huggingface.co/spaces/argilla/synthetic-data-generator) by Argilla：在 HF Space 里用自然语言构建数据集，对初学者友好。
- [LLM Datasets](https://github.com/mlabonne/llm-datasets) by Maxime Labonne：精选的后训练数据集与工具清单。
- [NeMo-Curator](https://github.com/NVIDIA/NeMo-Curator) by Nvidia：预训练与后训练数据的准备与整理框架。
- [Distilabel](https://distilabel.argilla.io/dev/sections/pipeline_samples/) by Argilla：合成数据生成框架，含 UltraFeedback 等论文复现。
- [Semhash](https://github.com/MinishLab/semhash) by MinishLab：用蒸馏嵌入模型做近似去重与去污染的极简库。
- [Chat Template](https://huggingface.co/docs/transformers/main/en/chat_templating) by Hugging Face：HF 关于对话模板的文档。

### 4. 有监督微调（SFT）

SFT 把基座模型变成能回答问题、遵循指令的有用助手。这个过程中模型学会组织答案、重新激活预训练学到的部分知识。注入全新知识是可能的但很表面：无法用它学会一门全新语言。**始终把数据质量放在参数优化之上**。

- **训练技术**：全量微调更新所有参数但算力消耗大。参数高效微调（PEFT）如 LoRA、QLoRA 通过只训练少量适配器参数、冻结基座权重来降低显存。QLoRA 把 4-bit 量化与 LoRA 结合进一步降显存。这些都已在主流框架 [TRL](https://huggingface.co/docs/trl/en/index)、[Unsloth](https://docs.unsloth.ai/)、[Axolotl](https://axolotl.ai/) 中实现。
- **训练参数**：关键参数包括带调度器的学习率、batch size、梯度累积、epoch 数、优化器（如 8-bit AdamW）、权重衰减、warmup 步数。LoRA 还引入三个参数：秩 rank（通常 16-128）、alpha（rank 的 1-2 倍）、目标模块。
- **分布式训练**：用 DeepSpeed 或 FSDP 跨多 GPU 扩展。DeepSpeed 提供三个 ZeRO 优化阶段，通过状态分片逐级提升内存效率。两者都支持梯度检查点。
- **监控**：跟踪 loss 曲线、学习率调度、梯度范数等，警惕 loss 突刺、梯度爆炸、性能退化等常见问题。

📚 参考：

- [用 Unsloth 极致高效微调 Llama 3.1](https://huggingface.co/blog/mlabonne/sft-llama3) by Maxime Labonne：用 Unsloth 微调 Llama 3.1 的实战教程。
- [Axolotl 文档](https://axolotl-ai-cloud.github.io/axolotl/) by Wing Lian：关于分布式训练与数据集格式的大量信息。
- [Mastering LLMs](https://parlance-labs.com/education/) by Hamel Husain：关于微调（也含 RAG、评估、应用、Prompt）的教育资源合集。
- [LoRA insights](https://lightning.ai/pages/community/lora-insights/) by Sebastian Raschka：LoRA 实践洞见与最佳参数选择。

### 5. 偏好对齐（Preference Alignment）

偏好对齐是后训练流水线的第二阶段，旨在让生成答案对齐人类偏好。它最初用于调整语气、降低毒性与幻觉，如今也越来越多地用于提升性能与有用性。与 SFT 不同，偏好对齐算法很多，这里聚焦三个最重要的：DPO、GRPO、PPO。

- **拒绝采样**：对每个提示，用训练中的模型生成多个回答并打分，推断出被选/被拒答案。这能创造 on-policy 数据（两个回答都来自被训练模型），提升对齐稳定性。
- **[直接偏好优化（DPO）](https://arxiv.org/abs/2305.18290)**：直接优化策略，使被选回答的似然高于被拒回答。无需奖励建模，比 RL 更省算力，但质量略逊。非常适合做聊天模型。
- **奖励模型**：用人类反馈训练奖励模型来预测人类偏好等指标。可借助 [TRL](https://huggingface.co/docs/trl/en/index)、[verl](https://github.com/volcengine/verl)、[OpenRLHF](https://github.com/OpenRLHF/OpenRLHF) 做可扩展训练。
- **强化学习**：[GRPO](https://arxiv.org/abs/2402.03300)、[PPO](https://arxiv.org/abs/1707.06347) 等 RL 技术迭代更新策略以最大化奖励，同时不偏离初始行为太远。它们可用奖励模型或奖励函数打分，计算昂贵且需仔细调超参（学习率、batch size、clip range）。**非常适合做推理模型**。

📚 参考：

- [图解 RLHF](https://huggingface.co/blog/rlhf) by Hugging Face：RLHF 入门，含奖励模型训练与 RL 微调。
- [LLM Training: RLHF and Its Alternatives](https://magazine.sebastianraschka.com/p/llm-training-rlhf-and-its-alternatives) by Sebastian Raschka：RLHF 流程及 RLAIF 等替代方案综述。
- [Preference Tuning LLMs](https://huggingface.co/blog/pref-tuning) by Hugging Face：DPO、IPO、KTO 算法对比。
- [用 DPO 微调](https://mlabonne.github.io/blog/posts/Fine_tune_Mistral_7b_with_DPO.html) by Maxime Labonne：用 DPO 微调 Mistral-7b 复现 NeuralHermes-2.5。
- [用 GRPO 微调](https://huggingface.co/learn/llm-course/en/chapter12/5) by Maxime Labonne：用 GRPO 微调小模型的实操练习。
- [DPO Wandb 日志](https://wandb.ai/alexander-vishnevskiy/dpo/reports/TRL-Original-DPO--Vmlldzo1NjI4MTc4) by Alexander Vishnevskiy：展示需要跟踪的主要 DPO 指标与预期趋势。

### 6. 评估（Evaluation）

可靠地评估大模型复杂但关键，它指引数据生成与训练，提供改进方向的宝贵反馈。但要牢记古德哈特定律：「当一个指标成为目标，它就不再是好指标。」

- **自动化基准**：用精选数据集和指标（如 MMLU）在特定任务上评测模型。对具体任务有效，但难以衡量抽象与创造能力，也容易受数据污染影响。
- **人类评估**：由人类对模型提问并打分，从「凭感觉（vibe check）」到带明确规范的系统化标注，再到大规模社区投票（arena）。更适合主观任务，对事实准确性的可靠性较低。
- **基于模型的评估**：用裁判模型和奖励模型评估输出。与人类偏好高度相关，但存在偏向自身输出、打分不一致的问题。
- **反馈信号**：分析错误模式以定位具体弱点，如遵循复杂指令的局限、缺乏特定知识、易受对抗提示攻击等，可通过更好的数据生成与训练参数改进。

📚 参考：

- [LLM 评估指南](https://huggingface.co/spaces/OpenEvals/evaluation-guidebook) by Hugging Face：含实践洞见的全面评估指南。
- [Open LLM Leaderboard](https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard) by Hugging Face：以开放可复现方式对比大模型的主榜单。
- [LM Evaluation Harness](https://github.com/EleutherAI/lm-evaluation-harness) by EleutherAI：流行的自动化基准评测框架。
- [Lighteval](https://github.com/huggingface/lighteval) by Hugging Face：含基于模型评估的替代评测框架。
- [Chatbot Arena](https://lmarena.ai/) by LMSYS：基于人类对比的通用大模型 Elo 评分。

### 7. 量化（Quantization）

量化是把模型的参数和激活转换为更低精度的过程。例如 16-bit 存储的权重可转为 4-bit 表示。这一技术对降低大模型的算力与内存成本越来越重要。

- **基础技术**：了解不同精度（FP32、FP16、INT8 等），掌握 absmax 与 zero-point 的朴素量化。
- **GGUF 与 llama.cpp**：最初为 CPU 设计的 [llama.cpp](https://github.com/ggerganov/llama.cpp) 与 GGUF 格式，已成为在消费级硬件运行大模型最流行的工具，支持在单文件中存储特殊 token、词表和元数据。
- **GPTQ 与 AWQ**：[GPTQ](https://arxiv.org/abs/2210.17323)/[EXL2](https://github.com/turboderp/exllamav2) 和 [AWQ](https://arxiv.org/abs/2306.00978) 引入逐层校准，在极低位宽下仍保持性能，通过动态缩放、选择性跳过或重定中心最重的参数来减少灾难性离群值。
- **SmoothQuant 与 ZeroQuant**：量化友好的变换（SmoothQuant）和基于编译器的优化（ZeroQuant）在量化前缓解离群值，并通过算子融合与数据流优化降低硬件开销。

📚 参考：

- [量化入门](https://mlabonne.github.io/blog/posts/Introduction_to_Weight_Quantization.html) by Maxime Labonne：量化、absmax/zero-point、LLM.int8() 概览（含代码）。
- [用 llama.cpp 量化 Llama 模型](https://mlabonne.github.io/blog/posts/Quantize_Llama_2_models_using_ggml.html) by Maxime Labonne：用 llama.cpp 和 GGUF 量化 Llama 2 的教程。
- [用 GPTQ 做 4-bit 量化](https://mlabonne.github.io/blog/posts/4_bit_Quantization_with_GPTQ.html) by Maxime Labonne：用 GPTQ 算法（AutoGPTQ）量化大模型。
- [理解 AWQ（激活感知权重量化）](https://medium.com/friendliai/understanding-activation-aware-weight-quantization-awq-boosting-inference-serving-efficiency-in-10bb0faf63a8) by FriendliAI：AWQ 技术及其优势概览。
- [SmoothQuant on Llama 2 7B](https://github.com/mit-han-lab/smoothquant/blob/main/examples/smoothquant_llama_demo.ipynb) by MIT HAN Lab：在 8-bit 精度下对 Llama 2 用 SmoothQuant 的教程。
- [DeepSpeed 模型压缩](https://www.deepspeed.ai/tutorials/model-compression/) by DeepSpeed：用 ZeroQuant 和极致压缩（XTC）的教程。

### 8. 新趋势（New Trends）

这里是一些没归入其他类别的值得关注的话题。有些是成熟技术（模型合并、多模态），有些更具实验性（可解释性、test-time compute），是大量研究论文的焦点。

- **模型合并（Model merging）**：合并已训练模型已成为无需微调即可创建高性能模型的流行方式。流行库 [mergekit](https://github.com/cg123/mergekit) 实现了 SLERP、[DARE](https://arxiv.org/abs/2311.03099)、[TIES](https://arxiv.org/abs/2311.03099) 等主流合并方法。
- **多模态模型**：[CLIP](https://openai.com/research/clip)、[Stable Diffusion](https://stability.ai/stable-image)、[LLaVA](https://llava-vl.github.io/) 等模型用统一嵌入空间处理多种输入（文本、图像、音频），解锁文生图等强大应用。
- **可解释性（Interpretability）**：稀疏自编码器（SAE）等机制可解释性技术在揭示大模型内部工作机制上取得显著进展，并衍生出 abliteration 等无需训练就能修改模型行为的技术。
- **Test-time compute**：用 RL 训练的推理模型可以通过在推理时扩大算力预算进一步提升，涉及多次调用、MCTS 或过程奖励模型（PRM）等专用模型。带精确打分的迭代步骤能显著提升复杂推理任务的表现。

📚 参考：

- [用 mergekit 合并大模型](https://mlabonne.github.io/blog/posts/2024-01-08_Merge_LLMs_with_mergekit.html) by Maxime Labonne：用 mergekit 做模型合并的教程。
- [Smol Vision](https://github.com/merveenoyan/smol-vision) by Merve Noyan：小型多模态模型的 Notebook 与脚本合集。
- [Large Multimodal Models](https://huyenchip.com/2023/10/10/multimodal.html) by Chip Huyen：多模态系统概览及该领域近期历史。
- [用 abliteration 给大模型去审查](https://huggingface.co/blog/mlabonne/abliteration) by Maxime Labonne：可解释性技术修改模型风格的直接应用。
- [SAE 的直观解释](https://adamkarvonen.github.io/machine_learning/2024/06/11/sae-intuitions.html) by Adam Karvonen：SAE 如何工作及其对可解释性的意义。
- [Scaling test-time compute](https://huggingface.co/spaces/HuggingFaceH4/blogpost-scaling-test-time-compute) by Beeching 等：用 3B 模型在 MATH-500 上超越 Llama 3.1 70B 的教程与实验。

---

## 👷 第三部分：LLM 工程师（The LLM Engineer）

本部分聚焦如何构建可用于生产的大模型应用，重点是增强模型并部署它们。

> 💡 本站对应：[LLM 应用开发实战](/engineering/llm-app-dev)、[RAG 基础与流程](/rag/rag-basics)、[Agent 基础与框架](/agent/agent-basics)、[推理优化与部署](/inference/inference-optimization)、[大模型安全与对齐](/advanced/safety)。

### 1. 运行大模型

由于硬件要求高，运行大模型可能很困难。根据场景，你可能只是通过 API（如 GPT-4）消费模型，或在本地运行。无论哪种，额外的提示与引导技术都能改进并约束输出。

- **LLM API**：API 是部署大模型的便捷方式，分为私有大模型（[OpenAI](https://platform.openai.com/)、[Google](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/overview)、[Anthropic](https://docs.anthropic.com/claude/reference/getting-started-with-the-api) 等）和开源大模型（[OpenRouter](https://openrouter.ai/)、[Hugging Face](https://huggingface.co/inference-api)、[Together AI](https://www.together.ai/) 等）。
- **开源大模型**：[Hugging Face Hub](https://huggingface.co/models) 是寻找大模型的好地方。可以直接在 [HF Spaces](https://huggingface.co/spaces) 运行，或本地用 [LM Studio](https://lmstudio.ai/)、[llama.cpp](https://github.com/ggerganov/llama.cpp)、[ollama](https://ollama.ai/) 运行。
- **提示工程**：常见技术包括 zero-shot、few-shot、思维链（CoT）、ReAct。大模型上效果更好，但也能适配到小模型。
- **结构化输出**：很多任务需要结构化输出（严格模板或 JSON）。[Outlines](https://github.com/outlines-dev/outlines) 等库可引导生成遵循给定结构，部分 API 也原生支持基于 JSON schema 的结构化输出。

📚 参考：

- [用 LM Studio 本地运行大模型](https://www.kdnuggets.com/run-an-llm-locally-with-lm-studio) by Nisha Arya：LM Studio 简明指南。
- [Prompt 工程指南](https://www.promptingguide.ai/) by DAIR.AI：详尽的提示技术清单（含示例）。
- [Outlines 快速上手](https://dottxt-ai.github.io/outlines/latest/quickstart/)：Outlines 支持的引导生成技术列表。
- [LMQL 概览](https://lmql.ai/docs/language/overview.html)：LMQL 语言入门。

### 2. 构建向量存储

构建向量存储是搭建 RAG 流水线的第一步。文档被加载、切分，相关片段用来生成向量表示（嵌入）并存储，供推理时使用。

- **文档摄取**：文档加载器能处理多种格式（PDF、JSON、HTML、Markdown 等），也能直接从数据库和 API（GitHub、Reddit、Google Drive 等）取数据。
- **文档切分**：文本切分器把文档拆成更小、语义完整的片段。相比按固定字符数切分，常常按标题或递归切分（带额外元数据）更好。
- **嵌入模型**：把文本转成向量表示。针对任务挑选合适模型能显著提升语义检索与 RAG 的效果。
- **向量数据库**：[Chroma](https://www.trychroma.com/)、[Pinecone](https://www.pinecone.io/)、[Milvus](https://milvus.io/)、[FAISS](https://faiss.ai/)、[Annoy](https://github.com/spotify/annoy) 等用于存储嵌入向量，基于向量相似度高效检索与查询「最相似」的数据。

📚 参考：

- [LangChain - 文本切分器](https://python.langchain.com/docs/how_to/#text-splitters)：LangChain 中各类文本切分器列表。
- [Sentence Transformers 库](https://www.sbert.net/)：流行的嵌入模型库。
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)：嵌入模型排行榜。
- [Top 7 向量数据库](https://www.datacamp.com/blog/the-top-5-vector-databases) by Moez Ali：最佳与最流行向量数据库对比。

### 3. 检索增强生成（RAG）

RAG 让大模型从数据库检索上下文文档来提升答案准确性，是无需微调即可扩充模型知识的流行方式。

- **编排器（Orchestrators）**：[LangChain](https://python.langchain.com/docs/get_started/introduction)、[LlamaIndex](https://docs.llamaindex.ai/en/stable/) 等框架用于连接大模型与工具、数据库。模型上下文协议（MCP）引入了跨厂商传递数据与上下文的新标准。
- **检索器（Retrievers）**：CoRAG、HyDE 等查询重写与生成式检索器通过转换用户查询增强搜索。多向量与混合检索结合嵌入和关键词信号来提升召回与精度。
- **记忆（Memory）**：为记住之前的指令与回答，ChatGPT 等会把历史加入上下文窗口。这个缓冲区可用摘要（如用更小的 LLM）、向量库 + RAG 等改进。
- **评估**：需同时评估文档检索（上下文精度与召回）和生成阶段（忠实度与答案相关性），可用 [Ragas](https://github.com/explodinggradients/ragas/tree/main)、[DeepEval](https://github.com/confident-ai/deepeval) 简化。

📚 参考：

- [LlamaIndex - 高层概念](https://docs.llamaindex.ai/en/stable/getting_started/concepts.html)：构建 RAG 流水线需要知道的核心概念。
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)：MCP 的动机、架构与快速上手。
- [Pinecone - 检索增强](https://www.pinecone.io/learn/series/langchain/langchain-retrieval-augmentation/)：检索增强流程概览。
- [LangChain - 用 RAG 做问答](https://python.langchain.com/docs/tutorials/rag/)：构建典型 RAG 流水线的分步教程。
- [LangChain - 记忆类型](https://python.langchain.com/docs/how_to/chatbots_memory/)：各类记忆及其用法。
- [RAG 流水线 - 指标](https://docs.ragas.io/en/stable/concepts/metrics/index.html)：评估 RAG 的主要指标概览。

### 4. 进阶 RAG

真实应用可能需要复杂流水线，包括 SQL 或图数据库，以及自动选择相关工具和 API。这些进阶技术能改进基线方案并提供额外能力。

- **查询构造**：传统数据库中的结构化数据需要 SQL、Cypher、元数据等特定查询语言。可用查询构造把用户指令直接翻译成查询去访问数据。
- **工具（Tools）**：Agent 通过自动选择最相关的工具来增强大模型。工具可以简单如用 Google 或 Wikipedia，也可复杂如 Python 解释器或 Jira。
- **后处理**：处理喂给大模型的输入的最后一步，用重排（re-ranking）、[RAG-fusion](https://github.com/Raudaschl/rag-fusion)、分类等提升检索文档的相关性与多样性。
- **以编程方式优化 LLM**：[DSPy](https://github.com/stanfordnlp/dspy) 等框架让你基于自动评估以编程方式优化提示和权重。

📚 参考：

- [LangChain - 查询构造](https://blog.langchain.dev/query-construction/)：各类查询构造的博客。
- [LangChain - SQL](https://python.langchain.com/docs/tutorials/sql_qa/)：用大模型与 SQL 数据库交互的教程（Text-to-SQL）。
- [Pinecone - LLM agents](https://www.pinecone.io/learn/series/langchain/langchain-agents/)：Agent 与工具入门。
- [LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) by Lilian Weng：关于 LLM Agent 的理论文章。
- [LangChain - OpenAI 的 RAG](https://blog.langchain.dev/applying-openai-rag/)：OpenAI 采用的 RAG 策略概览（含后处理）。
- [DSPy in 8 Steps](https://dspy-docs.vercel.app/docs/building-blocks/solving_your_task)：DSPy 通用指南，介绍模块、签名、优化器。

### 5. Agent（智能体）

LLM Agent 能基于对环境的推理采取行动，自主完成任务，通常通过工具或函数与外部系统交互。

- **Agent 基础**：Agent 通过思考（内部推理决定下一步）、行动（执行任务，常与外部工具交互）、观察（分析反馈或结果以优化下一步）运作。
- **Agent 协议**：[模型上下文协议（MCP）](https://modelcontextprotocol.io/) 是连接 Agent 与外部工具、数据源的行业标准（MCP server 与 client）。更近的 [Agent2Agent（A2A）](https://a2a-protocol.org/) 尝试标准化 Agent 互操作的通用语言。
- **厂商框架**：各大云模型厂商有自己的 Agent 框架，如 [OpenAI SDK](https://openai.github.io/openai-agents-python/)、[Google ADK](https://google.github.io/adk-docs/)、[Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)。
- **其他框架**：[LangGraph](https://www.langchain.com/langgraph)（工作流设计与可视化）、[LlamaIndex](https://docs.llamaindex.ai/en/stable/use_cases/agents/)（带 RAG 的数据增强 Agent）等可简化 Agent 开发。更具实验性的多 Agent 协作框架包括 [CrewAI](https://docs.crewai.com/introduction)（基于角色的团队工作流）和 [AutoGen](https://github.com/microsoft/autogen)（对话驱动的多 Agent 系统）。

📚 参考：

- [Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction)：Hugging Face 出品的热门 AI Agent 课程。
- [LangGraph](https://langchain-ai.github.io/langgraph/concepts/why-langgraph/)：用 LangGraph 构建 AI Agent 概览。
- [LlamaIndex Agents](https://docs.llamaindex.ai/en/stable/use_cases/agents/)：用 LlamaIndex 构建 Agent 的用例与资源。

### 6. 推理优化

文本生成成本高，需要昂贵硬件。除量化外，还有多种技术可最大化吞吐、降低推理成本。

- **Flash Attention**：优化注意力机制，把复杂度从二次降到线性，同时加速训练与推理。
- **KV 缓存**：理解键值缓存，以及 [Multi-Query Attention（MQA）](https://arxiv.org/abs/1911.02150) 和 [Grouped-Query Attention（GQA）](https://arxiv.org/abs/2305.13245) 带来的改进。
- **投机解码（Speculative decoding）**：用小模型生成草稿，再由大模型审核，加速文本生成。EAGLE-3 是特别流行的方案。

📚 参考：

- [GPU 推理](https://huggingface.co/docs/transformers/main/en/perf_infer_gpu_one) by Hugging Face：如何优化 GPU 推理。
- [LLM 推理](https://www.databricks.com/blog/llm-inference-performance-engineering-best-practices) by Databricks：生产环境优化大模型推理的最佳实践。
- [优化大模型速度与内存](https://huggingface.co/docs/transformers/main/en/llm_tutorial_optimization) by Hugging Face：量化、Flash Attention、架构创新三大优化技术。
- [Assisted Generation](https://huggingface.co/blog/assisted-generation) by Hugging Face：HF 版投机解码，含实现代码。
- [EAGLE-3 论文](https://arxiv.org/abs/2503.01840)：介绍 EAGLE-3，报告最高 6.5× 加速。
- [Speculators](https://github.com/vllm-project/speculators)：vLLM 出品的投机解码算法构建/评估/存储库。

### 7. 部署大模型

大规模部署大模型是一项工程壮举，可能需要多个 GPU 集群。其他场景下，demo 和本地应用可以用低得多的复杂度实现。

- **本地部署**：隐私是开源大模型相对私有模型的重要优势。本地 LLM 服务器（[LM Studio](https://lmstudio.ai/)、[Ollama](https://ollama.ai/)、[oobabooga](https://github.com/oobabooga/text-generation-webui)、[kobold.cpp](https://github.com/LostRuins/koboldcpp) 等）利用这一优势驱动本地应用。
- **Demo 部署**：[Gradio](https://www.gradio.app/)、[Streamlit](https://docs.streamlit.io/) 等框架适合快速原型与分享 demo，也能轻松托管到 [HF Spaces](https://huggingface.co/spaces) 等。
- **服务器部署**：大规模部署需要云（参考 [SkyPilot](https://skypilot.readthedocs.io/en/latest/)）或本地基础设施，常用优化的文本生成框架如 [TGI](https://github.com/huggingface/text-generation-inference)、[vLLM](https://github.com/vllm-project/vllm/tree/main) 等。
- **边缘部署**：受限环境中，[MLC LLM](https://github.com/mlc-ai/mlc-llm)、[mnn-llm](https://github.com/wangzhaode/mnn-llm/blob/master/README_en.md) 等高性能框架可在浏览器、Android、iOS 上部署大模型。

📚 参考：

- [Streamlit - 构建基础 LLM 应用](https://docs.streamlit.io/knowledge-base/tutorials/build-conversational-apps)：用 Streamlit 做类 ChatGPT 应用的教程。
- [HF LLM 推理容器](https://huggingface.co/blog/sagemaker-huggingface-llm)：在 Amazon SageMaker 上用 HF 推理容器部署大模型。
- [Philschmid 博客](https://www.philschmid.de/) by Philipp Schmid：关于用 SageMaker 部署大模型的高质量文章合集。
- [优化延迟](https://hamel.dev/notes/llm/inference/03_inference.html) by Hamel Husain：TGI、vLLM、CTranslate2、mlc 的吞吐与延迟对比。

### 8. 大模型安全

除了软件常见的安全问题，大模型因其训练和提示方式还有独特弱点。

- **提示攻击（Prompt hacking）**：包括提示注入（附加指令劫持模型回答）、数据/提示泄露（套取原始数据或系统提示）、越狱（构造提示绕过安全机制）。
- **后门（Backdoors）**：攻击可针对训练数据本身——投毒训练数据（如注入虚假信息）或植入后门（推理时改变模型行为的秘密触发器）。
- **防御措施**：保护大模型应用的最佳方式是针对这些漏洞做测试（如红队演练与 [garak](https://github.com/leondz/garak/) 等检查），并在生产中持续观测（如用 [langfuse](https://github.com/langfuse/langfuse)）。

📚 参考：

- [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)：大模型应用中最关键的 10 类漏洞清单。
- [Prompt Injection Primer](https://github.com/jthack/PIPE) by Joseph Thacker：面向工程师的提示注入简明指南。
- [LLM Security](https://llmsecurity.net/) by [@llm_sec](https://twitter.com/llm_sec)：大模型安全相关资源的详尽清单。
- [红队测试大模型](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/red-teaming) by Microsoft：如何对大模型做红队演练的指南。

---

## 致谢（Acknowledgements）

本路线图由 Maxime Labonne 创作，灵感来自 Milan Milanović 与 Romano Roth 的 [DevOps Roadmap](https://github.com/milanm/DevOps-Roadmap)。原作者特别感谢 Thomas Thelen、André Frade、Dino Dunn、Magdalena Kuhn、Odoverdose 以及所有为课程贡献教育资源的人。

> *免责声明（原作者）：作者与此处列出的任何来源均无关联。*

---

::: tip 关于本页
本页为 [mlabonne/llm-course](https://github.com/mlabonne/llm-course)（Apache-2.0）的中文译本，由 LLMGuide 整理。如发现翻译问题或链接失效，欢迎在 [本站仓库](https://github.com/Meko1/llm-interview-guide) 提 Issue / PR。原始英文与最新更新请以[原项目](https://github.com/mlabonne/llm-course)为准。
:::
