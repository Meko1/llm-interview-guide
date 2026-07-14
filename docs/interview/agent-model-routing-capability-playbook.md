# Agent 模型路由、降级与能力契约：Claude Code / Codex / OpenClaw / Hermes

> 企业模型网关解决“请求该发给哪个模型服务”；Agent Runtime 还要回答“当前 session、子 Agent、计划阶段、工具循环、压缩、视觉和审批各自用谁，主模型失败时能否切换，以及切换后还是否有资格执行动作”。只把备用 URL 写进配置，会把一个可用性问题变成质量、成本和安全事故。

> 通用 MaaS 路由、计费和供应商治理见 [MaaS 平台生产化高频问答](/interview/maas-production-qna)，模型变更的评测门禁见 [LLM 评测与发布门禁实战](/interview/evaluation-release-gates)，Agent 任务预算/并发见 [Agent 自动化与后台编排生产设计](/interview/agent-automation-orchestration-playbook)。

## 30 秒总答法

> 我将模型选择从字符串配置升级为 capability contract。任务 admission 根据风险、数据域、交互时延、上下文长度、工具/视觉/结构化输出能力和预算，选定主模型、允许的 fallback 链与辅助任务模型；每一个候选都声明 provider、model snapshot、支持的输入、工具/JSON/思考/上下文能力、区域、价格和安全约束。运行时先做同 provider 的凭证/profile rotation，再按明确的 failover 信号切换兼容模型；显式用户 pin、生产写操作和不兼容 schema 的任务默认 strict，不可静默降级。切换时冻结并记录 `selection_source`、route reason、失败分类、能力差异、config/prompt/tool schema 版本；任何能力变弱都进入只读、重新规划或人工确认，而不是沿用旧模型已生成的高风险计划。

## 一、模型路由的四个层次

| 层次 | 决策对象 | 例子 | 错误做法 |
| --- | --- | --- | --- |
| 网关层 | provider/region/endpoint | 同模型跨区域、限流、合规 | 只看单价/延迟 |
| Runtime 主循环 | 本次 session 或 run 主模型 | coding、research、operations | 每个 turn 随机切换 |
| 子任务/辅助 | 压缩、视觉、审批、检索摘要 | 小模型做 title，大模型做计划 | 所有节点都用同一贵模型 |
| 故障恢复 | profile rotation、fallback、strict fail | 429 先换同 provider key，再换模型 | 用户明确指定模型却静默换掉 |

这四层要有一份共同的 `model_selection_record`，否则账单看到的是 provider，Agent trace 却不知道为什么某一步突然失去工具调用或输出 JSON 的能力。

```json
{
  "run_id": "r_1024",
  "role": "planner",
  "selection_source": "policy_default",
  "primary": "provider-a/coding-2026-07-01",
  "fallbacks": ["provider-a/coding-mini", "provider-b/coding-pro"],
  "required": ["tool_calling", "json_schema", "context>=128k"],
  "forbidden": ["cross_region", "training_data_collection"],
  "effort": "high",
  "policy_digest": "sha256:..."
}
```

## 二、能力契约比模型名称重要

模型别名会漂移，provider 对同一模型的工具、思考、JSON 或上下文支持也可能不同。每个 route candidate 应有经测试的能力声明：

| 能力 | 为什么 Agent 特别在意 | 失败后的安全动作 |
| --- | --- | --- |
| Tool/function calling | 计划能否转换成受约束 action | 不执行写工具，重新规划或转人工 |
| JSON Schema/structured output | 下游 parser、审批和状态机 | 校验失败即阻断，不用自然语言猜字段 |
| Vision/PDF | 浏览器、截图、文档任务 | 仅降级到文本路径时需声明信息损失 |
| Context window | repo、会话和证据是否装得下 | 触发分层检索/压缩，不能静默截断 |
| Reasoning/effort | 复杂规划与成本/时延平衡 | 提升 effort 或改走 verifier，不无限重试 |
| Region/data policy | 合规与数据外发 | 禁止跨区域 fallback |
| Safety/refusal 行为 | 高风险动作与输出约束 | 进入人工 review，不以更弱模型绕开 |

能力以实际 contract test 为真，而不是厂家宣传。测试要覆盖 prompt 模板、工具 schema、长上下文、结构化输出、拒绝、流式、超时、错误码和 token/成本。模型兼容不意味着完整等价。

## 三、选择与 fallback 状态机

```text
admission -> selected(primary, profile) -> running
  -> rotate_profile -> running
  -> fallback_candidate -> capability_recheck -> running
  -> strict_failure | human_review | read_only_degrade
```

