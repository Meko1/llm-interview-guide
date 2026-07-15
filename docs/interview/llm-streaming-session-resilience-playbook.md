# LLM 流式输出、取消与会话恢复系统设计

> 流式输出不是把模型 token 原样转发给浏览器。生产系统要同时处理首字延迟、客户端断连、上游取消、工具调用中间态、内容安全、幂等记账和可审计的最终答案。面试官问“怎么做流式对话”，真正想听的是你是否理解这些边界。

## 一、30 秒面试回答

我会将 LLM 流式调用拆成**请求编排、上游模型流、事件协议、会话持久化和连接管理**五层。浏览器通常用 SSE 接收单向 token 与状态事件；服务端为每个请求创建 `run_id`，把模型、Prompt、检索、工具和策略版本固定到运行快照。模型增量经服务端校验、缓冲和事件化后再发给客户端，不能直接透传。客户端取消或断连时，网关通过取消令牌停止上游生成和工具任务；短暂断连则用事件序号从缓存或事件日志续传。最终答案只有在完成安全检查、持久化 usage 和 trace 后才标记 `completed`。全链路按 `run_id` 观察 TTFT、流速、断连率、取消生效率、尾部延迟和 token 成本。

## 二、先区分三个概念

| 概念 | 目的 | 不应混淆为 |
| --- | --- | --- |
| Streaming | 尽早把可见结果交给用户，降低感知等待 | 请求已经完成或结果已经可靠 |
| Cancellation | 用户不再需要结果，释放上游与工具资源 | 仅关闭浏览器连接 |
| Resume | 连接异常后继续消费同一运行的事件 | 重新发起一次相同请求 |

流式响应提升体验，但模型仍可能在最后给出错误答案、工具调用失败或被安全策略拦截。因此 UI 要能显示“检索中、调用工具中、正在生成、已完成、已取消、需要重试”等明确状态，而不应把每个 token 都等同于最终承诺。

## 三、系统总览

```text
Browser / App
  -> POST /runs (创建运行与不可变快照)
  <- run_id
  -> GET /runs/{run_id}/events (SSE) 或 WebSocket 订阅

API Gateway
  -> identity / tenant / rate limit / request budget
  -> Orchestrator
       -> RAG / tools / policy checks
       -> Model adapter (provider stream)
       -> event normalizer + safety filter
       -> event buffer / durable trace
  -> SSE writer

Cancel / reconnect
  -> POST /runs/{run_id}/cancel
  -> cancellation token -> model/tool executor
  -> GET events?after_seq=N -> replay then live tail
```

关键原则是：**运行生命周期独立于网络连接生命周期**。一次浏览器刷新不应让后台在不知情的情况下继续烧钱，也不应让用户无法知道这次执行到底完成、取消还是失败。

## 四、协议选择：SSE、WebSocket 还是轮询

| 方案 | 适用 | 优点 | 注意点 |
| --- | --- | --- | --- |
| SSE | 服务端持续向浏览器推送生成事件 | HTTP 语义简单、自动重连、适合单向文本流 | 客户端动作仍用普通 HTTP；代理要关闭缓冲 |
| WebSocket | 需要双向实时协作、语音、共享状态 | 双向低开销，事件类型丰富 | 心跳、重连、鉴权刷新、连接治理复杂 |
| HTTP 长轮询 | 老系统或极少量状态更新 | 基础设施兼容性高 | TTFT 和实时性差，不适合 token 流 |

大多数聊天产品优先 SSE：发送消息用 `POST /runs`，取消用 `POST /runs/{id}/cancel`，订阅用 `GET /runs/{id}/events`。不要为了“看起来实时”把所有业务接口都改成 WebSocket。

一个可演进的 SSE 事件协议：

```text
id: 42
event: delta
data: {"run_id":"r_123","seq":42,"text":"根据第 12 页..."}

id: 43
event: citation
data: {"seq":43,"document_id":"policy-7","page":12}

id: 44
event: completed
data: {"seq":44,"finish_reason":"stop","usage":{"input":1234,"output":328}}
```

事件必须有单调递增的 `seq`。重连后，客户端带 `Last-Event-ID` 或 `after_seq`；服务端先补发遗漏事件，再接入 live tail。不要依赖“浏览器应该都收到了”。

## 五、运行状态机：生成不是只有成功和失败

```text
created -> queued -> preparing -> streaming -> finalizing -> completed
                 |        |             |              |
                 v        v             v              v
              rejected  failed       cancelling       failed
                                      -> cancelled
```

| 状态 | 允许的动作 | 必须记录 |
| --- | --- | --- |
| `created/queued` | 排队、取消 | 身份、配额、运行快照 |
| `preparing` | 检索、工具预检、策略判断 | 证据和策略判定 |
| `streaming` | 增量输出、断连恢复、取消 | `seq`、首字时间、增量 usage |
| `finalizing` | 引用整理、最终安全检查、记账 | finish reason、最终内容哈希 |
| `completed` | 只读回放与反馈 | 完整 trace、账单记录 |
| `cancelled/failed` | 回放已产生事件 | 取消来源、错误类型、已耗 token |

