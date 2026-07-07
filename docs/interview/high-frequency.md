# 大模型高频面试题速记

> 把全站核心考点浓缩成「一问一答」速查卡，适合面试前快速过一遍。每题都链接到对应详解页，想深入就点进去。手撕环节请配合 [手撕代码题解集](/interview/coding-problems) 一起准备。

如果你的目标岗位 JD 里出现 Spring AI、LangChain、LangGraph、Dify、MaaS、Agent 评测等工程词，先看 [基础篇高频问答加厚版](/interview/foundation-qna)，它更偏岗位追问和项目复述。

## 一、Transformer 与基础

**Transformer 为什么能取代 RNN？** 并行训练（不必按时间步串行）、长距离依赖建模（任意位置 O(1) 路径）、易扩展。代价是 Attention O(n²)。详见 [Transformer](/basics/transformer)。

**为什么主流 LLM 都是 Decoder-only？** 训练目标统一（预测下一 token）、能用全部数据、天然适配生成与对话、规模扩展更稳定、in-context learning 效果好。

**Self-Attention 公式？为什么除以 √dₖ？** $\text{softmax}(QK^T/\sqrt{d_k})V$；除以 √dₖ 防止点积方差过大使 softmax 进入饱和区、梯度消失。详见 [Attention](/basics/attention)。

**MHA / MQA / GQA / MLA 区别？** MHA 每个 Q 头有独立 KV（显存大）；MQA 所有 Q 头共享 1 组 KV（最省，质量略降）；GQA 分组共享（折中，主流）；MLA 低秩压缩 KV（DeepSeek，省得多且近乎无损）。

**RoPE 为什么能体现相对位置？** 对位置 m、n 旋转后做点积，结果只与角度差 (m−n)θ 有关。长上下文扩展（PI / NTK / YaRN）都基于 RoPE。详见 [位置编码](/basics/position-encoding)。

**为什么用 RMSNorm + Pre-Norm？** RMSNorm 去掉减均值更省算力、效果相当；Pre-Norm 梯度可经残差直通、训练更稳能堆更深。详见 [归一化与激活](/basics/normalization)。

**SwiGLU 是什么？** 带 Swish 门控的 GLU，现代 FFN 标配，同参数下效果更好（用 3 个矩阵，中间维度取 8/3 d）。

**词表大小怎么权衡？** 大词表：压缩率高、等效上下文长、多语言友好，但 embedding 参数多、低频 token 训练不足；小词表反之。LLaMA 32K→128K、Qwen 152K 的演进见 [LLaMA 与 Qwen](/models/llama-qwen)。详见 [Tokenizer](/basics/tokenizer)。

**长上下文怎么外推？** 训练短、推理长会让 RoPE 遇到没见过的角度。位置插值（PI）线性压缩位置；NTK/YaRN 按频率分层调整 base；配合长文本继续预训练。详见 [长上下文专题](/basics/long-context)。

**涌现能力是真的吗？** 模型规模过阈值后某些能力「突然」出现。一种观点认为是度量不连续（用对数/连续指标看是平滑提升），但工程上「小模型做不了的任务大模型能做」的现象真实存在。详见 [缩放定律](/pretraining/scaling-law)。

## 二、训练与微调

**预训练目标？为什么用 CLM？** CLM（预测下一 token，GPT/LLaMA）、MLM（掩码还原，BERT）、Span Corruption（T5）。主流用 CLM：目标统一、用满数据、适配生成。详见 [预训练](/pretraining/pretrain)。

**数据处理流水线？** 清洗 → 去重（MinHash）→ 质量过滤 → 去毒/去隐私 → 配比混合 → tokenize 打包。去重防记忆过拟合，至关重要。

**显存花在哪？** 参数 2Ψ + 梯度 2Ψ + Adam 优化器状态 12Ψ + 激活值。优化器状态最占。详见 [分布式训练](/pretraining/distributed-training)。

**DP / TP / PP 区别？** DP 复制整模型喂不同数据；TP 切单层大矩阵（机内高带宽）；PP 切不同层（有流水线气泡）。超大模型用 3D 并行组合。

**ZeRO 三个阶段？** 分片优化器状态（1）→ + 梯度（2）→ + 参数（3）。FSDP 是 PyTorch 原生等价实现。

**SFT 为什么只对回答算 loss？** 让模型学「如何回答」而非拟合用户提问。详见 [微调范式](/finetuning/finetuning)。