1. **Resolve。** 先处理 policy allowlist、用户/任务 override、model snapshot、数据地域和必需能力。
2. **Try primary。** session 尽量 stick 到同模型/profile，保留上下文缓存和一致性。
3. **Rotate credential。** 若同 provider 有多个合法 auth profile，先按冷却、额度、主体和租户规则轮换；不得跨用户/租户借用 token。
4. **Classify failure。** 429、overload、可重试 timeout、永久 auth、billing、context overflow、schema/安全拒绝的响应不同。context overflow 不是“换小模型”的理由，应先压缩/拆任务。
5. **Evaluate fallback。** 对候选做 capability、数据域、成本、工具/输出 schema 和风险 recheck。
6. **Transition。** 记录失败原因、旧/新模型、profile、选择来源。对于写操作，旧 plan 必须失效并重新 prepare/approve。

## 四、严格选择与自动降级的边界

| 场景 | 是否可自动 fallback | 说明 |
| --- | --- | --- |
| 普通摘要/只读研究 | 可，候选能力相容 | 仍记录 route reason |
| 用户明确 pin 的模型/profile | 默认否 | 返回失败或请求用户改选 |
| cron/后台任务 | 可按 job 独立定义 | 配置 `fallbacks: []` 表示 strict |
| 结构化写工具 | 仅完全 schema/tool 等价时 | 否则只生成草稿或人工审查 |
| 高敏数据/区域限制 | 仅同政策域候选 | 不因 5xx 跨域 |
| 上下文超限 | 通常否 | 先压缩、检索、拆分或 checkpoint |
| 安全拒绝/内容策略 | 否 | 不能使用弱模型绕过限制 |

“Fallback 成功”应有两个指标：provider response 成功和业务 contract 成功。后者包含 JSON 解析、工具参数、权限、最终 effect 与用户体验；只看 HTTP 200 会掩盖大量事故。

## 五、主模型、辅助模型与子 Agent 的分工

把每件事交给主模型常常最贵、最慢，也会将业务上下文发送到不需要它的服务。推荐 role profile：

| 角色 | 优先指标 | 常见策略 |
| --- | --- | --- |
| Planner / high-risk reviewer | 推理、工具可靠性、长上下文 | 强模型、高 effort、可用 verifier |
| Coder / fixer | 代码/工具轨迹、repo context | coding model、worktree、测试门禁 |
| Compressor / title / classifier | 低成本、稳定格式、隐私 | 小模型或本地模型，固定 schema |
| Vision / browser observation | 多模态、延迟 | 专用视觉模型，最小截图 |
| Approval risk scorer | 保守、可解释、fail closed | 独立模型，不能直接批准高危写 |
| Cron 批处理 | 单价、吞吐、重试 | job profile、上限、显式 fallback |

辅助模型的输出依然是不可信 input。压缩模型不能改变审批状态，风险分类模型不能取代业务授权；它们只是控制面建议或受 schema 约束的中间工件。

## 六、四类 Runtime 映射

### Claude Code：model alias、effort 与子 Agent 覆盖