运行状态转换要使用乐观锁或条件更新，避免“取消请求”和“completed 回调”同时抵达时把同一运行记成两个终态。

## 六、不要直接透传模型 token

Provider 的 streaming chunk 通常包含角色、增量文本、工具调用 delta、完成原因和 usage，格式因厂商而异。模型适配层应该将其正规化为内部事件，再交给前端协议层。

需要在服务端完成的工作：

- 合并被切开的 Unicode、JSON 和 tool-call 参数片段。
- 限制单事件大小与发送频率，避免每个字符一次网络写入。
- 在合适边界做内容审核与敏感信息检测；对高风险场景采用保守展示策略。
- 将内部 provider 错误映射为稳定的产品错误码，不泄露密钥或供应商内部信息。
- 为 delta 追加 `run_id`、序号、模型版本和可追踪时间戳。

**常见错误**：模型流来一段就 `response.write()` 一段。这样无法兼容多模型、无法可靠续传、无法统一拦截敏感内容，也很难正确处理工具调用 JSON。

## 七、背压、缓冲与慢客户端

上游模型可能每秒产生数十个 chunk，而某些移动网络或浏览器标签页无法及时消费。若服务端无限制堆积，就会占满内存并拖垮连接池。

推荐策略：

1. 聚合短时间窗口内的小 delta，例如 20-80 ms 或到达标点时再发送。
2. 为每个订阅设置有界缓冲区；超过阈值时优先合并文本事件，而不是无限排队。
3. 若客户端长期不可写，断开订阅但保留短期事件缓冲；运行是否继续由产品策略决定。
4. 对每租户限制并发 run、并发 stream、每分钟输出 token 和长连接数。
5. 将“慢客户端导致的发送时间”与“模型生成时间”分别埋点，否则会误判模型变慢。

文本 delta 可以合并，状态事件、引用事件、错误事件和终态事件不能随意丢弃。事件缓冲必须保留最后的 `completed/cancelled/failed`，使重连客户端能收敛到确定状态。

## 八、取消：关闭页面不是取消上游任务

取消分为三层：

| 取消来源 | 服务端动作 | 风险 |
| --- | --- | --- |
| 用户点击“停止” | 条件更新状态，向模型与工具传播取消令牌 | 已输出内容和已耗 token 仍要记账 |
| 浏览器断连 | 标记订阅失联，延迟一小段时间观察重连 | 不能立刻假设用户放弃 |
| 平台超时/预算耗尽 | 强制取消，生成可解释终态 | 不能让工具在后台继续写入 |

取消 API 必须幂等：重复点击、前端重试或多个标签页请求取消，都应返回同一终态。对于有副作用的工具，取消不是“撤销世界”；工具层应有自己的幂等键、事务/补偿机制和执行状态查询。

```text
POST /runs/r_123/cancel
  -> compare-and-set: streaming -> cancelling
  -> signal model request abort controller
  -> stop launching new tools
  -> await/mark in-flight tools
  -> persist cancelled + usage + partial output hash
```

面试高分点：**取消令牌必须贯穿 HTTP 请求、编排器、模型适配器、检索调用和工具执行器；只在前端停止渲染不叫取消。**

## 九、断连恢复与幂等创建

### 9.1 创建请求的幂等性

客户端为“发送消息”生成 `idempotency_key`。网关将 `(tenant, user, key)` 与 `run_id` 绑定：网络超时后同一个 key 返回原运行，不会重复请求模型、重复下单或产生两份回答。

### 9.2 事件回放

热路径可将最近事件放在 Redis Streams 或内存环形缓冲，终态和完整 trace 写入持久存储。恢复请求流程：

```text
client reconnects with after_seq=41
  -> authenticate and recheck run ownership
  -> load events 42..latest from buffer/store
  -> write replay events in order
  -> attach subscriber to live stream if still streaming
```

回放窗口有限时，超过保留期的客户端不应悄悄从中间开始继续，而应返回“请读取最终结果/重新执行”的明确协议错误。

## 十、工具调用与结构化输出的流式边界

Agent 场景里，模型可能先流出思考性文本，再逐步构造工具参数。生产系统应避免将未确认的内部草稿暴露给用户，尤其当参数会产生副作用。

- 工具调用 delta 先在服务端累积，达到合法 JSON 且通过 schema 校验后才进入 `tool_call_ready`。
- 高风险工具先发 `approval_required`，不因模型已经“说要执行”就实际执行。
- 工具结果作为受信任/不可信数据分别标记，防止工具返回文本注入后续 prompt。
- 工具执行状态单独流式展示，例如“正在查询订单”“等待审批”，而不是伪造 token。
- 只有工具、权限、业务规则全通过，才将结果写入最终对话状态。

详见：[结构化输出与 JSON Schema](/interview/structured-output-qna)、[Agent 工具安全与权限边界](/agent/tool-safety)。

## 十一、安全与合规：流式场景多了哪些风险

