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
13. PRM vs ORM 在训练推理模型和推理时搜索中的角色有什么不同？→ [推理时算力扩展](/inference/test-time-scaling)
14. Mamba/SSM 相比 Transformer 的优劣？为什么用混合架构？→ [状态空间模型](/advanced/state-space-models)
15. 灾难性遗忘是什么？怎么缓解？→ [微调范式](/finetuning/finetuning)

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
10. 工具权限边界怎么设计？模型能不能自己判断是否有权执行？→ [Agent 工具安全与权限边界](/agent/tool-safety)
11. 怎么防止 Agent 陷入死循环 / 跑偏？→ [多 Agent](/agent/multi-agent)
12. 什么时候用单 Agent，什么时候用多 Agent？→ [多 Agent](/agent/multi-agent)
13. 怎么让模型稳定输出 JSON？→ [LLM 应用开发实战](/engineering/llm-app-dev)
14. 流式输出怎么实现？用什么协议？→ [LLM 应用开发实战](/engineering/llm-app-dev)
15. CoT、Few-shot 一定更好吗？什么时候用？→ [Prompt 工程](/prompt/prompt-engineering)
16. 微调、RAG、Prompt 三者怎么选？→ [微调范式](/finetuning/finetuning)
17. 设计一个高准确率数学/代码问答服务：如何做多采样、verifier、投票、early stopping 和预算控制？→ [推理时算力扩展](/inference/test-time-scaling)

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

### 系统设计专题追问

> 系统设计题不要背架构图，要能按「需求澄清 → 指标 → 主链路 → 数据流 → 可靠性 → 评估 → 成本 → 演进」讲完整。模板见 [AI 系统设计专题](../engineering/system-design)。

1. **设计一个统一模型网关**：如何做虚拟 Key、RPM/TPM 限流、多模型路由、failover、计费和审计？→ [模型网关与多模型路由](../engineering/llm-gateway)
2. **设计一个 Agent 任务执行平台**：如何做工具注册、权限、状态管理、记忆、限步数、人工确认和轨迹回放？→ [Agent 工具安全与权限边界](../agent/tool-safety)
3. **设计一个高并发推理平台**：如何拆 TTFT/TPOT、排队、连续批处理、量化、KV Cache、GPU 调度和降级？→ [推理性能压测](../inference/inference-benchmark)
4. **设计一个企业级 RAG 平台**：如何支持多租户、多数据源、权限过滤、增量索引、引用溯源和 RAG 评估？→ [RAG 生产化](../rag/rag-production)
5. **设计一个 AI Coding 平台**：如何管理项目规则、上下文索引、Agent 执行权限、代码审查、测试门禁和回滚？→ [AI 编程工具实战](../engineering/ai-coding-tools)
6. **设计一个模型评估与回归平台**：如何管理评测集、prompt 版本、模型版本、LLM-as-Judge、人工标注和上线门禁？→ [模型评估](../evaluation/evaluation)

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
9. 实现 **Self-Consistency wrapper**：并发采样、答案归一化、多数投票、置信度提前停止。→ [手撕代码题解集](/interview/coding-problems)

> 准备建议：手撕题重在「能写出核心逻辑 + 讲清每步在干嘛」，先吃透 [Attention](/basics/attention) 和 [解码采样](/basics/decoding) 的公式。

## 基础篇 12 类高频追问

> 这组题覆盖 Boss/JD 里最常出现的基础篇技能词。完整准备路径见 [大模型基础篇岗位要求总纲](./foundation-requirements)。

