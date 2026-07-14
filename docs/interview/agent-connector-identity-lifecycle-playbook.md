# Agent 外部连接与 OAuth 凭证生命周期：从用户同意到断连、轮换与可审计执行

> MCP 解决“工具如何连接”，OAuth 解决“谁允许访问什么”。生产系统还必须回答：哪个租户的哪个用户连了哪个外部账户，哪些 scope 在何时被同意，令牌由谁保管，刷新失败如何降级，用户点了断开后正在执行的写操作怎么处理。把这条链讲清楚，才是连接器而不是“在配置里填一个 token”。

> 本页聚焦外部连接控制面；工具调用时的短期授权、二次鉴权和效果对账见 [企业 Tool Gateway 安全执行系统设计](/interview/tool-gateway-security-design)，长任务内权限持续变化见 [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)，MCP Server 资产治理见 [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)。

## 30 秒总答法

> 我不会把 OAuth token 当成 Agent 的配置项，而会建设连接控制面。它以 `tenant + subject + connector + external_account` 创建一个 `connection`，把用户同意得到的 grant、scope 快照和密钥保险库中的 `credential_ref` 分开保存。授权码回调必须校验 `state`、PKCE、redirect URI 和租户/会话绑定；运行时由 Credential Broker 按一次 tool intent 换取最小、短时、指定 audience 的执行凭证，模型上下文、trace 和 MCP 配置里都不出现 refresh token。连接经历 `authorizing -> active -> refresh_required/suspended -> disconnected -> purged`；刷新轮换、`invalid_grant`、管理员禁用和用户断连都会阻止新换票，取消可取消任务，并把在途副作用按 idempotency key 对账。最后我按用户委托、共享服务账号、组织管理员授权和 MCP Server 服务身份分开建模，所有动作带上连接、主体、scope、策略版本和 effect 证据。

## 一、先分清四种身份和两种授权

面试中最常见的错误，是把“Agent 有一个 token”说成完整安全设计。至少要分开下列对象：

| 对象 | 代表什么 | 不应替代什么 |
| --- | --- | --- |
| 平台用户 `subject` | 在本系统发起请求的人或组织角色 | 外部应用账户 |
| 外部账户 `external_account` | GitHub user、Slack member、CRM service account 等 | 租户所有权 |
| 连接 `connection` | 某租户内、某主体对某 connector 的已同意关联 | 一次具体工具调用 |
| 执行 capability | 某一次 action 可用的短时权限 | 可长期刷新的 OAuth grant |
| MCP Server 身份 | Server 自己访问后端服务的工作负载身份 | 用户委托身份 |

再区分两层授权：第一层是连接建立时，用户或管理员向提供方同意 OAuth scope；第二层是每一次 Agent action 时，平台根据当前用户、资源、风险、审批与会话上下文决定是否允许使用该连接。第一层成功不意味着第二层永远允许。Codex 的插件/App 说明也强调，工作区中授予 App 的权限不会覆盖连接源系统本身的权限；用户仍需要该系统中的 OAuth 或其他权限。[Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/)

## 二、连接控制面的数据模型

不要只存一张 `oauth_tokens` 表。把同意关系、密钥位置和运行效果解耦，才能支持审计、迁移和撤销。

```text
Connection
  connection_id, tenant_id, subject_id, connector_id, external_account_id
  ownership: personal | shared_service | org_admin
  scopes_granted[], scopes_requested[], policy_version, status, expires_at

Grant
  grant_id, issuer, client_id, authorization_subject, scope_snapshot
  consented_at, consent_version, provider_revocation_hint

CredentialRef
  connection_id, vault_key, key_version, refreshable, last_rotated_at
  never stores secret material in the application database or prompt

ExecutionLease
  lease_id, connection_id, run_id, tool, resource, audience, scope_subset
  issued_at, expires_at, approval_id, idempotency_key, policy_decision_id
```

`connection` 的所有权必须落到 `tenant_id`，不能只靠 email 或 connector 名称匹配。共享连接还必须记录承担审计责任的 owner、允许使用的团队和允许资源范围。`CredentialRef` 只指向 KMS/Vault/HSM 中的密钥版本；日志只能出现不可逆 connection ID、key version 和错误码。

## 三、状态机比“已登录”更重要

连接不是布尔值。推荐显式状态机，所有迁移都记录 actor、reason、旧/新 scope 和关联事件。

