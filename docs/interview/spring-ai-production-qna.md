# Spring AI / Java AI 生产化高频问答

> Spring AI 面试的重点不是“会不会调用 ChatClient”，而是 Java/Spring 生产系统如何把 LLM 接入已有权限、审计、SSE、限流、配置、微服务和运维体系。工程总览见 [Spring AI 基础与面试题](/engineering/spring-ai)，应用全链路见 [LLM 应用开发实战](/engineering/llm-app-dev)，完整系统设计回答见 [Java / Spring AI 生产架构系统设计面试题](/interview/java-ai-production-architecture-system-design)。

## 怎么用这页

遇到 Spring AI / Java AI 岗位题，可以按这条线回答：

1. **定位**：Spring AI 是 Spring 生态里的 LLM 抽象层，不只是少写 HTTP。
2. **接入**：ChatClient、Prompt、Advisor、Embedding、VectorStore、Tool Calling 接进业务服务。
3. **生产化**：SSE、超时、线程池、限流、降级、审计、成本、评估。
4. **安全**：RAG 权限前置，Tool 后端鉴权，高危动作人审。
5. **项目表达**：用 Java 后端的治理能力证明你不是只会调模型 API。

可复述版本：

> 我会把 Spring AI 放在 AI Service 层，统一封装模型、Prompt、RAG、Tool Calling 和流式输出。业务请求先进认证和租户上下文，再进入 AI 编排；RAG 检索带 ACL，工具调用走后端鉴权，SSE 有超时和断开处理，全链路记录 prompt_version、model、token、tool_calls、retrieved_docs 和 cost。

## 追问链一：Spring AI 相比自己封装 HTTP 有什么收益

**面试官：为什么不用 RestTemplate/WebClient 自己调模型 API？**

标准答法：

> 自己封装 HTTP 可以跑 demo，但生产里会重复处理模型差异、prompt 模板、结构化输出、流式返回、Embedding、VectorStore、Tool Calling、RAG Advisor、观测和配置。Spring AI 的价值是把这些能力纳入 Spring 的 Bean、配置、拦截器、监控和微服务治理体系。

| 能力 | 自己封装 HTTP 的问题 | Spring AI 的价值 |
| --- | --- | --- |
| 模型调用 | 各家 API 格式不同 | 统一 ChatClient / Model 抽象 |
| Prompt | 模板散落在业务代码 | 模板化、版本化、可复用 |
| RAG | Embedding / VectorStore 自己拼 | 统一检索组件和 Advisor |
| 流式输出 | SSE、取消、异常各处实现 | 统一封装和服务层治理 |
| Tool Calling | 工具 schema 和执行分散 | 可统一暴露 Java 方法和业务工具 |
| 观测 | 不知道 token、延迟、prompt 版本 | 全链路 trace 和成本拆账 |

反面回答：

> “Spring AI 就是少写几行 HTTP”太浅。面试官想听的是企业后端治理能力。

## 追问链二：Java 服务怎么做 SSE 流式输出

**面试官：Spring Boot 服务如何实现大模型 SSE 流式返回？**

标准答法：

> 后端把上游模型 token stream 转换成 `text/event-stream`，按事件推给前端。关键不是能流，而是客户端断开、上游超时、内容审核失败、代理缓冲、日志补全和线程资源都要处理。

### SSE 事件建议

| 事件 | 含义 |
| --- | --- |
| `message_start` | 返回 request_id、model、trace_id |
| `delta` | 增量 token |
| `tool_call` | 可选，展示工具调用状态 |
| `warning` | 降级、引用不足、部分失败 |
| `error` | 上游超时、审核失败、权限拒绝 |
| `message_end` | 正常结束，返回 token 和耗时摘要 |

### 关键处理

- 客户端断开：取消上游模型请求，释放连接和线程。
- 上游超时：发送结构化 error 事件，记录 partial response。
- 内容审核失败：停止继续输出，返回安全提示和审计日志。
- 代理缓冲：Nginx / 网关关闭响应缓冲，保持心跳。
- 日志：不要只记录最后答案，至少记录摘要、token、错误码和 trace_id。

