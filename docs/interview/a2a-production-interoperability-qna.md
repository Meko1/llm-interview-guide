# A2A 跨 Agent 互操作生产设计面试题

> A2A 解决的是独立 Agent 如何发现、委托和交付任务，不等于“给多个 Agent 加一条 HTTP 通道”。生产难点在可信发现、委托身份、长任务状态、Artifact 安全、回调、预算和审计。协议基础见 [A2A 协议与 Agent 互操作](/agent/a2a-protocol)，工具接入见 [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)，权限执行见 [企业 Tool Gateway 安全执行系统设计面试题](/interview/tool-gateway-security-design)。

## 怎么用这页

当面试官问“A2A 和 MCP 什么关系”“如何把一个外部 Agent 接进企业流程”“长任务失败了如何恢复”时，不要只背 Agent Card、Task、Artifact 名词。按下面的链路回答：

1. 先说明协议角色：A2A 管 Agent 间任务协作，MCP 管 Agent 到工具/资源的接入。
2. 再说明信任：发现的是能力描述，不是授权结论；身份和权限必须沿委托链收敛。
3. 再说明运行：Task 是持久状态机，stream/webhook 只是状态通知通道。
4. 再说明数据：Artifact、文件、表单和网页内容都属于不可信跨边界输入。
5. 最后说明治理：注册、版本、预算、回调验签、trace、审计、撤销和降级。

## 30 秒总答法

> 我会把 A2A Server 当成一个不透明的远程任务服务，而不是内部函数。Client Agent 从受信 Registry 或经过验证的 Agent Card 发现候选能力，再以用户/租户/目的为约束申请短期委托凭证。Client 创建带幂等键、预算、输入分类和回调策略的 Task；Remote Agent 通过持久状态机执行，使用流式或签名 webhook 报告状态和 Artifact。每一次委托都要记录 delegator、subject、scope、task_id、card/schema 版本、策略版本和 trace。Remote 的内部工具不应暴露，但它的输出、Artifact、回调和最终副作用必须被 Client 的策略和业务系统校验。高风险任务只允许生成预览或进入 approval，不把授权沿委托链放大。这样 A2A 带来跨框架互操作，同时仍保持最小权限、可取消、可恢复和可审计。

## 一、A2A 的边界：协议解决什么，不解决什么

| 问题 | A2A 能提供 | 仍需企业运行时提供 |
| --- | --- | --- |
| 能力发现 | Agent Card、skills、接口和认证需求描述 | 可信 Registry、准入、签名校验、版本治理 |
| 任务协作 | Message、Task、Artifact、流式/异步更新 | 队列、持久化、重试、预算、SLA |
| 身份认证 | 声明安全方案、使用标准 Web 认证 | 委托身份、租户/资源授权、凭证代理 |
| 输出交付 | 结构化 Part、文件引用、Artifact | DLP、恶意文件扫描、业务字段校验 |
| 多 Agent 协作 | 远程 Agent 的黑盒任务边界 | 路由策略、评价、回滚和事故响应 |

**一句话区分**：MCP 让 Agent 获得“手和眼”，A2A 让 Agent 能把一个有状态的子任务交给另一个独立的“同事”。一条端到端业务链路通常两者同时存在。

## 二、企业 A2A 的分层架构

```text
Client Agent / Workflow
  -> A2A Gateway
      -> Trusted Agent Registry / Card Verifier
      -> IAM / Delegation Token / Policy Decision
      -> Task Store + Outbox + Scheduler
      -> Callback Verifier + Event Processor
  -> Remote A2A Agent
      -> its own Planner / Tools / MCP / Workers
      -> Artifact Store
  -> Audit + Trace + Cost + Incident Control Plane
```