1. **Spring AI / Java AI**：Spring AI 相比自己封装 HTTP 有什么收益？Java 服务如何做 SSE、超时、限流、审计和权限隔离？→ [Spring AI / Java AI 生产化高频问答](./spring-ai-production-qna)
2. **LangChain**：Model、Prompt Template、Output Parser、Retriever、Tool、Runnable 分别解决什么问题？什么时候不用框架更好？→ [LangChain 与应用框架](../engineering/langchain)
3. **LangGraph**：为什么复杂 Agent 要从 Chain 走向 Graph？State、Node、Edge、Checkpoint、人审分别怎么讲？→ [LangGraph 与状态图 Agent](../engineering/langgraph)
4. **Agent 基础**：ReAct、Plan-and-Execute、Reflexion 分别适合什么场景？Agent 如何防死循环和跑偏？→ [Agent 基础](../agent/agent-basics)
5. **RAG / 知识库**：RAG 离线索引和在线问答怎么拆？切分、混合检索、Rerank、引用溯源、权限过滤怎么做？→ [RAG 基础](../rag/rag-basics)
6. **Dify / 低代码**：Dify 的 Chatflow、Workflow、Knowledge、Tool 怎么分工？PoC 到生产要补哪些治理能力？→ [Dify 低代码工作流生产化高频问答](./dify-production-qna)
7. **智能工作流**：Workflow 和 Agent 的本质区别是什么？五种工作流模式如何组合？为什么能用 Workflow 就别上 Agent？→ [AI 工作流 vs Agent](../agent/workflow)
8. **Function Calling / MCP / 工具安全**：模型会自己执行函数吗？MCP Server、工具 schema、权限边界、高危写操作确认和审计怎么设计？→ [MCP Server 生产化与企业治理高频问答](./mcp-production-qna)
9. **SFT / PEFT / LoRA / QLoRA**：LoRA 为什么低成本有效？QLoRA 省显存在哪里？微调后如何评估灾难遗忘？→ [微调范式](../finetuning/finetuning)
10. **RLHF / DPO**：RLHF 为什么需要 Reward Model？DPO 如何简化偏好优化？安全对齐和过度拒绝如何平衡？→ [RLHF / DPO 对齐](../finetuning/rlhf)
11. **MaaS 平台**：如何设计模型目录、虚拟 Key、租户配额、计费账单、多模型路由和评测门禁？→ [MaaS 平台生产化高频问答](./maas-production-qna)
12. **Agent 评测与安全合规**：为什么不能只看最终答案？工具越权、Prompt Injection、敏感数据泄露和高危动作怎么防？→ [Agent 评测与安全合规高频问答](./agent-evaluation-safety-qna)

## 2026 岗位驱动追问

> 这组题来自 2026 年 LLM 应用、Agent、RAG/Memory、Java AI、AI Infra 类 JD 的共性要求。完整能力地图见 [2026 大模型岗位能力地图](./job-market-2026)。

### LLM 应用开发 / Java AI

1. 你如何设计一个可上线的 LLM 应用后端？请覆盖模型接入、流式输出、结构化输出、限流、重试、日志和成本控制。→ [LLM 应用开发实战](../engineering/llm-app-dev)
2. 如果模型返回的 JSON 偶发不合法，你会用 prompt 修复、解析重试、JSON Mode 还是 Schema 约束？怎么取舍？→ [结构化输出详解](../engineering/structured-output)
3. Spring Boot 服务如何实现 SSE 流式返回？客户端断开、上游超时、内容审核分别怎么处理？→ [Spring AI / Java AI 生产化高频问答](./spring-ai-production-qna)
4. 企业 Java 系统接入大模型时，为什么不能让业务代码直接散落调用各家模型 API？模型网关应封装哪些能力？
5. 大模型调用很慢且价格高，如何在 Java 微服务里做异步、限流、排队、降级和缓存？
6. 高准确率问答服务什么时候启用 Self-Consistency / Best-of-N，什么时候直接单次生成？如何把 SLA 和预算接进路由？→ [推理时算力扩展](../inference/test-time-scaling)

### 框架与智能工作流追问