**继续追问：同步 Servlet、异步线程池、WebFlux 怎么选？**

| 方式 | 适合 | 风险 |
| --- | --- | --- |
| 同步 Servlet | 低并发、实现简单 | 上游慢会占住业务线程 |
| 异步线程池 / `SseEmitter` | 中等并发、迁移成本低 | 需要独立线程池、超时和 backpressure |
| WebFlux | 高并发流式、响应式链路 | 团队学习成本和调试复杂度更高 |

可复述：

> 如果只是内部低并发助手，SseEmitter 足够；如果是高并发 C 端聊天，应该考虑 WebFlux 或独立流式网关。无论哪种方式，都要做超时、限流、断开取消和熔断。

## 追问链三：慢模型如何不拖垮 Java 微服务

**面试官：大模型接口慢且贵，Java 服务如何做异步、限流、排队、降级？**

标准答法：

> 我会把 AI 调用从核心业务线程池隔离出来，用 bulkhead、timeout、rate limit、queue、circuit breaker 和 fallback 控制风险。AI 服务慢不能拖垮订单、支付、登录这类核心链路。

| 风险 | 治理 |
| --- | --- |
| 上游模型慢 | timeout、异步执行、独立线程池 |
| 并发突增 | 限流、排队、拒绝策略 |
| 模型错误率升高 | 熔断、备用模型、降级到 FAQ |
| 成本失控 | 用户/租户预算、最大 token、缓存 |
| 长连接过多 | SSE 连接上限、心跳、超时清理 |

Java 落地时可以用 Resilience4j / Sentinel / 网关限流组合治理：`timeout` 控制单次等待，`bulkhead` 隔离线程池或信号量，`rate limiter` 控制租户速率，`circuit breaker` 在上游持续失败时快速失败。429 和网络抖动可以带退避重试；鉴权失败、权限拒绝、内容审核失败、结构化校验后的业务非法参数不要盲目重试。

项目表达：

> 我们把 AI 调用放到独立的 `ai-executor` 和模型网关后面，设置 P95 超时、最大并发、队列长度和租户配额。模型异常时降级为知识库搜索、标准 FAQ 或转人工，不影响核心交易服务。

## 追问链四：Spring AI RAG 权限怎么做

**面试官：企业 Java 知识库问答如何避免跨部门数据泄露？**

标准答法：

> 权限必须前置到检索层。文档入库时写入 tenant、department、role、owner、visibility 等元数据；查询时从登录态生成 ACL filter，向量召回和关键词召回都带过滤条件；拼上下文前二次校验引用文档权限。

RAG 权限链路：

```text
login user
  -> tenant / role / department
  -> build metadata filter
  -> vector search with ACL
  -> rerank only allowed docs
  -> verify citations
  -> generate answer with references
```

常见坑：

- 全局召回后靠 prompt 保密。
- 只过滤向量库，不过滤 BM25 或缓存。
- 引用链接不校验权限。
- chunk 失去原文档 ACL。
- 日志里明文记录敏感片段。

可复述：

> RAG 权限不是 prompt 问题，是检索系统问题。模型不该看到无权文档。

## 追问链五：Tool Calling 如何接企业业务系统

**面试官：Spring AI Tool Calling 如何调用订单、工单、CRM 这类内部系统？**

标准答法：

> 我会把工具封装成后端业务服务方法，而不是让模型直连数据库或内部 HTTP。只读工具和写工具分开；执行前做参数校验、用户/租户鉴权和风险判断；写操作生成待确认动作，确认后带幂等键执行。

工具设计：

| 工具类型 | 示例 | 控制 |
| --- | --- | --- |
| 只读查询 | 查订单、查物流、查工单状态 | ACL、字段脱敏、分页 |
| 低风险写 | 创建草稿、提交内部备注 | 幂等、审计、可撤销 |
| 高风险写 | 退款、转账、对外发邮件 | prepare/commit、HITL、approval_id |
| 管理类 | 改权限、删数据、部署 | 默认不暴露给自由 Agent |

