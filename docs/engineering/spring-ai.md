---
title: Spring AI 基础与面试题
description: >-
  Spring AI 的 Tool Calling 不能越过企业后端权限。需要回答身份委托、凭证代理、后端二次鉴权和写操作确认时，见 企业 Tool
  Gateway 安全执行系统设计面试题。
level: L2
roles:
  - 后端转型
  - 应用开发
  - Infra
classification: inferred
---
# Spring AI 基础与面试题

> Spring AI 的 Tool Calling 不能越过企业后端权限。需要回答身份委托、凭证代理、后端二次鉴权和写操作确认时，见 [企业 Tool Gateway 安全执行系统设计面试题](/interview/tool-gateway-security-design)。

> Spring AI 是 Java/Spring 生态里的大模型应用抽象层。面试里出现 Spring AI，通常不是在考你背 API，而是在考你能不能把 LLM 能力接入已有 Java 后端、权限体系、日志审计、配置中心和微服务治理。应用全链路见 [LLM 应用开发实战](/engineering/llm-app-dev)，生产化追问见 [Spring AI / Java AI 生产化高频问答](/interview/spring-ai-production-qna)，完整 Java 分层、流式、事务工具和 LLMOps 架构见 [Java / Spring AI 生产架构系统设计面试题](/interview/java-ai-production-architecture-system-design)，框架对比见 [LangChain 与应用框架](/engineering/langchain)。

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

框架抽象不是安全控制面：Spring Security、租户策略、Tool Gateway 和领域事务仍由应用接入。本文读取的是官方默认文档，不假定与你的 BOM 相同；复现先固定 JDK、Spring Boot、Spring AI BOM、模型/向量库适配器与 endpoint，确认对应版本的默认行为。不要混用不同版本的工具回调或结构化输出示例。

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