```text
draft -> authorizing -> active -> refresh_required -> active
                    \-> suspended -> authorizing
active -> disconnecting -> disconnected -> purged
active -> revoked_by_provider -> suspended
```

| 状态 | 允许什么 | 典型进入原因 | 处理 |
| --- | --- | --- | --- |
| `authorizing` | 仅接收一次性回调 | 用户开始授权 | 绑定浏览器会话、TTL、幂等 callback |
| `active` | 可按策略租赁执行凭证 | 回调换票成功 | 允许最小 scope action |
| `refresh_required` | 只允许刷新或重新同意 | access token 临近/已经过期 | 后台单飞刷新，不并发风暴 |
| `suspended` | 不允许新 action | `invalid_grant`、scope 缩减、管理员禁用 | 提示重新连接，保留审计 |
| `disconnecting` | 不再发新 lease | 用户/管理员断连 | 取消任务、撤销引用、对账 effect |
| `disconnected` | 只读审计 | 断连完成 | 不可自动复活 |
| `purged` | 无凭证、最小审计摘要 | 保留期结束 | 加密擦除或删除密钥版本 |

“断开”不是删除一行记录：它至少包含停止刷新、阻止新 lease、撤销或删除保险库密钥、使缓存失效、通知运行中的 worker、对已提交写操作做幂等对账，以及生成不可篡改审计事件。任务内 capability 的精确 fence 语义可复用 [持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook) 的设计。

## 四、OAuth 回调怎么防止串号和回放

**面试官：用户在浏览器完成 GitHub 登录，后端收到 callback，你如何保证它属于正确的连接？**

标准回答不是“交换 code 就行”，而是：

1. 发起授权前生成高熵、一次性、短 TTL 的 `state`，服务端保存其哈希，并绑定 `tenant_id`、`subject_id`、`connection_intent_id`、redirect URI、PKCE verifier 和 nonce。
2. 使用授权码流 + PKCE；浏览器只携带 authorization code 和 state，code verifier 只能在后端或受控客户端保存。
3. callback 必须做恒定时间的 state 校验、消费标记、TTL 校验、redirect URI 精确匹配和 issuer/nonce 校验；同一 state 第二次出现直接拒绝并审计。
4. 换票后从 provider 的身份端点或可信 claims 得到外部账户，要求账户/组织域符合连接策略；不能只相信前端传回的 email。
5. 将实际 `scopes_granted` 与请求的最小集合比较。缺 scope 时进入 `suspended` 或限制功能，不要悄悄扩大权限。

回调 URL、OAuth `state`、授权页面标题和外部文档都属于不可信输入，不可转成 prompt 指令或 shell 参数。将它们作为结构化字段校验、白名单化和脱敏记录。

## 五、最小 scope 与增量同意

连接向导应先解释“为什么需要此权限、读什么数据、是否会写、谁能使用、如何断开”，再请求权限。第一版默认 read-only；写操作单独请求增量 scope，并在执行前进入 action policy 和人审门禁。

| 场景 | 推荐 scope/策略 | 不推荐 |
| --- | --- | --- |
| 知识检索 | 指定 drive/repo/channel 的只读范围 | 全盘、全组织读取 |
| 创建工单 | 仅特定项目的 create，带幂等键 | 使用全局 admin token |
| 发送消息 | 指定频道 + 预览/确认 | 任意私聊和群发 |
| 代码变更 | repo allowlist、PR-only、分支保护 | 直接推默认分支 |

scope 是粗粒度能力，不能替代资源 ACL。Connector 要把“本平台允许”与“源系统允许”一起检查。对有组织域、数据驻留或同步边界的 App，Codex 文档建议使用角色分配、动作确认、域限制和 source boundary；这些限制会被使用该 App 的插件继承。[Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/)

## 六、Credential Broker：令牌永远不进模型上下文

模型只提出结构化 intent，例如 `create_ticket(project=P1, title=...)`。Policy Engine 决策后，Credential Broker 才在受控执行面读取 `credential_ref`，按 `tenant/subject/connector/tool/resource` 约束换取或注入短时凭证。模型看见的是成功、受限错误或可解释的恢复建议，绝不看见 access token、refresh token、client secret、authorization URL 中的敏感参数。

```text
LLM intent -> policy + approval -> credential broker -> provider/MCP
  ^                                                     |
  |--- redacted result + effect reference <-------------|
```

Broker 至少实施：

