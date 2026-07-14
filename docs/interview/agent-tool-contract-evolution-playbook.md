# Agent Tool Contract 工程：Schema 演进、兼容性与验证面试手册

> Function Calling、MCP 和普通内部 API 的共同难题不是“能否解析 JSON”，而是模型、Agent、UI、Gateway、评测集和下游服务在不同版本并存时，是否仍对一次工具调用有相同理解。本页讨论 Tool Contract 如何像生产 API 一样演进。

> 工具的权限、审批和执行网关见 [企业 Tool Gateway 安全执行系统设计](/interview/tool-gateway-security-design)，MCP Server 治理见 [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)，结构化输出与模型约束见 [结构化输出与 Schema 约束高频问答](/interview/structured-output-qna)。

## 一、30 秒总答法

> 我把 Tool Contract 当成 Agent 的生产 API 合约，而不是随 Prompt 一起改的 JSON。Contract 至少包含稳定 tool ID、语义版本、输入/输出 schema、字段语义、错误分类、风险/权限、幂等范围、示例、owner 和弃用策略。Registry 在发布时做 schema diff 和兼容性判定；Runtime 在一次 task 中 pin 到 manifest digest，不因工具列表热更新而改变既有计划；Gateway 同时校验输入、输出和业务不变量。兼容新增可灰度，必填字段、枚举收窄、单位/时区/权限语义变化必须新版本或新 tool ID。发布前用合成 tool call、历史 trace 回放、影子执行和模型矩阵测试验证，发布后同时监控 schema failure、unknown field、tool selection drift、错误分布和旧版调用占比。下线先隐藏、再拒绝新建、最后迁移和删除，绝不只改 description 让模型“自己适应”。

一句话：**模型能生成符合 JSON Schema 的参数，不代表它知道这个参数在业务上仍是同一件事。**

## 二、Tool Contract 不止 inputSchema

