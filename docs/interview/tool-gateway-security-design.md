---
title: 企业 Tool Gateway 安全执行系统设计面试题
description: 将模型调用意图转为受控业务动作，设计可信身份、ABAC义务、最小凭证、参数绑定审批、原子幂等、未知副作用对账、撤销窗口与可追溯审计。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 企业 Tool Gateway 安全执行系统设计面试题

> 这页回答一个很容易被问深的问题：模型已经选好了工具和参数，企业系统凭什么允许它触达订单、退款、邮件、工单、数据库或生产资源？核心答案是：**模型只生成调用意图，Tool Gateway 才拥有受策略约束的执行权。** Function Calling 基础见 [Function Calling 与 MCP](/agent/function-calling-mcp)，风险模型见 [Agent 工具安全与权限边界](/agent/tool-safety)，MCP Server 治理见 [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)。

## 怎么用这页

本页为参考系统设计；所有身份样例、审批状态、JSON和项目模板均为构造，不是产品默认能力或个人上线实测。

面对 Tool Calling、MCP、Agent 安全或企业 Java AI 岗位，不要直接从“我会写一个工具函数”开始。按下面的顺序回答：

1. **定义边界**：模型提议 action，网关做策略执行，资源服务在提交点复核授权。
2. **说明身份**：谁请求、以谁的权限、为了什么目的、能碰哪些租户和资源。
3. **说明凭证**：模型、prompt与工具schema不接触密钥；可信业务后端/凭证代理可持有受隔离管理的凭证，第三方MCP不获万能共享密钥。
4. **说明写操作**：prepare、预览、审批、commit、幂等、撤销和审计必须拆开。
5. **说明止血**：策略拒绝、凭证撤销、工具下线、会话终止和证据回溯都要在控制面完成。

## 30 秒总答法

> 我会把 Tool Gateway 设计为 Agent 到真实业务资源之间的 Policy Enforcement Point。Host 把已经验证的用户、租户、会话和任务上下文传给 Gateway；模型输出的 `tool_name + arguments` 先经过 schema、业务语义和策略校验，再由策略中心根据 subject、action、resource、tenant、purpose、risk 和环境上下文给出 allow、deny、脱敏、限流、沙箱或 require_approval 等决定。Gateway 只为允许的单次调用换取短期、最小 scope 的下游凭证，并把写操作拆成 prepare/approval/commit。业务服务仍会二次鉴权，所有策略版本、审批证据、凭证 jti、参数摘要、结果摘要和 trace_id 进入访问受控、追加写且可验证完整性的审计；普通trace/hash本身不构成不可抵赖证明。这是最小权限和可追溯目标，不保证所有越权、重放或泄露都已被消除；旁路、资源侧授权和撤销传播仍需验证。

## 一、Tool Gateway 不是普通 API 转发层

普通 API Gateway 主要做鉴权、路由、限流和协议适配；Tool Gateway 还要理解“这次调用由模型提出、代表哪个人、会影响哪类资源、是否需要确认”。

| 职责 | 关键问题 | 常见产物 |
| --- | --- | --- |
| 工具目录 | 这个工具是否存在、谁负责、当前版本是什么 | `tool_id`、schema、owner、SLA、risk_level |
| 策略执行 | 当前用户能否在当前会话调用它 | allow/deny/approval/mask/sandbox |
| 凭证代理 | 下游凭证如何按最小权限签发 | 短期 token、audience、scope、jti |
| 执行与证据 | 调了什么、为什么允许、产生了什么影响 | trace、审计事件、审批记录、幂等记录 |

**面试要点**：不要说“给 Agent 一个 service account”。一个共享高权限账号会让租户、用户、用途和责任主体全部丢失；Tool Gateway 的价值恰恰是把它们重新绑定回一次受控调用。

## 二、信任边界与分层

```text
Browser / App
  -> Host / AI Orchestrator
      -> LLM: tool-call intent only
      -> Tool Gateway (PEP)
          -> Tool Registry
          -> Policy Decision Point / IAM / Approval Service
          -> Credential Broker / Secret Manager
          -> DLP / Sandbox / Egress Proxy
          -> Business API or MCP Server
              -> resource-level authorization
  -> immutable audit + trace + incident control plane
```

| 组件 | 能做什么 | 不能信任什么 |
| --- | --- | --- |
| 模型 | 选择候选工具、填充候选参数、总结结果 | 用户身份、权限结论、资源归属、密钥 |
| Host / Orchestrator | 建立会话、裁剪可见工具、承接流式交互 | 不能用 prompt 代替授权 |
| Tool Gateway | 策略执行、凭证兑换、审批编排、审计 | 不能绕过业务服务的数据权限 |
| MCP Server / 业务服务 | 执行领域操作、资源级二次鉴权 | 不能盲信模型参数或 Host 自报身份 |
| 策略与身份中心 | 签发/验证身份、策略决策、撤销 | 不执行模型生成的业务写入 |

