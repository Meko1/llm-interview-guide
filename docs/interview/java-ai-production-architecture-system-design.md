# Java / Spring AI 生产架构系统设计面试题

> [Spring AI / Java AI 生产化高频问答](/interview/spring-ai-production-qna) 适合回答“某个点怎么做”；本页适合回答“让你用 Java/Spring 设计一个企业 AI 服务，完整架构怎样落地”。重点不是背 `ChatClient`，而是把 LLM 接进现有 Java 的身份、事务、限流、可观测和运维体系。

## 一、30 秒总答法

**面试官：用 Spring AI 设计企业知识库和客服 Agent，你的架构是什么？**

> 我会把 Spring AI 放在独立的 AI Orchestrator 层，而不是让 Controller 或业务服务直接调用模型。请求经过网关完成认证、租户、限流和幂等上下文；编排层按场景选择 RAG、固定工作流或受控 Agent，并通过模型网关调用模型。RAG 检索前带 ACL 和索引版本，工具调用统一走 Tool Gateway 做 Schema、ABAC、风险判断和审计。实时回答用 SSE 或 WebFlux 流式返回，长耗时研究和多步骤任务改为异步 Job，避免占满在线连接。模型调用使用独立 bulkhead、超时、预算和降级链，关键写操作拆为 prepare/confirm/commit，并结合事务外盒、幂等键和状态查询。全链路记录 release、Prompt、模型、检索、工具、token、成本和业务结果，变更先走离线评测、影子和灰度。

这段话体现了 Java AI 工程的优势：**稳定服务边界、业务事务、权限复用、流式治理和生产可观测**。

## 二、先把职责拆开：不要把 AI 逻辑塞进 Controller

推荐的逻辑分层：

```text
Web / App / 客服台
  -> API Gateway: auth, tenant, quota, request id
  -> Spring MVC / WebFlux Controller: 协议、SSE、DTO
  -> AI Orchestrator: 场景路由、Prompt、RAG、Workflow/Agent
  -> Model Gateway: provider, route, retry, budget, streaming
  -> Retrieval Service: ACL, hybrid search, rerank, citation
  -> Tool Gateway: schema, policy, approval, idempotency, audit
  -> Domain Services / DB / MQ / External APIs
  -> Trace / Metrics / Eval / Cost / Audit
```

| 层 | 该做什么 | 不该做什么 |
| --- | --- | --- |
| Controller | HTTP/SSE 协议、参数边界、取消信号 | 拼 Prompt、直接访问向量库 |
| AI Orchestrator | 场景选择、上下文组装、状态机、响应策略 | 直接绕过业务服务写数据库 |
| Retrieval Service | 索引版本、ACL、混合检索、引用 | 用 Prompt 代替权限判断 |
| Tool Gateway | Schema、策略、审批、审计、幂等 | 让模型直接持有业务系统密钥 |
| Domain Service | 事务、业务规则、最终状态校验 | 信任模型输出就直接落库 |
| Model Gateway | 模型适配、路由、预算、可用性 | 承载业务权限逻辑 |

面试表达：Spring AI 是编排层的 SDK 抽象；企业生产能力主要来自边界清晰的 Java 服务，而不是把所有内容塞进一个 `@Service`。

## 三、同步、SSE、WebFlux 和异步 Job 怎么选

LLM 请求有两类完全不同的生命周期：短对话希望尽快看到首字，长任务可能需要检索、多个工具、审批和几十秒甚至分钟的执行。

| 模式 | 适合场景 | Java 实现关注点 |
| --- | --- | --- |
| 同步 JSON | 简短分类、抽取、结构化决策 | 严格 timeout，避免占住核心线程 |
| SSE / 流式 | 聊天、客服、摘要生成 | 断开取消、心跳、代理缓冲、事件协议 |
| WebFlux | 高并发长连接、流式网关 | backpressure、非阻塞链路、上下文传播 |
| 异步 Job | Deep Research、批量报告、多 Agent | Job 状态、MQ、幂等、回调、结果存储 |

### SSE 事件契约

不要只往前端裸推 token。建议定义：

```text
message_start: request_id, trace_id, release_id
delta: text fragment
citation: doc_id, chunk_id, title
tool_status: tool name, phase, safe summary
warning: fallback, evidence insufficient, partial result
error: code, retryable, user-safe message
message_end: token usage, latency, result id
```

客户端断开后要取消上游模型流和可取消的检索/工具任务；如果业务写操作已经进入 commit，则不能简单按断开取消，需要通过 `operation_id` 查询最终状态。Nginx/网关缓冲、SSE 最大连接数、心跳和超时也属于面试常见追问。

### 为什么长任务要异步化

把 Deep Research、文件解析、批量 embedding 或多轮 Agent 放在在线 HTTP 连接里，会占满连接、难以恢复、也不利于审批等待。更稳的设计是：提交 Job -> 返回 job_id -> Worker 执行 -> checkpoint/状态事件 -> 前端轮询或订阅结果。Job 需要保存 `release_id`、输入摘要、tenant、预算、工具状态和可重试分类。