**LoRA 原理？为什么高效？** 给权重加低秩旁路 BA（r 很小），冻结原权重只训 A、B，参数量降几个数量级，可合并无推理延迟。详见 [LoRA](/finetuning/lora)。

**微调 vs RAG vs Prompt 怎么选？** 改风格/格式/能力 → 微调；注入实时/私有事实 → RAG；快速验证简单任务 → Prompt。常组合。

**RLHF 流程？** SFT → 训练奖励模型（RM）→ 用 PPO 优化策略。DPO 跳过 RM 直接用偏好数据优化。详见 [RLHF / DPO](/finetuning/rlhf)。

**MoE 为什么省成本？为什么费显存？** 每 token 只激活少数专家 → 省计算；但所有专家都要加载进显存 → 费显存。详见 [MoE](/basics/moe)。

**QLoRA 和 LoRA 区别？** QLoRA = 4-bit NF4 量化冻结的基座 + 反量化计算 + LoRA 旁路（BF16），单卡即可微调大模型；代价是训练略慢、极小的量化误差。

**DPO 和 PPO 怎么选？** DPO 离线、简单稳定、不用 RM 和采样，适合资源有限/偏好数据现成的场景；PPO/GRPO 在线探索上限更高，适合可验证奖励（数学/代码）或有强 RM 的场景。详见 [RLHF / DPO](/finetuning/rlhf)。

**GRPO 一句话？** 同一 prompt 采一组回答，组内奖励标准化当优势，去掉 Critic 价值模型——省显存、稳定，专配可验证奖励。推导见 [强化学习基础](/advanced/rl-basics)。

**灾难性遗忘怎么缓解？** 微调时混入通用数据回放、用 LoRA 限制改动幅度、降低学习率、训练后模型融合（merge）。

**Chinchilla 结论？** 算力固定时参数量与数据量应同比例增长（约 20 tokens/参数最优）；LLaMA 之后业界故意「过量训练」小模型——训练亏一点，推理省大钱。详见 [缩放定律](/pretraining/scaling-law)。

**预训练数据怎么清洗？** 抽取 → 语种过滤 → 规则过滤 → 质量分类器打分 → MinHash 去重 → 去毒/PII → 评测集去污染 → 配比退火。详见 [数据工程与合成数据](/pretraining/data-engineering)。

## 三、Prompt / RAG / Agent

**CoT 为什么有效？** 分解问题、给模型更多「计算空间」（更多 token = 更多前向计算），降低一步出错概率。是涌现能力，只在大模型有效。详见 [Prompt 工程](/prompt/prompt-engineering)。

**RAG 完整流程？** 离线：加载→切分→向量化→入库；在线：query 向量化→检索 Top-K→（重排）→拼上下文→生成。详见 [RAG 基础](/rag/rag-basics)。

**为什么「向量召回 + Rerank」两段式？** Bi-encoder 快、海量粗筛；Cross-encoder 准但慢、只精排少量候选。兼顾效率与精度。详见 [Embedding 与向量库](/rag/embedding-vectordb)。

**RAG 召回不准怎么优化？** 查询改写 / HyDE / Multi-Query（检索前）、混合检索 + 元数据过滤 + 父子分块（检索中）、Rerank + 上下文压缩（检索后）。详见 [RAG 进阶](/rag/rag-advanced)。

**HNSW 为什么快？** 多层可导航小世界图，贪心跳转 + 逐层下沉，复杂度近 O(log N)，召回高，代价是内存大。

**Agent = ？** LLM + 规划 + 记忆 + 工具。经典范式 ReAct（Thought→Action→Observation 循环）。详见 [Agent 基础](/agent/agent-basics)。

**ReAct vs Plan-and-Execute？** ReAct 边想边做、灵活但短视；Plan-and-Execute 先规划再执行、全局但僵硬。详见 [多 Agent](/agent/multi-agent)。

**Function Calling 是模型自己执行函数吗？** 不是，模型只返回结构化调用意图，执行由你的代码完成。

**chunk 大小怎么定？** 太小语义碎、太大噪声多。一般 200~800 token 起步，按文档类型调；配重叠窗口、父子分块（小块检索、大块送 LLM）兜底。详见 [RAG 基础](/rag/rag-basics)。

**GraphRAG 解决什么？** 普通 RAG 只能答「局部事实」，跨文档全局问题（总结、关系链）答不好；GraphRAG 先抽实体关系建图 + 社区摘要，检索时图遍历。代价是构建成本高。详见 [RAG 进阶](/rag/rag-advanced)。

