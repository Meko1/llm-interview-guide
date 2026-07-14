# Agent 沙箱、执行准入与逃逸处置：Claude Code / Codex / OpenClaw / Hermes

> “在 Docker 里跑”不是沙箱设计的完整答案。生产面试真正要讲清：谁能请求执行、代码实际在哪台机器运行、能读写哪些路径、能访问哪些域名、携带什么身份、何时需要批准、无法被隔离时是否 fail-closed，以及越过边界后如何留下可追溯证据。

> 本页关注进程和工具执行边界；外部 App 的 OAuth 连接生命周期见 [Agent 外部连接与 OAuth 凭证生命周期](/interview/agent-connector-identity-lifecycle-playbook)，每次业务 action 的短期 capability 与撤权见 [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)，远程节点和云端运行池见 [远程与云端 Agent 生产运行手册](/interview/remote-agent-operations-playbook)。

## 30 秒总答法

> 我把 Agent 执行设计为“先准入，再隔离，再授权，再留证”。控制面先冻结任务、仓库 revision、执行类、可写根、网络 allowlist、密钥引用、资源配额和审批要求；执行面把工具可见性、进程 sandbox、文件系统、网络 egress、凭证注入和业务二次鉴权分成独立层。默认在无网络、非特权、最小挂载、短寿命的 workspace sandbox 内运行，允许的依赖源和 API 走 egress proxy。任何 host/node/unsandboxed fallback 都是高风险的显式升级，必须绑定具体 command digest、审批、短 TTL 与审计。沙箱不可用时高风险任务 fail-closed；任务结束销毁临时密钥和环境，保留 image、policy、network、approval 与 effect 证据用于复盘。

## 一、六层控制，不能互相替代

| 控制层 | 回答的问题 | 常见误区 |
| --- | --- | --- |
| 工具策略 | Agent 看得到、调得到什么工具？ | 以为隐藏工具等于隔离 |
| 进程 sandbox | 子进程能触及哪台机器、哪个内核边界？ | “Docker 一定安全” |
| 文件系统 | 能读写哪些根、挂载是否可写？ | 只限制写，忘记 SSH key/配置读取 |
| 网络 egress | 能解析、连接和上传到哪些目的地？ | 允许 `*` 或只靠 prompt 约束 |
| 凭证与身份 | 运行时拿到哪些短期 secret/服务身份？ | 把 `.env` 整个挂进去 |
| 审批与业务授权 | 这次副作用是否符合人和资源策略？ | 以为沙箱能判断是否该退款/发版 |

沙箱只能限制进程能碰到什么；它不能替代源系统 RBAC、工具 schema 校验、审批、DLP 或效果对账。反过来，人工点了“允许”也不应自动打开 home directory、内网和所有 secret。

## 二、执行准入契约

在模型开始生成 Bash 或 tool call 前，控制面应创建不可变 `execution_contract`。不要让 Agent 通过自然语言临时决定执行环境。

```json
{
  "run_id": "run_428",
  "execution_class": "workspace_sandbox",
  "repo_sha": "c91e...",
  "image_digest": "sha256:...",
  "writable_roots": ["/workspace", "/tmp/build"],
  "read_denied": ["/home/agent/.ssh", "/var/run/secrets"],
  "network": {"mode": "allowlist", "domains": ["registry.npmjs.org", "api.github.com"]},
  "secret_refs": ["vault://ci/read-token@v7"],
  "limits": {"cpu": 2, "memory_mb": 4096, "pids": 256, "timeout_sec": 900},
  "promotion": {"host_exec": "approval_required", "policy_rev": "p-2026-07"}
}
```

契约由 task、用户/租户、代码仓库、风险和环境策略共同生成。Agent 可提出“需要额外域名/目录/命令”的结构化请求，但不能修改已生效的 contract。任何升级产生新的 revision，而非在原 run 中静默放宽。

## 三、默认安全基线

1. **临时、非特权环境。** 非 root 用户，drop Linux capabilities，`no-new-privileges`，限制 PID、CPU、内存、磁盘和 wall clock；不挂 Docker socket、宿主 `/`、Kubernetes admin config 或 cloud metadata socket。
2. **最小文件系统。** 只读代码快照或独立 worktree；只给 `/workspace` 和短期 `/tmp` 写入。私钥、浏览器 profile、SSH/Git credential、package manager 全局 cache 与其他租户目录默认 deny-read。
3. **默认无网络。** 依赖安装和少量 API 经有日志的 proxy/allowlist 放行；DNS、redirect、WebSocket、私网 CIDR、link-local metadata 和 upload 目的地都在策略范围内。
4. **密钥按调用注入。** 从 Vault 取短 TTL、audience/scope 受限的 credential，写到内存或单任务临时文件；完成后销毁。不能把 host 的全量环境变量透传给容器。
5. **写操作与执行分离。** 编译、测试、静态分析可以 sandbox 自主运行；部署、删除、付费 API、生产数据库写入走 prepare/approval/commit 和后端二次鉴权。

## 四、网络是数据外发控制，不是“能否联网”的开关