## 四、身份、租户和上下文如何贯穿 Spring 链路

Java 企业系统通常已有 SSO、网关、RBAC/ABAC 和审计体系。AI 服务不应另起一套松散的身份逻辑。

1. 网关验证用户或服务身份，生成不可伪造的 request/tenant/role/purpose 上下文。
2. Spring 层把上下文传播到 Reactor Context、线程池任务、MQ 消息和 Tool Gateway。
3. Retrieval 使用该上下文构建元数据过滤，Tool Gateway 用它做最终 ABAC。
4. Trace 只记录脱敏后的身份摘要和策略决策，不记录完整凭据。
5. 子 Agent 或异步 Job 使用短期、范围衰减的 service token，不能继承无限期管理员权限。

常见坑是在线请求有 tenant，异步 Worker、SSE 回调或缓存 key 却丢了 tenant/role/policy version，最终产生跨租户数据泄露。

## 五、RAG：在线读链路与离线索引链路分离

Java AI 架构里，知识库不要和聊天 API 共用一个随意的“向量查询 Service”。应拆成：

```text
离线: Connector -> Parser -> Chunk -> Embedding -> Vector/BM25 -> index_version
在线: User Context -> ACL filter -> hybrid retrieve -> rerank -> context builder -> citation
```

| 关注点 | Java 服务设计 |
| --- | --- |
| 索引更新 | 用 MQ/Job 处理增量、幂等、失败重试和版本切换 |
| 权限 | 向量、BM25、Rerank、缓存、引用页都走同一 ACL 语义 |
| 版本 | 回答和 trace 记录 index_version，出错可切回旧索引 |
| 缓存 | key 包含 tenant、role、policy、index、prompt 版本 |
| 引用 | 生成引用 ID，不暴露可绕过鉴权的原始下载链接 |

对高风险政策问答，RAG 返回“证据不足”比模型基于常识补写更安全；Java 后端可以在结构化响应 DTO 中强制 `citations`、`confidence`、`answer_mode` 等字段，并据此决定转人工。

## 六、Tool Calling 与事务边界：模型不能拥有提交权

工具调用是 Java AI 系统最容易被问深的地方。模型的 Function Calling 只说明“它想调用什么”，不能替代领域服务的权限、事务和幂等。

### 读写分离与两阶段业务动作

| 风险 | 例子 | 设计 |
| --- | --- | --- |
| 只读 | 查询订单、库存、工单 | ABAC、字段掩码、分页、审计 |
| 低风险写 | 创建草稿、内部备注 | 幂等、可撤销、操作记录 |
| 高风险写 | 退款、转账、外部邮件 | prepare/confirm/commit、HITL、approval_id |
| 特权操作 | 修改权限、生产发布、删数据 | 默认不提供给自由 Agent |

高风险工具流程：

```text
Agent proposes action
  -> Tool Gateway validates schema and policy
  -> Domain Service prepare: checks state and returns impact preview
  -> User/approver confirms approval_id
  -> Domain Service commit with idempotency_key
  -> Outbox event + audit + operation_id
  -> Agent receives safe result summary
```

### 事务外盒和最终一致性

模型调用本身不在本地数据库事务里，外部工具也不能用分布式大事务硬包。通常做法是领域服务先在本地事务中写入操作意图和 outbox，再异步可靠投递；外部执行通过 `operation_id` 和幂等键保证可查询、可重试、不重复。失败时使用补偿或转人工，而不是让 Agent 无限制重放写工具。

## 七、结构化输出、契约和业务验证

模型返回合法 JSON 不代表业务结果正确。推荐三层校验：

1. 模型侧：JSON Schema / tool schema，低温度，明确枚举和字段描述。
2. Java DTO：Jackson 解析、Bean Validation、长度/范围/枚举检查。
3. 领域层：权限、金额、库存、状态机、时间窗、幂等和引用证据校验。

失败策略应分类：格式错误可以有限重试；缺关键字段应追问或降级；权限和业务非法参数不能重试；高风险动作转人工。不要让“解析成功”成为“可以入库”的唯一条件。

## 八、可靠性、限流和成本隔离

AI 调用慢、供应商限流、上下文膨胀和 Agent 循环不应拖垮支付、登录、订单等核心服务。

| 风险 | Spring/Java 治理 |
| --- | --- |
| 上游慢/超时 | 独立 `ai-executor` 或 WebFlux、timeout、bulkhead |
| 并发突增 | 网关 RPM/TPM、队列、租户配额、拒绝策略 |
| 持续失败 | circuit breaker、健康路由、缓存/FAQ/人工降级 |
| 成本失控 | max tokens、Agent max steps、Top-K、预算熔断 |
| 重试风暴 | 只重试 retryable 错误，指数退避和总预算 |
| 长任务挤占在线 | 在线/离线队列、线程池和 GPU/模型通道隔离 |

面试时可以提 Resilience4j、Sentinel、Redis 限流、消息队列和配置中心，但不要只报组件名；要说明模型慢时如何保护核心业务，预算超限时用户会得到什么明确结果。