`ChatClient` 是调用编排入口，`ChatModel` 是模型适配层，`entity()`/converter 是输出映射，不是事实校验器。[Output Converter 官方说明](https://docs.spring.io/spring-ai/reference/api/structured-output-converter.html) 明确其格式引导是 best effort，需结合 schema 校验。provider-native 约束、Java 反序列化、Bean Validation/业务一致性分别验证，不能因为得到了 DTO 就直接执行业务写入。

### Advisor 顺序是数据外发边界

官方 [Advisors 文档](https://docs.spring.io/spring-ai/reference/api/advisors.html) 说明较低 order 值先执行，请求经过链后调用模型，响应再返回链。应确认认证/租户上下文在 Memory/RAG 读取前可用；检索权限过滤发生在查询服务，不能只把脱敏放在最终响应 Advisor。若某个 Advisor 记录了完整上下文，后面的脱敏无法撤回已写日志。使用合成敏感字段检查每一阶段的输入/输出，不仅检查最终回答。

工具也可能由框架自动循环执行。[Tool Calling 文档](https://docs.spring.io/spring-ai/reference/api/tools.html) 给出了外部审批/中间进度需要用户控制执行的场景；注册工具不等于自动获得批准。只把受控回调暴露给模型，领域服务从不可伪造的服务端上下文读取身份，而不是从模型的 `userId/tenantId` 参数读取。

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
| Spring AI | Spring 组件风格 | Java/Spring Boot 存量系统 | 具体 provider 能力、工具循环与持久化语义仍需核验 |
| LangChain4j | Java LLM 应用框架 | Java 团队候选 | 比较当前版本的 Spring 集成、工具门禁与维护成本，不预设无集成 |
| LangChain | Python / JS 等生态 | 检索与模型链路候选 | 若采用跨语言部署，要单独设计身份传播、超时与运维 |
| 直接封装 HTTP | 无框架 | 链路简单、极致可控 | 组件复用、观测、工具调用、向量库抽象都要自建 |

面试结论可以这样讲：

> 如果团队主体是 Java/Spring，且要接企业权限、审计、配置和微服务治理，我优先用 Spring AI 或 LangChain4j；如果是复杂 Agent 编排或快速实验，我会用 Python 生态的 LangGraph；生产核心链路最终会保留薄封装，避免业务代码直接依赖某个框架的深层 API。

## 高频面试题

**Q：Spring AI 相比自己封装 HTTP 有什么收益？**  
收益是统一抽象和工程治理：模型调用、prompt、embedding、vector store、tool calling、RAG advisor 可以在 Spring 体系里被配置、注入、监控和复用。自己封装 HTTP 初期快，但后期每个业务都重复做超时、重试、流式、日志、成本和模型切换。

**Q：Java 服务如何做流式输出？**  
常见是 SSE，后端将上游文本 delta 编码成有事件边界的 `text/event-stream`，不是每个事件一定对应一个 token。客户端断开时请求取消，但供应商可能已生成/执行工具；上游失败在连接仍可写时发终态错误，否则持久化终态供查询。敏感内容需要发送前缓冲审核，事后中断不能撤回已显示文字。日志默认只保留脱敏摘要、状态与版本，不默认落完整响应。

**Q：大模型接口慢，Java 线程会不会被拖死？**  
控制线程池、超时和并发。WebFlux 不会把阻塞 JDBC 或同步工具自动变为非阻塞：在 event loop 上执行会拖慢同线程其他请求。将阻塞工具放到有界调度器/隔离池，限制并发和排队；虚拟线程也不能无限增加数据库或供应商容量。异步边界须显式传播已验证的主体，不能假定 ThreadLocal 总能跟随线程切换。

**Q：RAG 权限怎么做？**  
文档入库时带 tenant_id、doc_id、role、owner、department 等元数据；查询时从用户上下文生成过滤条件，先过滤再召回，召回后做二次权限校验。不能先全局召回再靠 prompt 告诉模型“不要泄露”。

**Q：Tool Calling 如何接企业业务系统？**  
把工具封装成业务服务方法，输入参数用 schema 约束，输出结构化错误码。只读工具和写工具分开授权，写操作先生成待确认动作，由用户或审核人确认后再执行真实 API。

**Q：Spring AI 项目怎么讲成本控制？**  
按租户、应用、模型记录输入/输出 token；简单意图用小模型或规则分类；高频问题做缓存；RAG 控制 Top-K 和上下文长度；模型超时或预算超限时降级到 FAQ、短回答或人工。

## 面试专项：Spring AI 生产排障

Spring AI 面试最容易从“你会用 ChatClient 吗”转向“线上出问题怎么排”。可以按 **入口、模型、RAG、工具、输出、观测** 六层回答。

| 线上现象 | 常见原因 | 排查与修复 |
| --- | --- | --- |
| SSE 流到一半中断 | 客户端断开、上游超时、代理缓冲、连接数耗尽 | 监听断开事件取消上游请求；设置心跳和超时；Nginx 关闭缓冲；记录 partial response |
| Java 线程池被拖满 | 同步阻塞等待慢模型，缺少超时和并发隔离 | AI 调用使用独立线程池/异步/WebFlux；设置 bulkhead、timeout、熔断 |
| RAG 偶发越权 | 只在 prompt 里写权限，检索层未过滤 | tenant/role/doc ACL 前置到 VectorStore 和 BM25；生成前二次校验引用文档 |
| Tool Calling 调错业务 API | 工具描述模糊、参数太自由、读写工具混放 | schema 变窄；只读/写操作分开；写操作加确认；工具输出结构化错误码 |
| JSON 输出不稳定 | 格式引导不等于约束；拒答/截断被当正文 | 分类终态；解析/schema/业务校验分层；无副作用的生成才有界重试，不自动修复金额/实体 ID |
| 成本突然升高 | Top-K 过大、长上下文、循环调用、缓存失效 | token 计量按 app/tenant/prompt_version 拆账；预算熔断；模型路由和缓存 |
| 换模型后效果漂移 | prompt、工具 schema、拒答风格不兼容 | 通过模型网关灰度；跑 golden set 和 bad case；保留旧模型回滚 |

### 面试可复述版本

可重复联调的三个检查点（需自己的已固定版本服务，本文未运行 Spring 应用）：

- 两个用户询问同一文档，VectorStore/BM25 请求捕获的租户过滤应不同，缓存不得跨主体泄露；模型自报 tenant 不应改变过滤。
- 注册一个合成写工具，模型提出调用但未批准：领域状态不得变化；批准后故意让回执超时，重试前查幂等回执。
- 慢模型持续输出时断开客户端：确认请求资源最终释放，记录 `cancel_requested` 与实际上游终态/未知费用，不能用本地订阅关闭证明供应商取消成功。

L1 能定位 converter、模型适配器或工具错误；L2 能设计线程/连接隔离、授权上下文传播和取消契约；L3 用固定负载与阻塞比例比较同步/异步方案，报告排队与尾延迟，不用框架名称推断性能。

> 我不会把 Spring AI 项目只讲成调用 ChatClient。生产排障会先看入口层的 SSE 和线程池，再看模型调用的超时、限流、重试和 fallback；RAG 问题拆检索、权限和上下文；Tool Calling 问题拆 schema、授权、幂等和错误码；最后用 trace 把 prompt、模型、token、工具调用和引用文档串起来。这样才能定位是模型问题、业务 API 问题，还是工程治理问题。

## 项目讲法

银行客服 Agent 可以这样讲：

以下是银行客服参考设计，不是本文验证过的上线经历；未实现的能力应改为计划，不能复制为履历。

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