“容器没挂 secret 就可以开公网”同样危险：代码、Git history、生成内容、临时 token 和环境指纹都可能被上传。网络策略至少覆盖：

| 项目 | 设计要求 |
| --- | --- |
| 出站目标 | 精确域名/端口/方法，区分依赖 registry、代码托管、内部 API |
| DNS 与重定向 | 解析结果、CNAME、IP 范围和 redirect 再校验，避免域名 allowlist 绕过 |
| 私网与 metadata | 拒绝 RFC1918、loopback 特殊端口、link-local/cloud metadata，除非专门 gateway |
| 上传 | 对 body 大小、文件类型、DLP 分类、目的地做单独规则 |
| 代理 | 记录 allow/deny、host、method、字节数、run/tenant；TLS inspection 只在合法合规边界启用 |
| 依赖供应链 | 锁定 registry、hash、镜像 digest，阻止脚本临时下载未知二进制 |

域名 allowlist 不是 HTTPS 内容审查。Claude Code 文档明确其内置 proxy 不终止或检查 TLS 内容，因此允许的域名本身必须可信；更强的检查需接入组织代理。[Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)

## 五、逃逸与降级是最危险的状态迁移

以下情况不能悄悄“为了让任务完成”而发生：sandbox 依赖缺失、Docker 不兼容、命令需要额外目录、未知域名、任务请求 host/node、容器内工具要访问生产网络。正确状态机为：

```text
admitted -> sandboxed -> boundary_blocked -> promotion_requested
  -> approved_promotion -> constrained_host_exec -> completed
  -> denied / sandbox_unavailable -> fail_closed
```

每个 `promotion_requested` 绑定 command/args/cwd、目标 host、读取/写入根、域名、理由、风险、有效期和审批人。批准一次 `git status` 不能泛化为批准任意 `git` 命令；批准访问 package registry 也不能泛化为任意公网。

**关键原则：** 高风险运行要求 `sandbox.failIfUnavailable=true` 的等价策略。若产品默认在 sandbox 启动失败时降级到普通执行，组织必须用 managed configuration 禁止该路径或在 admission 前阻断。Claude Code 文档说明它默认可在 sandbox 不可用时警告并继续非沙箱执行，而 `failIfUnavailable` 可改为硬失败；其 unsandboxed escape hatch 也可用 `allowUnsandboxedCommands: false` 关闭。[Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)

## 六、命令审批为什么不能只做字符串黑名单

黑名单能减少误操作，却不能抵御组合命令、解释器、下载后执行、符号链接、路径穿越和业务语义错误。准入至少应分级：

| 级别 | 示例 | 控制 |
| --- | --- | --- |
| L0 观察 | `git diff`、lint、读取测试日志 | sandbox 自动运行，审计 |
| L1 workspace 变更 | 格式化、生成代码、跑 unit test | workspace-write，配额和 diff 证据 |
| L2 受控网络 | 下载锁定依赖、调用测试 API | allowlist proxy、短期 token |
| L3 受限 host | 读取诊断、访问构建节点 | command digest、host-local allowlist、审批 |
| L4 特权/不可逆 | 生产部署、删库、改权限 | 双人/变更单、后端鉴权、可回滚与 effect 对账 |