**MCP 的三大原语？** Tools（模型可调用的操作）、Resources（可读取的数据）、Prompts（可复用模板）。Host-Client-Server 架构 + JSON-RPC，解决「M 个应用 × N 个工具」的重复集成。详见 [MCP 协议深入](/agent/mcp)。

**Agent 工具安全怎么做？** Prompt 不是安全边界，模型只提出调用意图；服务端按用户/租户/角色过滤工具集，执行前做 ACL 和策略校验，高危写操作走 prepare/commit + HITL + 幂等键，所有工具调用写 trace 和审计。详见 [Agent 工具安全与权限边界](/agent/tool-safety)。

**LangGraph 生产化最容易被追问什么？** State 四分法、checkpoint 恢复语义、HITL resume、写操作幂等、图版本升级、并行 State 合并、trace 和上线门禁。核心是把 Agent 当可恢复状态机，而不是黑盒 ReAct 循环。详见 [LangGraph 状态图 Agent 生产化高频问答](/interview/langgraph-production-qna)。

**上下文工程四操作？** Write（持久化到外部）、Select（按需取回）、Compress（压缩历史）、Isolate（多 Agent 隔离上下文）。详见 [上下文工程](/agent/context-engineering)。

## 四、推理优化与评估

**Prefill 和 Decode 区别？** Prefill 并行处理 prompt、计算密集、定 TTFT；Decode 逐 token、访存密集、定吞吐。详见 [推理优化](/inference/inference-optimization)。

**Decode 为什么是 memory-bound？** 每生成一个 token 都要把整个模型权重和 KV Cache 读一遍，计算量却小，瓶颈在显存带宽。

**KV Cache 是什么？瓶颈？** 缓存历史 token 的 K、V 避免重算；显存随序列长度线性增长，是长上下文瓶颈。对策：GQA/MQA/MLA、PagedAttention、KV 量化。

**量化方法？** GPTQ（逐层 PTQ）、AWQ（激活感知）、GGUF（端侧）。省显存提速，可能轻微掉点，INT4 性价比常最高。

**投机解码为什么不掉精度？** 小模型起草、大模型并行验证，只接受与大模型分布一致的 token，输出分布不变，是加速非近似。

**FlashAttention 是近似吗？** 不是。IO 感知的精确算法，靠分块 + 算子融合把中间矩阵留在 SRAM，显存 O(n²)→O(n)、提速。

**怎么评估大模型？** 自动指标（PPL/BLEU/ROUGE）、基准（MMLU/C-Eval/GSM8K/HumanEval）、人评（Chatbot Arena）、LLM-as-a-Judge。详见 [模型评估](/evaluation/evaluation)。

**幻觉成因与缓解？** 概率生成本质 + 数据缺陷 + 不愿拒答。缓解：RAG 溯源、提示「不知就说」、降温、事实校验、训练校准。

**推理模型为什么强？怎么训的？** 推理前先生成长思维链（慢思考），用「推理时计算（test-time compute）」换强推理；靠在可验证奖励任务（数学/代码）上做 RL 训出，纯 RL 也能涌现反思/回溯。详见 [推理模型与慢思考](/advanced/reasoning-models)。

**Test-time scaling 有哪些工程做法？** 垂直深化（long CoT / budget forcing）、水平并行（Self-Consistency / Best-of-N）、树/图搜索（ToT / MCTS / PRM-guided beam）。关键看有没有 verifier，以及 SLA/成本能否承受。详见 [推理时算力扩展](/inference/test-time-scaling)。

**Self-Consistency 手撕怎么写？** 把模型调用抽象成 `generate_fn`，循环采样多条回答，先用 `parse_answer` 抽取可投票答案，再用 `Counter` 多数投票；提前停止要判断第二名即使拿满剩余票也追不上第一名。详见 [手撕代码题解集](/interview/coding-problems)。

**Snell 2024 的 compute-optimal test-time scaling 怎么理解？** 不是“推理时算力永远划算”，而是在给定 FLOPs 预算下，不同难度题适合不同策略：简单题少想或修正，中等题用 PRM/Beam，难题可能需要 BoN 或更大模型。核心是先判断难度，再动态分配推理预算。

**推理模型内建 long CoT 后，还要服务侧 BoN/SC 吗？** 高价值、可验证、可离线并行的任务仍有意义；实时聊天和低价值请求通常不值得。面试回答要把收益、延迟、token 成本、verifier 可靠性一起讲。