MCP 是协议，不是授权系统。HTTP、MCP、stdio 或本地执行器都可以接入 Gateway，但真实执行权限必须由同一套身份、策略和审计模型约束。

## 三、身份传播与身份委托怎么设计

| 身份材料 | 适合场景 | 风险 | 正确做法 |
| --- | --- | --- | --- |
| 用户原始登录 token | 面向业务 API 的短链路调用 | audience 不匹配、scope 过宽、被日志泄露 | 不透传到模型或第三方 Server |
| Host 服务身份 | Host 自身访问控制面 | 丢失最终用户责任 | 仅用于向授权服务申请委托 |
| 委托 token | Gateway 到下游单次工具调用 | 被重放或跨服务使用 | 短期、audience 限定、scope 最小、带 `jti` |
| 下游服务账号 | 服务间后台任务 | 过度授权 | 由 Credential Broker 临时绑定任务与资源 |

一次退款工具调用应当能说明“谁在代表谁做什么”：

```text
subject=user:alice
actor=agent:customer-service
client=host:bank-assistant
tenant=bank-cn-a
purpose=customer_refund_after_dispute
action=refund.prepare
resource=order:O-123
```

Gateway 在策略通过后，向凭证代理申请只可访问 `refund.prepare`、仅面向 `refund-api`、只属于该租户、有效期数分钟的 token。下游按明确凭证profile检查可信issuer/密钥、算法allowlist、签名、aud、有效时间与业务scope/tenant，并核订单资源。scope/tenant属于本方案约定，不是任意JWT通用强制字段；jti只是标识，重放检测还需原子状态或绑定机制。

### 为什么不能让模型带 `user_id` 直接调用

模型生成的任何参数都属于不可信输入。`{"user_id":"admin"}`、`{"tenant":"other-company"}`、`{"role":"finance"}` 都不能作为授权依据。身份、租户、角色、审批状态必须由服务端的认证上下文或签名凭证导出；模型参数最多用于定位候选资源，且要在资源层验证归属。

## 四、工具可见性裁剪不等于执行时授权

| 阶段 | 目的 | 例子 | 是否能单独保证安全 |
| --- | --- | --- | --- |
| 工具可见性裁剪 | 减少模型误选和上下文噪声 | 普通客服看不到 `delete_customer` | 否，旧 prompt 或恶意请求可能绕过 |
| schema 校验 | 保证字段形状正确 | 金额、枚举、ID 格式 | 否，字段合法不代表有权限 |
| 策略授权 | 判断当前 action 是否允许 | 只有订单所有者可发起退款 | 否，仍需资源层防御 |
| 业务二次鉴权 | 在真实资源处验证归属、状态和额度 | 订单未退款、金额不超限 | 是最终业务防线 |

**裁剪解决“模型看见什么”，策略解决“这次能不能做”，业务服务解决“这条资源能不能真的改”。三层都不能省。**

## 五、ABAC 策略与策略义务

一个容易扩展的策略输入可以写成：

```json
{
  "subject": {"user_id": "u-7", "roles": ["support"], "department": "cs"},
  "action": "ticket.create",
  "resource": {"type": "ticket", "tenant": "t-a", "customer_level": "standard"},
  "context": {"purpose": "after_sales", "channel": "web", "hour": 14},
  "risk": {"tool_level": "L2", "amount": 0, "external_egress": false}
}
```

策略中心不应只返回布尔值，还应返回由 Gateway 强制执行的**义务（obligations）**：

| 决定 | Gateway 必须执行的义务 |
| --- | --- |
| `allow` | 注入租户、记录策略版本和审计事件 |
| `deny` | 阻断调用，向模型返回不可泄露细节的结构化错误 |
| `require_approval` | 创建待确认动作，冻结参数摘要与资源版本 |
| `mask` | 对手机号、证件号、账户号做字段级脱敏 |
| `sandbox` | 在隔离环境运行，禁止生产写入和公网出站 |
| `rate_limit` | 按用户、工具、租户、风险域限速 |

策略即代码应版本化、评审、测试和灰度。审计记录需要同时保存 `policy_id`、`policy_version`、输入摘要与最终决定，避免事故后只能看到“系统允许了”。

## 六、高危写操作：prepare、approval、commit

