# 远程与云端 Agent 生产运行手册：Claude Code / Codex / OpenClaw / Hermes

> 面试里问“怎样把 Agent 放到云端或远程机器上运行”时，不能只回答“套一层 WebSocket、加 SSH 或部署 Docker”。真正的难点是明确：谁拥有任务状态，谁能调度执行器，远端设备凭什么被信任，断网后能否安全继续，以及怎样一键停止已经拿到工具权限的运行。本页把 Claude Code、Codex、OpenClaw、Hermes 的公开能力抽象成可迁移的生产设计。

> 先阅读 [智能体运行时架构高频问答](/interview/agent-runtime-architecture-qna) 建立统一 Runtime 模型；工具权限见 [企业 Tool Gateway 安全执行设计](/interview/tool-gateway-security-design)，跨 Agent 调度见 [A2A 跨 Agent 互操作生产设计](/interview/a2a-production-interoperability-qna)。

> 需要进一步设计断网、休眠、Gateway 重启、检查点恢复与人工中途 steer 的一致性时，见 [长运行 Agent 检查点、恢复与人工 Steer](/interview/long-running-agent-recovery-playbook)。

## 怎么使用这页

本页不推断闭源产品的内部实现。产品事实以官方文档为准，版本升级后应重新核对；文中的架构、状态机、表字段和控制策略是工程抽象。准备面试时按以下顺序组织回答：

1. 先给出控制面、执行面、身份面三分法。
2. 再说明远程交互、云端执行和设备接入为什么是三件不同的事。
3. 最后以断网、重试、审批、撤销和审计说明生产闭环。

## 30 秒总答法

> 我会把远程 Agent 设计为“控制面管理任务和策略，执行面只领取带租约的工作，身份面把用户、设备、工作区和凭证绑定”的系统。远程 UI 只能接管一个执行会话，不能自然获得机器权限；云端任务在隔离环境中运行，也不能自动访问本地网络；远程节点即使完成配对，也要再经过能力和命令审批。任务状态必须持久化在控制面，流式连接只是传输层。遇到断网时执行器停在安全检查点，恢复后凭 execution lease 继续；遇到风险事件则按入口封禁、任务取消、进程终止、令牌撤销和证据保全五步执行 kill switch。这样既能解释 Claude Code 的远程控制和云端模式、Codex 的隔离任务，也能解释 OpenClaw Gateway/Node 与 Hermes Gateway/终端后端的差异。

## 一、先分清四个常被混淆的概念

| 概念 | 谁保存状态 | 命令实际在哪里执行 | 最容易犯的错 |
| --- | --- | --- | --- |
| 远程控制 | 本地或远端已有 Runtime | 原执行器所在地 | 把浏览器控制台当成权限边界 |
| 云端委派任务 | 云端任务控制面与任务容器 | 隔离云容器 | 以为能直接访问开发者笔记本或内网 |
| Gateway + Node | Gateway 持有会话、策略、路由 | 被调用的 Node 或工具后端 | 把 Node 当成独立控制面，导致双写状态 |
| 消息 Gateway + 终端后端 | Gateway 持有渠道与会话 | local、容器、SSH 等后端 | 把聊天平台的用户身份直接当作 shell 权限 |

一句话区分：**远程控制改变的是操作者所在地，云端委派改变的是执行器所在地，节点接入增加的是一个受策略控制的能力端点。**

下面是面试时可画出的通用拓扑：

```text
Browser / IDE / Chat channel / Scheduler
              |
              v
    +---------------------------+
    | Control plane             |
    | auth, policy, task state  |
    | session, audit, queue     |
    +------------+--------------+
                 | signed task + lease + scoped capability
       +---------+----------+
       |                    |
       v                    v
Cloud sandbox         Remote Gateway / Runner
repo + env             owns sessions and routing
       |                    |
       v                    v
tests, patch       paired node / SSH / container / browser
       \                    /
        +---- evidence -----+
                 |
                 v
       durable audit and reviewer decision
```

这里最重要的接口不是一个普通的 `run(prompt)`，而是带边界的任务契约：