## 九、Workflow、Agent 与 Java 编排边界

稳定的审批、表单、路由和数据同步流程优先使用显式 Workflow；只有任务路径不确定、需要搜索和动态工具选择时才使用 Agent。Java/Spring 中可用状态机、数据库任务表、MQ 和调度器承载确定流程；复杂开放式 Agent 可以调用 LangGraph 服务，但仍要由 Java 侧负责身份、审批、业务事务和审计。

| 需求 | 推荐 |
| --- | --- |
| 固定客服分流、表单补全 | Spring 工作流/规则/状态机 |
| 企业 RAG 问答 | Spring AI + Retrieval Service |
| 可控工具任务 | Spring AI + Tool Gateway + 明确状态机 |
| 长研究/复杂规划 | LangGraph/Agent Worker + Java 治理外壳 |

## 十、可观测、测试与发布闭环

每个请求至少关联 `request_id`、`trace_id`、`tenant_id`、`release_id`、`model_version`、`prompt_version`、`index_version`、`tool_schema_version`。指标要从三层回答：

- 系统：TTFT、P95、错误率、SSE 连接数、队列等待、线程池水位。
- 质量：引用支持、JSON/DTO 校验、工具成功、拒答、人工接管、bad case。
- 成本与业务：token、模型单价、缓存命中、每租户账单、解决率、工单关闭率。

Java 落地时用 OpenTelemetry 把上下文从网关传播到 WebFlux/Reactor Context、`ai-executor`、MQ Job、RAG、模型和 Tool Gateway。SSE 的 span 应从 `message_start` 持续到 `done/error/cancel` 终态；高流量 trace 可做 tail sampling，但安全、失败、高成本、写操作和策略拒绝必须保留。注意不要把原始 Prompt、PII 或高基数用户标识直接塞进 metric label。

测试不能只 mock 模型返回。至少包括 DTO/领域单测、工具契约测试、RAG ACL/删除回归、sandbox 副作用测试、SSE 断开取消测试、发布前 golden/regression、安全集和灰度 trace 回放。详见 [LLM 评测与发布门禁实战](/interview/evaluation-release-gates)。

## 十一、系统设计追问与项目讲法

**问：模型超时后重试会不会重复退款？**

不会把写操作当成可随便重试的模型调用。先查 `operation_id` 和领域状态；只有确认未执行才允许安全重试。commit 必带幂等键，外部响应未知时走状态查询或人工补偿。

**问：WebFlux 就一定比 MVC 好吗？**

不是。它更适合大量流式长连接和非阻塞链路，但团队熟悉度、调试和阻塞依赖都要考虑。低并发内部助手可用 MVC/SseEmitter 加独立 AI 线程池；关键是隔离、超时、取消与背压，而不是框架名称。

**问：为什么不把所有 Agent 都放在 Java 里？**

确定流程和业务事务适合 Java；复杂探索式图编排可能使用 LangGraph 等专用运行时。无论 Agent 在哪，身份、工具权限、业务提交、审计和成本治理应回到企业 Java 服务边界。

项目讲法：

> 我们在 Spring Boot 中将 AI API、编排、检索和工具网关拆层。在线客服用 SSE 返回 token，并通过断开取消、独立线程池和租户限流保护核心服务；知识库检索带 ACL 与索引版本，返回引用 DTO；写工具采取 prepare/confirm/commit，领域服务负责 ABAC、幂等和 outbox。所有请求关联模型、Prompt、索引、工具和 release 版本，离线回归通过后影子和灰度发布。这样 Spring AI 负责统一模型/RAG 抽象，真正的生产可靠性由 Java 的事务、权限、观测和治理能力保证。

## 速记

1. Spring AI 放在哪一层？AI Orchestrator，不直接塞进 Controller 或领域服务。
2. 流式响应要处理什么？断开取消、超时、心跳、代理缓冲、审核和事件契约。
3. 长 Agent 任务怎么办？异步 Job、checkpoint、预算、状态查询与人工接管。
4. Tool Calling 能直接写库吗？不能，模型只提意图，领域服务执行鉴权、事务、幂等和审计。
5. JSON 合法就能落库吗？不能，还要 DTO 与领域业务校验。
6. 模型慢如何保护 Java 服务？隔离线程/连接、限流、超时、熔断、队列和降级。
7. Agent 必须 Java 实现吗？不必，但身份、事务、审批和审计应由企业服务边界控制。

## 继续阅读

- [Spring AI 基础与面试题](/engineering/spring-ai)：Spring AI 抽象、ChatClient、Advisor、VectorStore 和 Tool Calling。
- [Spring AI / Java AI 生产化高频问答](/interview/spring-ai-production-qna)：SSE、限流、RAG、工具、成本等专项追问。
- [大模型应用系统设计面试题](/interview/application-system-design)：通用 RAG/Agent/LLMOps 架构题。
- [LLM 评测与发布门禁实战](/interview/evaluation-release-gates)：版本、评测、灰度与回滚。