错误结构：

```json
{
  "ok": false,
  "error_code": "permission_denied",
  "retryable": false,
  "message": "current user cannot access this order"
}
```

一句话：

> 模型只提出工具调用意图，真正执行仍然是 Java 服务端的业务 API，必须按普通生产接口做鉴权、事务、幂等和审计。

## 追问链六：结构化输出和业务校验

**面试官：模型返回 JSON 偶发不合法，Java 后端怎么处理？**

标准答法：

> 不能只靠 prompt 说“请返回 JSON”。优先用模型侧 JSON / schema 约束或 Spring AI 的结构化输出转换；后端用 DTO + Bean Validation 做二次校验；解析失败可以重试一次，关键字段不合法则拒绝或转人工。

处理顺序：

1. Prompt 明确输出 schema 和示例。
2. 使用结构化输出 / converter / JSON mode。
3. 后端解析到 DTO。
4. Bean Validation 校验字段范围。
5. 失败时有限重试或降级。
6. 记录 bad case 到评估集。

反例：

> 直接 `ObjectMapper.readValue()` 失败就 500，不适合生产。

## 追问链七：模型网关与 Spring AI 如何分工

**面试官：企业 Java 系统为什么还需要模型网关？Spring AI 不能直接接所有模型吗？**

标准答法：

> Spring AI 是应用侧抽象，模型网关是平台侧治理。Spring AI 负责业务服务里的 prompt、RAG、tool 和调用编排；模型网关负责统一 key、模型路由、限流、配额、计费、fallback、审计和供应商切换。

| 层 | 职责 |
| --- | --- |
| Spring AI 应用层 | 业务上下文、Prompt、RAG、Tool、SSE |
| 模型网关 | 虚拟 Key、模型路由、限流、计费、fallback |
| MaaS 平台 | 模型目录、租户配额、评测门禁、账单 |
| 推理平台 | 自托管模型、GPU、vLLM/SGLang、压测 |

可复述：

> 业务服务不应该散落保存各家模型 key。Spring AI 调的是企业模型网关，网关再决定走哪个模型和供应商。

## 追问链八：可观测、审计和成本怎么做

**面试官：Spring AI 应用上线后怎么排障和算成本？**

标准答法：

> 每次请求都要串起 HTTP request、用户、租户、prompt_version、model、token、latency、retrieved_docs、tool_calls、error_code 和 cost。没有 trace，就无法判断问题是模型、RAG、工具、权限还是网关。

审计字段：

| 类型 | 字段 |
| --- | --- |
| 请求 | request_id、user_id、tenant_id、endpoint |
| 模型 | model、provider、prompt_version、temperature |
| 成本 | input_tokens、output_tokens、price、budget |
| RAG | query、top_k、doc_ids、scores、acl_filter |
| Tool | tool_name、args_summary、status、latency |
| 输出 | finish_reason、safety_result、error_code |

工程落地可以把业务日志、Micrometer 指标和 OpenTelemetry trace 串起来：日志保留可审计摘要，指标看 QPS、P95、错误率、token 和成本，trace 负责把 HTTP 请求、RAG 检索、模型调用、工具调用串成一次可回放的链路。

成本治理：

- 按 app / tenant / user / model 拆账。
- 高频问题缓存。
- 简单任务走小模型。
- 限制 Top-K、历史轮数、最大输出 token。
- 超预算降级或转人工。

## 系统设计题：Java + Spring AI 银行客服 Agent

题目：

> 设计一个 Java + Spring AI 银行客服 Agent，支持制度问答、账户查询、工单创建、流式输出、权限审计和人工兜底。

### 需求澄清

- 用户渠道：App、Web、坐席系统还是内部员工？
- 哪些问题只读，哪些涉及写操作？
- 是否允许查询账户明细、交易记录、贷款信息？
- P95 延迟和并发要求是多少？
- 是否要私有化模型或接企业模型网关？
- 审计日志保留多久？