1. Spring AI、LangChain、LangGraph、Dify、直接 SDK 怎么选？请按团队栈、流程复杂度和治理要求回答。→ [框架与智能工作流高频问答](./framework-workflow-qna)
2. Spring AI 服务里 SSE 输出到一半模型超时或内容审核失败，前端事件和后端日志怎么设计？→ [Spring AI / Java AI 生产化高频问答](./spring-ai-production-qna)
3. Java 同步 Servlet、异步线程池、WebFlux 三种方式接大模型流式输出，分别适合什么并发场景？→ [Spring AI / Java AI 生产化高频问答](./spring-ai-production-qna)
4. LangChain 版本升级导致 prompt 或链路行为漂移，如何用薄封装、锁版本、trace 和 golden set 控风险？→ [LangChain 与应用框架](../engineering/langchain)
5. 一个 LangChain PoC 什么时候应该迁到 LangGraph，什么时候应该毕业为直接 SDK + 薄封装？→ [LangChain 与应用框架](../engineering/langchain)
6. LangGraph 的 State 里哪些字段应该持久化，哪些只应该作为临时运行态？→ [LangGraph 生产化与系统设计](../engineering/langgraph-production)
7. Checkpoint 恢复时，如果工具已经真实执行过，如何防止重复扣款、重复发邮件或重复建单？→ [LangGraph 生产化与系统设计](../engineering/langgraph-production)
8. Dify PoC 跑通后，哪些配置可以迁移，哪些能力必须在后端服务里重做？→ [Dify 低代码工作流生产化高频问答](./dify-production-qna)
9. 工作流里的 gate/validator 应该检查什么？哪些检查不能交给 LLM 判断？→ [AI 工作流 vs Agent](../agent/workflow)
10. 写操作工具如何设计幂等键、审批、审计日志和回滚策略？→ [Agent 工具安全与权限边界](../agent/tool-safety)

### Agent 工程

1. 什么时候用固定 Workflow，什么时候用 Agent？请给出一个你会拒绝使用 Agent 的业务场景。→ [AI 工作流 vs Agent](../agent/workflow)
2. 设计一个投研/客服/运营 Agent：任务规划、工具调用、状态管理、失败重试、人工确认分别怎么做？→ [Agent 基础](../agent/agent-basics)
3. Tool Calling 失败有哪些类型？参数错、权限错、网络错、业务返回错、模型误调用分别如何恢复？→ [Function Calling 与 MCP](../agent/function-calling-mcp)
4. 工具返回 `403 permission_denied` 后，Agent 应该重试、换工具、追问用户、申请审批还是直接拒绝？→ [Agent 工具安全与权限边界](../agent/tool-safety)
5. MCP 解决了什么问题？和你自己定义一组 HTTP 工具接口相比，优势和代价是什么？企业内部 MCP Server 怎么治理？→ [MCP Server 生产化与企业治理高频问答](./mcp-production-qna)
6. Agent Memory 该写什么、不该写什么？新旧记忆冲突时怎么处理？→ [Agent 记忆系统](../agent/agent-memory)
7. 如何评估一个 Agent 是否可上线？除了任务成功率，还要看哪些过程指标？→ [Agent 评测与安全合规高频问答](./agent-evaluation-safety-qna)
8. Deep Research 为什么可以看作 long-horizon test-time compute？如何控制搜索次数、停止条件、引用可信度和成本？→ [深度研究 Agent](../agent/deep-research)

### RAG & Memory / AI Search

1. RAG 回答错了，你怎么判断问题出在检索、重排、上下文拼接、Prompt 还是模型生成？→ [RAG 评估](../rag/rag-evaluation)
2. chunk size、overlap、父子分块、标题层级切分怎么选？如果文档里有表格和图片怎么办？→ [切分与检索策略深挖](../rag/chunking-retrieval)
3. 向量检索、BM25、混合检索、Rerank 各自解决什么问题？怎么做融合？→ [RAG 进阶](../rag/rag-advanced)
4. 金融/客服知识库如何做引用溯源、拒答、权限隔离和增量更新？→ [RAG 生产化与系统设计](../rag/rag-production)
5. Agent Memory 和 RAG 知识库有什么区别？为什么 Memory 的写入策略比检索更难？→ [Agent 记忆系统](../agent/agent-memory)

### RAG、Memory 与评测安全追问

