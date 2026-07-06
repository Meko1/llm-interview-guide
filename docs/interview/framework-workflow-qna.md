# 框架与智能工作流高频问答

> 这页面向 Spring AI、LangChain、LangGraph、Dify、智能工作流、Function Calling 和 Agent 工程岗位。它不追求逐 API 教程，而是回答面试最常问的三件事：为什么选这个框架、生产里怎么治理、项目里怎么讲。

## 怎么用这页

- Java AI 工程岗：重点刷 Spring AI、SSE、权限、审计、模型网关。
- LLM 应用开发岗：重点刷 LangChain、直接 SDK、RAG/工具编排和可观测。
- Agent 工程岗：重点刷 LangGraph、Workflow vs Agent、Function Calling 失败恢复。
- 低代码/业务落地岗：重点刷 Dify PoC、生产边界和迁移路径。

答题结构建议固定为：**场景复杂度 -> 团队技术栈 -> 治理要求 -> 框架取舍 -> 上线门禁**。

## 框架选型总表

| 场景 | 首选 | 为什么 |
| --- | --- | --- |
| Java/Spring 存量系统接入 LLM | Spring AI / LangChain4j | 权限、审计、配置、SSE、微服务治理接入自然 |
| Python 快速做 RAG/工具编排 | LangChain | 生态适配多，PoC 快，组件丰富 |
| 复杂有状态 Agent | LangGraph | 显式 State/Node/Edge、checkpoint、人审、回放 |
| 业务人员快速搭应用 | Dify / Coze | 低代码、发布快、业务可维护 prompt 和知识库 |
| 链路简单且性能/稳定性优先 | 直接 SDK + 薄封装 | 可控、依赖少、升级风险低 |
| 企业统一模型服务 | 模型网关 / MaaS | Key、配额、计费、路由、审计、评测门禁 |

**Q：面试官问“你为什么不用某某框架”，怎么答？**

不要站队。先说“我按复杂度和治理要求选”。简单稳定链路用直接 SDK；Java 后端生产系统用 Spring AI；Python 快速编排用 LangChain；多分支长任务用 LangGraph；业务 PoC 用 Dify。核心判断是：框架是否让系统更可维护，而不是更炫。

## Spring AI / Java AI 工程

**Q：Spring AI 相比自己封装 HTTP 有什么价值？**

不是少写几行 HTTP，而是把模型调用、Prompt、Embedding、VectorStore、Tool Calling、RAG Advisor 放进 Spring 的配置、注入、观测和治理体系。Java 项目最重要的是接已有登录态、租户权限、审计日志、限流降级、SSE 和模型网关。

**Q：Spring AI 项目怎么讲亮点？**

可以按企业后端链路讲：用户请求进入 Spring MVC/WebFlux 后，先解析用户和租户上下文；制度类问题走带 ACL 的 RAG；账户类问题通过只读 Tool 调内部系统；高危写操作只生成待确认动作；模型输出用 SSE 返回；全链路记录 trace、token、prompt_version、tool_calls 和 retrieved_docs。

**Q：Java 服务做流式输出有哪些坑？**

SSE 能降低体感延迟，但要处理客户端断开、上游超时、内容审核、日志补全和连接数占用。同步 Servlet 场景要控制线程池和超时；高并发流式更适合异步或 WebFlux。不要让上游慢模型把业务线程池拖死。

**Q：Spring AI 接 RAG 时权限怎么做？**

权限要前置到检索层。文档入库带 tenant、role、owner、department 等元数据；查询时根据登录用户生成过滤条件，向量召回和关键词召回都要带过滤；生成前二次校验引用文档。不能全局召回后靠 prompt 让模型保密。

## LangChain / 应用编排

**Q：LangChain 的核心抽象怎么讲？**

Model 统一模型调用，Prompt Template 管模板变量，Output Parser 管结构化解析，Retriever 管检索，Tool 管外部能力，Runnable/Chain 把组件编排成可执行链。面试要补一句：生产里不会盲信框架，关键链路要薄封装、可观测、可回归。

**Q：LangChain 和直接 SDK 怎么选？**

PoC、多组件编排、快速试错用 LangChain；稳定单链路、性能敏感、长期维护用直接 SDK + 薄封装；复杂 Agent 用 LangGraph。很多生产系统会经历“框架快速验证 -> 核心链路毕业成自研薄封装”的过程。

**Q：LangChain 生产风险有哪些？**

抽象层深、版本变化快、隐式 prompt 包装、回调链复杂、依赖冲突、调试栈长。治理手段是锁版本、封装边界、记录 trace、维护评估集、对 prompt/模型/检索参数做回归测试。

## LangGraph / 状态图 Agent

**Q：为什么复杂 Agent 要从 Chain 走向 Graph？**

Chain 适合固定线性流程，Agent 需要循环、分支、失败恢复、人审和状态持久化。LangGraph 用 State 保存共享状态，用 Node 做一步处理，用 Edge/Conditional Edge 控制流转，把“模型自由决策”限制在工程可控的路径里。

**Q：LangGraph 怎么防死循环？**

设置最大步数、最大 token、最大耗时；状态里记录最近工具调用和失败次数；条件边必须有终止分支；连续失败进入 fallback、追问用户或转人工；高危动作通过 interrupt 暂停等待确认。

