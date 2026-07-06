# Spring AI 基础与面试题

> Spring AI 是 Java/Spring 生态里的大模型应用抽象层。面试里出现 Spring AI，通常不是在考你背 API，而是在考你能不能把 LLM 能力接入已有 Java 后端、权限体系、日志审计、配置中心和微服务治理。应用全链路见 [LLM 应用开发实战](/engineering/llm-app-dev)，框架对比见 [LangChain 与应用框架](/engineering/langchain)。

面试前需要速刷 Spring AI、LangChain、Dify、Agent、RAG 的横向追问，可配合 [基础篇高频问答加厚版](/interview/foundation-qna)。

## 面试先背这几句话

- Spring AI 的定位是：在 Spring Boot 里统一模型调用、Prompt 模板、Embedding、VectorStore、Tool Calling 和 RAG 组件。
- Java 团队用 Spring AI 的价值不是“少写 HTTP”，而是把 LLM 接入已有的配置、权限、监控、日志和微服务治理体系。
- ChatClient 是模型对话入口，支持同步和流式调用；Embedding + VectorStore 支撑知识库检索；Tool Calling 把业务 API 暴露给模型调用。
- 银行、政企、客服场景最看重审计、权限、稳定性和可控成本，所以 Spring AI 项目要讲清超时、重试、限流、SSE、降级和数据隔离。
- Spring AI 适合 Java 生产系统，LangChain 适合 Python 生态快速编排，LangGraph 适合复杂有状态 Agent。选型看团队、系统边界和可维护性。

## Spring AI 解决什么问题

不用框架时，Java 服务里常见写法是每个业务模块自己封装模型 HTTP 请求。这种方式 demo 很快，但生产会出现问题：

- 不同模型 SDK/API 格式不一，业务代码和模型厂商耦合。
- Prompt、模型参数、输出解析、流式协议散落在各处，难以统一治理。
- RAG、Embedding、向量库、工具调用没有统一抽象，换组件成本高。
- 权限、审计、限流、成本统计没有统一入口。
- 线上排障时不知道哪次请求用了哪个 prompt、哪个模型、多少 token、调用了哪些工具。

Spring AI 的价值是把这些横切能力收拢成 Spring 风格的组件，让 LLM 应用像普通后端能力一样被配置、注入、观测和治理。

## 核心抽象

| 抽象 | 作用 | 面试表达 |
| --- | --- | --- |
| ChatClient | 对话模型调用入口，可组织 prompt、参数、同步/流式返回 | 类似业务层调用模型的统一 client |
| Prompt Template | 把系统指令、用户变量、上下文片段模板化 | 避免 prompt 硬编码散落 |
| Output Converter / Parser | 把模型输出转成结构化对象 | 降低 JSON 不稳定对业务的影响 |
| EmbeddingModel | 把文本转向量 | RAG 的离线索引和在线 query embedding |
| VectorStore | 向量库统一接口 | 对接 pgvector、Milvus、Redis、ES 等 |
| Advisor | 在调用前后增强上下文、记忆、RAG、审计等 | 类似 LLM 调用链路的拦截器 |
| Tool Calling | 把 Java 方法或业务工具暴露给模型调用 | 让模型查询订单、创建工单、查库存 |

官方文档中，ChatClient 被定义为和 AI Model 通信的 fluent API，并支持同步和流式模型；Advisors 则用于在交互前后做增强、转换和复用生成式 AI 模式。面试无需背接口细节，但要能讲出这些抽象在生产链路里的位置。

## 企业 Java 接入架构

```text
Web / App / 客服台
  -> Spring MVC / WebFlux API
  -> Auth + Tenant Context + Rate Limit
  -> AI Service
      -> Prompt Template / Policy
      -> RAG Retriever: Embedding + VectorStore + ACL Filter
      -> ChatClient: model params + streaming
      -> Tool Calling: order / ticket / CRM / account API
  -> Audit Log + Trace + Cost Meter
  -> SSE / JSON / 工单结果
```

关键点：

- **权限前置**：先从登录态拿 user、tenant、role，再把权限条件带到检索和工具调用。
- **RAG 不绕过 ACL**：检索前过滤租户和文档权限，检索后再做二次校验。
- **工具调用最小权限**：只给 Agent 当前任务需要的工具，高危写操作必须确认。
- **流式输出**：用 SSE 降低体感延迟，但流中也要能处理上游超时、用户断开和内容审核。
- **可观测**：记录 request_id、model、prompt_version、token、latency、tool_calls、retrieved_docs、error_code。
- **降级**：模型超时或限流时，可切备用模型、关闭 Agent、转普通 FAQ 或转人工。

## Spring AI vs LangChain4j vs LangChain