```json
{
  "task_id": "tsk_20260714_018",
  "principal": "employee:alice",
  "workspace": "repo:billing-service",
  "execution_class": "cloud_sandbox",
  "capabilities": ["repo.read", "repo.write", "test.run"],
  "network_policy": "deny_by_default",
  "lease_expires_at": "2026-07-14T10:00:00Z",
  "approval_policy": "pr_required",
  "idempotency_key": "issue-842-retry-1"
}
```

`task_id` 用于业务追踪，`session_id` 用于上下文选择，`execution_id` 标识一次尝试，`lease` 防止失联 worker 永久占用权限。四者不能互相替代。

## 二、四类产品带来的架构启发

### 1. Claude Code：远程控制与远程执行必须分开叙述

[Claude Code Remote Control 官方文档](https://code.claude.com/docs/en/remote-control) 描述的是让 Web 或移动端连接到本机正在运行的 Claude Code 会话。代码、MCP、工具和项目配置仍留在本地机器；远端只是观察和控制该本地会话。文档同时给出 server mode：可以配置 `same-dir`、`worktree` 或 `session` 的会话派生策略，并设置容量和沙箱选项。

这带来两个工程结论：

| 场景 | 应采用的边界 | 为什么 |
| --- | --- | --- |
| 远程查看本地修复 | 本地 executor，远端只发控制命令 | 本地文件、凭证、MCP 不应被复制到浏览器 |
| 多人并发处理仓库 | 每个任务独立 worktree + 分支 | 避免同目录并发写入与测试互相污染 |
| 团队开启远程控制 | 工作区级开关 + RBAC + 可信设备 | 控制入口本身就是高权限操作入口 |
| 网络或睡眠恢复 | 会话重连，不将 UI 断线视为任务失败 | 任务实际状态归本地 Runtime 所有 |

官方 Web 文档还把 `--remote` 的云端会话与 `--remote-control` 区分开：前者改变执行位置，后者不改变。面试中若能主动说出这点，说明你没有把“远程”当成一个模糊词。

### 2. Codex：把云端 Agent 当作隔离的短生命周期执行单元

Codex 的公开资料将 cloud task 描述为在带有代码与环境的隔离 sandbox 中后台运行，结果可以被审阅、导出或转为 PR；[OpenAI 的 Codex 说明](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) 也说明 cloud-delegated 与本地客户端是不同执行路径。Codex 安全文档说明云端容器默认网络受限，网络能力应按项目和允许的域名、HTTP 方法谨慎授予，而不是在 prompt 中写一句“不要访问危险网站”。参见 [Codex Security](https://deploymentsafety.openai.com/gpt-5-2-codex/cybersecurity)。

因此，企业里一个云端 Coding Agent 的最低任务边界应包括：

| 维度 | 设计要求 | 反模式 |
| --- | --- | --- |
| 代码快照 | 固定 commit SHA、依赖镜像、初始化脚本版本 | 从可变主分支重新拉取后无法复现 |
| 文件系统 | 仅挂载工作区和显式 writable path | 把 CI 私钥、家目录或生产配置整体挂载 |
| 网络 | 默认拒绝，按域名和方法放行，记录 DNS/HTTP 摘要 | `allow all` 后让 Agent 自由安装和上传 |
| 密钥 | 短时、任务绑定、不可读回、环境结束即回收 | 长期 PAT 写进仓库或 prompt |
| 变更出口 | patch/分支/PR，加测试证据与人审 | 直接向默认分支推送 |

Codex 的价值不只在“云端跑得更久”，而在于使每次执行都能被看作一份可复现的实验：输入快照、工具轨迹、测试结果和 diff 一起归档。这样线上问题才能回答“哪个环境、哪个指令、哪个依赖版本生成了这行代码”。

### 3. OpenClaw：Gateway 是状态与策略的唯一控制点

[OpenClaw Remote Access](https://docs.openclaw.ai/gateway/remote) 明确 Gateway 负责会话、认证档案、渠道和状态，Node 只是连接到 Gateway 的外围执行端。其默认 WebSocket 绑定到 loopback；远程接入应使用 SSH 隧道、Tailscale Serve 或可信 LAN/tailnet 绑定，非 loopback 绑定需要有效认证。这个模型特别适合解释“为什么一个聊天 Agent 也需要控制平面”。

远程命令流可描述为：

```text
Telegram / WebChat -> Gateway -> Agent decision -> node.invoke
       -> paired Node executes capability -> Gateway -> channel reply
```

这条流中，Node 不接收第三方渠道消息，也不自行决定任务归属。Gateway 既是会话 source of truth，也是策略执行点。多节点或多频道时，绝不能让每个 Node 各自维护一份 session history，否则重连、撤销与审计都会分叉。

[Gateway-owned pairing](https://docs.openclaw.ai/gateway/pairing) 还提示了一个非常实用的安全分层：设备先进入待审批状态，审批后取得令牌；节点声明的命令面仍要经过 Gateway 全局命令策略和节点侧执行审批。也就是说：

```text
device identity -> pairing approval -> token -> declared capability
                -> gateway policy -> node-side exec approval -> execution
```

**配对不是万能授权。** 设备身份、可调用命令集合、具体命令参数和每次人工确认必须各有记录和撤销入口。

### 4. Hermes：把消息入口、会话持久化与终端后端拆开

[Hermes Messaging Gateway 文档](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) 将 Gateway 定义为长期运行的后台进程，负责消息平台连接、会话、定时任务和投递；它提供 allowlist/pairing、繁忙输入的 interrupt/queue/steer 策略，以及隔离的 background 会话。其 [终端后端与工具文档](https://hermes-agent.nousresearch.com/docs/user-guide/tools) 列出本地、Docker、SSH 等不同执行后端。

工程上应实现以下解耦：

| 组件 | 持有的信息 | 不应持有的信息 |
| --- | --- | --- |
| Channel adapter | 渠道消息 ID、投递状态、签名校验 | shell 凭证、工作区写权限 |
| Session store | 绑定后的主体、会话版本、摘要、任务索引 | 平台原始 access token 明文 |
| Task scheduler | 队列、并发、超时、重试、幂等键 | 长期业务权限 |
| Terminal backend | 一次性能力令牌、目录、资源配额 | 对所有用户的渠道身份映射 |
| Policy gateway | 工具模式、数据分级、审批结论 | 未脱敏的完整模型思维过程 |

当用户在聊天平台输入“把服务重启一下”，Gateway 应先把它归为意图，再根据绑定的 workspace、变更窗口、目标环境和审批策略生成受限任务；不能把原消息直接拼进 `ssh host systemctl restart`。

## 三、远程 Agent 的生产状态机

一个可恢复的任务至少应有如下状态。重点是将流式输出和真实状态分开：流会断，持久化状态不能断。

```text
CREATED -> AUTHORIZED -> QUEUED -> CLAIMED -> RUNNING -> WAITING_APPROVAL
                                      |               |
                                      v               v
                                   PAUSED <-------- RESUMED
                                      |
                                      v
                             SUCCEEDED / FAILED / CANCELLED / EXPIRED
```

| 状态 | 允许的动作 | 关键持久化字段 | 失败处理 |
| --- | --- | --- | --- |
| `AUTHORIZED` | 排队、取消 | policy revision, capability grant | 策略更新后重新校验 |
| `CLAIMED` | 启动执行器 | worker ID, lease ID, lease expiry | 租约失效则重新入队 |
| `RUNNING` | 工具调用、写 checkpoint | execution ID, step, tool idempotency key | worker 心跳超时后进入恢复判定 |
| `WAITING_APPROVAL` | 展示计划、批准、拒绝 | approval payload hash, approver | 审批过期则取消能力 |
| `PAUSED` | 续租、迁移、取消 | durable checkpoint, open resources | 不重放不可幂等外部写 |

### 断网、重启和重复投递如何处理

1. **控制连接失去不等于任务失败。** Gateway 或 cloud control plane 应保留最后 checkpoint 与 lease；UI 重新连接后只订阅事件。
2. **执行器失联不等于可以盲目重跑。** 先检查 lease 是否过期、是否已有成功回执、外部操作是否可幂等。
3. **工具调用必须带幂等键。** 例如创建工单、发邮件、提交 PR、部署变更都要在资源侧去重；LLM 重试不能作为去重机制。
4. **不可恢复的副作用需要人工仲裁。** 对数据库迁移、付款、生产发布等操作，checkpoint 只记录“意图已批准/结果未知”，不自动再执行。

一个安全的 claim 逻辑如下：

```text
if task.status in terminal_states: reject
if lease is valid and owned by another worker: reject
if previous_execution has unconfirmed non_idempotent_effect: require operator
issue new lease with bounded TTL and allowed capabilities
```

## 四、身份、配对与能力：必须四层拆分

| 层 | 解决的问题 | 样例 | 撤销方式 |
| --- | --- | --- | --- |
| 人/服务主体 | 谁提出请求 | SSO user、service account | 禁用主体、撤销会话 |
| 设备身份 | 哪台执行机器接入 | key pair、device ID、attestation | 删除设备、旋转 token |
| 会话路由 | 上下文属于哪条对话 | `session_id`、channel thread | 归档/重置会话 |
| 能力授权 | 这次任务可做什么 | `repo.write`、`node.camera`、`deploy.stage` | 过期 lease、撤销 grant、deny policy |

面试陷阱：`session_id` 只能告诉系统“把哪段历史拿出来”，不能证明“这个人有权读取或执行”。OpenClaw 的安全文档也特别强调 session key 是路由/上下文选择而非用户认证；这是一条可推广到所有 Agent 的原则。

推荐为每个敏感工具请求生成完整的权限元组：

```text
(principal, tenant, workspace, device, task, capability, resource, action, expiry, policy_version)
```

网关验证该元组，资源服务再根据自己的 ACL 复核。不要把“Gateway 已经允许”当成数据库、Git 平台或部署系统无需鉴权的理由。

## 五、网络设计：默认 loopback，远程通道显式化

远程 Agent 的网络分为两类：入口流量和执行器出站流量。两者都要默认拒绝。

### 入口：操作者、Node 与 Gateway 如何连

| 拓扑 | 推荐方式 | 不推荐方式 |
| --- | --- | --- |
| 单机开发 | loopback + 本地 CLI/UI | 直接将控制端口暴露公网 |
| 远程运维 | SSH local forward 或企业 tailnet | 公网明文 WebSocket |
| 常驻 Gateway | loopback + Tailscale Serve 或受控反向代理 | 只依赖 IP 白名单且不认证 |
| 移动 Node | TLS 终止 + 显式配对 + token rotation | 因为在内网就自动信任所有设备 |

[OpenClaw Network](https://docs.openclaw.ai/network) 的 loopback-first 原则值得直接借鉴：非 loopback bind 必须配置认证路径。对于移动节点，发现协议只能提供“在哪里”，不能证明“你是谁”；mDNS、二维码、tailnet IP 都不应替代配对确认。

### 出口：任务容器能访问什么

| 等级 | 可访问范围 | 适用任务 |
| --- | --- | --- |
| `none` | 无外网 | 本地构建、静态分析、已有依赖测试 |
| `package` | 仅包仓库与镜像仓库 | 固定依赖构建 |
| `allowlist` | 指定 API 域名和 HTTP 方法 | 调用内部测试环境或文档 API |
| `brokered` | 通过代理做身份注入、DLP、审计 | 必须访问企业服务的任务 |

网络放行不仅是防数据泄露，也要防 prompt injection 驱动 Agent 下载恶意脚本、访问伪造文档或将内容上传到未知端点。对每个出网请求记录任务 ID、域名、方法、结果码、字节数和策略版本；敏感 body 应做哈希或脱敏而不是全文落盘。

## 六、执行器与 Node 的注册、心跳和隔离

一个生产 Node/Runner 注册协议建议包含：

```text
1. bootstrap: short-lived enrollment code or device key
2. attest: device ID, runtime version, declared capabilities, posture
3. approve: human/policy approval produces scoped credential
4. activate: heartbeats carry credential and capability digest
5. invoke: task + lease + capability request
6. revoke: stop new work, drain/cancel, invalidate credential
```

Node 声称“我能执行 `system.run`”只是能力声明。控制面还需比较运行时版本、平台补丁、地理或网络位置、租户归属和允许命令模式。对高危能力采用二段式授权：

```text
node declares capability
  -> gateway policy allows capability class
  -> task grant scopes target resource
  -> node local approval / sandbox validates concrete command
```

这也解释为什么“已配对的机器被提示注入后执行危险命令”不能只靠模型拒绝。Node 端应保留本地 allow/ask/deny 规则、资源限制、审计缓冲和断链时的 fail-closed 策略。

## 七、远程 kill switch：取消必须是级联动作

“取消任务”在生产里至少有五层，不是往队列写一个 `cancelled` 字段。

| 层 | 动作 | 目的 |
| --- | --- | --- |
| 入口层 | 禁用渠道、Webhook、远程 UI 会话 | 不再接收新指令 |
| 调度层 | 停止 claim，标记任务 cancel requested | 不再分配新执行器 |
| 执行层 | 发送 cooperative cancel，超时后终止进程/容器 | 停下当前工具调用 |
| 凭证层 | 撤销 lease、短期 token、代理会话 | 防止孤儿进程继续访问资源 |
| 证据层 | 冻结 trace、日志、diff、审批记录 | 支持复盘和合规审计 |

建议的取消协议：先发送带原因码的协作取消；执行器在工具边界确认，关闭子进程与网络连接；超过宽限期由平台强制终止。强杀后不要简单标记“已取消”，而应标记 `CANCELLED_WITH_UNKNOWN_EFFECT`，直到核对幂等键、外部资源和 Git 状态。

常见原因码包括 `USER_CANCELLED`、`POLICY_REVOKED`、`SECRET_EXPOSURE`、`BUDGET_EXCEEDED`、`WORKER_COMPROMISED`。原因码驱动不同后续动作：例如疑似密钥泄露必须同时旋转凭证和扩大日志保留范围。

## 八、面试系统设计题：设计一个企业远程 Coding Agent

### 题目

“研发在 IDE、Slack 和浏览器都能发起任务。部分任务在 Codex 类云端 sandbox 执行，部分任务要调用公司内网构建机，部分任务需要远程接入开发者笔记本。如何设计？”

### 推荐回答结构

1. **入口统一。** 所有入口先换取 OIDC 身份，将渠道消息归一为任务契约；不把 Slack user ID 直接传给 shell。
2. **控制面唯一。** Task API、状态机、审批、策略、审计和队列由同一控制面持有；它发的是短期 lease，不发长期机器密码。
3. **执行面分池。** 云 sandbox、企业 runner、本地远程控制分别用不同 execution class；代码快照、网络、密钥和写入权限独立配置。
4. **Node 显式接入。** 设备需成对配对、能力声明、健康检查和本地命令审批；每个 Node 可被单独撤销。
5. **Git 为变更边界。** Agent 产出 patch 或分支，通过 PR、CI、CODEOWNERS 和发布系统进入主干；禁止把远程 shell 当交付通道。
6. **可观测与应急。** 关联 task/session/execution/tool trace，支持按 token、设备、任务或工作区执行级联 kill switch。

### 核心数据模型

| 实体 | 关键字段 | 约束 |
| --- | --- | --- |
| `Task` | task ID、主体、workspace、intent、状态 | 不存可复用长密钥 |
| `Execution` | execution ID、image SHA、commit SHA、lease | 每次重试新 execution ID |
| `Device` | device key、posture、capability digest、last seen | 设备删除立即失去新 lease |
| `Grant` | capability、resource selector、expiry、policy revision | 最小权限、短期、可撤销 |
| `ToolEffect` | idempotency key、external reference、effect state | 未确认副作用禁止自动重放 |
| `AuditEvent` | actor、decision、input hash、output ref、trace ID | 追加写、权限隔离 |

### 追问：为什么不让 Gateway 直接 SSH 到所有机器

高质量回答：SSH 只是一种 transport，不是授权模型。若 Gateway 持有全网长期 root key，则渠道身份、模型输出和机器权限在同一处耦合，任何 prompt injection 或 Gateway 泄露都会横向扩散。更好的做法是让 Node 主动建立受控连接，使用短期任务 lease；Node 本地依据 allowlist、目录、资源限制和审批执行，并将证据回传。SSH 可作为某个 executor backend，但不能替代控制面、设备身份和细粒度能力授权。

### 追问：远程会话恢复时怎样避免重复部署

高质量回答：恢复的是持久 checkpoint，不是重放聊天记录。部署工具必须先用 idempotency key 查询外部发布系统，已创建的发布单继续轮询，状态未知则进入人工仲裁。lease 过期只说明 worker 不再拥有执行权，不说明外部副作用没有发生。对不可幂等动作宁可停住，也不要由模型根据文本猜测“应该再试一次”。

## 九、上线前检查表

### 身份与入口

- [ ] 每个入口都映射为统一主体、租户和 workspace，渠道线程不等于授权。
- [ ] Remote UI、云端任务、本地 executor、Node 有独立 RBAC 开关和审计范围。
- [ ] 设备配对采用待审批、短期 bootstrap、令牌轮换和单设备撤销。

### 执行与网络

- [ ] 每种 execution class 都定义镜像、可写目录、CPU/内存/时长和网络策略。
- [ ] 控制端口默认 loopback；远程访问经 SSH、tailnet 或受控 TLS 代理。
- [ ] 外网出站默认拒绝，允许列表按域名和方法配置，并记录策略版本。
- [ ] 密钥仅以短期、任务绑定方式注入，日志与模型上下文均不可回显。

### 可靠性与治理

- [ ] task、session、execution、lease 和 tool effect 有明确关系和终态定义。
- [ ] 外部写操作具备幂等键，未知副作用不会被自动重放。
- [ ] 取消能级联到队列、执行器、凭证与证据保全。
- [ ] trace 能关联用户、设备、模型、工具、网络策略、git SHA 与审批结论。

## 十、常见错误答案与修正

| 错误答案 | 为什么不够 | 更好的说法 |
| --- | --- | --- |
| “给 Agent 一台云服务器就完成远程化。” | 没有说明状态、身份、网络和回收 | 云端 executor 只是执行面的一种，仍要由控制面发 lease 和策略 |
| “VPN 内网是可信的，所以 Node 自动配对。” | 网络可达不是设备身份 | 发现、TLS、配对、能力审批分别处理 |
| “断线就重跑任务。” | 可能造成重复发信、重复部署、重复扣款 | 检查 checkpoint、lease 和幂等键，未知副作用转人工 |
| “取消就是杀掉容器。” | 孤儿 token、外部工具和审计仍可能存在 | 执行级联取消并撤销凭证、冻结证据 |
| “session ID 校验过就可以调用工具。” | session 是上下文路由，不是授权声明 | 按主体、workspace、资源、能力、期限做二次授权 |

## 延伸阅读

- [Claude Code Remote Control](https://code.claude.com/docs/en/remote-control)：本地执行器的远程控制、server mode 与会话派生策略。
- [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)：云端会话与 remote control 的区别。
- [OpenAI Codex Cloud 说明](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)：cloud task、隔离 sandbox 与审阅/PR 流程。
- [Codex Agent Sandbox and Network Access](https://deploymentsafety.openai.com/gpt-5-2-codex/cybersecurity)：云端隔离、默认网络边界及允许列表风险。
- [OpenClaw Remote Access](https://docs.openclaw.ai/gateway/remote)：Gateway、Node、SSH/Tailnet 与远程命令流。
- [OpenClaw Gateway-owned pairing](https://docs.openclaw.ai/gateway/pairing)：设备配对、令牌旋转、命令面审批。
- [Hermes Messaging Gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging)：消息入口、会话、繁忙输入和后台任务。
- [Hermes Tools and Toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/tools)：本地、Docker、SSH 等终端后端。
