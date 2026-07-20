# LLM 输出契约兼容与演进：从模型响应到稳定业务接口

结构化输出解决的是“这段内容能否被解析成 JSON”；真正的线上系统还要解决“所有消费者能否持续按同一种业务语义使用它”。模型升级、Provider 切换、fallback、Prompt 修改、Schema 扩展或流式协议调整，都可能让请求成功却让前端错渲染、工作流走错分支、金额单位被误解，甚至在高风险操作中改变决策含义。

本文讨论 **LLM Provider / Prompt / 编排层 到业务 API、UI、队列消费者和流式客户端** 的响应契约。它不同于 [结构化输出](/engineering/structured-output) 的语法约束，也不同于 [Agent Tool Contract 演进](/interview/agent-tool-contract-evolution-playbook) 的工具调用契约：前者关注“模型给业务系统的结果如何可消费、可演进、可回滚”。

## 一、为什么合法 JSON 仍会造成线上事故

设想客服分流 API 返回：

```json
{"intent":"refund", "confidence":0.72, "priority":"high"}
```

这段 JSON 完全合法，但以下变化都可能是事故：

| 变化 | 为什么危险 |
| --- | --- |
| `priority` 从 `high` 改为 `urgent` | 旧消费者可能默认为低优先级，或直接报错 |
| `confidence` 从 0 到 1 改为 0 到 100 | 门禁阈值被放大 100 倍 |
| 金额由 CNY 改成分或 USD | 展示、审批、结算均可能错误 |
| 字段缺失表示“未知”还是“未计算” | 下游无法决定追问、重试还是安全拒绝 |
| 流式 `done` 事件提前发出 | UI 完结，但后续引用、审批或工具结果丢失 |
| fallback 模型改用自然语言解释 | 业务 DTO 解析失败，或错误进入默认分支 |

所以契约不只是 JSON Schema，它还包含字段语义、单位、允许的空值、错误分类、时序、版本、权限/风险标签和兼容期。对于高风险场景，不能用“模型这次输出看着差不多”作为兼容性证据。

> 面试一句话：我把 LLM 输出当作对下游消费者公开的业务 API。合法 JSON 是最低要求；版本化语义、消费者测试和可观测回滚才是生产级要求。

## 二、定义 canonical response contract

不要让每个模型供应商的原始响应直接穿透到业务层。推荐建立一个稳定的 canonical contract，由 Provider adapter 将不同的 token、tool call、reasoning、usage 和 finish reason 翻译为内部对象。

```text
provider response
  -> provider adapter
  -> canonical model event / structured result
  -> contract validator and policy enrichment
  -> product DTO, workflow event, UI renderer
```

一个可版本化响应通常含四部分：

```json
{
  "contract_version": "2.1",
  "request_id": "req_01",
  "status": "completed",
  "result": {
    "classification": {"value": "refund", "confidence": 0.72, "scale": "unit_interval"},
    "answer": {"text": "...", "citations": ["ev_17"]}
  },
  "meta": {
    "model_policy_version": "route-2026-07-21",
    "source": "primary",
    "degraded": false,
    "warnings": []
  }
}
```

业务字段与 Provider 细节要分开。`finish_reason=length`、供应商的 token 计数或思维链片段不能成为前端依赖的业务协议。需要保留调试信息时放入受访问控制的诊断对象，避免把不稳定、敏感或不应展示的字段泄露给普通客户端。

## 三、契约的六层：形状相同不等于语义相同

| 层 | 需要固定的内容 | 典型破坏 |
| --- | --- | --- |
| 传输层 | HTTP/SSE、事件 ID、编码、重放语义 | 改事件名、断开后无法续传 |
| 结构层 | 字段、类型、嵌套、必填性 | 将可选字段改成必填，数组改对象 |
| 语义层 | 枚举含义、置信度尺度、金额单位、时区 | 数值仍是 number，但含义变了 |
| 状态层 | `pending/running/completed/failed` 转移 | 提前完成、失败被伪装为成功 |
| 风险层 | 来源、是否降级、是否可自动执行、审批要求 | fallback 后仍标作可写操作 |
| 生命周期层 | 版本、弃用、兼容窗口、迁移方式 | 发布后直接删除旧字段 |

生产事故多数发生在语义、状态和风险层，恰恰是 JSON Schema 很难完整表达的部分。因此除了 schema 文件，还要维护字段字典、枚举表、样例、状态机、兼容性规则和 owner。

## 四、版本策略：何时可以兼容，何时必须新版本

建议将版本分为显式的 major/minor，并在每个响应或流开始事件中携带 `contract_version`。兼容性判断不能只看字段 diff：