退款、转账、批量发邮件、改权限、部署生产变更不能让一次工具调用直接完成。推荐状态机：

```text
requested
  -> validated
  -> prepared
  -> approval_pending
  -> approved | rejected | expired
  -> committed | failed | compensated
```

### prepare 阶段必须冻结什么

- 规范化后的工具参数与参数哈希；
- 资源版本或 ETag，防止确认前对象被别人修改；
- 申请人、受益人、金额、租户、用途、风险等级；
- 策略版本、审批规则和过期时间；
- `idempotency_key` 与一次性确认令牌。

审批通过后，commit 仍要重新检查 token、审批人、资源版本、额度和策略。这是在防 **TOCTOU**：用户确认的是“退款 100 元给 A”，真正提交时不能被模型或并发请求换成“退款 1000 元给 B”。确认令牌应绑定 `action_hash + subject + tenant + approval_id + expiry`，不可复用于别的动作。

### 幂等与补偿

写工具必须让调用方传入或由 Gateway 生成幂等键。业务服务以 `tenant + tool + idempotency_key` 做去重，同时绑定规范化payload hash，重复同key不同payload返回冲突。去重记录与本地业务写需同事务提交；跨外部服务不能只凭Gateway查key就保证仅执行一次。跨多个业务系统的长事务不要假装成数据库事务：按业务采用Saga/Outbox及明确补偿；Outbox通常是至少一次投递，消费者仍需幂等，补偿不等于撤回所有现实影响，并在模型侧清楚返回 `pending`、`succeeded`、`failed` 或 `compensation_required`，以及回执丢失时的`unknown_effect`。状态未知先对账，不自动用新幂等键重放。

## 七、凭证隔离、密钥代理与紧急撤销

**禁止项**：把数据库密码、第三方 API key、长期 OAuth refresh token、生产 kubeconfig 放入 prompt、tool description、MCP 配置或模型上下文。

建议链路：

1. 工具注册表声明需要的下游资源和最大 scope。
2. Gateway 通过策略后向 Credential Broker 兑换短期凭证。
3. 凭证按本方案profile绑定audience、tenant、scope、tool_id、jti和短TTL；签发方与验证方共同配置，不能仅把这些字段写到prompt。
4. 下游服务验证并关联jti、请求hash和trace；若要求单次提交，还需原子消费/业务幂等记录，保留日志本身不防重放。
5. 发生风险时按实际支持的撤销/denylist/introspection机制拒绝凭证，冻结工具并停止新执行；离线自包含token无法仅靠控制面字段立即撤销，存量请求仍需对账。

对于第三方 MCP Server，优先使用每个 Server 独立的租户隔离凭证和出站代理；无法确认来源、无法做资源级审计、无法限制 scope 的 Server 不应进入生产工具目录。

## 八、工具结果同样是不可信输入

工具返回结果可能包含恶意文本、间接 prompt injection、敏感字段、超长内容或诱导链接。Gateway 或结果处理层应做：

- 结果 schema 和大小上限校验；
- 字段白名单与 PII 脱敏，而不是把整个 API 响应塞回模型；
- HTML/Markdown/URL 清洗与外链风险标注；
- RAG、网页抓取和第三方 MCP 结果标记为不可信上下文；
- 需要外发时走 DLP、目的地 allowlist 和 egress audit。

这也是为什么“工具调用成功”不代表 Agent 可以把原始结果直接展示或继续用于下一个高危动作。数据外发治理可结合 [LLM 数据分级、外发治理与审计证据面试题](/interview/data-governance-egress-audit-qna) 一起回答。

## 九、MCP、HTTP、stdio 与本地执行器如何统一治理

| 类型 | 常见风险 | Gateway 侧控制 |
| --- | --- | --- |
| 内部 HTTP API | 过度服务账号权限、参数越权 | 委托 token、资源二次鉴权、幂等 |
| 远程 MCP Server | Server 投毒、凭证泄露、租户混淆 | 签名/准入、独立凭证、出站代理、审计 |
| stdio MCP | 子进程越权、文件系统泄露 | 沙箱、文件系统 allowlist、资源配额 |
| 本地 Shell / Code 工具 | 命令注入、供应链、破坏性操作 | 受限 runner、命令模板、网络隔离、审批 |

协议适配器只负责把调用转换成 HTTP/JSON-RPC/stdio；安全决策不能藏在适配器里，否则同一业务工具换协议后就会绕过治理。统一的 `tool_id`、策略输入、审批状态、审计事件和凭证代理才是控制面。

## 十、可观测、审计与事故响应