| 选型 | 生态 | 适合场景 | 风险 |
| --- | --- | --- | --- |
| Spring AI | Spring 官方生态风格 | Java/Spring Boot 存量系统、企业后端、政企金融 | AI 生态不如 Python 丰富，复杂 Agent 需自己设计 |
| LangChain4j | Java LLM 应用框架 | Java 团队快速做 RAG、工具调用、Agent demo | 与 Spring 体系的治理集成要自己补 |
| LangChain | Python 生态 | 快速试验、RAG/Agent 生态丰富、LangGraph 编排 | Java 业务系统要跨语言服务化 |
| 直接封装 HTTP | 无框架 | 链路简单、极致可控 | 组件复用、观测、工具调用、向量库抽象都要自建 |

面试结论可以这样讲：

> 如果团队主体是 Java/Spring，且要接企业权限、审计、配置和微服务治理，我优先用 Spring AI 或 LangChain4j；如果是复杂 Agent 编排或快速实验，我会用 Python 生态的 LangGraph；生产核心链路最终会保留薄封装，避免业务代码直接依赖某个框架的深层 API。

## 高频面试题

**Q：Spring AI 相比自己封装 HTTP 有什么收益？**  
收益是统一抽象和工程治理：模型调用、prompt、embedding、vector store、tool calling、RAG advisor 可以在 Spring 体系里被配置、注入、监控和复用。自己封装 HTTP 初期快，但后期每个业务都重复做超时、重试、流式、日志、成本和模型切换。

**Q：Java 服务如何做流式输出？**  
常见是 SSE。后端把上游模型 token stream 转成 `text/event-stream` 推给前端。要处理四件事：客户端断开要取消上游请求；上游超时要发送错误事件并收尾；敏感内容要能中断或延迟输出；日志要记录完整响应或安全摘要。

**Q：大模型接口慢，Java 线程会不会被拖死？**  
同步 Servlet 模型下要控制线程池、超时和并发；高并发流式场景更适合 WebFlux 或异步执行。无论哪种方式，都要做限流、排队、熔断和降级，避免上游慢请求把业务线程耗尽。

**Q：RAG 权限怎么做？**  
文档入库时带 tenant_id、doc_id、role、owner、department 等元数据；查询时从用户上下文生成过滤条件，先过滤再召回，召回后做二次权限校验。不能先全局召回再靠 prompt 告诉模型“不要泄露”。

**Q：Tool Calling 如何接企业业务系统？**  
把工具封装成业务服务方法，输入参数用 schema 约束，输出结构化错误码。只读工具和写工具分开授权，写操作先生成待确认动作，由用户或审核人确认后再执行真实 API。

**Q：Spring AI 项目怎么讲成本控制？**  
按租户、应用、模型记录输入/输出 token；简单意图用小模型或规则分类；高频问题做缓存；RAG 控制 Top-K 和上下文长度；模型超时或预算超限时降级到 FAQ、短回答或人工。

## 项目讲法

银行客服 Agent 可以这样讲：

> 我们在 Spring Boot 服务里用 Spring AI 做统一 AI 接入层。用户问题先经过意图识别，制度类问题走 RAG，账户/账单类问题通过 Tool Calling 调用内部只读 API，高危操作只生成工单或待确认动作。RAG 检索带租户和权限过滤，模型输出通过 SSE 返回。上线时重点做了超时、重试、限流、审计日志和 token 成本统计，避免模型慢请求影响核心交易系统。

加分细节：

- 用模型网关统一管理上游 Key 和路由，业务不直接接触模型厂商。
- Prompt、模型、工具 schema 版本化，支持灰度和回滚。
- 把 bad case 写入评估集，每次改 prompt 或换模型都跑回归。

## 系统设计追问

1. 设计一个 Java + Spring AI 企业知识库系统，如何做文档接入、权限过滤、RAG、引用和审计？
2. 设计一个银行客服 Agent，如何区分制度问答、账户查询、工单创建和转人工？
3. 如果模型供应商 429 或超时，Spring 服务如何做重试、排队、fallback 和用户提示？
4. 如何把 Spring AI 服务接入模型网关，让多个业务共享模型能力但成本可拆账？
5. 如果要从 Dify PoC 迁移到 Java 生产服务，哪些能力必须重写，哪些配置可以保留？

## 延伸阅读

- [Spring AI ChatClient 官方文档](https://docs.spring.io/spring-ai/reference/api/chatclient.html)
- [Spring AI Advisors 官方文档](https://docs.spring.io/spring-ai/reference/api/advisors.html)
- [LLM 应用开发实战](/engineering/llm-app-dev)
- [模型网关与多模型路由](/engineering/llm-gateway)
- [MaaS 平台与模型服务治理](/engineering/maas-platform)