1. **部分泄露**：最终审核前已经显示敏感 token。对高敏场景可按句子/风险窗口缓冲，或优先使用安全模型与严格数据最小化。
2. **跨租户续传**：事件回放接口必须重新认证并校验 `tenant_id`、用户和会话归属，不能只凭 run_id。
3. **日志泄露**：trace 需脱敏；不要把完整 Authorization、原始文件内容或工具密钥写进事件。
4. **缓存错配**：缓存与恢复键必须含租户、身份范围、Prompt/模型版本和文档索引版本。
5. **资源耗尽**：长连接、超长输出和频繁取消都要限流、限额和审计。

流式安全不是“等结束再扫一次”的问题。它要求明确哪些内容可以早展示、哪些操作必须等策略确认后才可见/可执行。

## 十二、观测、记账与告警

每个 `run_id` 至少关联：

```text
tenant, user/session, request hash, model/provider, prompt version,
rag/index version, tool schema version, status transitions,
ttft_ms, tokens_per_second, output_tokens, total_cost,
disconnect_count, resume_count, cancel_source, finish_reason
```

核心指标：

| 指标 | 解释 | 典型定位方向 |
| --- | --- | --- |
| TTFT p95 | 从提交到第一可见事件 | 排队、RAG、模型 prefill、代理缓冲 |
| 流中断率 | 非用户主动的异常终止 | provider、网络、超时、网关重启 |
| 取消生效率 | 取消后仍继续产生 token 的比例 | abort 未向上游传播 |
| 恢复成功率 | 断连后能否无丢失续传 | 事件保留、序号、鉴权 |
| 尾部延迟 | 最后 token 到终态确认的时间 | usage 回填、安全检查、持久化 |
| 每成功会话成本 | 完成/取消/失败都应纳入 | 重试、长上下文、工具循环 |

不能只看平均耗时。一个“首字很快但经常无终态”的系统，用户体验和账务一致性都会很差。

## 十三、测试清单

- 上游每种 chunk 分片方式都能正确合并 UTF-8、引用与工具参数。
- 客户端在第 N 个事件断开、重连后不会重复或丢失事件。
- 并发 `cancel`、provider `completed` 和网关重试时终态唯一。
- 超时、429、连接重置、模型错误分别映射到可预期错误码与重试策略。
- 慢消费者不会使单个运行无界占内存。
- 取消后不再启动新工具；已有写操作有幂等/补偿证据。
- 缓存和事件回放不能跨租户、跨用户或跨版本泄露。
- 压测同时验证 TTFT、连接数、内存、文件描述符和 token 记账。

## 十四、高频面试问答

**Q：为什么不直接把模型 SSE 转给浏览器？**

因为不同模型协议不一致，而且生产系统还要做鉴权、限流、事件编号、缓冲、内容安全、工具状态、usage 记账和断连恢复。适配层将 provider stream 规范成内部事件，才能稳定演进和切换模型。

**Q：用户刷新页面，后台任务应不应该停止？**

不应该把刷新直接等同于取消。连接断开后先保留一个短暂的恢复窗口；同一用户带 `run_id` 与最后事件序号重连时续传。超过窗口或用户明确点击停止，再发起幂等取消。对高成本后台任务还要由产品策略决定是否允许脱离会话继续。

**Q：怎样防止取消后仍在扣费？**

取消状态要传播到模型 HTTP 请求和工具执行器；服务端在收到 abort 后停止消费与重试，记录已产生 usage。不能保证已发送给 provider 的 token 绝对不计费，但要监控取消生效率，并限制取消后继续输出的尾部 token。

**Q：流式输出如何做内容审核？**

按风险分层。低风险聊天可做轻量增量检测和最终复检；高风险业务对句子/风险窗口缓冲后展示，或先走受控模板与结构化结果。无论哪种，工具写操作都必须在策略与审批确认后执行，不能依赖前端已经显示了什么。

**Q：SSE 与 WebSocket 怎么选？**

单向文本流和普通聊天优先 SSE，简单、易穿透现有 HTTP 基础设施；需要双向音视频、实时协作或复杂客户端命令时才选 WebSocket。重点不是协议名称，而是运行状态、重连序号、取消传播和资源治理是否完整。

## 十五、项目讲法模板

> 我负责 LLM 对话服务的流式交互链路。我们把模型厂商的流规范成内部事件，所有事件带 run_id 和序号，浏览器通过 SSE 消费、断连后按序号补发。每个 run 绑定模型、Prompt、检索和工具版本；取消令牌贯穿网关、编排器、模型请求和工具执行器。针对慢客户端做有界缓冲与 delta 合并，针对高风险动作先流式展示状态、后做审批执行。线上重点看 TTFT、流中断率、恢复成功率、取消生效率和每成功会话成本，因此既改善了首字体验，也避免了断连后的重复调用和不可审计账单。

继续学习：[推理成本与性能优化](/interview/inference-cost-qna)、[大模型网关](/engineering/llm-gateway)、[结构化输出与 JSON Schema](/interview/structured-output-qna)、[LLM 线上评测与灰度实验](/interview/online-evaluation-rollout-operations)、[Agent 观测与事故响应](/interview/agent-observability-incident-response)。