每次调用至少要关联：`request_id`、`trace_id`、`session_id`、`tenant_id`、`subject_id`、`tool_id`、`schema_version`、`policy_id/version`、`decision`、`approval_id`、`credential_jti`、`idempotency_key`、参数摘要、资源摘要、结果摘要、延迟和错误码。

指标不要使用 `user_id`、订单号或自由文本做 label，避免高基数与隐私泄露。更合适的是按 `tool_id`、risk_level、decision、tenant_tier、error_code 聚合；明细放到有访问控制的 trace 或审计存储。

### 发现越权风险后的止血顺序

1. 关闭工具在 Registry 中的可见性并阻断 Gateway 路由；
2. 撤销关联的短期凭证、冻结审批和终止进行中的会话；
3. 按 `tool_id + version + policy_version + jti + time window` 回溯影响范围；
4. 核查已执行写操作，触发补偿、通知与人工复核；
5. 固化回归样本、修正策略和 schema，灰度后再开放。

## 十一、系统设计白板题：多租户金融客服 Agent 的工具平台

**题目**：设计一个客服 Agent，可查订单、创建工单、生成退款申请、发送邮件。要求租户隔离、写操作需确认、可审计、第三方 MCP Server 可接入。

### 白板回答结构

1. **先分级**：订单查询为敏感读，工单草稿为普通写，退款和外发邮件为高危写。
2. **再拆面**：数据面包括 Host、Gateway、业务 API/MCP Server；控制面包括 Registry、IAM/Policy、Credential Broker、Approval、Audit 和 Kill Switch。
3. **再讲主链路**：用户登录上下文进入 Host；Host 用策略裁剪工具；模型只给出候选调用；Gateway 校验 schema 与 ABAC；允许后签发短期凭证；业务服务二次鉴权；结果脱敏后回到模型；写操作进入 approval 状态机。
4. **最后讲异常**：策略超时默认拒绝高危写；凭证服务不可用时只允许已有有效最小权限凭证支持的只读路径，否则拒绝；审计不可用时阻断高危提交，或保证业务状态与可靠Outbox同事务落盘，不能best-effort写日志后仍执行；第三方 Server 不健康时从目录摘除。

### 退款申请的示例链路

```text
LLM -> refund.prepare(order_id, amount, reason)
Gateway -> schema + tenant + ABAC + order ownership
Gateway -> short-lived token(aud=refund-api, scope=refund.prepare)
refund-api -> resource check + create prepared_refund
Gateway -> return preview + approval_id
user / approver -> confirm approval_id
Gateway -> re-check policy + resource version + approval token
refund-api -> idempotent commit + outbox audit event
```

## 十二、项目讲法模板

以下是参考方案，只有实际实施并有证据时才改为个人经历。

> 在参考企业客服 Agent 中，方案不让模型直连订单和退款服务，而是在 Spring AI 编排层和业务 API 之间放置 Tool Gateway。每个工具在 Registry 中维护 owner、schema、风险级别和允许的业务域。Gateway 从认证上下文取得用户与租户，结合工具动作、订单归属和用途调用策略中心；通过后才从凭证代理换取面向单个下游 API 的短期 token。退款、邮件等写操作先生成不可变预览和 `approval_id`，确认时再校验参数哈希、资源版本与幂等键。方案把策略版本、审批记录、凭证 jti 和 trace 串起来，出现问题计划以冻结新执行、资源侧撤销和证据回溯处置风险；不承诺一键撤回外部副作用。这样既保留了 Agent 的自然语言入口，也没有把企业权限边界交给模型。

## 十三、反面回答清单

- “模型会根据 system prompt 判断谁有权限。”
- “MCP Server 在内网，所以可以信任 Host 传来的 user_id。”
- “工具不展示给模型，就不需要执行时鉴权。”
- “用户点了确认就行，确认前后的参数不需要绑定。”
- “给每个 Agent 一个万能 service account，方便接业务系统。”
- “工具成功返回的 JSON 可以全文喂回模型。”
- “审计只记最终回复，不需要记录策略和审批依据。”

## 十四、递进追问速答

**Q：Tool Gateway 和 API Gateway 会不会重复？** 入口 API Gateway 管 HTTP 流量；Tool Gateway 管模型驱动的动作语义、身份委托、工具策略、审批和执行证据。两者可以部署在一起，但职责不能混。

**Q：策略中心不可用怎么办？** 高危写默认拒绝，低风险只读可以使用短 TTL 的已签名策略缓存，但要明确失效时间和审计标记，不能无限 fail-open。

**Q：审批人确认的是自然语言还是结构化动作？** 必须确认结构化、规范化后的动作预览和影响范围；自然语言只是辅助说明。