| 改动 | 是否可在原 minor 内发布 | 推荐做法 |
| --- | --- | --- |
| 新增可选字段，默认语义无副作用 | 通常可以 | 文档化、灰度并观察未知字段 |
| 新增枚举值 | 取决于消费者是否有安全默认分支 | 先扩展消费者，再启用生产者 |
| 可选字段改必填 | 否 | 新 major 或新 endpoint |
| 字段重命名/删除 | 否 | 双写旧新字段，经历弃用期 |
| 单位、时间基准、置信度尺度改变 | 否，即使类型未变 | 新字段/新 major，显式标记语义 |
| 默认模型或 fallback 变化导致能力边界不同 | 不应静默视作兼容 | 在元数据暴露降级和能力标签，并重新验证 |

版本并不是为了让系统接受任意历史包袱。它的目的在于把“谁可以升级、谁还在使用旧协议、何时可下线”变成可观测决策。发布前先扫描 consumer registry 和流量中的版本分布，而不是假设所有客户端同步更新。

## 五、Provider adapter：把供应商差异挡在边界外

多模型系统里，主模型、备用模型和供应商 SDK 往往对 tool call、JSON mode、拒答、content filter、stream usage、停止原因有不同表达。adapter 的职责是：

1. 映射原始响应到 canonical status、错误码、usage 和 result；
2. 验证模型输出是否满足该路由所声明的 contract；
3. 对不支持的能力返回明确的 `capability_unavailable`，而不是模拟成功；
4. 标记 `source=primary/fallback`、`degraded=true` 和实际能力集；
5. 禁止供应商私有字段穿透到业务消费者。

以结构化工具结果为例，adapter 不应在原始 JSON 解析失败后“猜一猜字段”再告诉下游成功。它应输出受控失败：

```json
{
  "contract_version": "2.1",
  "status": "failed",
  "error": {
    "code": "OUTPUT_CONTRACT_INVALID",
    "retryable": true,
    "safe_message": "模型结果未满足本次任务的输出协议"
  },
  "meta": {"source": "fallback", "degraded": true}
}
```

这样工作流可以按错误分类选择一次受限重试、转保守模型、要求人工补充，或安全终止；不会把解析异常伪装成“空答案”。

## 六、流式输出的契约：token 之外还有状态和终结性

SSE/WebSocket 不应只传 `data: text fragment`。推荐使用显式、可重放的领域事件：

```text
run.started      request and contract metadata
content.delta    append-only visible text fragment
citation.upsert  cite / revise an evidence binding
artifact.ready   structured payload or downloadable artifact is ready
run.warning      degradation or policy warning
run.completed    terminal success with final checksum
run.failed       terminal failure with safe error code
```

每个事件要有 `event_id`、`run_id`、序号、`contract_version` 和可选的 `resume_token`。客户端根据事件 ID 去重、重连后从缺失序号续传；服务端不能在 `run.completed` 后继续发送语义有效的内容。若引用只在最终阶段可确认，UI 应显示“引用待核验”而不是把临时文本包装成已证实答案。

流式契约也需定义取消语义：用户关闭页面是停止展示、取消模型调用，还是保留后台产物？对于带工具、副作用或异步文档生成的 run，必须区分 `client_detached`、`cancel_requested`、`cancelled` 和 `completed_after_detach`。

## 七、消费者驱动测试：让真实依赖定义兼容性

仅由生产者维护 schema，容易忽略 UI、规则引擎、报表、移动端、Webhook 和数据管道的实际假设。建立 consumer-driven contract test：每个消费者提交自己依赖的最小样例与断言，生产者在改动时回放。

典型测试矩阵包括：

| 测试 | 验证点 |
| --- | --- |
| schema/codec test | 可解析、类型、默认值和未知字段策略 |
| semantic fixture | 单位、时间、枚举、空值、分母和证据含义 |
| streaming replay | 乱序、重复、断线恢复、终止事件和版本混流 |
| provider matrix | 主/备模型、不同 SDK、模型降级后的同一业务 contract |
| historical trace replay | 历史真实请求在候选版本下的解析、风险和质量回归 |
| negative / adversarial | 截断 JSON、超长文本、注入、无引用、冲突工具结果 |

黄金样例要包含“未知”“拒答”“权限不足”“被内容策略拦截”“工具超时”“部分成功”，而非只覆盖理想答案。消费者看到未知枚举时，应选择安全的 fallback UI 或拒绝处理，不能把它悄悄映射为“已完成”。

## 八、发布、灰度与回滚：必须同时管理生产者和消费者

安全的演进流程通常为：

```text
design contract -> add tolerant consumers -> dual-write / adapter support
  -> shadow validation -> canary producer -> observe -> promote
  -> deprecate old reads -> remove old writer / field
```

先升级消费者，再启用生产者的新值；对于无法做到双写的破坏性语义改动，走新 endpoint、新 event stream 或新 major。灰度要按会话/任务 sticky，避免同一个流或长任务中途切换版本。回滚时优先切换路由或 adapter manifest；若数据已持久化，必须准备 migration 的反向策略和旧消费者的读取能力。

所有一次请求固定 `contract_version`、模型/路由、Prompt、schema、策略和 adapter digest。否则当线上出现“某些回答没有引用”时，无法区分是模型、Prompt、适配器还是 UI 解析造成的。

