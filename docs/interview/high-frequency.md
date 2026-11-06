---
title: 大模型高频面试题速记
description: 用短答、条件与反例串起大模型基础、训练、RAG、Agent 和推理评估；纠正速记中的绝对化结论，按岗位选择追问路线，不把题目顺序当招聘频率统计。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 大模型高频面试题速记

> **速查不是标准答案库**：标题沿用旧 URL 与站内名称；本站没有代表性招聘样本，不能据此声称题目真实出现频率。先口述机制，再补成立条件，最后举一个会失效的例子。手撕环节配合 [手撕代码题解集](/interview/coding-problems)。

| 阅读层级 | 你需要留下的回答证据 | 不足以证明什么 |
| --- | --- | --- |
| L1 应用 | 说明输入、输出和失败定位；能找到正文中的机制依据 | 背出缩写不等于能接入系统 |
| L2 工程 | 固定负载、单位、权限与预算，比较替代方案和故障恢复 | 没有环境的“提升几倍”不能用于选型 |
| L3 研究 | 说明推导假设、对照实验、统计不确定性与复现范围 | 论文作者的成绩不是自己的实验 |

如果你的目标岗位 JD 里出现 Spring AI、LangChain、LangGraph、Dify、MaaS、Agent 评测等工程词，先看 [基础篇高频问答加厚版](/interview/foundation-qna)，它更偏岗位追问和项目复述。

## 一、Transformer 与基础

**Transformer 为什么能取代 RNN？** 自注意力让训练阶段同一序列的 token 表示并行计算，并缩短可见位置间的信息路径；因果掩码仍禁止访问未来，生成仍逐 token。普通稠密注意力在长度 n、头维度 d 下计算量为 O(n²d)，不是整个系统只有 O(n²)。RNN 在流式或资源受限任务仍有价值。详见 [Transformer](/basics/transformer)。

**为什么主流 LLM 都是 Decoder-only？** 许多生成模型采用因果下一 token 目标，便于把文本任务统一成续写并复用训练与推理栈；不代表所有 LLM 都如此，也不能从架构名字推出泛化更强。检索编码器和 encoder-decoder 仍适合各自任务。详见 [架构选择](/basics/model-architecture-landscape)。

**Self-Attention 公式？为什么除以 √dₖ？** $\text{softmax}(QK^T/\sqrt{d_k})V$；除以 √dₖ 防止点积方差过大使 softmax 进入饱和区、梯度消失。详见 [Attention](/basics/attention)。

**MHA / MQA / GQA / MLA 区别？** MHA 通常让 Q 与 KV 头一一对应；MQA 共享一组 KV，GQA 分组共享，减少相同序列的 KV 存储。MLA 缓存低维潜变量并处理位置编码相关部分，不能简单当作“给旧模型无损压缩”。容量、质量和算子效率须在具体架构、训练及服务配置下比较。详见 [KV Cache](/inference/kv-cache)。

**RoPE 为什么能体现相对位置？** 对同一频率下的 Q、K 做旋转，旋转矩阵在点积中的位置作用可写成相对位移 n−m；完整分数还依赖内容向量，不能说只由位置决定。PI、NTK-aware 与 YaRN 是 RoPE 扩展路线，不是所有长上下文方法。详见 [位置编码](/basics/position-encoding)。

**为什么用 RMSNorm + Pre-Norm？** RMSNorm 按均方根缩放，不做 LayerNorm 的去均值；Pre-Norm 在子层前归一化，使残差路径更直接。成本与稳定性是设计动机，不保证任意模型同质量；归一化位置、学习率与残差尺度须一起考虑。详见 [归一化与激活](/basics/normalization)。

**SwiGLU 是什么？** 两个输入投影分别产生值与 SiLU 门控，逐元素相乘后再投影回模型维度。若忽略 bias、以普通 4d FFN 的 8d² 参数为参照，三个矩阵的 3dm 匹配给出 m≈8d/3；实际会按硬件对齐取整，收益取决于训练配置。详见 [Transformer](/basics/transformer)。

