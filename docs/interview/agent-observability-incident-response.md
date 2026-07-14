# Agent 观测、取证与事故响应手册：Claude Code / Codex / OpenClaw / Hermes

> “有日志”不等于可观测，“能重放聊天记录”不等于能解释一次副作用，“任务完成”不等于已被安全审计。生产 Agent 的观测系统必须把用户、任务、子 Agent、模型、上下文、工具、执行器、外部 effect 和交付结果连成一条可查询证据链，并且在采集时不把密钥、源代码和私人对话再次扩散。本页将 Claude Code、Codex、OpenClaw、Hermes 的公开运行面整理为统一的运维方法。

> 通用轨迹评估见 [Agent 评估与可靠性工程](/agent/agent-evaluation)，工具审计见 [Agent 工具安全与生产治理](/agent/tool-safety)，后台任务状态机见 [Agent 自动化与后台编排生产设计](/interview/agent-automation-orchestration-playbook)。

## 30 秒总答法

> 我把 Agent 观测拆为 metrics、structured events、distributed traces、审计证据和可回放工件五层。每个信号都要关联 `request/task/run/session/execution/trace/effect` 等 ID，但将 prompt、工具参数、文件内容和密钥按默认最小化采集。告警看的是任务成功、策略拒绝、工具错误、队列积压、成本异常和未确认副作用，而不是单纯模型响应时间。事故时先冻结证据、停止新 work、撤销 lease，再根据 commit、镜像、指令/Skill、模型、上下文 manifest 和工具 effect 做分层回放。Claude Code 可通过 OTel 导出指标、日志和 traces；Codex 的管理员分析与合规日志适合用量和审计面；OpenClaw 提供 Gateway logs、health、doctor、诊断包和 OTel；Hermes 保存 session 工件、可导出脱敏 trace，并可接入 Langfuse。它们都是信号源，企业仍需统一关联、脱敏、保留和响应控制面。

## 一、先分清五类信号

| 信号 | 最适合回答的问题 | 例子 | 不应承担的职责 |
| --- | --- | --- | --- |
| Metrics | 是否变慢、变贵、变多、变差 | token、cost、P95、成功率、队列深度 | 定位具体输入或判断责任 |
| Structured event | 某个重要动作是否发生 | permission denied、tool called、PR created | 还原完整因果链 |
| Trace / span | 哪一步耗时或失败 | task -> model -> tool -> Node | 保存完整原文和长期审计 |
| Audit evidence | 谁以什么授权做了什么 | principal、policy decision、resource ID、effect | 统计高基数性能指标 |
| Replay artifact | 变更能否复核/复现 | commit、image SHA、prompt version、test report | 替代真实资源系统的状态 |

把它们混成一个“日志平台”会得到两种坏结果：为了排障把所有原文打到日志里，或因隐私顾虑只保留聚合数字而无法调查。正确做法是不同保留期、不同访问角色、不同脱敏等级的多层存储。

## 二、统一关联模型：从用户请求到外部副作用

```text
principal / channel message
           |
           v
request_id -> task_id -> run_id -> execution_id
                           |          |
                           |          +-> worker / sandbox / Node
                           v
                     session_id -> trace_id -> span_id
                                      |
                         model / retrieval / tool calls
                                      |
                                      v
                                effect_id / delivery_id
```

### 最小事件信封

```json
{
  "event_id": "evt_79a",
  "occurred_at": "2026-07-14T12:20:17Z",
  "kind": "tool.completed",
  "principal": "user:alice",
  "tenant": "acme",
  "task_id": "task_842",
  "run_id": "run_017",
  "execution_id": "exe_03",
  "session_id": "sess_4c9",
  "trace_id": "tr_112",
  "tool": {"name": "git.create_pr", "version": "2.4.1"},
  "result": {"class": "success", "effect_ref": "github:pr/4821"},
  "policy": {"revision": "policy-91", "decision": "allow"},
  "redaction": "tool-args-hashed"
}
```

规则是：ID 可关联，原始载荷按需隔离。`session_id` 不是身份，`trace_id` 也不是授权凭证；它们只用于定位链路。

## 三、四类 Runtime 的公开观测能力

| Runtime | 已公开的运行面 | 应在企业侧补齐什么 |
| --- | --- | --- |
| Claude Code | OpenTelemetry metrics、logs、optional traces；会话/成本/工具/权限事件 | 采样、PII/代码脱敏、SIEM 规则、任务与工单关联 |
| Codex | 管理员用量/采用分析、云端任务与代码审阅活动、合规日志能力 | 每个本地/云端任务的工件、环境、测试和业务 effect 关联 |
| OpenClaw | Gateway JSONL logs、health/status、doctor、诊断包、OTel | 多 Gateway 聚合、告警门槛、长期存储、外部系统 effect 对账 |
| Hermes | session SQLite、脱敏 trace export、dashboard logs/analytics、Langfuse 插件 | 企业身份映射、集中留存、敏感工件审批、incident workflow |