- 单飞刷新：同一 connection 同时只有一个 refresh，其余请求等待结果，避免 refresh rotation 互相作废。
- audience、scope subset、TTL、run ID 和 idempotency key 绑定，禁止把用户 bearer token 原样透传给任意 MCP Server。
- 日志 redaction、secret scanner、出站 header 过滤、崩溃转储隔离；禁止把 token 放进 `.mcp.json`、Skill、聊天记录或 eval 样本。
- 保险库取密钥、刷新、换票和删除全部产生审计证据，而不是只记录最终 tool call。

Hermes 的安全文档提供一个可借鉴的运行时边界：MCP stdio 子进程默认只继承一组安全环境变量，显式声明的 `env` 才会传入，并会对 MCP 工具错误中的常见 token 模式做脱敏。[Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security/)

## 七、刷新、轮换和外部撤销的操作手册

access token 过期是正常路径，`invalid_grant` 不是普通重试。对刷新结果分类处理：

| 信号 | 处理 | 用户/运维可见性 |
| --- | --- | --- |
| 正常刷新并轮换 refresh token | 原子替换 vault 版本，废弃旧版本 | 仅审计 |
| 网络超时/5xx | 有界指数退避，不把旧 token 当永久可用 | 标记 degraded |
| 401/`invalid_grant` | 立即停新 lease，进入 `suspended` | 要求重新连接 |
| scope 变少 | 比较 scope snapshot，禁用受影响 tool | 展示缺失能力 |
| 管理员禁用/域不匹配 | 进入 suspended，触发安全事件 | 通知 tenant admin |
| 用户点击断连 | 停刷新、删引用、取消任务、对账 | 返回断连凭据和 effect 摘要 |

刷新 token 轮换必须是事务语义：先在 Vault 写新版本，确认可读后更新引用，再异步废弃旧版本；失败时不得丢失仍可用的旧引用。对 provider 的撤销 webhook 要验签、去重、按 provider event ID 幂等，并接受 webhook 迟到：每次高风险 action 仍以当前 token/introspection/源系统拒绝为准。

## 八、断连与在途副作用的竞态

**面试官：用户断开 CRM 后，Agent 正在创建客户怎么办？**

> 断连先推进 connection 的 fencing epoch，后续 lease 必须带新 epoch 才能执行；Worker 在可取消边界重新检查 epoch。尚未发送的调用取消；已发送但未收到响应的调用用 `idempotency_key` 查询 CRM 或进行效果对账，不能盲目重试；已经成功的写操作保留 effect 记录，必要时按业务流程补偿。OAuth 撤销无法回滚已发生的外部副作用，因此“断开成功”要同时展示已阻止的动作和待对账动作数。

这也解释了为什么“删 token”不等于安全撤销：缓存、队列、并行 worker 和已发出的 HTTP 请求都可能仍持有旧状态。

## 九、多租户与共享服务账号

| 模式 | 正确归属 | 最重要的边界 |
| --- | --- | --- |
| 个人 OAuth | `tenant + user + external_account` | 不可被同租户其他用户默认复用 |
| 组织管理员同意 | `tenant + app + admin grant` | 仍要按最终用户和源系统 ACL 裁剪 |
| 共享服务账号 | `tenant + service identity + named owner` | 资源 allowlist、用途限定、双人管理 |
| MCP Server 工作负载身份 | `server/workload` | 不冒充最终用户，不拥有超大 scope |

