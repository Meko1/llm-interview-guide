# 大模型基础篇岗位要求总纲

> 这页把 Boss/JD 里反复出现的技术词，翻译成面试准备清单。目标不是把每个框架都学成源码专家，而是能回答：它解决什么问题、生产里怎么用、和相邻技术怎么取舍、项目里怎么讲。

面试前需要一问一答速刷时，配合 [大模型基础篇高频问答加厚版](./foundation-qna) 使用；如果目标岗位写了 Spring AI、LangChain、LangGraph、Dify、智能工作流或 Function Calling，继续刷 [框架与智能工作流高频问答](./framework-workflow-qna)；如果写了 SFT、LoRA、QLoRA、RLHF、DPO、MaaS 或模型网关，继续刷 [微调与模型平台高频问答](./finetuning-platform-qna)。

## 面试先背这几句话

- 大模型基础篇已经不只考 Transformer 原理，更考 **LLM 应用工程化**：模型接入、RAG、Agent、工具调用、评估、成本、安全。
- Boss/JD 写 Spring AI、LangChain、LangGraph、Dify，本质是在考候选人是否能把“调模型”做成可维护的业务系统。
- RAG、Agent、Workflow、Function Calling 不是互斥概念。真实项目常见组合是：Workflow 控主流程，Agent 处理不确定子任务，RAG 提供知识，Function Calling 连接业务系统。
- 微调、RAG、Prompt、长上下文要会选型：知识更新和权限优先 RAG，风格/格式/领域行为优先 SFT/LoRA，偏好和安全行为优先 RLHF/DPO。
- 可上线的大模型系统必须能解释效果、成本、延迟、安全和失败恢复；只会做 demo 很容易被追问打穿。

## 12 类 Boss/JD 高频技能矩阵

| 技能词 | 岗位真正想考 | 面试常问 | 站内补课 |
| --- | --- | --- | --- |
| Spring AI | Java 团队如何接入 LLM 能力 | 为什么不用自己封装 HTTP？如何做 SSE、权限、审计？ | [Spring AI 基础与面试题](/engineering/spring-ai) |
| LangChain | LLM 应用编排抽象 | Chain、Runnable、Retriever、Tool 怎么分工？ | [LangChain 与应用框架](/engineering/langchain) |
| LangGraph | 有状态 Agent 工程化 | State、Node、Edge、Checkpoint 怎么让 Agent 可控？ | [LangGraph 与状态图 Agent](/engineering/langgraph) |
| Agent | 多步任务与工具调用 | ReAct、Plan-and-Execute、Memory、Tool Use 怎么讲？ | [Agent 基础](/agent/agent-basics) |
| RAG | 企业知识库与 AI Search | 切分、召回、重排、引用、权限、评估怎么做？ | [RAG 基础](/rag/rag-basics) |
| Dify | 低代码 AI 应用落地 | Dify 适合 PoC 还是生产？怎么做版本和权限？ | [Dify 与低代码智能工作流](/engineering/dify-workflow) |
| 智能工作流 | 确定性编排 | Workflow 和 Agent 如何取舍？五种工作流模式怎么组合？ | [AI 工作流 vs Agent](/agent/workflow) |
| Function Calling / MCP | 工具生态与业务系统连接 | 模型会不会自己执行函数？MCP 比 HTTP 工具有何价值？ | [Function Calling 与 MCP](/agent/function-calling-mcp) |
| SFT / PEFT / LoRA / QLoRA | 低成本模型适配 | LoRA 为什么有效？QLoRA 省什么？PEFT 和全参微调怎么选？ | [微调范式](/finetuning/finetuning) |
| RLHF / DPO | 偏好对齐与安全行为 | DPO 如何简化 RLHF？Reward Model 为什么难？ | [RLHF / DPO 对齐](/finetuning/rlhf) |
| MaaS 平台 | 模型服务治理 | 多模型、Key、配额、计费、路由、审计怎么设计？ | [MaaS 平台与模型服务治理](/engineering/maas-platform) |
| Agent 评测与安全合规 | 上线门禁 | 如何证明 Agent 可靠？工具越权、注入、审计怎么防？ | [Agent 评估与可靠性工程](/agent/agent-evaluation) |

## 按岗位方向怎么准备