**词表大小怎么权衡？** 更大词表可能降低特定语料的 token/字符比，但也增加 embedding、输出层和词表计算成本；多语言质量取决于语料覆盖，不能由词表大小直接推出。比较时固定文本、规范化与特殊 token 规则，分别统计长度和任务效果。详见 [Tokenizer](/basics/tokenizer)。

**长上下文怎么外推？** 训练短、推理长会让 RoPE 遇到没见过的角度。位置插值（PI）线性压缩位置；NTK/YaRN 按频率分层调整 base；配合长文本继续预训练。详见 [长上下文专题](/basics/long-context)。

**涌现能力是真的吗？** 模型规模过阈值后某些能力「突然」出现。一种观点认为是度量不连续（用对数/连续指标看是平滑提升），但工程上「小模型做不了的任务大模型能做」的现象真实存在。详见 [缩放定律](/pretraining/scaling-law)。

## 二、训练与微调

**预训练目标？为什么用 CLM？** CLM（预测下一 token，GPT/LLaMA）、MLM（掩码还原，BERT）、Span Corruption（T5）。主流用 CLM：目标统一、用满数据、适配生成。详见 [预训练](/pretraining/pretrain)。

**数据处理流水线？** 清洗 → 去重（MinHash）→ 质量过滤 → 去毒/去隐私 → 配比混合 → tokenize 打包。去重防记忆过拟合，至关重要。

**显存花在哪？** 一种混合精度 Adam 账本为：BF16 权重 2Ψ 字节、BF16 梯度 2Ψ、FP32 主权重 4Ψ、两个 FP32 矩 8Ψ，合计 16Ψ，另加激活与通信临时缓冲。主权重不是 Adam 的两个矩；梯度精度、分片与优化器实现会改变账本，长序列激活也可能主导。详见 [分布式训练显存](/basics/distributed-training-memory)。

**DP / TP / PP 区别？** DP 复制整模型喂不同数据；TP 切单层大矩阵（机内高带宽）；PP 切不同层（有流水线气泡）。超大模型用 3D 并行组合。

**ZeRO 三个阶段？** 分别累积分片优化器状态、梯度、参数。FSDP 的 full-shard 与 ZeRO-3 在分片目标上相近，但包裹粒度、参数收集、通信、保存和 API 不等价；不能照搬一个框架的配置。详见 [分布式训练](/pretraining/distributed-training)。

**SFT 为什么只对回答算 loss？** response-only 是一种监督掩码选择，让损失聚焦目标回答；输入仍参与前向并影响回答梯度。全序列监督、多轮助手掩码及工具消息有其他配方，必须检查模板和 labels，不是所有 SFT 都只训最后回答。详见 [微调范式](/finetuning/finetuning)。

**LoRA 原理？为什么高效？** 用 ΔW=(α/r)BA 训练低秩更新；单层新增参数 r(d_in+d_out)，原矩阵是 d_in·d_out。训练参数与状态变小不等于总显存同比下降。匹配精度和单适配器部署时可合并消除旁路算子；动态多适配器、量化合并和质量变化需要另外验证。详见 [LoRA](/finetuning/lora)。

**微调 vs RAG vs Prompt 怎么选？** 改风格/格式/能力 → 微调；注入实时/私有事实 → RAG；快速验证简单任务 → Prompt。常组合。

**RLHF 流程？** SFT → 训练奖励模型（RM）→ 用 PPO 优化策略。DPO 跳过 RM 直接用偏好数据优化。详见 [RLHF / DPO](/finetuning/rlhf)。