| 组件 | 关键职责 | 典型错误 |
| --- | --- | --- |
| A2A Gateway | 认证、协议适配、卡片缓存、限流、路由 | 把 Gateway 当透传代理，丢失任务和策略证据 |
| Registry | 维护受信 agent、owner、风险、版本、SLA | 任何 `/.well-known` 地址都自动接入 |
| Policy Center | 按主体、用途、资源和风险决定委托范围 | 只校验调用方身份，不校验最终业务权限 |
| Task Store | 状态、幂等、checkpoint、取消、预算 | 只靠 SSE 事件当作任务事实来源 |
| Callback Processor | 验签、去重、顺序与回放保护 | 收到任意 webhook 就更新任务状态 |
| Artifact Gateway | 文件引用、下载、扫描、DLP、保留期 | 把远端文件 URL 直接下载进业务网络 |

## 三、Agent Card：发现不是信任，元数据不是密钥

Agent Card 让 Client 知道远端 Agent 的身份、skills、端点、交互模式与认证要求。生产中要把它当作**外部声明**，不能当作已经认证的真相。

### 可信发现流程

1. 企业内部优先通过 Registry 获取 Agent Card，而不是让模型任意搜索 URL。
2. 校验 HTTPS、域名归属、卡片签名或 Registry 绑定、版本和过期时间。
3. 检查 `skill_id`、输入输出模态、支持接口、认证要求、风险等级和 owner。
4. 只把当前任务允许的 skills 暴露给 Client Agent 的上下文。
5. 缓存 Card 时带 TTL 和 ETag/版本；撤销或高危变更要立刻失效。

### 绝不能放入 Card 的内容

- 长期 API Key、OAuth refresh token、数据库凭证；
- 内部 prompt、工具链细节、生产拓扑或敏感数据样例；
- “本 Agent 已经有全部权限”这类无法机器验证的承诺。

Agent Card 可声明认证方案，但凭证应由 Client 通过受控的 out-of-band 过程或 Credential Broker 获取；卡片不能成为 secret distribution 机制。

## 四、身份委托：谁代表谁在请求什么

跨 Agent 调用的最大风险是授权被放大。正确的委托链必须保存至少四个主体：

```text
subject    = 最终用户或业务主体
actor      = 当前 Client Agent
client     = 发起调用的应用/工作流
resource   = 本次任务允许触达的租户、业务域或对象
```

委托 token 应绑定：`audience=remote-agent`、`tenant`、`skill`、`purpose`、`task_id`、`scope`、`exp` 和 `jti`。Remote Agent 不能把 Client 的通用 token 继续转交给下游；每一跳都要缩小而不是扩大 scope。

| 错误做法 | 正确做法 |
| --- | --- |
| Client 用万能服务账号调所有 Remote Agent | 按 agent/skill/task 签发短期最小权限凭证 |
| 在 A2A Message 里传 `role=admin` | 身份与角色由签名 token 和服务端策略导出 |
| Remote 说“已授权”就执行资金操作 | 最终业务 API 做资源级二次鉴权与额度判断 |
| 每跳保留全部用户数据 | 仅传本 task 必需的最小上下文，附分类标签 |

## 五、Task 必须是持久状态机

A2A Task 的 `working`、`input-required`、`completed` 等状态表达协作语义；企业运行时还必须补充任务租约、幂等、超时、取消和证据。

```text
CREATED
  -> DISPATCHED
  -> WORKING
  -> INPUT_REQUIRED | APPROVAL_PENDING | CHECKPOINTED
  -> COMPLETED | FAILED | CANCELLED | EXPIRED
```

### 每个任务需要保存什么

- `task_id`、`idempotency_key`、父任务/委托链和当前 attempt；
- Agent Card、skill、协议接口和 schema 版本；
- 委托 token 的摘要、租户、数据分类、允许资源、预算和 deadline；
- Remote 返回的状态序列、Artifact 引用、回调事件 ID 和验证结果；
- 审批、取消、重试、补偿和最终业务回执。

**面试官：SSE 已经能持续推状态，为什么还需要数据库？**

> SSE 是传输，不是事实存储。连接会断、事件会重复或乱序、Remote 会重启。Task Store 才是状态权威；每个事件带 event_id/sequence，写入时去重并校验合法状态迁移。SSE 和 webhook 只驱动状态机，不能绕过状态机。