| 岗位方向 | 优先掌握 | 项目证据 | 容易被追问 |
| --- | --- | --- | --- |
| Java AI 工程 | Spring AI、SSE、RAG、Tool Calling、网关治理 | Java + Spring AI 客服/知识库/业务助手 | 线程阻塞、流式返回、权限、审计、降级 |
| LLM 应用开发 | LangChain、结构化输出、RAG、评估、成本 | 企业知识库、AI Search、Text-to-SQL | JSON 不稳定、RAG 答错、模型路由、可观测 |
| Agent 工程 | LangGraph、Workflow、Function Calling、Memory、评测 | 投研 Agent、运营 Agent、Coding Agent | 死循环、工具失败、高危动作、轨迹回放 |
| RAG / Memory | 切分、混合检索、Rerank、引用、权限、评估 | 多租户知识库、客服问答、金融制度检索 | 删除一致性、ACL 过滤、表格/图片、增量索引 |
| AI 平台 / MaaS | 模型网关、配额、计费、观测、评测、推理服务 | 企业统一模型平台、模型网关、评测平台 | RPM/TPM、成本账单、灰度、fallback、合规 |
| 算法微调 | SFT、LoRA、QLoRA、DPO、评估集 | 领域问答模型、风格对齐、分类/抽取小模型 | 数据质量、过拟合、灾难遗忘、RAG vs 微调 |

## 12 类技能高频追问

### 1. Spring AI 与 Java AI 工程

1. Spring AI 相比自己封装模型 HTTP API 的收益是什么？
2. Java 服务如何做大模型流式输出？SSE、WebSocket、Streaming HTTP 怎么选？
3. 大模型接口慢且贵，如何做超时、重试、限流、排队、降级和缓存？
4. 银行/政企场景如何把用户权限、审计日志和 RAG 检索绑定？
5. Spring AI 和 LangChain4j、LangChain 的边界在哪里？

### 2. LangChain 应用编排

1. LangChain 的 Model、Prompt Template、Output Parser、Retriever、Tool 分别负责什么？
2. LCEL / Runnable 的价值是什么？什么时候不用框架更好？
3. LangChain 和 LlamaIndex 最大差异是什么？
4. 框架升级导致行为变化，你怎么隔离风险？
5. 生产环境如何做 trace、dataset 和 prompt 回归？

### 3. LangGraph 状态图 Agent

1. 为什么 Agent 工程从 Chain 走向 Graph？
2. State、Node、Edge、Conditional Edge 怎么解释？
3. Checkpoint、interrupt、human-in-the-loop 解决什么问题？
4. LangGraph 如何防止 ReAct 自由循环失控？
5. 如何回放一次失败的 Agent 轨迹？

### 4. Agent 基础与多步任务

1. Agent 和普通 LLM 调用的本质差异是什么？
2. ReAct、Plan-and-Execute、Reflexion 分别适合什么任务？
3. Agent Memory 该写什么、不该写什么？
4. 单 Agent 和多 Agent 如何取舍？
5. 如何给 Agent 设置最大步数、预算和终止条件？

### 5. RAG 与知识库

1. RAG 的离线链路和在线链路分别做什么？
2. chunk size、overlap、父子分块、标题层级切分怎么选？
3. 向量召回、BM25、混合检索、Rerank 各解决什么问题？
4. 知识库删除、更新、权限变更如何保证一致？
5. RAG 回答错了，如何定位是召回错、排序错还是生成错？

### 6. Dify 与低代码工作流

1. Dify 的 Chatflow、Workflow、Knowledge、Tool 怎么分工？
2. 低代码平台适合 PoC，为什么复杂生产链路常要代码化？
3. Dify 工作流如何做版本管理、灰度、评估和成本统计？
4. Dify、Coze、n8n、LangGraph、自研代码如何取舍？
5. 如何把一个 Dify PoC 迁移为 Spring AI 或 LangGraph 服务？

### 7. 智能工作流

1. Workflow 和 Agent 的本质区别是什么？
2. Prompt Chaining、Routing、Parallelization、Orchestrator-Workers、Evaluator-Optimizer 怎么记？
3. 为什么“能用 Workflow 就别上 Agent”？
4. 评估-优化循环什么时候有效，什么时候会浪费钱？
5. 业务流程中哪些节点必须程序化校验？

### 8. Function Calling / Tool Calling / MCP

1. Function Calling 的完整流程是什么？模型会自己执行函数吗？
2. 工具 schema 怎么设计才能减少误调用？
3. 工具调用失败有哪些类型？参数错、权限错、网络错、业务失败如何恢复？
4. MCP 的 Host、Client、Server、Tools、Resources、Prompts 分别是什么？
5. MCP 和普通 HTTP 工具接口相比，优势和代价是什么？

### 9. SFT / PEFT / LoRA / QLoRA