1. 设计企业级 RAG 时，如何从需求澄清推导出数据量、QPS、P95、成本和权限指标？→ [RAG、Memory 与评测安全高频问答](./rag-memory-eval-qna)
2. 多租户 RAG 如何保证向量召回、BM25 召回、rerank、上下文组装和缓存都不越权？→ [RAG 生产化与系统设计](../rag/rag-production)
3. 文档删除后，如何证明向量库、倒排索引、对象存储、缓存和引用页都已经失效？→ [RAG 生产化与系统设计](../rag/rag-production)
4. RAGAS / LLM-as-Judge 分数和人工判断冲突时怎么办？如何校准裁判？→ [RAG 评估](../rag/rag-evaluation)
5. 长期助理里，哪些信息应该写入 Memory，哪些只应该留在上下文或日志？→ [Agent 记忆系统](../agent/agent-memory)
6. 用户今天说“我换工作了”，旧记忆里还有原公司信息，你怎么更新？→ [Agent 记忆系统](../agent/agent-memory)
7. Memory 误写了敏感信息，怎么发现、删除、审计和防复发？→ [Agent 记忆系统](../agent/agent-memory)
8. 如何设计一个 Agent 评测集？每条样本除了用户问题还要存什么？→ [Agent 评测与安全合规高频问答](./agent-evaluation-safety-qna)
9. Agent 最终答案正确，但调用了禁止工具，这算通过吗？为什么？→ [Agent 评测与安全合规高频问答](./agent-evaluation-safety-qna)
10. 企业 RAG / Agent 合规评审时，面试官最关心哪些证据？→ [Agent 评测与安全合规高频问答](./agent-evaluation-safety-qna)
11. Prompt、模型或工具 schema 改动后，Agent 如何做回归与灰度发布？→ [Agent 评测与安全合规高频问答](./agent-evaluation-safety-qna)

### AI Infra / 推理部署

1. Prefill 和 Decode 的瓶颈分别是什么？为什么 TTFT 和 TPOT 要分开优化？→ [推理优化与部署](../inference/inference-optimization)
2. KV Cache 显存如何估算？长上下文 + 高并发为什么容易 OOM？→ [长上下文专题](../basics/long-context)
3. vLLM 的 PagedAttention 和连续批处理分别解决什么问题？为什么能提升吞吐？→ [推理优化与部署](../inference/inference-optimization)
4. GPTQ、AWQ、GGUF、INT8/INT4 怎么选？量化后如何证明效果没有明显下降？
5. 设计一个私有化大模型部署方案：模型选型、显卡、量化、推理框架、高可用、监控和成本怎么讲？

### 推理部署与成本治理追问

1. P99 TTFT 突然升高，你如何区分是排队、Prefill、网络、模型版本还是 prefix cache 命中率下降？→ [推理部署与成本治理高频问答](./inference-cost-qna)
2. P99 TPOT 突然升高，你如何排查 batch、KV Cache、显存带宽、量化 kernel 和输出长度？→ [推理性能压测](../inference/inference-benchmark)
3. 给定 70B 模型、32K 上下文和 8 张 H100，如何粗估最大并发？哪些假设必须说清？→ [KV Cache 深度解析](../inference/kv-cache)
4. vLLM、SGLang、TensorRT-LLM、TGI、llama.cpp/Ollama 怎么按生产场景选型？→ [推理框架对比](../inference/serving-frameworks)
5. 固定并发压测和泊松到达压测有什么差异？为什么在线聊天更关注到达模式？→ [推理性能压测](../inference/inference-benchmark)
6. 为什么 goodput 比 throughput 更适合做上线门禁？SLA 应该包含哪些指标？→ [推理部署与成本治理高频问答](./inference-cost-qna)
7. W4A16、W8A8、FP8、KV Cache 量化分别适合什么瓶颈？上线前怎么验收？→ [量化实战](../inference/quantization)
8. 模型网关如何做 RPM/TPM、预算熔断、异常成本定位和输出 token 预估？→ [模型网关](../engineering/llm-gateway)
9. 语义缓存能省钱，但如何避免跨租户泄漏、旧知识复用和错误答案放大？→ [推理部署与成本治理高频问答](./inference-cost-qna)
10. 私有化部署如何讲高可用、灰度、回滚、镜像/模型制品管理和监控告警？→ [MaaS 平台生产化高频问答](./maas-production-qna)
11. Self-Consistency、Best-of-N、ToT、MCTS 分别适合什么任务？为什么 verifier 是胜负手？→ [推理时算力扩展](../inference/test-time-scaling)
12. Test-time scaling 会让成本暴涨，如何用动态 K、early stopping、prefix cache 和模型路由控制预算？→ [推理时算力扩展](../inference/test-time-scaling)