### Claude Code：OTel 是强信号源，但默认不含全部内容

[Claude Code Monitoring](https://code.claude.com/docs/en/monitoring-usage) 支持通过 OpenTelemetry 导出 metrics、events 和可选 traces。公开指标包括 session、token、成本、代码行数、commit、PR 和权限决策，事件可关联用户、session、tool、MCP 和 Hook。它也特别说明：用户 prompt、工具参数、工具内容与原始 API body 默认不记录；开启相应开关后可能包含敏感数据，后端必须过滤或脱敏。

这带来正确的企业配置顺序：

1. 先开启最小 metrics 和结构化事件，验证 cost、错误、权限拒绝和 adoption 面板。
2. 将 OTel collector 放在受控网络，按用户/组织/项目添加资源标签，不直接把高基数 file path 写入 metrics。
3. 对工具细节和内容使用独立日志管道、短保留期、按需访问和 redaction，而不是一键全开。
4. 将 tool decision、MCP connection、permission mode 变化、Hook block 送往 SIEM，和终端/CI/Git 审计关联。
5. 计费以供应商 billing 为准，本地 cost estimate 只能用于趋势和告警。

### Codex：管理员分析回答“使用如何”，任务证据回答“为何发生”

[OpenAI Global Admin Console](https://help.openai.com/en/articles/12289294-global-admin-console) 的 Codex analytics 可展示 active users、credits、tokens、message runs、生成代码行数、plugin calls、skills 使用和 code review activity 等聚合信息。这非常适合检查采用率、成本归因与异常使用，但不能替代单次业务任务的证据链。

对于 Codex 类工作流，企业应把以下工件与任务 ID 绑定：仓库/commit SHA、worktree/云端环境 ID、`AGENTS.md` 命中版本、sandbox/network/approval 模式、测试命令及退出码、diff/PR、人工 review 结论和外部部署回执。管理员面板知道“谁用得多”，而 incident responder 还必须知道“这个 PR 是在何种规则和环境下生成的”。

在需要企业审计时，[OpenAI Compliance Platform](https://help.openai.com/en/articles/9261474) 的 append-only 合规事件能力适合形成独立保留面。不要试图通过删除本地聊天或代码来假设审计记录同步消失；数据删除、保留和合规日志是不同的流程。

### OpenClaw：将 Gateway health、日志、doctor 与 OTel 编成值班梯子

[OpenClaw Logging](https://docs.openclaw.ai/logging) 说明 Gateway 有 JSONL 文件日志与终端输出；[Health Checks](https://docs.openclaw.ai/gateway/health) 提供 `status`、`health`、模型使用快照和 channel probe；[Doctor](https://docs.openclaw.ai/cli/doctor) 区分 inspect、repair、适合 CI 的 `--lint`。对未知问题不要直接执行修复，先遵循：

```text
status/health -> logs --follow -> doctor --lint -> scoped diagnosis
             -> approval -> doctor --fix or controlled rollback
```

[OpenClaw OpenTelemetry](https://docs.openclaw.ai/gateway/opentelemetry) 还将 token、cost、run duration、queue、session、tool、memory 和 exporter health 作为指标/trace 信号。用于线上系统时，应给每个 Gateway、agent、channel、worker 池加资源标签，并限制 session/user ID 的暴露方式，防止观测后端成为跨用户聊天内容的旁路。

当 Gateway 发生内存压力、协议不匹配或队列积压，[Diagnostics Export](https://docs.openclaw.ai/gateway/diagnostics) 与 stability bundle 可以提供经过清理的支持信息。诊断包默认省略聊天、提示词、Webhook body、工具输出、凭证和原始 session ID；这正是“可支持排障但不把数据外发”应具备的默认值。

### Hermes：session 工件、脱敏导出与集中观测

[Hermes Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/) 保存模型配置、system prompt snapshot、消息、工具调用、token、时间戳和 session lineage，并支持导出为 JSONL、Markdown、HTML 或 trace；对要共享或上传的导出提供 secret redaction。其 [Web Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard) 可以查看 agent/gateway/error logs 与 token、cost、cache hit 的汇总；[Built-in Plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/built-in-plugins) 列出 Langfuse 可用 session/task 作为 grouping key 的观测插件。

运行手册应明确导出边界：先选 session 与时间范围，使用 `--dry-run` 预览，默认 `--redact`，在受控工件库保存，不直接把完整 trace 贴到聊天或 issue。需要求助时，[Hermes Debug](https://hermes-agent.nousresearch.com/docs/reference/cli-commands) 默认也会脱敏诊断 bundle；`--no-redact` 应只在明确批准后使用。

## 四、采集策略：默认元数据，内容按需升级

| 级别 | 收集内容 | 适用场景 | 风险控制 |
| --- | --- | --- | --- |
| L0 聚合 | 数量、耗时、token、cost、结果码 | 默认 SLO/成本监控 | 不存 prompt/tool body |
| L1 结构化 | tool 名、参数 schema、资源类型、policy decision | 运行排障与审计 | 参数哈希、ID 脱敏 |
| L2 受控片段 | 有限错误片段、检索引用、stdout 摘要 | 特定 bad case 调查 | 内容 DLP、短 TTL、按角色访问 |
| L3 法证工件 | 原始输入、完整 tool output、环境快照 | 安全事故、法务/合规批准 | 加密、隔离 vault、双人审批、严格保留期 |

禁止“排障期间临时全量打日志”这种无边界做法。正确流程是为 incident 创建 capture policy，限定 task/time/tool/resource，提升一个受控范围内的采样等级，并记录谁批准、何时关闭和哪些工件被导出。

### Redaction 的最低实现

```text
raw event
  -> schema-aware redactor (secret keys, headers, tokens, PII)
  -> content classifier (source code / user data / binary)
  -> allowlisted fields + length limits
  -> hash or secure object reference
  -> event store / audit store
```

只靠正则无法识别所有密钥，仍应配合 secret manager、工具 schema、response field allowlist、源端最小返回与后端访问控制。日志脱敏之后，原工件的读取权限也必须重新校验。

## 五、回放不是重新调用模型

模型、外部网页、检索索引、工具和环境都会变化，因此“重新跑一遍”通常不能复现历史。应区分四种回放：

| 回放 | 固定什么 | 回答什么 | 局限 |
| --- | --- | --- | --- |
| Trace replay | 事件顺序与摘要 | 发生了什么、何处失败 | 不重新决策 |
| Context replay | prompt/version/manifest/retrieval refs | 当时模型看到了什么 | 需控制敏感内容 |
| Sandbox replay | commit、image、依赖、测试命令 | 代码/工具结果能否复现 | 外部服务可能不可重建 |
| Effect reconciliation | idempotency key、资源 ID、外部审计 | 副作用是否真正完成 | 需要下游系统支持查询 |

生产事故优先做 trace replay 和 effect reconciliation。只有在隔离 sandbox 中、确认无新副作用的条件下才做 context/sandbox replay。绝不能为了“复现”而再次发邮件、重试付款或重新发布生产。

### 证据包清单

```yaml
evidence_bundle:
  identity: principal, tenant, channel, approval_ids
  task: task_id, run_id, execution_id, start/end, termination_reason
  environment: repo_sha, worktree, image_sha, model, provider, tool_versions
  context: instruction_revision, skill_hashes, context_manifest_ref
  trace: trace_id, span_summary, policy_decisions, sanitized errors
  effects: idempotency_keys, external_refs, reconciliation_status
  delivery: destination, delivery_id, acknowledgement
  integrity: artifact_hashes, retention_class, access_log
```

该 bundle 可以供事故复盘、评测样本回流和审计使用，但访问它的角色应不同：研发可看去标识 trace，安全团队可按审批读取受控工件，业务 owner 可看 effect 与交付状态。

## 六、告警、SLO 与事故分级

### 建议仪表盘

| 面板 | 指标 | 关注的异常 |
| --- | --- | --- |
| Outcome | task success、acceptance、effect reconciliation | “模型回复成功但任务失败” |
| Reliability | tool error、retry exhaustion、timeout、queue lag | 特定工具/模型/地区退化 |
| Safety | policy deny、approval expiry、secret redaction hit | 越权尝试、规则漂移 |
| Cost | input/output/cached token、tool cost、fan-out | 无限循环、异常并发、缓存失效 |
| Context | token budget、compaction、retrieval noise | 大工具输出、污染记忆、过期规则 |
| Operations | Gateway health、worker lease、channel delivery | 节点失联、消息积压、process 泄漏 |

SLO 不能只写“回答成功率 99%”。例如企业 Coding Agent 可以定义：

- P95 从 task admission 到第一条可读状态的时延；
- 受控写工具的 audit coverage 100%；
- 高风险 effect 的 reconciliation coverage 100%；
- 被策略拒绝后仍真正执行的次数为 0；
- 提交 PR 的测试证据覆盖率和人工接受率；
- 单任务超过成本/步骤预算的比例；
- P1 incident 的证据包生成时延与 kill switch 完成时延。

### 事故响应 runbook

| 触发 | 首先做什么 | 不要做什么 |
| --- | --- | --- |
| 成本/步骤突然飙升 | pause admission、取 trace、确认递归 fan-out | 只提高预算让它“跑完” |
| 错误工具写入 | 停止同类 capability、查 effect、撤销凭证 | 先让 Agent 再试一次 |
| 敏感内容进入 telemetry | 停止相关 exporter、冻结访问、轮换密钥 | 在普通聊天/issue 粘贴原始日志 |
| Gateway/worker 大量失联 | 查 health、queue、lease、版本与网络 | 盲目重启所有节点导致重复执行 |
| 回答质量突然退化 | 对比 model/prompt/skill/index/context revision | 只凭最终文本猜测是模型问题 |

响应顺序建议固定为：**保护人和资源 -> 停止新增副作用 -> 冻结证据 -> 对账 effect -> 分层修复 -> 离线回放与评测 -> 灰度恢复**。

## 七、系统设计高频追问

### Q1：为什么要同时有 trace 和 audit log？

> Trace 面向性能和因果链，允许采样、聚合和短保留；audit log 面向责任与合规，应覆盖关键动作、不可篡改、权限隔离且与真实身份/审批关联。Trace 可以告诉我调用链哪一步慢，audit 要告诉我谁以何种授权修改了哪条资源。把二者合并会使性能数据太敏感、审计数据又不完整。

### Q2：如何调查一次“Agent 说部署成功但线上没变化”？

> 先从 task/run/trace 找到 deploy tool 的 effect ID、参数摘要、策略/审批和工具返回；再到发布系统按 idempotency key 或 deployment ID 对账。若 effect 未创建，定位工具/权限/网络；若创建但未生效，检查发布状态、目标环境、回滚/审批门；若模型只写了自然语言而无 effect，判为虚假完成。整个过程不需要重新部署。

### Q3：如何做 Bad Case 回流又不泄露用户数据？

> 从 trace 提取最小可复现工件：脱敏输入、稳定上下文片段引用、工具 schema、预期 effect 和失败分类；原始高敏内容留在受控 vault。数据集按租户/数据等级审核，评测运行在隔离环境，回流样本保留 provenance、redaction version 和删除联动。不能把生产 trace 整包导出到公共 benchmark。

### Q4：为什么不记录完整 chain-of-thought？

> 排障需要可验证的计划、工具、证据和决策，不需要也不应依赖完整私有推理文本。完整 reasoning 会扩大敏感数据、误导审计者并提高保留成本。用结构化 decision summary、policy result、tool arguments summary、evidence refs 和最终 effect 组成可操作的解释链。

### Q5：如何证明 OTel/日志没有成为新的数据泄露面？

> 从采集配置、schema allowlist、redaction 覆盖率、存储加密、访问控制、导出审计、保留/删除策略和定期 red-team 样本证明。默认只采 metadata；内容级 telemetry 必须按 task/time/tool 范围升档并有批准。还要监控 redaction 失败、异常字段长度和未经授权的 trace export。

## 八、上线检查表

### 信号与关联

- [ ] request/task/run/execution/session/trace/effect/delivery 有明确关联和终态。
- [ ] metrics、events、trace、audit、工件采用不同 retention 与访问角色。
- [ ] 每个关键写工具和审批决策具备 audit evidence，关键 effect 可对账。

### 隐私与取证

- [ ] 默认不采集 prompt、工具 body、文件内容和原始 API bodies。
- [ ] 内容级采集需要 capture policy、最小范围、短 TTL、访问审计和关闭流程。
- [ ] export/diagnostics 默认 redaction，原始工件存放在受控 vault。
- [ ] 线上 bad case 回流样本有 provenance、脱敏版本和删除联动。

### 运行与响应

- [ ] 成本、步骤、工具错误、queue、delivery、policy deny、health 和 context 都有告警。
- [ ] 分别演练 pause、cancel、lease revoke、effect reconciliation 和证据包导出。
- [ ] 回放不会重放不可逆副作用；外部系统支持用 effect/idempotency key 查询。
- [ ] 版本变更时对比 model、instructions、skills、tools、context、runner、policy revision。

## 延伸阅读

- [Claude Code Monitoring](https://code.claude.com/docs/en/monitoring-usage) 与 [Costs](https://code.claude.com/docs/en/costs)：OTel、工具审计、token/cost 和隐私配置。
- [OpenAI Global Admin Console](https://help.openai.com/en/articles/12289294-global-admin-console) 与 [Compliance Platform](https://help.openai.com/en/articles/9261474)：Codex 采用率、用量与合规日志边界。
- [OpenClaw Logging](https://docs.openclaw.ai/logging)、[Health](https://docs.openclaw.ai/gateway/health)、[Diagnostics](https://docs.openclaw.ai/gateway/diagnostics)、[OTel](https://docs.openclaw.ai/gateway/opentelemetry)：Gateway 运行、诊断、清理和遥测。
- [Hermes Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/)、[Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)、[Debug](https://hermes-agent.nousresearch.com/docs/reference/cli-commands)：session 工件、日志、成本面板与脱敏诊断包。