MCP Tools 规范将 `inputSchema` 定义为必需的 JSON Schema，并允许提供 `outputSchema` 来描述结构化结果。MCP 的 schema 默认采用 JSON Schema 2020-12；这给了传输层形状，却没有自动定义业务兼容性、权限或弃用策略。[MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

企业 Registry 应在协议 schema 外补齐下列元数据：

```yaml
tool:
  id: crm.customer.lookup
  version: 2.1.0
  contract_digest: sha256:...
  owner: customer-platform
  lifecycle: active
  risk: read_sensitive
  input_schema: schemas/customer-lookup-v2.json
  output_schema: schemas/customer-lookup-result-v2.json
  semantics:
    idempotency: not_applicable
    consistency: read_your_writes_not_guaranteed
    data_classification: confidential
  compatibility:
    accepts: [2.x]
    deprecates: [1.x]
    sunset_at: 2026-12-31T00:00:00Z
  examples:
    positive: [examples/by-email.json]
    negative: [examples/ambiguous-identity.json]
  policy:
    required_scopes: [crm.customer.read]
    field_masks: [phone, address]
```

| 合约层 | 要回答的问题 | 只靠 JSON Schema 是否足够 |
| --- | --- | --- |
| 身份 | 这是哪个稳定能力，谁负责 | 否 |
| 语法 | 参数和结果有什么字段、类型、范围 | 部分足够 |
| 语义 | 金额单位、时间区间、默认值、空值、排序代表什么 | 否 |
| 行为 | 幂等、分页、一致性、限流、异步任务如何工作 | 否 |
| 安全 | 能访问哪些数据、何时需审批、结果如何脱敏 | 否 |
| 生命周期 | 如何灰度、弃用、迁移、回滚和审计 | 否 |

### Tool name 是稳定身份，不是营销文案

`create_ticket`、`open_ticket`、`submit_case` 三个近义工具会增加模型选错率，也让迁移和审计无从谈起。稳定 ID 用机器可读命名，展示名称可改；当业务语义真正变化时，用新 ID 或明确 major version，而不是重用旧名。LangChain 的 Tools 文档同样建议使用由字母、数字、下划线和连字符组成的兼容名称，避免不同模型提供商拒绝空格或特殊字符。[LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)

## 三、兼容性矩阵：字段形状相同也可能是破坏性变更

| 改动 | 协议兼容性 | Agent 语义兼容性 | 推荐做法 |
| --- | --- | --- | --- |
| 新增可选字段，默认行为不变 | 通常兼容 | 通常兼容 | minor 版本，灰度并补示例 |
| 新增必填字段 | 不兼容 | 不兼容 | 新 tool/version，或提供确定默认值 |
| 删除/重命名字段 | 不兼容 | 不兼容 | 兼容 adapter + deprecate，延迟删除 |
| 收窄 enum/range | 可能解析通过 | 常使旧 Agent 失败 | 新版本，迁移调用和评测集 |
| 金额从元改分、时间从本地改 UTC | 形状不变 | **严重不兼容** | 新字段/新 ID，双读校验 |
| 默认排序或权限范围变化 | 形状不变 | **可能越权或漏数据** | 重大变更，重新审批与灰度 |
| 新增输出字段 | 通常兼容 | 可能触发 prompt/解析器误用 | 版本化 output，消费者字段白名单 |
| 输出字段改含义 | 表面兼容 | 不兼容 | 新版本、双写/对比、迁移 |

“JSON 能 parse”只是 wire compatibility。Agent 还依赖 description、示例、工具可见性、错误文本和默认值做决策，所以应额外测试：旧 prompt 是否仍选择该工具、同一请求是否产生同等风险、结果是否仍驱动下游正确动作。

## 四、Canonical Contract 与 Runtime Adapter

不要让业务工具分别维护 OpenAI、Anthropic、MCP、LangChain 和内部 HTTP 的五份 schema。定义一个 canonical contract，再由 adapter 降级或映射到不同 Runtime：

```text
canonical Tool Contract
      |        |         |
      v        v         v
MCP input/  provider   framework
outputSchema tool JSON  Pydantic/Zod
      |        |         |
      +------ Gateway validation ------+
```

### Adapter 的边界

1. **保持语义**：adapter 可以转换字段命名、nullable 表示或 provider 支持的 schema 子集，不能把“需审批的退款”悄悄降级为普通写入。
2. **显式能力声明**：某些 provider 支持 strict schema，某些只提供 JSON Mode 或工具提示。声明能力矩阵，并对弱能力使用更简单的 canonical subset 或额外服务端校验。
3. **保留原始与标准化版本**：trace 同时保存 model tool call、adapter 输出、canonical command、schema/adapter digest 和 validation error，排障时才能知道问题来自模型、adapter 还是业务服务。
4. **Runtime 只看到适用工具**：不要把所有版本、已弃用工具和管理员工具塞进同一上下文。可见性由 task manifest、用户权限和 rollout 决定。

OpenAI 的函数工具参数采用 JSON Schema，并提供 `strict` 选项以要求模型遵循定义 schema；但严格模式只支持 JSON Schema 的一个子集。严格生成能降低格式错误，仍不能替代服务端校验、版本适配和业务授权。[OpenAI Function Calling Reference](https://platform.openai.com/docs/api-reference/fine-tuning/event-object)

LangChain 也区分 Pydantic 的自动字段校验与 TypedDict/JSON Schema 的手动校验；这正说明“有类型定义”不等于运行时已经验证。[LangChain Models](https://docs.langchain.com/oss/python/langchain/models)

## 五、输入、输出、错误：三个 Contract 都要版本化

### 输入 Contract

- 每个字段写明单位、时区、locale、资源作用域、是否允许 `null`、默认值的业务意义。
- 用 enum、范围、format、最大长度和 `additionalProperties: false` 降低模型猜测空间；但别把动态业务规则硬编码成巨大 enum。
- 禁止让模型传 `tenant_id`、`user_id`、权限 scope 或内部 price。可信身份与权限从 Gateway 上下文注入，并从 model-visible schema 隐藏。

### 输出 Contract

工具结果也可能驱动下一次工具调用或前端 UI，因此同样需要 schema、大小限制、脱敏和版本。MCP 对结构化结果建议同时提供序列化 JSON 的文本内容以兼容旧客户端；这提醒我们结果演进要考虑消费者能力，而不是只升级 Server。[MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

推荐返回稳定 envelope：

```json
{
  "status": "ok",
  "data": { "ticket_id": "T-381", "state": "OPEN" },
  "meta": { "contract_version": "2.1.0", "request_id": "req_9" },
  "warnings": []
}
```

将 `status`、机器错误码、可安全展示的 `message` 与 `retryable` 分开。模型应看到足以修复调用的安全错误；运维 trace 才看完整堆栈、内部资源和敏感上下文。

### 错误 Contract

| 错误类 | 示例 | Agent 可做什么 |
| --- | --- | --- |
| `INVALID_ARGUMENT` | 日期格式、枚举、字段组合错误 | 修正一次或向用户追问 |
| `NOT_FOUND` | 资源不存在或不可见 | 不要编造 ID；可尝试允许的查询 |
| `CONFLICT` | ETag/版本已变、重复创建 | 重新读取并重新 plan，不盲重试 |
| `RATE_LIMITED` | 限流 | 退避、切只读降级、报告等待 |
| `REQUIRES_APPROVAL` | 高风险 command 未批准 | 呈现冻结预览，等待批准 |
| `UNKNOWN_EFFECT` | 下游超时但可能已执行 | 查询/对账，禁止再提交 |
| `INTERNAL` | 下游未知故障 | 有限重试或人工，错误不泄密 |

错误码的改变也属于 Contract 变更。将所有错误折叠成“tool failed”会让模型在错误路径上更容易循环和越权。

## 六、发布前验证：从 schema diff 到模型行为回归

### 1. 静态兼容检查

Registry 的 CI 对 input/output/error schema 做 diff，并按规则分类：新增 optional、删除、required 变化、enum/range 收窄、默认值变化、描述/示例变化、权限变化。描述和示例虽不改变 JSON shape，却会影响模型路由，因此应作为“行为可能改变”进入评审。

### 2. Consumer-driven Contract Tests

为每个 tool consumer 保存 contract fixture：

- Agent 的 canonical command 和预期 validation result。
- UI 的渲染字段、错误映射和 feature flag。
- Gateway 的 policy obligation、字段 mask、幂等键规则。
- 下游 provider 的请求/回执 mock、版本/ETag 冲突和超时样本。

Server 在 CI 对 fixture 验证；consumer 在升级前对 candidate Server 回放。不要只测 Server “能返回 200”，也要测旧 consumer 是否还能理解成功、失败和分页结果。

### 3. Trace Replay 与模型矩阵

从脱敏生产 trace 中抽取：正常调用、缺参数、歧义意图、旧版本调用、恶意扩展字段、冲突、限流、超时和审批拒绝。对 candidate contract 在固定模型、fallback 模型和不同 prompt 版本上重放，衡量：

| 指标 | 说明 |
| --- | --- |
| tool selection precision | 应调用新工具时是否选对，旧工具是否被误选 |
| argument validity | schema 与业务校验通过率 |
| semantic equivalence | 旧/新版本对同一任务的资源、金额、风险是否一致 |
| recovery quality | 错误后是否正确追问、查询、等待或转人工 |
| safety regression | 是否暴露旧管理工具、扩大参数/数据范围、绕过审批 |
| cost and latency | 工具描述变长、重试增多、并行行为变化造成的成本 |

LangChain 的 structured output 在 schema 不匹配时会把验证错误反馈给 Agent，形成受控修复回路；生产实现仍应设次数上限，并把失败样本回流到评测集，避免模型无限“再试一次”。[LangChain Structured Output](https://docs.langchain.com/oss/python/langchain/structured-output)

### 4. Shadow、Canary 与可逆切换

对于读工具，可以在相同输入上 shadow 调用新旧版本并比较脱敏结果；对于写工具，不要双写真实资源，而用 provider sandbox、dry-run 或只执行 candidate 的 validation/prepare。canary 以 tenant、Agent、工作区、用户组或 tool manifest 切流，保留一次请求固定到单一 Contract digest 的粘性，防止同一 plan 的不同 step 穿越版本。

## 七、弃用与下线：删 schema 之前先迁移行为

```text
announce -> hide from new manifests -> warn old callers -> migrate/replay
       -> reject new v1 intents -> keep query/receipt -> retire implementation
```

| 阶段 | Runtime 行为 | 需要的保障 |
| --- | --- | --- |
| Announce | 仍可见，返回 deprecation metadata | owner、替代工具、截止日期 |
| Hide | 新 task 不再注入旧工具 | 旧 task 仍 pin 原 contract |
| Migrate | adapter 或显式迁移 command | 参数/语义 diff 和 replay 评测 |
| Reject | 新 intent 返回可操作错误 | 新工具名、迁移指引、人工通道 |
| Retire | 停止实现和凭证，保留审计查询 | receipt/对账保留与事故检索 |

不要在已运行 task 中热替换 Contract。它会使缓存的工具说明、已经签出的 approval、幂等键和模型计划不再匹配。对长期 Agent，manifest 必须保存 `tool_id + contract_version + digest + adapter_version`，恢复时发现版本已撤销应进入 replan 或人工接管，而不是静默映射。

## 八、系统设计题：多模型企业 Tool Registry

**题目**：公司同时有 OpenAI/Anthropic 模型、MCP Server、LangGraph 工作流和 Spring AI 服务。一个 `create_ticket` 工具要新增 `urgency`，随后把默认优先级从 P3 改为 P2。如何发布，且不影响旧 Agent？

### 推荐答案

1. 建立 canonical Tool Contract，输入包含 `summary`、`category`、可选 `urgency`，并明确 `urgency` 缺省仍等于 P3；新默认 P2 不是普通 minor 改动。
2. 为默认值变化创建 `create_ticket.v2` 或显式 `priority_policy_version`，在 Registry 声明版本、owner、风险、迁移与 sunset。
3. adapter 分别生成 MCP schema、provider tool schema 和 Java DTO；所有 Runtime 工具 trace 都带 contract/adaptor digest。
4. 静态 diff、旧 trace 回放、不同模型选择率、UI/consumer fixtures 与 Gateway policy tests 全部通过后，先在 sandbox/dry-run canary。
5. 新 task 看 v2，已运行 task 固定 v1；旧调用收到 deprecation warning 和迁移数据，不被运行时自动改成 P2。
6. 观察 P2 创建量、参数校验失败、重复建单、审批/限流错误、模型误选与人工修正；达到退出标准才扩大范围。
7. 兼容期结束后拒绝新 v1 intent，但保留旧工单查询、receipt 和审计能力。

### 追问：为什么不能用 description 写“默认优先级现在是 P2”？

> description 影响模型概率，不会改变旧客户端发送的缺省参数，也不能证明某次业务动作使用了什么版本。默认值是语义 Contract，应进入显式字段、版本和审计；如果风险或业务结果变化，就需要新的 intent 和审批边界。

### 追问：Strict schema 是否就能解决兼容问题？

> Strict schema 解决的是模型参数是否符合 provider 支持的 schema 子集。它不能处理旧 tool name、字段语义、权限、错误码、下游 API、UI 解析器和业务默认值，所以仍要 Registry、Gateway、回放和灰度。

## 九、面试反例

- “后端加个字段，模型自然会用。”
- “JSON Schema 没变，所以可以直接改单位和默认值。”
- “输出字段是新增的，客户端不会受影响。”
- “弃用就是从 tools 列表删掉。”
- “模型支持 strict，所以服务端不需要校验。”
- “新旧版本同时暴露给模型，让它自己选。”
- “写工具可以 shadow 双调用，比较哪个成功。”
- “错误给模型一段堆栈，它总能自己修好。”

## 十、上线检查表

- [ ] Registry 有稳定 tool ID、semantic version、digest、owner、输入/输出/错误 schema、风险、权限、示例和 sunset。
- [ ] schema diff 能识别 required、enum/range、默认值、description/示例、权限和输出语义变化。
- [ ] canonical contract 与 provider/MCP/framework adapter 分离，且 adapter 版本进入 trace。
- [ ] Gateway 校验输入、输出和业务不变量；身份、租户、scope 不从模型参数取得。
- [ ] CI 包含 consumer fixture、schema diff、恶意字段、历史 trace、模型矩阵、错误和恢复路径。
- [ ] 写工具只在 sandbox/dry-run shadow，真实 canary 固定 contract digest 并可立即回切。
- [ ] 旧 contract 的隐藏、拒绝、审计查询和 receipt 保留有明确时间表；长任务恢复检测撤销版本。

## 延伸阅读

- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)：`inputSchema`、`outputSchema`、JSON Schema 与兼容性提醒。
- [OpenAI Function Calling Reference](https://platform.openai.com/docs/api-reference/fine-tuning/event-object)：函数参数 schema 与 strict 模式边界。
- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools) 和 [Structured Output](https://docs.langchain.com/oss/python/langchain/structured-output)：类型、运行时校验与格式失败处理。
- [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)、[Function Calling 与 MCP](/agent/function-calling-mcp)：MCP / Function Calling 基础与工具治理。
