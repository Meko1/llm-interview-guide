---
title: 多租户 LLM 应用控制面：身份、隔离与授权连续性
description: >-
  企业 AI 应用最危险的故障往往不是回答不够聪明，而是把 A 部门的上下文、文件、缓存、工具结果或操作权限带给了 B 部门。真正的多租户不是给每条记录加一个
  tenant_id，而是让身份和授权在入口、检索、模型、工具、缓存、Trace、反馈与异步任务的每一跳都不丢失、不被模型伪造。
level: L2
roles:
  - 后端转型
  - 应用开发
  - Infra
classification: inferred
---
# 多租户 LLM 应用控制面：身份、隔离与授权连续性

> 企业 AI 应用最危险的故障往往不是回答不够聪明，而是把 A 部门的上下文、文件、缓存、工具结果或操作权限带给了 B 部门。真正的多租户不是给每条记录加一个 `tenant_id`，而是让身份和授权在入口、检索、模型、工具、缓存、Trace、反馈与异步任务的每一跳都不丢失、不被模型伪造。

## 一、先定义问题：谁在代表谁做什么

一个 LLM 请求至少涉及五类主体：

| 主体 | 例子 | 需要回答的问题 |
| --- | --- | --- |
| 人类用户 | 员工、客户、运营人员 | 他是谁、属于哪个租户/部门、具有什么角色？ |
| 应用客户端 | Web、IM、移动端、API 调用方 | 请求是否可信、会话是否被劫持？ |
| LLM 应用服务 | RAG/Agent/对话服务 | 它能代用户访问哪些资源？ |
| 工具/领域服务 | CRM、订单、工单、文件、数据库 | 用户授权能否被精确传递和复核？ |
| 模型与外部供应商 | 模型 API、向量库、OCR、搜索 | 哪些数据可外发，在哪个地域处理？ |

身份不是一句 Prompt，也不是模型输出的 `user_id` 字段。它来自受信任的身份系统；签名验证只证明声明的来源与完整性，不保证角色仍有效，更不等于允许访问资源。下面是**服务端构造的内部上下文示例**，不是可由客户端提交即生效的令牌：

```json
{
  "subject": "user:8241",
  "tenant": "acme-cn",
  "workspace": "finance",
  "roles": ["analyst"],
  "scopes": ["rag:read", "crm:read", "report:draft"],
  "data_residency": "cn",
  "authz_revision": "policy-2026-07-22",
  "session_id": "s_...",
  "request_id": "r_..."
}
```

其中 `roles` 不是最终授权结论，真正的访问决策还依赖资源、动作、属性与实时策略。例如财务分析师能查自己组织的已发布预算，却未必能读取 HR 附件；同一用户在离职、部门调整或临时授权收回后，运行中的长任务也应停止获得旧权限。

## 二、端到端身份传播链路

```text
Browser / API client
  -> Identity Provider / SSO
  -> API Gateway: validate token, create principal context
  -> LLM Application: bind session + request + release
       -> RAG Gateway: tenant/ACL filter before retrieval
       -> Model Gateway: residency / egress / quota policy
       -> Tool Gateway: action-level authorization + idempotency
       -> Cache: namespace + authorization-safe key
       -> Trace / Feedback: tenant-aware storage and redaction
  -> Domain service: independently re-authorize
```

这张图的核心原则是：**每一个边界都应重新验证或至少可验证主体，不接受模型替你声明身份。** LLM 应用可以把用户的自然语言转成“查询候选”或“动作提案”，但不能把它升级为权限。

### 入口层：认证与会话绑定