**Q：Checkpoint 存什么？**

存 session/thread id、state、当前节点、消息历史、工具请求和结果、错误码、模型版本、prompt 版本、审批状态。敏感数据要脱敏或只存引用。它的价值是断点续跑、人审恢复和失败回放。

## Dify / 低代码智能工作流

**Q：Dify 适合什么，不适合什么？**

适合快速 PoC、企业知识库问答、客服 FAQ、业务专家维护 prompt 和流程。不适合直接承载高并发强 SLA、复杂状态机、强合规写操作、严格测试和灰度的大规模核心链路。低代码不是不能上线，而是上线前必须补版本、权限、评估、观测、成本和迁移路径。

**Q：Dify Workflow 和 Chatflow 怎么区分？**

Chatflow 面向多轮对话入口，Workflow 面向确定性任务流程。两者都可以用节点编排模型、知识库、工具和条件分支。面试要说清：节点画布能表达业务流程，但复杂逻辑堆在画布里会变难测、难审、难回滚。

**Q：Dify PoC 如何迁移到生产代码？**

先冻结 PoC 的 prompt、知识库策略、工具列表和高频问题；抽取真实日志做评估集；把 RAG 权限、工具调用、状态机、人审和审计迁到 Spring AI/LangGraph/自研服务；Dify 可保留为业务配置台或运营验证工具。

## Workflow vs Agent

| 任务形态 | 推荐 |
| --- | --- |
| 固定步骤、路径可预知 | Workflow / Prompt Chaining |
| 需要按输入类型分流 | Routing |
| 多个独立子任务可并行 | Parallelization |
| 任务可拆成多个 worker | Orchestrator-Workers |
| 需要生成后自检迭代 | Evaluator-Optimizer |
| 路径依赖运行时反馈，无法事先写死 | Agent / LangGraph |

**Q：为什么常说“能用 Workflow 就别上 Agent”？**

因为 Workflow 可测试、可预测、成本可控；Agent 灵活但不确定性更强，容易死循环、误调工具、成本失控。生产里常见组合是：Workflow 控主流程，Agent 只处理不确定子任务，工具调用和安全边界由程序控制。

## Function Calling / MCP

**Q：Function Calling 是模型自己执行函数吗？**

不是。模型输出结构化调用意图，业务服务或 MCP Server 执行真实函数。权限、参数校验、幂等、重试、审计都必须在服务端做，不能信任模型。

**Q：工具 schema 怎么设计？**

描述要写清何时用、何时不用、参数边界、默认值、返回语义和失败处理。参数尽量少而扁平，枚举优于自由文本，只读工具和写工具分开，高危写操作必须确认。

**Q：工具调用失败怎么恢复？**

参数缺失可让模型修正或追问；权限失败不要重试；网络超时可有限重试；业务错误用结构化错误码返回；写操作必须幂等，避免重复扣款、重复发邮件、重复创建工单。

## 项目讲法

### Java + Spring AI 银行客服

> 我们把 LLM 能力放在 Spring Boot AI Service 层，不让业务模块直连模型。登录态进入后生成租户和权限上下文，制度问答走 RAG，账户查询走只读工具，高危操作只生成待确认工单。模型调用统一经过模型网关，支持 SSE、超时、限流、fallback、token 计费和审计。上线前用制度问答 golden set、权限越权集和工具调用失败集做回归。

### LangGraph 投研 Agent

> 我们没有让 Agent 自由循环，而是用 LangGraph 把流程拆成意图识别、检索、行情工具、财报工具、分析草稿、风险校验和报告生成。State 保存证券代码、时间范围、引用材料和工具结果；工具节点幂等并记录错误码；涉及投资建议进入人工确认；失败时通过 checkpoint 回放定位问题。

### Dify 企业知识库 PoC

> PoC 阶段用 Dify 快速接制度文档和 Chatflow，让业务方直接调 prompt 和知识库。验证价值后，我们把高频问题、bad case、知识切分策略和工具定义沉淀为评估集和接口文档；生产阶段把权限过滤、审计、灰度、成本统计和复杂状态机迁到 Spring AI/LangGraph 服务，Dify 保留给业务做轻量配置。

## 面试前 30 分钟速背

- Java 生产系统优先讲 Spring AI + 权限 + 审计 + SSE + 模型网关。
- LangChain 是组件生态和快速编排，生产要薄封装、锁版本、做 trace 和评估。
- LangGraph 是显式状态机，核心词是 State、Node、Edge、Checkpoint、Interrupt。
- Dify 适合 PoC 和业务维护，生产化必须补版本、权限、评估、观测、成本。
- Workflow 可预测，Agent 灵活；生产里常用 Workflow 控主流程、Agent 处理不确定子任务。
- Function Calling 只是模型输出调用意图，真实执行、鉴权、幂等、审计都在服务端。

## 延伸阅读

- [Spring AI 基础与面试题](/engineering/spring-ai)
- [LangChain 与应用框架](/engineering/langchain)
- [LangGraph 与状态图 Agent](/engineering/langgraph)
- [Dify 与低代码智能工作流](/engineering/dify-workflow)
- [AI 工作流 vs Agent](/agent/workflow)
- [Function Calling 与 MCP](/agent/function-calling-mcp)