**越狱 vs Prompt 注入？** 越狱绕过模型安全对齐让其说违禁内容；注入把「数据」伪装成「指令」劫持应用行为（RAG/Agent 中的间接注入最危险）。防护靠指令数据分离 + 最小权限 + 护栏 + 人工确认。详见 [大模型安全](/advanced/safety)。

**TTFT 和 TPOT 分别由什么决定？** TTFT（首 token 延迟）主要由 Prefill 决定（prompt 长度、算力）；TPOT（每 token 时间）由 Decode 决定（显存带宽、KV Cache 大小、批大小）。优化方向完全不同。

**连续批处理（Continuous Batching）解决什么？** 静态批要等最长请求结束，GPU 大量空转；连续批在**迭代级**调度——任一请求结束立即换入新请求，吞吐量提升数倍，是 vLLM 高吞吐的另一半（另一半是 PagedAttention）。

**LLM-as-a-Judge 有什么坑？** 位置偏差（偏向先出现的回答）、长度偏差（偏向长回答）、自恋偏差（偏向同源模型风格）。对策：交换位置取平均、校准提示、混合人评抽检。详见 [模型评估](/evaluation/evaluation)。

**榜单分数为什么可能虚高？** 评测集污染（训练数据混入测试题）。鉴别：对比公开题与全新私有题的成绩差、n-gram 重叠检测。详见 [评测基准深入](/evaluation/benchmarks)。

## 五、系统设计高频题

> 这类题没有标准答案，重点是讲清思路与权衡。

- **设计一个企业知识库问答系统（RAG）**：文档接入与解析 → 切分策略 → Embedding 选型 → 向量库选型 → 混合检索 + Rerank → Prompt 模板 + 引用溯源 → 评估（RAGAS）→ 增量更新 → 权限隔离 → 缓存与成本控制。
- **设计高并发大模型服务**：vLLM（PagedAttention + 连续批处理）→ 多副本水平扩展 → 限流排队超时降级 → 模型分级路由 → 前缀/语义缓存 → 监控可观测 → 多供应商容错。详见 [应用开发实战](/engineering/llm-app-dev)。
- **设计 Agent 工具执行平台**：Tool Registry → Router → Policy Engine → Approval Service → Executor Sandbox → Audit/Trace，重点讲权限边界、高危动作确认、幂等和注入防护。详见 [Agent 工具安全与权限边界](/agent/tool-safety)。
- **私有化部署方案**：模型选型与量化 → GPU 选型与成本 → 推理框架（vLLM/TGI）→ 负载均衡高可用 → 监控告警 → 数据安全与隔离。

## 六、前沿趋势速答

**test-time scaling 是什么？** 把算力从「训练更大的模型」转向「推理时多想一会」——长 CoT、多次采样取最优、搜索。o1/R1 证明这是新的能力增长轴；服务侧做法见 [推理时算力扩展](/inference/test-time-scaling)，模型侧原理见 [推理模型](/advanced/reasoning-models)。

**R1-Zero 为什么重要？** 不做 SFT、纯 RL（可验证奖励）也能涌现反思回溯，说明推理能力可以「激发」而不必「示范」。详见 [DeepSeek 专题](/models/deepseek)。

**数据墙怎么破？** 合成数据（配验证器）、多模态数据、提高数据利用效率、转向后训练与推理时计算。详见 [数据工程与合成数据](/pretraining/data-engineering)。

**为什么大家又开始做小模型（SLM）？** 端侧隐私/离线/低延迟需求 + 蒸馏让小模型继承大模型能力 + Agent 系统里「小模型做简单步骤」更经济。详见 [SLM 专题](/models/slm)。

**Agent 方向最新趋势？** 从「prompt 串流程」走向 Agentic RL（端到端训练 Agent 行为）、上下文工程、多 Agent 协作与 MCP 标准化生态。详见 [Agentic RL](/advanced/agentic-rl)。

## 速记口诀

- **现代 Decoder-only 标配**：RMSNorm + Pre-Norm + SwiGLU + RoPE + GQA/MLA + （可选）MoE。
- **推理省显存三件套**：GQA/MLA 减 KV、PagedAttention 管 KV、量化压 KV。
- **RAG 优化三段论**：检索前（改写）、检索中（混合）、检索后（重排）。
- **降本四板斧**：模型分级、缓存复用、Prompt 精简、限制输出。