审批服务应审批“冻结计划”，而不是一个自然语言意图：canonical command AST/digest、解释器、cwd、resolved path、环境引用、target host、网络目的地和有效 TTL。OpenClaw 的 node approval 会保存 canonical execution plan，参数、cwd、agent 或 session 改变后转发应因 mismatch 拒绝，这是很好的实现参照。[OpenClaw Exec approvals](https://docs.openclaw.ai/tools/exec-approvals)

## 七、四种 Runtime 的可复述映射

### Claude Code：OS sandbox 与权限规则互补

Claude Code 的 sandboxed Bash 用 macOS Seatbelt 或 Linux bubblewrap 对 Bash 子进程实施文件和网络隔离；权限规则则先于工具运行、覆盖 Bash/Read/Edit/WebFetch/MCP 等工具。默认 Bash 可写当前目录，默认读取较宽，因此生产配置应明确 deny-read home/secret 路径、限制 allow-write，并同时限制 Bash 网络与 WebFetch。[Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)

它有 auto-allow 和 regular permission 两种 sandbox 体验，但两者的边界相同，差异只是沙箱内是否自动批准。重要追问是：Read/Edit 等内置文件工具并不靠 Bash sandbox 强制，应配合 permission deny 和 managed settings；Computer Use 操作真实桌面，也不是 Bash sandbox 的保护范围。组织配置还提醒，只禁 `WebFetch` 并不能阻止已获 Bash 权限的 `curl/wget`，必须一起配置网络边界。[Claude Code organization setup](https://code.claude.com/docs/en/admin-setup)

### Codex：受控沙箱、审批、网络与托管要求

OpenAI 的 Codex 安全实践将 sandbox 的可写根、网络、approval policy、managed requirements、规则和 agent-native telemetry 合成一套控制面。低风险工作可在 `read-only` / `workspace-write` 中快速完成；跨 sandbox 边界时进入 review。官方示例把 `allowed_sandbox_modes` 作为管理员要求，并通过网络 proxy 的 allow/deny domain 管理外联，同时记录 prompt、tool approval、tool result、MCP 与网络策略事件到 OpenTelemetry。[Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/)

命令行面试答法可补充：Suggest、Auto Edit、Full Auto 是不同审批体验；Full Auto 的默认设计是当前目录范围内的 sandbox、网络禁用环境，而不是“永久完全权限”。[Codex CLI Getting Started](https://help.openai.com/en/articles/11096431)

### OpenClaw：sandbox 路由与 host-local 审批叠加

OpenClaw 先决定工具是否可用，再决定 `exec` 去 sandbox、gateway 还是 node。`host=auto` 仅在 sandbox runtime 已激活时会选择 sandbox，否则会选择 gateway；显式 `host=sandbox` 失败时则应 fail closed。这个默认路由细节非常容易被忽略，生产基线必须显式启用 sandbox 或将 gateway host 严格限制。[OpenClaw Exec tool](https://docs.openclaw.ai/tools/exec)

host exec 只有 configuration policy、allowlist 和可选用户批准都同意时才会运行，且 host-local approval 只能收紧、不能放松全局要求。`/elevated full` 是 break-glass 机制而非普通工具权限；应限制发送者、记录会话原因和缩短有效期。[OpenClaw Exec approvals](https://docs.openclaw.ai/tools/exec-approvals) [OpenClaw Elevated mode](https://docs.openclaw.ai/tools/elevated)

### Hermes：容器后端很强，但持久性和挂载必须治理

Hermes 的 Docker 后端默认 drop capabilities、启用 `no-new-privileges`、限制 PID，并可限制 CPU、内存与磁盘；`docker_forward_env` 是显式 allowlist，避免宿主 secret 自动进入容器。[Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security/)

但它的 Docker backend 可以是跨 session 的长生命周期容器，持久模式还会 bind-mount workspace/root。于是“容器里安全”不自动等于“租户或任务隔离”：控制面要按 task/tenant 重建或清理持久环境、区分可信 repo 与不可信代码，并只读挂载需要的 Skill credential。`terminal.docker_network=false` 可令容器采用 `--network=none`，适合默认无外联的阶段。[Hermes Configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration/)

## 八、系统设计题：企业 Coding Agent 执行平台

**题目：开发者从 IDE、Slack 或 Web 发起 Agent 任务，任务可能跑本地、云 sandbox 或内部构建节点。如何保证安全和效率？**

```text
Request -> Identity / Task admission -> Execution contract / Policy
  -> Scheduler -> workspace sandbox | cloud sandbox | approved node
  -> Egress proxy + Credential Broker + Tool Gateway
  -> trace / approval ledger / effect ledger / SIEM
```

回答顺序：

1. Admission 解析主体、租户、repo SHA、风险和允许 execution class，生成不可变 contract。
2. Scheduler 默认派发临时 sandbox；只有诊断、硬件依赖或内网任务才申请受控 node，并采用独立 host policy。
3. Runner 用非特权 image、资源配额、workspace mount、网络代理和 credential broker 执行；禁止 Docker socket、通用 host env 与云 metadata。
4. Tool Gateway 将业务 API 与 shell 分开：shell 受进程边界，API 受 schema/RBAC/approval/幂等边界。
5. Boundary block 生成 promotion request，比较旧/新 contract；批准后仅运行冻结的、短 TTL 的升级计划。
6. Run manifest、sandbox image、mount/network decision、secret reference version、approval、command digest、exit code、diff 和 effect 进入审计；发生异常可 kill sandbox、吊销 lease、阻断 egress 并回放到隔离环境。

## 九、验证与事故演练清单

- [ ] sandbox 不可用、镜像拉取失败、代理不可达时，高风险任务是否 fail-closed？
- [ ] 是否模拟提示注入诱导 `curl | sh`、读取 SSH key、访问 metadata、使用 Docker socket 和写出工作区？
- [ ] 文件系统是否同时测试 read、write、符号链接、挂载穿透、临时目录和 child process？
- [ ] 网络是否测试 DNS rebinding、redirect、私网 IP、上传大文件、未知域和 allowlist 误配？
- [ ] secret 是否在 stdout、error、trace、core dump、shell history、container layer 和缓存中均不可见？
- [ ] 容器持久模式是否会残留上一任务 repo、token、package cache 或恶意 PATH 修改？
- [ ] host/node approval 是否绑定 agent、session、cwd、command digest、TTL，并在升级后重新审批？
- [ ] 是否演练 kill sandbox、冻结 egress、吊销 credential、停止队列、定位 effect 和恢复干净环境？

## 延伸阅读

- [Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)：Bash 的 OS 级文件/网络边界、fallback 和限制。
- [Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/)：sandbox、approval、managed network、keyring 与 telemetry。
- [OpenClaw Exec approvals](https://docs.openclaw.ai/tools/exec-approvals)：全局/host-local 策略叠加与 canonical plan。
- [Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security/)：命令审批、容器加固与环境变量过滤。