### 微调与模型平台追问

1. SFT 和 PEFT 是一回事吗？为什么 SFT 通常只对 assistant 回答算 loss？→ [微调范式](../finetuning/finetuning)
2. 微调后线上效果变差，你如何按数据、模板、训练、评估、上线五层排障？→ [微调范式](../finetuning/finetuning)
3. LoRA 的低秩假设是什么？`r`、`alpha`、`target_modules` 怎么定？为什么 r 不一定越大越好？→ [LoRA / QLoRA](../finetuning/lora)
4. QLoRA 量化的是哪部分？NF4、双重量化、分页优化器分别解决什么？→ [LoRA / QLoRA](../finetuning/lora)
5. LoRA 能不能注入新知识？为什么企业知识库通常还是要 RAG？→ [微调与模型平台高频问答](./finetuning-platform-qna)
6. RLHF 的三阶段是什么？PPO 为什么要维护多个模型？DPO 如何简化这条链路？→ [RLHF / DPO 对齐](../finetuning/rlhf)
7. DPO、KTO、ORPO、SimPO、GRPO 分别适合什么数据形态和任务？→ [偏好优化方法全景](../finetuning/preference-optimization)
8. 如何构造偏好数据？如何防止 reward hacking、谄媚和过度拒答？→ [RLHF / DPO 对齐](../finetuning/rlhf)
9. 设计一个企业 MaaS 平台：模型目录、虚拟 Key、配额、计费、路由、审计、评测门禁怎么做？→ [MaaS 平台生产化高频问答](./maas-production-qna)
10. 模型升级后用户投诉质量变差，但离线评测通过了，你如何排查和止血？→ [MaaS 平台生产化高频问答](./maas-production-qna)
11. 新模型或新 LoRA 上线前要跑哪些评估？如何把 golden set、bad case、安全集、成本延迟接到 CI/CD？→ [模型评估与幻觉](../evaluation/evaluation)

### AI Coding / 工具提效

1. Vibe Coding 和 Spec Coding 的区别是什么？为什么生产项目更推荐先写验收标准？→ [AI 编程工具实战](../engineering/ai-coding-tools)
2. 你如何给 Claude Code / Cursor / Codex 准备上下文？哪些上下文不该给？→ [AI 编程工具实战](../engineering/ai-coding-tools)
3. 如果 AI 一次修改了 20 个文件，你如何审查、拆分、回滚和重新约束任务？→ [AI 编程工具实战](../engineering/ai-coding-tools)
4. CLI 型 AI Agent 和 IDE 型 AI 编程工具分别适合什么任务？团队里如何组合使用？→ [AI 编程工具实战](../engineering/ai-coding-tools)
5. 如何证明 AI Coding 真的提升了工程效率，而不是制造更多 review 成本？
6. 面试官问“AI 会不会削弱程序员能力”，你如何回答才能体现判断力和工程基本功？

## 软性 / 项目题

1. 介绍一个你做过的大模型项目，重点讲难点和你的决策。→ [AI 项目实战](/engineering/projects)
2. 你做的项目，效果是怎么评估的？提升了多少？
3. 遇到过最棘手的大模型问题是什么？怎么解决的？
4. 你怎么跟进大模型领域的最新进展？→ [学习资源汇总](/interview/resources)
5. 为什么从原岗位转向（或选择）大模型方向？

> 项目题的关键：**量化结果 + 体现工程权衡 + 展示持续学习**。别只罗列功能，要讲清「为什么这么做」。