1. SFT 解决什么问题，不能解决什么问题？
2. PEFT 的核心思想是什么？为什么 LoRA 能低成本适配？
3. LoRA 的 rank、alpha、target modules 怎么调？
4. QLoRA 主要省显存在哪里？对效果有什么风险？
5. 微调后如何评估灾难遗忘和领域泛化？

### 10. RLHF / DPO / 偏好优化

1. RLHF 为什么要 Reward Model？PPO 在这里做什么？
2. DPO 如何绕过显式奖励模型和在线 RL？
3. 偏好数据如何采集，如何避免标注偏差？
4. 安全对齐和过度拒绝如何平衡？
5. DPO、IPO、KTO、ORPO 这类方法共同想解决什么？

### 11. MaaS 平台与模型服务治理

1. MaaS 和模型网关、LLMOps、推理平台是什么关系？
2. 如何设计模型目录、虚拟 Key、租户配额、计费账单？
3. 多模型路由如何兼顾能力、成本、可用性和合规？
4. 模型升级如何做灰度、回滚和评测门禁？
5. 如何按业务线拆 token 成本和质量报表？

### 12. Agent 评测、安全与合规

1. Agent 评估为什么不能只看最终答案？
2. 工具调用准确率怎么拆指标？
3. Prompt Injection、工具越权、数据泄露分别怎么防？
4. 高危动作如何做人工确认、沙箱和审计？
5. 如何证明一次 prompt 或模型升级没有让 Agent 变差？

## 项目讲法模板

面试里不要说“我用了某某框架”。按下面 7 句讲：

1. **业务目标**：这个系统服务谁，解决什么高频痛点。
2. **输入输出**：用户输入是什么，最终产物是什么。
3. **主链路**：Workflow、RAG、Agent、Tool Calling 分别在哪一步。
4. **关键取舍**：为什么不用另一种方案，比如为什么 RAG 而不是微调，为什么 LangGraph 而不是自由 ReAct。
5. **可靠性**：超时、重试、降级、人工确认、权限隔离怎么做。
6. **评估指标**：准确率、召回率、任务成功率、P95 延迟、单次成本至少讲两个。
7. **复盘迭代**：线上 bad case 怎么回流，下一步怎么优化。

可直接复述的版本：

> 我做的不是单轮聊天，而是一个可上线的 LLM 应用。主流程用 Workflow 固定住，知识问题走 RAG，涉及外部系统的动作通过 Function Calling 调工具，不确定的多步任务再交给 Agent。为了上线，我做了权限过滤、引用溯源、工具参数校验、超时重试、人工确认和 trace 回放。评估上同时看任务成功率、检索命中率、延迟、token 成本和高危动作拦截率。

## 4 周基础篇补齐路线

| 周次 | 目标 | 每天动作 | 产出 |
| --- | --- | --- | --- |
| 第 1 周 | 补 LLM 应用共同底座 | Prompt、结构化输出、RAG、Function Calling 各刷 10 题 | 一张“用户输入到模型输出”的链路图 |
| 第 2 周 | 补 Agent 与 Workflow | ReAct、LangGraph、Dify、MCP、评测各刷 8 题 | 一个 Agent 任务平台系统设计答案 |
| 第 3 周 | 补 Java 与平台治理 | Spring AI、MaaS、模型网关、LLMOps、成本治理 | 一个 Java + Spring AI 项目讲法 |
| 第 4 周 | 补微调与安全 | SFT、LoRA、QLoRA、RLHF、DPO、安全合规 | 一份面试前速查稿和 2 个项目故事 |

## 站内学习路径

- Java AI 工程：[Spring AI 基础与面试题](/engineering/spring-ai) -> [LLM 应用开发实战](/engineering/llm-app-dev) -> [模型网关与多模型路由](/engineering/llm-gateway)
- Agent 工程：[Agent 基础](/agent/agent-basics) -> [LangGraph 与状态图 Agent](/engineering/langgraph) -> [Agent 评估与可靠性工程](/agent/agent-evaluation)
- RAG 与知识库：[RAG 基础](/rag/rag-basics) -> [RAG 生产化](/rag/rag-production) -> [RAG 评估](/rag/rag-evaluation)
- 低代码到工程化：[Dify 与低代码智能工作流](/engineering/dify-workflow) -> [AI 工作流 vs Agent](/agent/workflow) -> [LangGraph 与状态图 Agent](/engineering/langgraph)
- 微调与对齐：[微调范式](/finetuning/finetuning) -> [LoRA / QLoRA](/finetuning/lora) -> [RLHF / DPO](/finetuning/rlhf)
- 平台治理：[MaaS 平台与模型服务治理](/engineering/maas-platform) -> [模型网关](/engineering/llm-gateway) -> [LLMOps](/engineering/llmops)