**Q：Agent 自己的后台定时任务怎么授权？** 用明确的 workload identity，绑定任务 owner、租户、目的和允许时间窗，不能伪造成人类用户；高危动作仍应进入审批或变更流程。

**Q：怎么防止同一确认链接被重复提交？** 确认令牌绑定action hash和版本；首次授权消费、状态迁移与本地效果需原子处理。相同主体/key/payload的重复提交应查询已记录结果，而非再次执行；过期令牌不得授权新动作。若提交途中外部效果未知，转对账而非“重新批准再重跑”。

**Q：为什么下游服务还要二次鉴权？** Gateway 是集中控制点，但业务服务最了解资源归属、状态机和额度；双层防御避免 Gateway bug、旁路调用或 token 被误用扩大影响。

## 面试前 5 分钟速记

- 模型没有执行权，Tool Gateway 才是 PEP。
- 身份由认证上下文和签名委托 token 提供，模型参数不能提供身份。
- 可见工具集、策略授权、资源二次鉴权是三层不同防线。
- 短期、最小 scope、audience 限定的凭证替代长期万能密钥。
- 高危写操作必须 prepare/approval/commit，确认绑定参数哈希和资源版本。
- 工具结果是不可信输入，要脱敏、最小化、清洗和审计。
- 事故时能冻结工具、撤销凭证、终止会话并按证据链回溯。

## 延伸阅读

- [Agent 工具安全与权限边界](/agent/tool-safety)
- [Function Calling 与 MCP](/agent/function-calling-mcp)
- [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)
- [Java / Spring AI 生产架构系统设计面试题](/interview/java-ai-production-architecture-system-design)
- [企业 AI 安全、合规与审计控制面系统设计面试题](/interview/enterprise-ai-governance-audit-system-design)

## 授权不是一次检查：失败注入与边界

### 提交、重放与审计证据

[HTTP RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) 本轮实读幂等方法摘录，非幂等请求不能仅因超时自动重试；[§13.1.1 If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) 的强ETag条件写用于避免丢失更新，但须业务API实际支持。

[OAuth Token Exchange RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html) 与 [JWT RFC 7519](https://www.rfc-editor.org/rfc/rfc7519.html) 本轮仅链接，读取TLS失败，未确认实现符合性。本文的subject/actor、短TTL与jti是设计profile，不能暗示JWT天然单次、可即时撤销或自动完成用户委托。

构造审批时序：用户确认“给A退100元”，期间订单owner/版本变更，commit必须拒绝旧快照；同key改成1000元须冲突，不新建第二次退款。若网关先写“key已执行”再调退款API，崩溃可能漏执行；先调API再写key可能重复执行。要求资源侧原子幂等，或用外部reference查询/人工仲裁；单凭Gateway内存缓存不能证明exactly-once。

构造撤销窗口：在线撤销检查缓存最多5秒、获准请求最长30秒，若只在入口检查，存量请求风险可持续约35秒；离线token剩余TTL120秒、允许时钟偏差5秒、在途30秒时，保守窗口可达155秒。前提是各上限真实强制，且窗口从撤销请求起计；高危写应在资源提交点重新验证，不能以短token替代即时撤销机制。

参数哈希需统一规范化方法与版本，绑定所有影响字段（收件人、金额、币种、资源版、用途），不是仅hash自然语言摘要。审计应独立权限、可靠持久化、校验链/签名和保留策略；追加写日志有助追溯，不自动具备法律上的不可抵赖性。

<details>
<summary>L1：工具schema合法、jti存在，为何仍可拒绝？</summary>

schema不证明订单归属或审批，jti不证明未重放。可信服务核身份、issuer/aud/有效时间、资源ACL、业务状态和参数绑定；拒绝不能让模型换工具绕过。mocked负例包括模型伪造tenant/admin和同key不同payload。
</details>

<details>
<summary>L2：怎样验证prepare/commit与撤销？</summary>

注入审批后参数/资源版本变化、100个并发相同key提交、回执丢失、策略/凭证/审计故障和取消失效。断言新动作被阻断、同payload效果至多一次、未知效果可对账；低风险只读降级仍需有效权限，不能因为凭证服务坏了就匿名调用。
</details>

<details>
<summary>L3：哪些不变量只能在资源侧证明？</summary>

授权版本检查、确认令牌消费、幂等payload记录与领域状态更新需要事务/CAS或服务明确支持的等价机制。跨服务故障时只能陈述各环节原子性、至少一次传输及幂等假设，不能把Saga/Outbox当exactly-once证明。保留失败时序与剩余风险，测试零事故也不是全局安全证明。
</details>