## 六、异步回调、取消与重试

### Webhook 的生产要求

- 回调 endpoint 必须 allowlist、HTTPS、签名校验和时间戳/nonce 防重放；
- 以 `task_id + event_id` 去重，以 sequence 或 version 处理乱序；
- 回调只写入 Inbox/Outbox，再由 worker 更新业务状态，避免外部请求占用事务；
- 回调 payload 记录原始摘要和验证结论，失败可重放但不可重复副作用；
- Client 侧取消后，Remote 可能已有在途工作，因此取消是协商状态，不是假设立即停止。

### 重试矩阵

| 场景 | 是否可自动重试 | 原因 |
| --- | --- | --- |
| 网络超时且未收到 task_id | 谨慎，使用 idempotency key | 可能已在 Remote 创建任务 |
| 读取型技能的 429/5xx | 可退避重试 | 无业务副作用 |
| 远端返回 `input-required` | 不重试，等待补充 | 缺少事实不是临时错误 |
| 高风险写任务超时 | 先查业务回执，再决定 | 不能重复转账/提交 |
| 策略拒绝/凭证失效 | 不盲目重试 | 需要新授权或人工处理 |

## 七、Artifact、文件和多模态输入的安全边界

Artifact 可能是报告、图片、表格、文件引用或结构化 JSON。它是 Remote Agent 的输出，仍然不可信。

1. Artifact 先进入隔离对象存储，不让 Remote URL 直接访问内网。
2. 校验 content type、大小、hash、病毒/恶意宏、压缩炸弹和引用链。
3. 对 JSON 使用 schema + 业务规则；对文本/网页/PDF 做 prompt injection 与 PII 风险标记。
4. 根据数据分类、租户和用途执行 DLP、脱敏、保留期与删除策略。
5. 高风险 Artifact 只产生预览，不能直接作为下一个写工具的参数。

例如“财务 Agent 返回退款名单”不是可立即执行的指令；Client 必须校验每条记录的 tenant、金额、订单状态、批准额度和来源。

## 八、可观测、成本与 SLO

跨 Agent 系统没有全链路 trace，就无法判断问题发生在路由、Remote、其工具、回调还是 Artifact 下载。至少传播并记录：

`trace_id`、`parent_task_id`、`task_id`、`agent_id`、`skill_id`、`card_version`、`delegation_id`、`tenant_id`、`policy_version`、`attempt`、`budget`、`artifact_id`、`event_id`。

指标建议：

- Agent Card discovery 成功率与签名/版本拒绝率；
- 任务从创建到首反馈、完成、input-required 的 P50/P95；
- webhook 验签失败、去重命中、乱序事件和取消成功率；
- 按 agent/skill/tenant 的 token、工具、文件传输和人工审批成本；
- Artifact DLP/恶意文件阻断率、越权拒绝数和不安全委托链拦截率。

## 九、互操作兼容矩阵与发布门禁

协议支持不等于生产互操作。每次升级 Agent Card、Task schema、Artifact 模态、认证方式或扩展前，都要在模拟对端和真实候选对端上跑兼容矩阵。

| 测试维度 | 最小用例 | 失败处理 |
| --- | --- | --- |
| Card 兼容 | 新旧 card、未知字段、已撤销 skill、签名失效 | 拒绝发现或降级到兼容接口 |
| Task 语义 | 幂等重投、乱序事件、重复 webhook、取消竞态 | 状态机拒绝非法转移，事件进入死信队列 |
| 身份委托 | audience/scope/tenant 不匹配、token 过期 | 拒绝并记录 delegation evidence |
| Artifact | 超大文件、恶意文件、schema 漂移、敏感数据 | 隔离、扫描、DLP、人工复核 |
| 异常恢复 | Remote 重启、回调丢失、网络分区 | 从 checkpoint 查询 task，禁止盲目重放写操作 |
| 成本与容量 | fan-out、深层委托、慢 Agent | 限制委托深度、并发、预算和 deadline |