入口按身份协议分别验证凭证，不能把 OIDC、SAML 和 JWT 当成同一种 API。OIDC ID Token 面向登录客户端，不能默认作为资源服务的 access token；JWT 验证需限定算法、绑定 issuer 的密钥并验证 audience，见 [RFC 8725 §3.1、§3.8–3.9](https://www.rfc-editor.org/rfc/rfc8725.html#section-3)。离线验签不自动查询撤销状态：需另有短有效期、内省或撤销/策略版本机制；不支持的能力必须记录。内部 principal context 仅在受认证服务通道中传播，不能信任任意请求的同名 header。会话创建时绑定 tenant、用户、客户端、认证强度和当前策略版本；用户切换组织/工作区时必须新建或显式切换会话，不能复用旧 session 的缓存和历史。

前端传来的 `tenant_id` 只能作为选择意图，服务端要确认该主体确实属于此 tenant。常见漏洞是 URL 参数、Cookie 或 WebSocket 连接建立后不再校验租户，导致切换 ID 即越权。

### 服务间传播：少传、可衰减、可审计

内部服务不应该共享一个万能管理员 token。推荐使用工作负载身份加上代表用户的短期 delegation token，token 含 audience、动作范围、资源范围、过期时间和 correlation ID。每跨一个边界，都可以缩小范围：对 RAG 只发 `documents:read`，对 CRM 只发 `customer:read`，对写工具只发已审批的单一动作令牌。

这种衰减比“服务知道用户 ID 就行”更安全：下游服务能拒绝不属于自己的 audience，也能审计某次操作是哪个用户、哪个应用、哪个 release、通过哪条授权策略完成的。[RFC 8693 §1.1、§2.1.1](https://www.rfc-editor.org/rfc/rfc8693.html#section-1.1) 区分 delegation 与 impersonation，并说明 scope 和目标服务的关系；它不保证每个身份供应商都支持自动权限衰减。最终允许范围应是用户权限、应用委托范围与资源当前策略的交集，换 token 不能扩大这三者。

## 三、隔离不是一层：至少要覆盖八个数据面

### 1. 会话与上下文隔离

聊天历史、记忆摘要、系统提示中的用户资料、上传资产引用必须按 tenant/workspace/session 分区。切换用户、共享设备、客服代操作和 IM 群聊都是高风险场景。摘要不应丢失来源和权限信息；将“某用户的个人偏好”写入全局 Agent memory 是典型泄露路径。

### 2. RAG 与知识库隔离

文档、chunk、embedding、metadata、候选集合、reranker 特征、引用卡片和缓存都继承文档 ACL。过滤必须在受服务端强制的召回查询中执行，而不是先全库召回、再让模型不要引用。检索请求应带 `tenant + workspace + subject/group claims + document policy revision`；最终引用展示时再次校验当前权限。

### 3. 向量索引隔离

隔离策略可以是每租户独立 collection/index、共享 index 加强制 metadata filter、或按高风险租户独立物理资源。选型取决于规模、合规和查询性能，但任何共享索引都需要服务端不可绕过的过滤器。不能把 filter 只写在 Prompt 或让客户端自由传 SQL/向量条件。

### 4. 缓存隔离

缓存是最常被忽视的数据面。精确缓存、语义缓存、检索结果缓存、工具结果缓存、前缀缓存和 CDN 都可能把答案跨租户复用。缓存键至少包含 tenant、workspace、权限/策略版本、资源可见性摘要、任务类型、release/config digest；如果无法安全表达权限差异，就不要共享该缓存。缓存命中后仍需做当前主体校验，尤其是返回了引用、文件名或业务字段时。

### 5. 工具与领域动作隔离

工具 schema 中的 `customer_id`、`document_id`、`order_id` 都是不可信参数。Tool Gateway 依据 delegation token 和资源属性重新授权；对于写动作还校验审批、对象版本、幂等键、金额/风险阈值和数据驻留。模型不能用“用户说他有权限”绕过网关，也不能因成功调用一个只读工具就获得写权限。

### 6. 模型外发与地域隔离

把文本送给外部模型也是数据访问。根据租户合同、数据分级、地域和模型供应商策略，路由到私有部署、指定区域或经过脱敏的外部 API。模型网关记录 egress policy、provider、区域、数据类别和批准版本。输入侧就执行策略，不能等生成后再试图过滤已经外发的内容。

### 7. Trace、日志与反馈隔离

可观测系统常收集原始 Prompt、工具参数和文档片段，若按“所有工程师都能查 trace”设计，隔离会在日志层失效。Trace 需要 tenant ACL、字段脱敏、采样策略、独立加密/保留期和按角色查询。用户反馈、人工修正和评测样本也带 tenant 与数据用途标签；训练/评测导出必须再次审批。

### 8. 异步任务与备份隔离

队列消息、对象存储、DLQ、离线批处理、失败重放、备份与灾备副本都携带 principal/tenant/授权快照。消费者不能因为“消息来自内部队列”就跳过授权。长任务恢复前重新校验授权，避免用户权限已经收回但旧 job 仍读取数据。备份和归档要有租户级删除、保留与访问证据。

## 四、授权模型：RBAC 不够，ABAC/ReBAC 何时需要

RBAC 适合粗粒度职责，例如管理员、分析师、客服。但企业 AI 的资源往往有项目、部门、文档密级、地域、有效期和所有者等属性，通常需要 ABAC：

```text
allow if subject.tenant == resource.tenant
  and subject.department in resource.allowed_departments
  and resource.classification <= subject.clearance
  and action in policy.allowed_actions
  and request.region satisfies resource.residency
```

协作文件、项目成员、客户关系等还可能需要关系型授权（ReBAC）：用户是否属于某项目、是否被文档显式共享、是否是工单处理人。不要期望 LLM 自己推断这些关系，授权引擎/领域服务应给出确定答案。

设计时将策略决策与策略执行分离：PDP（Policy Decision Point）计算 allow/deny 与理由，PEP（Policy Enforcement Point）位于网关、检索服务、工具服务和对象下载接口。请求 trace 只记录决策 ID、策略版本和必要理由摘要，不记录完整敏感规则。

## 五、连续授权：长任务与 Agent 不能拿着旧权限一直跑

一次普通 API 调用可以在入口校验 token；一个会等待数小时审批、不断调用工具的 Agent 则不同。它启动后，用户可能离职、切换部门、撤销 OAuth、案件关闭或风险策略升级。

连续授权的做法：

1. **短期 delegation**：每个工具调用使用短过期、窄 scope 的令牌，不给 Agent 长期全权 token。
2. **关键节点重校验**：检索、外发、写操作、审批恢复、发布报告前重新评估策略。
3. **撤权事件**：身份/授权系统将撤销、组织变更、案件关闭作为事件发布；运行时订阅后冻结/取消相关 run。
4. **授权快照与当前状态并存**：审计要知道启动时为何允许，执行时还要以当前授权为准。历史合理不等于现在仍可做。
5. **人工接管**：因授权失效中断的任务不能自动换一个高权服务账号继续，必须重新申请授权或由合规角色接管。

## 六、租户级限额、成本和公平性

多租户隔离还包括资源公平。一个租户的长上下文、批量上传或循环 Agent 不能耗尽模型配额、向量 QPS、队列 worker 或第三方 API 限制。控制面应维护：

- 请求/并发/流式连接上限；
- token、工具调用、文件处理和存储预算；
- 每租户队列配额与优先级；
- 高风险操作审批额度；
- 成本归因到 tenant、workspace、application、release 和场景。

当达到上限时，返回可解释的限额状态，选择排队、降级模型、缩短上下文、部分结果或转人工。共享 GPU、数据库与外部配额仍有资源竞争；租户限流降低影响但不承诺 B 的延迟完全不变。用分租户排队与尾延迟指标验证隔离效果，严格时延目标可能需要预留或独立容量。

## 七、租户级灰度、故障隔离与紧急控制

多租户发布不能只按全站 5% 随机分流。企业 AI SaaS 常需按租户套餐、地区、风险等级、模型许可、工作区或显式 allowlist 灰度；同一会话、案件和异步 run 还应保持 release/experiment 粘性，防止一次对话前后换模型、换知识索引或换安全策略。

控制面为每个租户维护独立的 feature flag、模型路由、预算、策略版本与 fallback 规则，并在 trace 记录实际命中的配置。这样可在供应商区域故障、某模型质量下降或租户自定义 Prompt 出现注入风险时，只熔断受影响的租户/功能，而不是让全站一起降级。

紧急操作至少包括：按 tenant/workspace/application 禁用工具写操作、冻结新的长任务、关闭某模型供应商、将检索切到已验证索引、撤销泄露 API Key、强制重新认证、切换到只读/人工模式。每次控制面操作应产生审计事件和新的有效配置版本；恢复时也需要灰度与验证，不应直接“重新打开开关”。

## 八、系统设计题：设计多租户企业知识助手

### 需求

多个事业部共用一个知识助手，文档来自 Drive/Confluence/内部系统；员工可问制度、项目资料和客户信息；系统可创建工单草稿但不能直接提交；要支持地区数据驻留、离职即时撤权、引用溯源、成本分账和管理员审计。

### 参考架构

```text
SSO -> API Gateway -> Principal Context Service
                         |-> Session / Memory store (tenant partition)
                         |-> RAG Gateway (ACL-filtered retrieval)
                         |-> Model Gateway (egress + quota + route)
                         |-> Tool Gateway (ABAC + approval + idempotency)
                         |-> Trace / Feedback store (tenant ACL + redaction)

Connector Control Plane -> document/ACL lineage -> index publication
Policy Engine <---------------- authorization decisions / revocation events
```

### 高分回答点

1. SSO 解析用户、组织、角色、地区和认证强度；网关把它变成内部短期 principal。
2. RAG 文档、派生 chunk、embedding 与引用均带 ACL，过滤前置在查询服务；引用展示二次校验。
3. 用户输入中的实体 ID 只作为候选，工具网关以主体和资源属性重新授权；写操作仅创建草稿，并绑定幂等键与审批。
4. 缓存 key 和 session namespace 含 tenant/授权版本；高风险答案不跨租户复用。
5. 数据分级控制模型外发；不同地区命中不同模型/存储，trace 记录实际 provider 与 policy。
6. 撤权事件取消/冻结长任务；恢复时重新鉴权，不能沿用旧 session 的权限。
7. 观测、反馈和备份独立做租户 ACL、脱敏、保留和审计；管理员也只按审计权限读取。
8. 成本和并发按租户分账/限流，防止 noisy neighbor。

## 九、常见失败模式

### 一次撤权竞争怎样验收

用两个测试租户 A/B、同名查询和一份仅 A 可见文档构造演练；不使用真实敏感数据：

1. A 授权版本为 7，先生成并缓存答案；B 发同一查询，必须不能命中 A 的答案、引用或文件名。
2. A 的任务暂停在“检索完成、模型外发之前”；撤销该文档权限并将授权版本升到 8。
3. 恢复任务时，在外发 PEP 读当前策略；若撤权已生效，拒绝外发并将已取到的旧片段隔离，不能因为检索曾成功而继续。
4. 故意延迟撤权事件，检查 PEP 是否仍能拒绝；仅依赖异步事件则必须声明传播窗口，不能承诺“即时”。授权服务不可用时，高风险读取/写入 fail closed，返回可恢复状态。
5. 同一工具参数保持合法 JSON，但将 `customer_id` 换成 B 的对象；领域服务仍应拒绝。schema 验证通过不是授权证据。

撤权与实际写入之间仍可能竞争。高风险写操作把对象版本和授权条件与业务提交绑定；无法原子校验时，声明最大陈旧窗口、限制动作范围并设计补偿/人工处理。已经发送给供应商或下载到客户端的字节不能靠撤权事件收回。

L1 负责上述负例与缓存检查；L2 选择事件传播、同步策略查询、可用性和隔离容量的取舍；L3 对随机化的撤权/恢复时序做并发测试，报告漏拒绝率与窗口上界的观测范围，不能把有限测试当成安全证明。

| 失败模式 | 为什么危险 | 正确做法 |
| --- | --- | --- |
| 请求 body 里直接信任 tenant_id | 用户可篡改组织身份 | 从认证主体映射并校验成员关系 |
| 全局语义缓存 | 可能复用包含他人数据的答案 | 权限感知 key 或禁用跨租户共享 |
| 先召回后 Prompt 保密 | 模型/日志已看到未授权内容 | ACL 过滤前置且服务端强制 |
| 平台保存管理员 API Key | 任一应用/Prompt 漏洞扩大为全租户事故 | delegation + Tool Gateway + 最小权限 |
| 只在任务开始鉴权 | 长任务可能携带过期权限 | 关键节点重校验与撤权事件 |
| Trace 全员可读 | 日志成为影子数据仓库 | tenant ACL、脱敏、分级与访问审计 |
| 只按租户分表 | 忽略缓存、队列、对象、指标与备份 | 覆盖所有数据面的一致血缘 |

## 十、面试高频问答

**Q：多租户 RAG 只加 metadata filter 是否足够？**

取决于 filter 是否由服务端不可绕过地执行，以及文档、chunk、embedding、缓存、rerank、引用和日志是否继承同一 ACL。若客户端可控制 filter、候选集在过滤前已暴露，或缓存未带权限维度，就不够。高敏租户还可能需要独立物理索引。

**Q：为什么模型不能直接拿用户 JWT 调内部系统？**

用户 JWT 的 audience、scope 和生命周期未必适合每个下游，也会暴露令牌面。应由应用/网关验证后换取窄 scope、短有效期、绑定受众和 correlation ID 的 delegation，领域服务仍独立授权。

**Q：用户已撤权，之前生成的答案怎么办？**

目标是撤权生效后拒绝新读取/外发，而不是假定所有 PEP 同时收到事件。记录撤权提交时间、策略 revision、各执行点观察到该 revision 的时间，以及撤权后仍放行的请求；同步查询、缓存 TTL 和事件传播决定陈旧窗口。未收到确认的执行点不能标记已完成，高风险操作在当前授权无法确认时拒绝。会话/缓存失效、任务冻结和历史审计访问仍按策略处理；已外发答案走事件处置，不能追回已复制内容。

**Q：如何安全地做语义缓存？**

先确定答案是否含用户/租户/文档/权限相关内容。安全 key 至少包含任务、tenant、workspace、授权/策略版本、release 和检索语义；命中后仍验证主体。无法可靠构造隔离 key 时，宁可不共享语义缓存，或只缓存完全公开、无个性化的内容。

**Q：多租户应用如何做线上排障？**

用 trace_id 定位，但查询 trace 本身要通过 tenant 与审计权限。排障控制台默认显示脱敏摘要、版本与策略决策；需要原始内容时走临时审批。指标按 tenant/release/route 聚合，并避免把用户 ID、Prompt 或文档 ID 放进高基数标签。

**Q：一个大客户把公共集群拖慢了，如何处理？**

先按 tenant 观察排队时间、并发、token、文件处理、向量 QPS 与工具调用；在入口、队列、模型网关和批处理层实施独立配额与公平调度。大任务走异步/专用 worker，在线交互保留容量；超过约定预算进入排队或降级。不要只扩大公共 worker，因为那会让其他租户共同承担成本和尾延迟。

**Q：一个租户的 API Key 泄露怎么办？**

立即在凭证控制面撤销/轮换该 key，按 key、tenant、IP、scope 和时间查询影响面，冻结高风险写操作与异常 run；将有效策略版本传播到网关和长任务执行器，避免旧缓存继续接受该 key。随后审计已访问资源、通知租户、修复签发/存储问题，并通过最小 scope、短期 token、异常检测和密钥不落日志降低复发风险。

## 十一、项目讲法模板

**以下是参考设计，不是实际部署记录或可直接复制的个人项目经历。** 只有完成联调、故障注入和传播时延测量后，才能据自己的证据描述已实现能力。

> 这份设计让 principal 贯穿入口、检索、工具和异步任务。SSO 验证后生成内部身份；RAG 查询执行租户/文档 ACL，展示和外发前再检查当前权限。模型只产生候选，领域服务按授权、审批、对象版本及幂等回执决定动作。缓存、Trace、反馈与衍生资产保留权限血缘。长任务在关键节点重校验，并消费撤权事件。撤权不是全链路瞬时生效：用策略 revision、执行点确认和撤权后放行日志测量陈旧窗口；无法确认当前权限的高风险动作阻断。设计目标是限制后续访问并解释决定，不声称取消已完成外发或未经测试的“可靠停止”。

## 十二、延伸阅读

- [多租户 RAG 检索隔离与索引演进](/interview/multi-tenant-rag-index-governance-playbook)
- [Agent 外部连接与 OAuth 凭证生命周期](/interview/agent-connector-identity-lifecycle-playbook)
- [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)
- [企业 Tool Gateway 安全执行设计](/interview/tool-gateway-security-design)
- [Connector 增量同步与撤权数据面](/engineering/connector-sync-data-plane)
- [LLM 应用版本血缘与质量归因](/engineering/llm-release-provenance-control-plane)
