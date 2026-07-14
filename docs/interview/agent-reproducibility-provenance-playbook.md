# Agent 可复现运行与配置溯源：Claude Code / Codex / OpenClaw / Hermes

> “模型没变，为什么今天改坏了代码？”通常不是一个纯模型问题。实际一次 Agent run 同时受项目指令、路径规则、自动记忆、Skill、MCP/插件、模型/推理配置、权限、工作区、环境变量、检索索引和外部工具版本影响。只保存聊天 transcript 无法说明当时哪些配置真正生效；只保存 Git SHA 也无法证明 Agent 看到了什么。本页给出将 Agent 行为做成可追溯、可比较、可回归的运行 manifest。

> 上下文组织原理见 [上下文工程](/agent/context-engineering)，扩展供应链与变更治理见 [跨运行时 Agent 扩展生产治理](/interview/agent-skills-production-governance)，观测和证据包见 [Agent 观测、取证与事故响应手册](/interview/agent-observability-incident-response)。

## 30 秒总答法

> 我把一次 Agent run 视为一个可签名的“配置闭包”，不是一段聊天。控制面在 admission 时解析并固定 instruction tree、skill/plugin/MCP 清单、模型/endpoint、tool schema、policy、sandbox、repo/worktree/image、环境变量的引用、retrieval snapshot 和 session/memory 的版本，写成 `run_manifest` 与 digest。执行时记录实际命中的 path rule、实际调用的 tool version 和 effect；回放时区分 trace replay、context replay 和 sandbox replay，默认不重放外部副作用。所有 Agent 配置都像代码一样走 PR、schema 校验、签名/来源校验、golden task、对抗注入与权限回归；变更采用 canary、shadow 或 pinned version。Claude Code 通过 CLAUDE.md、rules、settings、memory、skills/MCP 形成多层输入；Codex 聚合 AGENTS.md、config、skills、环境与 thread；OpenClaw 按 agent 隔离 workspace、auth profile、session 与 tool policy；Hermes 通过优先级 context files、profile、config 与 session snapshot 形成上下文。它们的加载规则不同，因此企业必须记录解析后的有效配置，而不能只记文件名。

## 一、为什么“配置闭包”比 Prompt 更重要

一个 prompt 是用户意图；配置闭包是使同一意图在某次运行中产生特定行为的所有版本化输入。

| 类别 | 例子 | 常被漏掉的风险 |
| --- | --- | --- |
| Instructions | AGENTS.md、CLAUDE.md、规则、system/developer prompt | 子目录规则或 import 改变了行为 |
| Memory/context | 自动记忆、摘要、检索引用、会话历史 | 恢复时读到了更新后的知识 |
| Capability | tools、MCP、plugin、skill、tool schema | 同名工具升级后参数/副作用改变 |
| Execution | model、endpoint、reasoning、sandbox、image、worktree | 本地和云端依赖/权限不同 |
| Policy | allow/deny、审批、网络、数据域、预算 | 同一调用在新 policy 下应被拒绝 |
| External state | repo SHA、索引版本、feature flag、API 版本 | 代码/知识库/下游资源已经变化 |

配置闭包不是让你永久存储密钥或全部私有文本。原则是：**保存不可变引用、摘要、digest、版本和访问日志；原始敏感工件放在受控 vault，按需要读取。**

## 二、运行 manifest：可查询的事实来源