跨租户禁止用 email、connector ID 或缓存 key 推断权限。所有缓存、向量索引、token exchange audience、队列消息和审计查询都要带 tenant 条件。连接迁移/备份同样是高风险：OpenClaw 文档将 OAuth/API key profile、provider/channel credential 与 workspace 分开，并明确提醒状态备份包含密钥，应加密保存，疑似泄露时轮换。[OpenClaw migration guide](https://docs.openclaw.ai/install/migrating)

## 十、四类 Agent Runtime 映射

### Claude Code

[Claude Code 的 MCP 文档](https://code.claude.com/docs/en/mcp) 支持用 `/mcp` 对需要 OAuth 2.0 的远程 Server 发起认证；当服务端不支持动态客户端注册时，可预注册 OAuth app 并提供 client ID/secret。文档说明 secret 放在系统 keychain 或 credentials file，而非 MCP 配置。工程设计上仍应把 project/user-scoped MCP 视为连接入口：生产平台需要在其外围补齐租户归属、scope、Vault 引用和断连审计。

### Codex

Codex 的 Plugins 可以组合 Skills、Apps 与模板，管理员可按角色分发；App 的读写、确认、同步/域限制和源系统权限会自然继承给插件。[Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/) 因此面试回答重点是：plugin 安装成功不等于人员已被授权，也不等于源系统会放行；连接控制面仍须有测试用户、低风险验证和最小 action rollout。

### OpenClaw

[OpenClaw OAuth](https://docs.openclaw.ai/oauth) 把 OAuth/API key auth profile 放在每个 Agent 的状态目录中，并支持主 Agent 的受控 read-through；刷新会写回 canonical store 而不是复制 refresh token。它也建议需要严格区分个人与工作身份时使用独立 Agent。生产上要额外确认子 Agent 的 fallback 是否符合租户隔离预期，并让 profile 秘密永不进入 workspace repo。其 policy 可限制允许的 auth profile mode，例如 `api_key`、`oauth` 和 `token`。[OpenClaw Policy](https://docs.openclaw.ai/cli/policy)

### Hermes

[Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) 支持 HTTP MCP 的 OAuth 2.1：元数据发现、动态客户端注册、PKCE、换票、刷新和 step-up auth。token 会被缓存，失去 refresh 能力时需要重新登录；不支持动态注册的 provider 应配置预注册 client。它还允许安装时选择暴露的工具，因此应把“选择工具”纳入 capability manifest，而不是授权后默认暴露完整 tool surface。

## 十一、系统设计题：企业知识助手的连接控制面

**题目：设计一个企业知识助手，用户可以连接 Google Workspace、GitHub、Slack 和 CRM，支持 RAG、搜索、建工单和发消息。**

```text
Web / CLI
  -> Connection API -> OAuth orchestrator -> Provider
  <- callback verifier <- state/PKCE store

Connection DB <-> Vault/KMS <-> Credential Broker
                         -> Tool Gateway / MCP Client -> source systems
Policy + Approval + tenant ACL -> lease -> worker -> effect ledger / audit
```

设计顺序：

1. Connection API 创建 intent，要求 tenant、主体、connector、所需工具和最小 scope；组织级连接必须走管理员审批。
2. OAuth Orchestrator 完成 state/PKCE/callback 绑定，换票后验证 provider identity、组织域与 scope snapshot。
3. Vault 只保存 secret，Connection DB 保存 reference 和状态；后台任务按 connection ID 找 Broker，不直接拿 token。
4. Tool Gateway 每次执行重新校验 tenant、用户、资源 ACL、工具风险、审批、connection status 与 scope subset；高危写操作强制 preview/confirm。
5. Effect Ledger 将 `connection_id/run_id/lease_id/idempotency_key/provider_request_id` 串联，支持断连、超时和 webhook 事件后的精确对账。
6. 控制面暴露“连接了谁、共享给谁、读写什么、最后使用时间、重连/断连、失败原因”的界面，但绝不显示原始 secret。

## 十二、追问清单与测试矩阵

面试末尾可以用这份清单自检：

- [ ] `state` 是否一次性、过期、绑定 tenant/user/intent/redirect，并在 callback 后原子消费？
- [ ] 是否使用 PKCE，是否拒绝未注册 redirect URI、issuer/nonce 不匹配和 callback 重放？
- [ ] 是否分开保存 connection、grant、credential reference 和一次 execution lease？
- [ ] refresh token 是否永远不进入 prompt、日志、配置库、MCP manifest 和指标标签？
- [ ] scope 是否最小化，source ACL 是否仍在后端二次校验？
- [ ] `invalid_grant`、scope 降级、管理员禁用、provider webhook 和用户断连是否有不同状态迁移？
- [ ] 断连能否阻止新换票、使缓存/队列失效、取消未发调用并对账在途 effect？
- [ ] 个人 OAuth、共享服务账号、组织 grant 和 MCP workload identity 是否有不同 owner、范围和审计归属？
- [ ] 是否测试 callback 回放、串租户 state、并发刷新、refresh rotation 失败、scope 缩减、断连竞态、webhook 重放和跨租户缓存键？

## 延伸阅读

- [Claude Code MCP](https://code.claude.com/docs/en/mcp)：远程 MCP OAuth、预配置 client 和 credentials 存储。
- [Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex/)：角色分配、App 动作控制和源系统权限边界。
- [OpenClaw OAuth](https://docs.openclaw.ai/oauth)：per-agent auth profile、刷新与多账户隔离。
- [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)：OAuth 2.1、PKCE、动态注册、token 缓存和工具选择。