## 九、观测与门禁：兼容性需要被量化

建议至少记录并按 `contract_version`、provider、tenant、消费者和任务类型分维度观察：

- schema validation failure、unknown field/enum、nullability violation；
- terminal state 完整率、流式重连/重放成功率、客户端解析失败率；
- fallback/degraded 比例及其输出契约通过率；
- 每个消费者的旧版本占比、弃用字段读取量；
- 语义断言失败，如币种/尺度/证据/审批标记不一致；
- 回滚时间、灰度前后质量/成本/风险门禁变化。

发布门禁不应只要求“新模型离线得分更高”。高风险工作流还要要求：所有必需消费者通过契约回放、主备模型均通过输出验证、降级路径不会扩大权限、关键 terminal event 和审计字段完整，且失败可以无损回滚。

## 十、系统设计题：设计一个多模型客服平台的响应兼容层

可以按以下框架回答：

1. **边界**：哪些消费者需要稳定接口，哪些字段属于展示、决策或副作用门禁；把模型原始响应与业务响应隔离。
2. **canonical model**：定义 versioned envelope、状态机、错误分类、风险/降级元数据、结果 schema 和字段字典。
3. **适配层**：每个 Provider/模型版本有 adapter，负责正常化、能力发现、输出验证和安全错误映射。
4. **流式协议**：领域事件 + ID/序号/重放 + 明确 terminal 状态，禁止 token 片段直接成为业务真相。
5. **演进机制**：consumer registry、兼容矩阵、先消费者后生产者、双写/灰度/弃用和可回滚 manifest。
6. **验证观测**：消费者驱动测试、模型矩阵、历史 trace 回放、实时解析失败和语义断言指标。

架构可以简化为：

```text
Clients / Workflows
       <- versioned business response or event stream
Contract Gateway -> Validator -> Policy enrichment -> Consumer registry
       <- canonical response/events
Provider adapters <- model gateway <- primary / fallback providers
       -> trace, contract metrics, replay corpus, release manifest
```

设计取舍是：适配层会增加一些代码与延迟，但它将供应商变动局限在边界，避免每个业务团队都直接适配多份 SDK。对核心接口而言，这个成本远小于一次静默语义变更造成的业务事故。

## 十一、高频追问

### Q1：新增字段为什么也可能是破坏性变更？

如果旧客户端使用严格反序列化、将所有字段做签名、把未知值直接展示，或新字段触发默认业务行为，新增就会出错。先调查消费者能力，必要时让客户端忽略未知字段或在新版本 endpoint 中发布；不能仅依据 JSON Schema 的“optional”判断安全。

### Q2：模型 fallback 后如何保证契约？

fallback 进入前要验证该模型具备所需能力，如 JSON/工具调用/流式；adapter 对结果执行相同的 canonical contract 校验。若不满足，返回带 `degraded` 的安全失败或降级到只读解释，不得把自由文本强行解析为可执行指令。主备都纳入同一套回放和灰度测试。

### Q3：流式响应如何兼容升级？

在 `run.started` 固定 `contract_version`，一个 run 生命周期内不混用版本。新事件先让客户端容忍或升级，再灰度生产者；事件带 ID、序号和 terminal 语义，重连时按游标恢复。事件 payload 的版本应独立于 HTTP API 版本管理。

### Q4：如何区分模型不确定、模型失败和系统失败？

用显式状态与错误码：`completed` 但 `answer.status=insufficient_evidence` 表示业务结果不确定；`failed/OUTPUT_CONTRACT_INVALID` 是模型/适配输出不合规；`failed/UPSTREAM_TIMEOUT` 是系统失败。三者的重试、UI 和审计路径不同，绝不能都返回空字符串。

### Q5：如何证明一次升级没有伤害旧消费者？

使用 consumer registry 找到依赖方，运行其契约样例、历史 trace 和流式回放；Shadow 记录新旧 canonical 输出 diff，Canary 监控按消费者划分的解析失败、未知枚举、业务门禁和投诉率。保留旧 adapter/manifest，直到旧版本流量和弃用字段读取下降到预设阈值。

## 十二、60 秒项目讲法

“我们没有让业务服务直接消费不同模型厂商的响应，而是在网关后建立 versioned canonical output contract。它除了 JSON schema，还定义状态机、错误分类、置信度尺度、单位、来源、降级和审批标签。每个 Provider adapter 负责将原始响应归一化并做输出验证，fallback 不满足约束就返回安全失败而非自由文本。对于流式接口，我们用带序号、重放和 terminal 语义的领域事件，并在 run 开始时固定 contract version。发布时先让消费者支持新版本，再双写、影子回放和小流量灰度；用客户端解析失败、未知枚举、语义断言和旧版本流量监控弃用过程。这样模型切换或 Prompt 迭代不会静默破坏前端、工作流和高风险决策。”

这比“我们用了 JSON mode”更能体现你理解模型系统与传统分布式接口之间的真实连接点。