发布采用 allowlist 灰度：先让少量内部任务使用新 Remote Agent/Card 版本，监测任务成功率、`input-required` 比例、回调异常、Artifact 拦截和人工接管率；阈值越界时通过 Registry kill switch 停止新委托，同时保留既有 Task 的只读查询和人工接管通道。

## 十、系统设计题：跨组织投研报告协作平台

**题目**：企业研究 Agent 需要委托外部市场数据 Agent、内部合规 Agent 和报告生成 Agent。要求跨团队/跨厂商、长任务、引用可追溯、禁止把客户数据发给不合规 Agent。

### 白板回答结构

1. **登记**：所有 Remote Agent 先进入 Registry，验证 Card、owner、SLA、数据域和可用 skills。
2. **路由**：Client 根据任务标签选择允许的 Agent，不让模型临时访问未知 URL。
3. **委托**：下发最小化请求和短期 scoped token，`purpose=research_report`、`tenant`、`allowed_data_classification` 写入策略输入。
4. **执行**：Task Store 管状态、租约、重试和预算；stream/webhook 写入事件总线，统一处理去重与顺序。
5. **产物**：数据 Agent 输出进入隔离 Artifact Store，经 DLP、来源校验和引用格式检查后才交报告 Agent。
6. **合规**：涉及客户名称、未公开信息或对外发布时进入 approval；合规 Agent 只返回 verdict 和证据摘要，不获得其他 Agent 的全量工具权限。
7. **止血**：某个 Agent 发生泄露或被投毒时，从 Registry 下线、吊销委托 token、暂停在途任务并按 task/card/version 回溯。

## 十一、项目讲法模板

> 我们把跨团队 Agent 协作从框架内函数调用升级为 A2A 任务边界。每个 Agent 通过受信 Registry 发布经校验的 Agent Card，Client 只根据已批准的 skill 路由任务。委托时传的是绑定用户、租户、用途、Task 和 skill 的短期凭证，而不是共享服务账号。A2A Gateway 把流式和 webhook 事件写进持久 Task Store，用 event_id、sequence、Outbox 和幂等键处理断连、乱序和重复回调。Remote 的 Artifact 会先经隔离存储、DLP 和 schema 校验，再进入下游 Agent。资金、外发和发布类任务只允许产生审批预览。这样我们获得了跨框架互操作，但没有把内部工具、长期密钥或用户权限扩散到外部 Agent。

## 十二、反面回答清单

- “发现到 Agent Card 就说明该 Agent 值得信任。”
- “A2A 已经认证了，所以业务系统不用二次鉴权。”
- “把用户 token 原样传给每个 Remote Agent 最方便。”
- “SSE 连接不断就不需要持久化 Task。”
- “Webhook 收到就直接更新订单或报告状态。”
- “Artifact 是合作 Agent 生成的，因此可以直接执行或喂给高危工具。”
- “跨 Agent 协作要把彼此内部 prompt、工具和思维过程都共享。”

## 面试前 5 分钟速记

- A2A 是 Agent 到 Agent 的任务协议；MCP 是 Agent 到工具/资源的接入协议。
- Agent Card 用于发现，不是信任或密钥分发机制。
- 每跳委托都要缩小 scope，绑定 subject、actor、tenant、purpose、task 与 audience。
- Task Store 才是状态事实；SSE/webhook 是通知通道。
- 回调要验签、去重、排序、写 Inbox/Outbox 并可回放。
- Artifact 是不可信跨边界输入，要隔离、扫描、DLP 和 schema 校验。
- 发生事故时下线 Agent、吊销凭证、暂停在途任务、按版本和 task 回溯。

## 公开资料与延伸阅读

- [A2A Protocol Specification](https://github.com/a2aproject/A2A/blob/main/docs/specification.md)
- [A2A 开源项目](https://github.com/a2aproject/A2A)
- [A2A 协议与 Agent 互操作](/agent/a2a-protocol)
- [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)
- [企业 Tool Gateway 安全执行系统设计面试题](/interview/tool-gateway-security-design)
- [Agent 评测与安全合规高频问答](/interview/agent-evaluation-safety-qna)