[Claude Code Model configuration](https://code.claude.com/docs/en/model-config) 支持 session `/model`、启动参数、环境变量和 settings 的优先级；alias 会随 provider 推荐版本演进，因此要求稳定行为时要 pin 完整 model name。它还支持 effort level，且 Skill/Subagent frontmatter 可以覆盖 session effort。工程上把 effort 当作可计费、可评测的 route 参数：低 effort 只用于窄任务，高/更高 effort 用于复杂 planning/review，不能用自然语言 “多想想” 代替配额和评测。

该文档也指出自定义 Bedrock ARN/部署名可能无法被内建识别，应显式声明支持的 effort、thinking、tool 间思考等 capability。否则配置可能看似选择了模型，实际 Runtime 已禁用了依赖的特性。

### Codex：模型选择、snapshot 与环境契约

Codex CLI/IDE 可由 model picker、`-m` 或 `config.toml` 选择支持的模型；用量会受代码库规模、任务复杂度、长 session 和执行位置影响。[Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) 对需要稳定可复现 API 行为的服务，不应依赖 floating name：OpenAI 的模型文档说明 snapshot 可以锁定具体版本，且 reasoning effort 是能力/成本维度的一部分。[GPT-5.2-Codex model](https://developers.openai.com/api/docs/models/gpt-5.2-codex)

生产 Coding Agent 应把 model snapshot、reasoning effort、sandbox、`AGENTS.md`、工具 schema 和 task evidence 一起固定。切换模型后旧的 code-review/approval 结论不能自动沿用，必须对 head SHA 与新 route 重新验证。

### OpenClaw：先 profile rotation，再 model fallback

[OpenClaw Model failover](https://docs.openclaw.ai/model-failover) 清晰分成两阶段：当前 provider 内 auth profile rotation/cooldown，之后才进入 `agents.defaults.model.fallbacks`。session 自动选择可以在 fallback 后持久化自己的 override 以避免并发状态回跳；用户显式 `/model` 选择则是 strict，不会悄悄答成另一个模型。这个语义非常适合面试回答“何时应可用性优先，何时应用户/业务意图优先”。

OpenClaw 的 image/PDF 模型是独立 surface，cron 又可单独提供 `--model`、`--fallbacks` 和 thinking override；若指定模型不可用，cron 直接报验证错误而不是回落到默认模型。[OpenClaw Models](https://docs.openclaw.ai/concepts/models) [OpenClaw Cron](https://docs.openclaw.ai/cli/cron)

### Hermes：主循环、辅助 slot 与 provider routing

[Hermes Configuring Models](https://hermes-agent.nousresearch.com/docs/user-guide/configuring-models) 将 main model 与 vision、compression、web extraction、approval、MCP helper 等 auxiliary slot 分开。其 [Fallback Providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/fallback-providers/) 支持同 provider credential pool、主模型跨 provider fallback，以及辅助任务专属 fallback chain；但 429 的 `Retry-After` 是请求约束，不能被当作随意绕开显式 provider 选择的理由。

通过 OpenRouter 的 provider routing，还可按价格、延迟、吞吐排序或 allow/deny 特定底层 provider，设置 `require_parameters: true` 防止路由后静默丢掉 tool 等参数，并可禁止 data collection。[Hermes Provider Routing](https://hermes-agent.nousresearch.com/docs/user-guide/features/provider-routing) 这应映射到企业数据策略与 capability contract，而不只是“挑便宜的”。

## 七、系统设计题：多 Runtime Agent 的模型控制面

**题目：公司同时运行 Coding Agent、客服 Agent 和巡检 Cron，接入多家模型。设计一个既省钱又不会错误降级的模型控制面。**

```text
Task admission -> model policy / capability registry -> route planner
  -> profile resolver -> Runtime adapter -> model provider
  -> tool gateway / effect gate
  -> route trace + quality/cost feedback -> policy rollout
```

设计回答：

1. Capability Registry 保存 model snapshot/provider/region、工具、JSON、vision、context、effort、价格、数据训练与评测版本，不允许把 alias 当稳定 contract。
2. Policy 根据 tenant、任务 role、数据分类、写风险、SLA/预算选择 primary/fallback；高风险 role 设置 strict fallback 或只读降级。
3. Runtime Adapter 适配 Claude Code effort/subagent、Codex model/config、OpenClaw profile+fallback、Hermes main/auxiliary/provider routing，并记录 effective selection。
4. Route Planner 先做同主体、同 provider 的 profile rotation，后做兼容 fallback；每次 transition 写 route reason、error class、capability diff 和 cooldown。
5. Tool Gateway 重新检查 fallback 模型的结构化输出、权限和 approval，写操作需要新的 prepare/commit 证据。
6. Eval/observability 按 route bucket 统计 task success、schema success、tool error、fallback rate、cost、latency、safety refusal 和用户满意度；某候选退化时从 registry 摘除而不等待全局事故。

## 八、验收清单

- [ ] 每个 Agent 角色是否有主模型、允许候选、必需能力、数据域、effort 和预算，而不是一个全局别名？
- [ ] alias/model snapshot/provider/region/capability/profile 是否写入 run manifest？
- [ ] 是否区分 auth rotation、429/overload、billing、timeout、context overflow、schema failure 与 safety refusal？
- [ ] 显式用户 pin、写动作、高敏数据和不兼容 schema 是否默认 strict？
- [ ] fallback 后是否重新验证 JSON/tool schema、policy、approval 和 effect，而非复用旧计划？
- [ ] 是否对主/辅模型、cron/子 Agent 分别设置最小化上下文、成本与 fallback policy？
- [ ] 是否按 candidate 观测 route reason、质量、工具成功、成本、延迟和安全指标，并有自动摘除/回滚？

## 延伸阅读

- [Claude Code Model configuration](https://code.claude.com/docs/en/model-config)：model alias、effort、subagent/Skill 覆盖与自定义 capability。
- [OpenClaw Model failover](https://docs.openclaw.ai/model-failover)：profile rotation、strict selection、cooldown 与可观测 fallback。
- [Hermes Fallback Providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/fallback-providers/)：主模型与辅助任务的不同降级链。
- [Hermes Provider Routing](https://hermes-agent.nousresearch.com/docs/user-guide/features/provider-routing)：底层 provider 选择、参数兼容与数据采集策略。