```yaml
run_manifest:
  manifest_version: 1
  run_id: run_20260714_481
  task: {id: task_842, input_digest: sha256:...}
  principal: {subject: user:alice, tenant: acme, auth_context_ref: vault://...}
  instructions:
    effective_digest: sha256:...
    sources:
      - {uri: repo://AGENTS.md, digest: sha256:..., scope: root}
      - {uri: repo://services/payments/AGENTS.md, digest: sha256:..., scope: path}
    resolved_order: [managed, user, project, path]
  capabilities:
    skills: [{name: release-check, version: 1.4.0, digest: sha256:...}]
    plugins: [{name: jira, version: 3.2.1, digest: sha256:...}]
    tools: [{name: deploy.prepare, schema_digest: sha256:..., policy_profile: staging}]
  execution:
    runtime: codex
    runtime_version: 0.x
    model: gpt-5-codex
    endpoint_profile: enterprise-default
    sandbox: {mode: workspace-write, network_policy: allowlist-v4}
    environment: {image: ghcr.io/acme/agent:sha-..., repo_sha: abc123, worktree: wt_481}
  context:
    session_ref: session://.../redacted
    memory_manifest_digest: sha256:...
    retrieval_snapshot: index://handbook@2026-07-14T08:00Z
  policy: {revision: policy-78, capability_id: cap_9f1}
  integrity: {manifest_digest: sha256:..., signature_ref: kms://...}
```

其中 `effective_digest` 比“记录有哪些文件”更关键：它代表按加载顺序、path scope、import、裁剪和策略过滤后，真正进入 Agent 上下文的解析结果。每次 tool call 再带 `manifest_digest`、`tool_schema_digest`、`policy_revision`，观测系统才能解释一次差异来自模型、配置还是外部状态。

## 三、解析、固定、执行、对账四步

```text
discover sources -> resolve precedence -> validate/scan -> freeze manifest
                                                        |
                                                        v
execute with pinned refs -> emit actual-use events -> reconcile artifacts/effects
```

### 1. Discover 与 Resolve

发现所有可能影响行为的源，不只是根目录文件。解析器需要记录：文件 URI、scope、导入链、优先级、是否被截断、是否被安全扫描/拒绝、何时被懒加载。若一个 runtime 使用“first match wins”，另一个使用“多层合并”，同名 `AGENTS.md` 的含义完全不同。

### 2. Validate 与 Freeze

对配置做 schema、签名/来源、secret scan、大小/循环 import、tool policy、依赖版本和相容性校验。通过后生成不可变 manifest；执行器只能引用 manifest 内声明的 capability/环境。**不要让 Agent 在任务中途静默刷新 Skill、重读远程 URL 或升级 MCP 包。** 新版本应创建新 manifest、经测试后再切流。

### 3. Emit Actual Use

计划中声明过但未使用的 skill 不等于实际影响行为。记录 `instruction.loaded`、`rule.matched`、`memory.read`、`skill.invoked`、`plugin.loaded`、`tool.schema_resolved`、`sandbox.denied` 等结构化事件，且不默认上传原始内容。

### 4. Reconcile

完成时将最终 diff、测试报告、artifact digest、effect ID、实际模型/工具版本与 manifest 关联。失败 run 也要保留其闭包，否则团队只能用“模型不稳定”解释回归。

## 四、四类 Runtime 的配置差异

### Claude Code：CLAUDE.md 是上下文，不是强制策略