**MoE 为什么省成本？为什么费显存？** 稀疏路由使每 token 只计算部分专家，但总专家权重仍需存储；全部 GPU 常驻时显存较大，也可卸载专家，以传输和调度开销换更低常驻显存。计算节省不保证同质量或更快，需计入路由、通信、负载不均与缓存。详见 [MoE](/basics/moe) 和 [专家卸载原论文](https://arxiv.org/abs/2312.17238)。

**QLoRA 和 LoRA 区别？** QLoRA 在冻结的 4-bit 量化基座上训练 LoRA，论文还采用 NF4、double quantization 和 paged optimizers。存储位宽不等于全部算子在 4-bit 中计算。“单卡可训”需给出模型、显存、序列长度和 batch；不能保证量化误差极小或训练只略慢。详见 [微调范式](/finetuning/finetuning)。

**DPO 和 PPO 怎么选？** 标准离线 DPO 用固定偏好对训练，不需训练循环中在线 rollout 或单独拟合 RM；偏好数据仍需收集，参考模型与数据质量仍有成本。PPO 类方法用采样和奖励反馈更新策略，能探索也可能奖励投机、失稳；没有通用“上限更高”结论。详见 [偏好优化](/finetuning/preference-optimization)。

**GRPO 一句话？** 对同一问题采一组回答，用组内奖励构造相对优势，省去单独的 critic 网络；组内奖励全相同可能没有有效学习信号，仍受奖励投机、采样成本和实现变体影响。它不只限于可验证奖励，也不保证稳定。推导见 [强化学习基础](/advanced/rl-basics)。

**灾难性遗忘怎么缓解？** 先用冻结的通用与领域切片证明退化，再比较数据回放、正则、学习率和早停。LoRA 限制更新的秩，不自动限制更新幅度；权重融合也可能损坏能力。保留基座与版本，报告提升和退化而非只看领域均分。

**Chinchilla 结论？** 在论文研究的训练计算预算与拟合范围内，参数和训练 token 数约同比例扩展。约 20:1 是特定结果，不是跨模型固定配方；计入服务需求后的生命周期成本是另一个优化目标，小模型多训练是否划算还需同质量对照。详见 [训练预算](/pretraining/compute-budget)。

**预训练数据怎么清洗？** 抽取 → 语种过滤 → 规则过滤 → 质量分类器打分 → MinHash 去重 → 去毒/PII → 评测集去污染 → 配比退火。详见 [数据工程与合成数据](/pretraining/data-engineering)。

## 三、Prompt / RAG / Agent

**CoT 为什么有效？** 中间步骤提供可继续条件化的推理状态和额外生成计算，在一些任务上有帮助；错误步骤也会传播。效果取决于模型训练、题型、提示与校验，不能说只在大模型有效或必然降低出错概率；可见解释不一定忠实反映内部决策。详见 [CoT 与推理](/prompt/cot-reasoning)。

**RAG 完整流程？** 离线解析、分块、建索引并记录来源与版本；在线确认用户和授权、检索、重排、上下文打包、生成并核查引用。删除/更新须传到索引与缓存；证据不足应弃答，不能把“查到了”当“答对了”。详见 [RAG 基础](/rag/rag-basics)。

**为什么「向量召回 + Rerank」两段式？** Bi-encoder 可预计算文档向量，适合大候选集；cross-encoder 联合编码查询与候选，单对成本更高、可能改善排序。重排不能找回召回阶段遗漏的证据，须分别检查 recall@k、排序与端到端回答。详见 [Embedding 与向量库](/rag/embedding-vectordb)。

**RAG 召回不准怎么优化？** 查询改写 / HyDE / Multi-Query（检索前）、混合检索 + 元数据过滤 + 父子分块（检索中）、Rerank + 上下文压缩（检索后）。详见 [RAG 进阶](/rag/rag-advanced)。

**HNSW 为什么快？** 用分层图从稀疏上层导航到底层，再维护候选进行近邻搜索，避免全量距离计算。近似检索的实际召回和时延取决于图参数、查询预算、数据分布与过滤；O(log N) 不是所有输入的最坏时延保证。详见 [向量检索](/advanced/vector-search)。

**Agent = ？** 在运行循环中根据任务状态和观察选择后续动作，工具调用是常见实现。规划、长期记忆和多角色不是必需组件；工程上还要有终止、预算与授权边界。ReAct 是推理与行动交替的一种范式。详见 [Agent 基础](/agent/agent-basics)。

**ReAct vs Plan-and-Execute？** 前者按观察逐步选行动，后者显式拆分计划与执行；后者也可重规划，前者也可维护全局目标。比较错误恢复、依赖约束、工具开销与可观测性，不要把名字当能力保证。详见 [工作流工程](/agent/workflow-engineering)。

**Function Calling 是模型自己执行函数吗？** 不是，模型只返回结构化调用意图，执行由你的代码完成。

**chunk 大小怎么定？** 保留可回答的语义单位与来源位置，再在固定文档、查询和总上下文预算下比较分块大小、重叠和父子检索。表格、代码与条款不能一律按固定 token 切；重叠会增加索引量和重复证据，不是免费兜底。详见 [分块与检索](/rag/chunking-retrieval)。

**GraphRAG 解决什么？** 一类方法利用实体关系与社区摘要帮助组织跨文档证据、回答全局问题；不同模式可能用社区报告聚合或局部检索，不能一概说查询时都是图遍历。普通 RAG 也可多跳或层次汇总；图中错误关系、摘要失真和增量维护须计入评估。详见 [GraphRAG](/rag/graphrag)。

**MCP 的三大原语？** Tools（模型可调用的操作）、Resources（可读取的数据）、Prompts（可复用模板）。Host-Client-Server 架构 + JSON-RPC，解决「M 个应用 × N 个工具」的重复集成。详见 [MCP 协议深入](/agent/mcp)。

**MCP Server 生产化怎么讲？** 把 Server 当生产 API 治理：Registry 管 owner/版本/风险，Policy/Gateway 管鉴权/限流/灰度，Server 侧二次鉴权和审计，第三方 Server 做供应链评审，Resources 只读也要 ACL 和脱敏。详见 [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)。

**Agent 工具安全怎么做？** 模型只提议；执行端按可信用户/租户身份和当前资源权限校验参数。高风险动作绑定审批快照、业务幂等键与结果确认，提交未知时先对账而非换键重试。并非所有工具支持 prepare/commit；审计也要脱敏和访问控制。详见 [Agent 工具安全与权限边界](/agent/tool-safety)。

**Agent 怎么证明可上线？** 在冻结任务与对抗切片中检查终态、副作用、成本、安全和审计，把危险违规设为发布阻断项，并限制灰度范围、监控与回滚。测试观察到 0 次违规不证明真实风险为 0：独立同分布假设下，n 次零事件的单侧 95% 上界是 1−0.05^(1/n)，n=100 时仍约 2.95%。详见 [重复试验](/agent/repeated-trial-evaluation)。

**LangGraph 生产化最容易被追问什么？** State 四分法、checkpoint 恢复语义、HITL resume、写操作幂等、图版本升级、并行 State 合并、trace 和上线门禁。核心是把 Agent 当可恢复状态机，而不是黑盒 ReAct 循环。详见 [LangGraph 状态图 Agent 生产化高频问答](/interview/langgraph-production-qna)。

**Spring AI 生产化怎么讲？** 重点不是少写 HTTP，而是把 ChatClient、RAG、Tool Calling、SSE 接入 Spring Security、限流、审计、模型网关和成本治理；SSE 要处理断开、超时、审核失败，RAG 权限要检索前过滤。详见 [Spring AI / Java AI 生产化高频问答](/interview/spring-ai-production-qna)。

**Dify PoC 到生产要补什么？** 补版本、权限、评估、观测、成本、灰度和审计；检索与工具授权须由服务端强制。若现有实现无法满足恢复、提交处核权、审批绑定和幂等/对账要求，再把相关执行逻辑迁至受控代码服务；迁移本身不是安全保证。详见 [Dify 生产化问答](/interview/dify-production-qna)。

**MaaS 平台怎么证明不是多包一层网关？** 网关管请求执行，MaaS 还要管模型目录、虚拟 Key、租户配额、评测门禁、成本账单、合规审批、模型生命周期和事故复盘。详见 [MaaS 平台生产化高频问答](/interview/maas-production-qna)。

**上下文工程四操作？** Write、Select、Compress、Isolate 可作为整理持久状态、检索、压缩与隔离的教学框架，不是统一协议。压缩要保留约束、授权和原文指针；多 Agent 分开上下文也不自动形成数据安全隔离。详见 [上下文工程](/agent/context-engineering)。

## 四、推理优化与评估

**Prefill 和 Decode 区别？** 前者处理输入并建立状态，后者逐步生成并复用 KV。长输入 prefill 往往更偏计算，小批量 decode 往往更偏带宽；batch、模型和硬件会改变瓶颈。TTFT 还含排队/网络，吞吐也受调度影响。详见 [推理优化](/inference/inference-optimization)。

**Decode 为什么是 memory-bound？** 小批量下权重与 KV 的数据搬运可能相对算术量更大；增大 batch 能复用权重，长上下文又增大 KV 访问。MoE 不会每 token 计算全部专家，“每次完整读全权重”也不是所有硬件缓存/并行实现的事实。用实测与 roofline 判断。详见 [推理压测](/inference/inference-benchmark)。

**KV Cache 是什么？瓶颈？** 缓存历史 token 的 K、V 避免重算；显存随序列长度线性增长，是长上下文瓶颈。对策：GQA/MQA/MLA、PagedAttention、KV 量化。

**量化方法？** GPTQ、AWQ 是权重量化方法；GGUF 是模型文件容器，不是量化算法。低位宽可能减少存储，但提速需匹配 kernel、硬件和负载，质量退化也未必轻微；分别比较权重、激活、KV 精度以及高风险切片。详见 [量化](/inference/quantization)。

**投机解码为什么不掉精度？** 精确投机采样用目标/草稿概率构造接受与拒绝后的残差分布，在假设和数值精度内恢复目标采样分布；不是只收下大模型“同意”的 token，也不等于逐字相同或回答事实正确。速度另取决于接受率与验证成本。详见 [概率恢复](/inference/speculative-sampling-proof)。

**FlashAttention 是近似吗？** 原始稠密算法是 IO-aware 精确注意力，通过分块与在线 softmax 避免在 HBM 物化完整 n×n 分数矩阵；减少的是注意力中间存储与 IO，不把稠密算术复杂度变成线性，也不把整个模型显存变成 O(n)。浮点结果不承诺逐位一致。详见 [FlashAttention](/advanced/flash-attention)。

**怎么评估大模型？** 自动指标（PPL/BLEU/ROUGE）、基准（MMLU/C-Eval/GSM8K/HumanEval）、人评（Chatbot Arena）、LLM-as-a-Judge。详见 [模型评估](/evaluation/evaluation)。

**幻觉成因与缓解？** 区分无证据的主张、错误知识、检索失败和对给定证据的误用；分别定位数据、检索与生成。RAG、引用检查与弃答可降低特定风险，温度降低只减少随机性，不能修复错误事实。报告证据支持率和弃答覆盖，不只看流畅度。

**推理模型为什么强？怎么训的？** 某些模型通过监督、蒸馏或强化学习形成更有效的分步推理行为，并在推理时投入额外计算。训练配方与公开范围各异，不能凭可见长回答推断做了 RL，更不能把长度当正确性。比较固定预算下的结果与验证器可靠性。详见 [推理模型与慢思考](/advanced/reasoning-models)。

**Test-time scaling 有哪些工程做法？** 垂直深化（long CoT / budget forcing）、水平并行（Self-Consistency / Best-of-N）、树/图搜索（ToT / MCTS / PRM-guided beam）。关键看有没有 verifier，以及 SLA/成本能否承受。详见 [推理时算力扩展](/inference/test-time-scaling)。

**Self-Consistency 手撕怎么写？** 把模型调用抽象成 `generate_fn`，循环采样多条回答，先用 `parse_answer` 抽取可投票答案，再用 `Counter` 多数投票；提前停止要判断第二名即使拿满剩余票也追不上第一名。详见 [手撕代码题解集](/interview/coding-problems)。

**Snell 2024 的 compute-optimal test-time scaling 怎么理解？** 在其研究配置中，预算分配与问题难度、候选生成和选择方法有关；没有“简单/中等/困难”对应固定策略的通用表。部署还要验证难度估计误差、验证器成本与时延，FLOPs 最优也不必等于账单或用户体验最优。详见 [推理时算力扩展](/inference/test-time-scaling)。

**推理模型内建 long CoT 后，还要服务侧 BoN/SC 吗？** 高价值、可验证、可离线并行的任务仍有意义；实时聊天和低价值请求通常不值得。面试回答要把收益、延迟、token 成本、verifier 可靠性一起讲。

**越狱 vs Prompt 注入？** 越狱绕过模型安全对齐让其说违禁内容；注入把「数据」伪装成「指令」劫持应用行为（RAG/Agent 中的间接注入最危险）。防护靠指令数据分离 + 最小权限 + 护栏 + 人工确认。详见 [大模型安全](/advanced/safety)。

**TTFT 和 TPOT 分别由什么决定？** 先明确计时边界：端到端 TTFT 包含排队、输入处理与传输；TPOT 是后续 token 时间的汇总，流式到达也受网络缓冲影响。二者都受混合调度、batch 和负载影响，并非优化方向完全独立。用单请求与混合负载的分位数对照。详见 [SLO 与 goodput](/inference/slo-goodput)。

**连续批处理（Continuous Batching）解决什么？** 在迭代级调整活动请求，减少等待整批最慢请求的槽位浪费；接入仍受 token、KV、公平性与调度预算限制。吞吐收益必须固定负载和 SLO 实测，不能把它与 PagedAttention 各归为吞吐的一半。详见 [服务框架](/inference/serving-frameworks)。

**LLM-as-a-Judge 有什么坑？** 位置、长度、自我偏好以及事实/推理错误。交换候选位置后须恢复候选身份；两轮冲突单列复核，不能直接把“A 胜/B 胜”取平均当平局。用独立人工参照报告覆盖率、误放行和切片；一致不等于正确。详见 [裁判校准](/evaluation/judge-calibration)。

**榜单分数为什么可能虚高？** 污染、反复对测试集调参、选择性报告和评测协议差异都可能影响分数。公开/私有题成绩差也可能来自难度与分布；n-gram 重叠只能给线索，未检出不证明没污染。追查来源、训练可访问性和同条件对照。详见 [污染审计](/pretraining/contamination-audit)。

## 五、系统设计高频题

> 这类题没有标准答案，重点是讲清思路与权衡。

- **设计一个企业知识库问答系统（RAG）**：先定义允许用户、证据版本与弃答条件；再设计文档生命周期、检索与引用；用权限/过期/缺证据负例检验发布门禁。评估框架只是工具，缓存键和更新删除也须遵守授权。详见 [RAG 生产化](/rag/rag-production)。
- **设计高并发大模型服务**：先固定输入/输出长度分布、到达率和 SLO；再比较调度、副本、限流与缓存。报告满足质量和时延的逻辑请求 goodput；供应商切换须处理输出契约、预算及已开始的外部副作用，而非无条件重试。详见 [应用开发实战](/engineering/llm-app-dev)。
- **设计 Agent 工具执行平台**：Tool Registry → Router → Policy Engine → Approval Service → Executor Sandbox → Audit/Trace，重点讲权限边界、高危动作确认、幂等和注入防护。详见 [Agent 工具安全与权限边界](/agent/tool-safety)。
- **私有化部署方案**：模型选型与量化 → GPU 选型与成本 → 推理框架（vLLM/TGI）→ 负载均衡高可用 → 监控告警 → 数据安全与隔离。

## 六、前沿趋势速答

**test-time scaling 是什么？** 在模型之外或模型生成过程中增加推理计算，例如更多步骤、多候选与搜索；它补充而非替代训练计算。收益依赖任务、模型、样本相关性与验证器，不保证继续加预算就变好。服务侧见 [推理时算力扩展](/inference/test-time-scaling)，模型侧见 [推理模型](/advanced/reasoning-models)。

**R1-Zero 为什么重要？** 作者报告从预训练基座直接做 RL 的研究路线，无前置 SFT 阶段，并观察到特定推理行为；“纯 RL”不代表没有预训练、奖励设计或任务分布选择，也不是最终 R1 的全部训练流程。不能把此结果外推成任何基座都能复现。详见 [DeepSeek 专题](/models/deepseek)。

**数据墙怎么破？** 合成数据、任务反馈、多模态与数据利用效率都是研究路线，不是已经证明无条件有效的突破。需要去重、污染检查、验证与分布覆盖；重复放大教师错误可能降低质量，后训练和更多推理也不能凭空补齐缺失事实。详见 [合成数据](/finetuning/synthetic-data)。

**为什么大家又开始做小模型（SLM）？** 端侧隐私/离线/低延迟需求 + 蒸馏让小模型继承大模型能力 + Agent 系统里「小模型做简单步骤」更经济。详见 [SLM 专题](/models/slm)。

**Agent 方向最新趋势？** 面试时应改问“这条路线解决了哪种失败”：持久工作流解决恢复缺口，上下文工程组织证据和状态，工具协议降低集成重复，训练改善特定行动策略。多 Agent 或端到端 RL 不自动更可靠；动态产品事实需查版本，不靠趋势词排序。详见 [Agentic RL](/advanced/agentic-rl)。

## 速记口诀

- **架构口诀只是索引**：归一化、位置编码、注意力和 FFN 可独立选择；常见组合不是标准规范。
- **省显存先分账**：权重、KV、激活和临时缓冲分别治理；PagedAttention 管理分配碎片，不缩小每个 KV 元素。
- **RAG 优化先定位**：证据没入库、没召回、被压缩丢失或被误用，分别处理，不能先堆组件。
- **降本保持契约**：模型路由、缓存、压缩和输出上限都要重测质量、安全、覆盖与时延；少输出不等于完成任务。

<details>
<summary>面试自测：为什么“零失败、INT4、双轮裁判”仍不能直接发布？</summary>

**场景（构造示例，不是实测）**：100 个独立测试任务没有越权；换 INT4 后平均分不变，但没有统计延迟；裁判交换顺序后总选第一项。

- **L1**：第一项在两轮中对应不同候选，这是位置冲突；平均分也隐藏了具体任务退化。
- **L2**：零事件样本仍有不确定性；须增加高风险切片、拒绝判断与人工复核，固定负载测量 goodput/成本，并限制灰度和回滚。安全约束不能用均分补偿。
- **L3**：约 2.95% 上界来自独立同分布二项假设；同一模板的重复任务相关，不能照搬该区间或宣称得到全分布安全保证。

</details>

## 来源与核查范围

本页是速查整理，不是完整文献复现。以下原始资料支持相关机制与证据边界；论文摘要的成绩仅属于原实验，不移植为本站测评。框架、价格、职位频率和产品默认值未据此认证。

- [FlashAttention 原论文](https://arxiv.org/abs/2205.14135)：稠密 exact attention 的 IO-aware 动机，区别于近似注意力。
- [Speculative Sampling 原论文](https://arxiv.org/abs/2302.01318)：在硬件数值范围内恢复目标分布，速度是特定分布式设置的实验结果。
- [MT-Bench / LLM-as-a-Judge 原论文](https://arxiv.org/abs/2306.05685)：位置、长度、自我偏好与有限推理能力；校准步骤参见站内裁判专题。
- [QLoRA 原论文](https://arxiv.org/abs/2305.14314)：4-bit 冻结基座、低秩适配、double quantization 与 paged optimizers。
- [Chinchilla 原论文](https://arxiv.org/abs/2203.15556)：训练计算预算内的参数/token 分配，不是全生命周期固定配方。
- [MoE 专家卸载研究](https://arxiv.org/abs/2312.17238)：有限加速器显存下的参数卸载路线，证明“所有专家必须常驻 GPU”不是通用约束；不移植其速度为本站性能。

其余问题沿站内详解追查来源；要声称个人复现，还需记录模型/代码版本、数据、硬件、预算、日志与失败样例。