### 架构答法

```text
Web/App
  -> Spring MVC/WebFlux API
  -> Auth / Tenant / RateLimit
  -> AI Service with Spring AI
      -> Intent Router
      -> RAG Advisor with ACL
      -> ChatClient via Model Gateway
      -> Tool Calling: account / ticket / CRM
      -> Safety / Human Handoff
  -> SSE / JSON Response
  -> Trace / Audit / Cost
```

### 主链路

1. 用户请求进入 Spring API，解析身份、租户、角色和渠道。
2. 意图识别分为制度问答、账户查询、工单、投诉、转人工。
3. 制度问答走带 ACL 的 RAG。
4. 账户查询走只读 Tool，并做字段脱敏。
5. 工单创建先生成草稿或待确认动作。
6. ChatClient 通过模型网关调用模型，结果用 SSE 返回。
7. 全链路写 trace、审计和成本。

### 上线门禁

- 制度问答 golden set 准确率达标。
- 跨租户/跨用户数据泄露 = 0。
- 高危写操作未确认执行 = 0。
- SSE 中断和上游超时有结构化错误。
- P95 延迟和单问成本达标。
- bad case 能回放到 prompt、文档和工具。

## 项目讲法模板

### 模板一：政企知识库问答

> 我们用 Spring AI 接入政企制度知识库。文档入库时写入部门和角色元数据，查询时按登录用户生成 ACL filter。模型调用走企业模型网关，ChatClient 统一设置 prompt_version 和模型参数。回答必须带引用，引用文档二次校验权限。上线前用制度问答 golden set、跨部门越权集和拒答集做回归。

### 模板二：银行客服 Agent

> 银行客服里，制度问答走 RAG，账户类问题走只读工具，高危操作只生成待确认工单。Spring AI 负责 ChatClient、RAG Advisor 和 Tool Calling 编排；Spring Security 提供用户和租户上下文；SSE 返回流式答案；日志记录 token、引用文档、工具调用和审计字段。模型慢或网关限流时降级到 FAQ 或转人工。

### 模板三：Dify PoC 迁 Java 生产

> PoC 阶段用 Dify 验证高频问题和知识库策略；进入生产后，把权限过滤、工具调用、审计、灰度、成本统计迁到 Spring AI 服务。Dify 里的 prompt 和 bad case 沉淀为模板和评估集，核心链路由 Java 后端接企业 IAM、模型网关和监控平台。

## 反面回答清单

面试里尽量别这样说：

- “Spring AI 就是调 OpenAI 的 Java SDK。”太浅。
- “RAG 权限靠 prompt 约束。”错误，权限要检索前过滤。
- “SSE 能流式返回就行。”少了断开、超时、审核和日志。
- “模型慢就多开线程。”会拖垮服务，要隔离、限流、熔断。
- “Tool Calling 直接调内部接口。”缺少鉴权、幂等和审计。
- “模型网关和 Spring AI 二选一。”它们是平台层和应用层分工。

## 面试前 5 分钟速记

- Spring AI 定位：Java/Spring 生态的 LLM 抽象和生产接入层。
- 生产六件套：SSE、timeout、rate limit、fallback、audit、cost。
- RAG 权限：文档 ACL 入库，检索前过滤，引用二次校验。
- Tool 原则：只读/写分离，后端鉴权，高危 prepare/commit。
- SSE 关键：断开取消、上游超时、审核失败、心跳、日志。
- 网关分工：Spring AI 做业务编排，模型网关做平台治理。
- 项目亮点：接 IAM、审计、配置、监控、成本和微服务治理。

## 延伸阅读

- [Spring AI 基础与面试题](/engineering/spring-ai)
- [LLM 应用开发实战](/engineering/llm-app-dev)
- [模型网关与多模型路由](/engineering/llm-gateway)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [框架与智能工作流高频问答](/interview/framework-workflow-qna)