[Claude Code Memory](https://code.claude.com/docs/en/memory) 区分用户写的 `CLAUDE.md` 与自动记忆；会从不同 scope 读取并按路径顺序组装，auto memory 在同一 repo 的 worktree 之间共享、但机器本地保存。文档也明确指出 CLAUDE.md 是进入 context 的指令而非严格执行边界，硬约束应落到 managed settings、sandbox、permission/Hook。

[Configuration](https://code.claude.com/docs/en/configuration) 说明 settings、skills 和 MCP 与 memory 文件是不同配置层，且 managed 设置覆盖更低层。生产 manifest 应记录：每个加载的 CLAUDE.md/rule 的 digest、auto-memory 是否启用和其 manifest、setting source、enabled MCP/skill 版本、permission/sandbox profile；不要把完整自动记忆误当作可提交的 repo 配置。

### Codex：将 AGENTS、config、tools 与 environment 一起解析

[Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/) 公开说明 Codex 会聚合 `$CODEX_HOME` 与项目路径中的 `AGENTS.md`/`AGENTS.override.md`、skills 元数据、环境信息与 `config.toml` 指令；更深路径的项目 instructions 会在输入中更靠后。其 [App Server 架构](https://openai.com/index/unlocking-the-codex-harness/) 将 thread persistence、config/auth、sandbox tool execution、MCP/skills 置于同一 harness。

因此要记录“解析后的 instruction order、配置 profile、thread/event lineage、worktree/repo SHA、sandbox/network 边界和 tool schema”，而不是仅保存用户 prompt。不同 Codex surface 可能共享 harness 但运行环境不同，manifest 是本地、远端和云端 handoff 的共同语言。

### OpenClaw：agent 是独立的 workspace、认证、模型与 session 域

[OpenClaw Multi-agent routing](https://docs.openclaw.ai/concepts/multi-agent) 定义每个 agent 拥有独立 workspace、state directory、auth profiles、model registry 和 session store；消息 binding 决定进入哪个 agent。它还指出跨 session recall 是有界、脱敏视图而非原始 transcript。 [OpenClaw Tools](https://docs.openclaw.ai/tools) 则强调模型看到的工具是 profile、allow/deny、provider、sandbox、channel 和 plugin 可用性共同过滤后的结果。

所以 OpenClaw manifest 必须带 `agentId`、workspace digest、agentDir profile、auth profile *引用*、session/memory scope、effective tool profile、plugin/skill resolution 和 channel binding。不要因共享 gateway 而假设所有 persona 使用同一状态或同一权限。

### Hermes：first-match context 和 session snapshot 都要记录

[Hermes Context Files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files) 的项目 context 采用 `.hermes.md -> AGENTS.md -> CLAUDE.md -> .cursorrules` 的 first-match 规则，并在子目录按需发现；文件会经过安全扫描和长度截断。 [Hermes Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/) 保存模型配置、system prompt snapshot、消息/工具结果、token、时间和 parent session ID。

因此 Hermes 的可复现闭包至少保存选中的 context type/digest、动态发现的子目录文件、截断/扫描结果、`HERMES_HOME` profile、provider/model config 与 session snapshot ref。仅保存 `AGENTS.md` 可能完全错过实际优先级更高的 `.hermes.md`。

## 五、配置变更如何安全发布

| 变更 | 最小验证 | 高风险回归 |
| --- | --- | --- |
| 指令/路径规则 | lint、冲突/循环检测、golden task | 注入绕过、受保护路径写入、错误优先级 |
| Skill/插件/MCP | provenance、签名/依赖、schema diff | 新增工具面、网络外发、secret access、版本降级 |
| 模型/endpoint | 质量/成本/延迟基准 | tool selection、JSON/schema、拒绝率、长上下文退化 |
| Sandbox/权限 | policy unit test、dry-run | 越权 read/write、网络域名、approval bypass |
| Memory/检索 | snapshot/TTL/删除联动 | 陈旧规则、跨租户召回、敏感内容进入 prompt |

### 三种发布策略

1. **Pinned run：** 关键任务强制使用指定 manifest，最适合发布/财务/合规场景。
2. **Shadow run：** 新配置只对镜像任务运行，比较 tool trajectory、test、cost、policy deny，不产生 effect。
3. **Canary：** 少量低风险 tenant/仓库使用新 manifest，超过阈值立即回退到上一有效 digest。

回滚目标是 `manifest_digest`，而不只是 Git 回滚。因为模型别名、远程 MCP、索引和本地 memory 也可能已变；对于不可再获得的外部 state，应明确“不能完全复现”，并用 trace/evidence 做解释性复盘。

## 六、回归测试矩阵

| 测试层 | 输入 | 断言 |
| --- | --- | --- |
| Parser test | 文件树、imports、path scopes | effective order/digest 与预期一致 |
| Policy test | manifest + tool request | deny/ask/allow、资源 selector、审批义务正确 |
| Golden task | 固定 repo/index/sandbox | artifact、测试、tool trajectory、成本区间 |
| Adversarial context | 恶意 README/tool output/网页 | 不覆盖高优先级规则、不外泄、不触发写 effect |
| Compatibility | 新旧 plugin/schema/model | 旧任务仍能解析，关键参数未静默改义 |
| Replay | 历史 manifest + 工件 refs | 可完成 trace/context/sandbox replay，副作用不重放 |

不要把“最终文本像以前一样好”作为唯一回归信号。对 Coding Agent，更重要的是 diff、测试、工具调用、权限拒绝和外部 effect；对企业助手，更重要的是数据边界、来源和动作正确性。

## 七、系统设计题：为什么生产 Agent 昨天能修复、今天却给出错误方案？

> 排查一个企业 Coding Agent。模型 alias 未变，但同一 issue 昨天能通过 CI，今天产生错误 patch 并尝试调用新工具。如何定位并防止再次发生？

### 高分回答

1. 用 task ID 找到两次 `run_manifest`，做字段级 diff：repo/worktree、instruction effective digest、memory/retrieval snapshot、model endpoint、skill/plugin/tool schema、sandbox/policy 和环境镜像。
2. 比较 actual-use event，而非只看声明：今天是否命中了新的子目录 rule、自动记忆、Skill、MCP 工具或检索结果。
3. 将发生变化的因素固定到 sandbox replay：使用昨天 repo/index/工具 schema 跑 golden task，不产生部署/写库等 effect。
4. 若是配置变更，回滚到上一 manifest digest，补 parser/policy/adversarial regression；若是外部 state 改变，调整 snapshot/TTL 与受控引用；若是模型行为差异，扩大 golden set、设置模型/endpoint pin 或接受新的基线并 canary。
5. 将 manifest diff、测试证据、policy decision 和最终 effect 纳入 incident bundle，避免只在聊天里猜“模型抽风”。

### 高频追问

**Q：是否要把 prompt 和所有工具输出永久存下来？** 不需要，也不安全。保存 digest、摘要、来源、数据分类、访问日志和受控 vault 引用；仅在经批准的调查中读取高敏原文。可复现性不是无限制采集。

**Q：为什么不要让任务中途自动更新插件？** 因为 tool schema、权限需求和副作用语义可能改变，使同一个 task 不再具有稳定含义。升级应形成新 manifest，先 shadow/canary，再切换默认版本。

**Q：记忆是配置还是数据？** 两者皆可。自动/用户记忆通常是可变数据，但它会改变行为，所以运行 manifest 至少要记录其版本/digest/检索结果引用和删除策略；长期规则则应提升为受审查的配置或 Skill。

## 八、上线检查表

- [ ] 每个关键 run 写入 versioned、签名或防篡改的 manifest digest；敏感原文仅用受控引用保存。
- [ ] manifest 覆盖 instructions、memory/context、skills/plugins/MCP、tool schema、model/endpoint、policy/sandbox、repo/image 和 external snapshot。
- [ ] 记录 effective resolved order、实际命中的 path rule/tool 及截断/安全扫描结果。
- [ ] resume、handoff、远程/云端迁移必须重新解析或明确 pin manifest，不能无证据继承配置。
- [ ] 所有配置变更经过 schema/provenance/secret scan、golden、权限、对抗注入和兼容回归。
- [ ] 支持 pinned、shadow、canary 和 manifest 级回滚；回放默认无副作用。
- [ ] 失败 run 同样可查询其配置闭包、工具轨迹、artifact/effect 证据和 policy revision。

## 延伸阅读

- [Claude Code Memory](https://code.claude.com/docs/en/memory) 与 [Configuration](https://code.claude.com/docs/en/configuration)：多层 instructions、自动记忆、settings、skills 和 MCP。
- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/) 与 [Codex App Server](https://openai.com/index/unlocking-the-codex-harness/)：AGENTS/config/工具输入，thread persistence 与 harness 配置。
- [OpenClaw Multi-agent routing](https://docs.openclaw.ai/concepts/multi-agent) 与 [Tools](https://docs.openclaw.ai/tools)：每 Agent 状态域、工具过滤与扩展来源。
- [Hermes Context Files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files) 与 [Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/)：context 优先级、动态发现、安全截断与 session snapshot。
