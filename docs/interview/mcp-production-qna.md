# MCP Server 生产化与企业治理高频问答

> 需要把 scoped token、身份委托、确认令牌、凭证撤销和后端二次鉴权连成完整回答时，见 [企业 Tool Gateway 安全执行系统设计面试题](/interview/tool-gateway-security-design)。

> 如果问题从“用户怎样把 Slack、GitHub、CRM 或 Google Workspace 连接给 Agent”开始，需要解释 OAuth 同意、刷新、断连与审计控制面，见 [Agent 外部连接与 OAuth 凭证生命周期](/interview/agent-connector-identity-lifecycle-playbook)。

> MCP 面试不要只背 Host / Client / Server 和 tools/resources/prompts。真正能拉开差距的是：公司内部要开放一批 MCP Server，如何做权限、版本、审计、资源边界、工具注册、灰度、下线和安全评估。协议细节见 [MCP 协议深入](/agent/mcp)，工具执行边界见 [Agent 工具安全与权限边界](/agent/tool-safety)，跨模型外发、凭据和审计证据见 [LLM 数据分级、外发治理与审计证据面试题](/interview/data-governance-egress-audit-qna)，资产台账、组件签名、策略即代码和紧急冻结见 [企业 AI 安全、合规与审计控制面系统设计面试题](/interview/enterprise-ai-governance-audit-system-design)。

## 怎么用这页

遇到 MCP 生产化问题，可以按这条线回答：

1. **定位**：MCP 解决工具和数据源的标准化接入，把 M×N 集成变成 M+N。
2. **分层**：Host 管用户体验和策略，Client 管连接，Server 管能力实现和资源访问。
3. **边界**：Server 不能信任模型输出，也不能把内部系统变成万能后门。
4. **治理**：owner、schema 版本、权限、审计、SLA、灰度、下线、评估集。
5. **安全**：第三方 Server、间接注入、凭证泄露、过度授权、高危写操作都要有系统边界。

可复述版本：

> 我会把 MCP Server 当作生产 API 来治理，而不是给模型随便开的插件。每个 Server 都要有 owner、版本、权限域、风险等级、审计日志和下线流程；Tools、Resources、Prompts 要分开授权；写工具必须服务端鉴权、参数校验、幂等和人审。

## 追问链一：MCP 和 Function Calling 到底什么关系

**面试官：MCP 和 Function Calling 是一回事吗？**

标准答法：

> 不是。Function Calling 是模型层能力，解决“模型如何表达我要调用哪个函数和参数”；MCP 是应用集成层协议，解决“工具和数据源如何被统一发现、描述、连接、调用和复用”。MCP Server 暴露工具后，Host 仍然可能用模型的 Function Calling 能力让模型选择工具。

| 维度 | Function Calling | MCP |
| --- | --- | --- |
| 层次 | 模型 API / 输出格式 | 应用与工具集成协议 |
| 解决问题 | 模型怎么表达调用意图 | 工具怎么标准化暴露和复用 |
| 关注点 | schema、参数、结构化输出 | Host/Client/Server、生命周期、传输、能力发现 |
| 治理对象 | 单个应用内的工具定义 | 跨应用复用的一组 Server |

一句话：

> FC 是“模型会点菜”，MCP 是“菜单、厨房和上菜通道标准化”。

## 追问链二：企业内部 MCP Server 怎么分层

**面试官：让你把公司内部系统接入 Agent，你怎么设计 MCP Server 平台？**

标准答法：

> 我会按 Host、Client、Server、治理平台四层设计。Host 负责用户身份、策略和模型编排；Client 负责协议连接和能力发现；Server 封装具体业务系统；治理平台负责注册、权限、审计、版本、评估和成本。

```text
AI Host / Agent Platform
  -> MCP Client Manager
  -> MCP Registry / Policy Center
  -> MCP Server: CRM / Ticket / Document / Git / Database
  -> Internal Systems
  -> Trace / Audit / Eval / Cost
```

| 层 | 职责 |
| --- | --- |
| Host | 用户会话、模型调用、工具可见集、HITL、trace |
| Client Manager | 连接管理、initialize、tools/list、resources/read、错误归一 |
| Registry | Server 元数据、owner、版本、风险等级、灰度状态 |
| Policy Center | 用户/租户/角色/资源授权，工具风险策略 |
| Server | 真正访问业务系统，做参数校验、鉴权、审计 |
| Observability | tool trace、latency、error、cost、bad case |

反面回答：

> “写几个 MCP Server 给 Agent 连上就行”太浅。企业场景一定要讲注册、授权、审计、版本和下线。

## 追问链三：Tools / Resources / Prompts 怎么授权

**面试官：MCP 三大原语在生产里怎么做权限？**

标准答法：

> Tools、Resources、Prompts 的风险不同，授权方式也不同。Tools 可能有副作用，要按动作授权；Resources 是数据读取，要按资源和字段授权；Prompts 是模板，要按角色和场景授权。

| 原语 | 风险 | 授权重点 |
| --- | --- | --- |
| Tools | 读写业务系统、产生副作用 | action、resource、risk_level、approval |
| Resources | 读取文件、文档、数据库结果 | tenant、role、path、field、row ACL |
| Prompts | 引导模型执行特定流程 | role、scenario、prompt_version |

**继续追问：Resources 是只读的，为什么也危险？**

回答要点：

- 只读也可能泄露跨租户数据、PII、源代码、财务文档。
- `resources/read` 需要路径、租户、角色、字段级控制。
- 资源返回也可能包含间接 Prompt Injection。
- 大资源要分页、摘要、引用，不把全量敏感内容塞给模型。

可复述：

> Resources 无副作用不等于无风险。读错数据就是数据泄露，读到恶意文档还可能诱导 Agent 调用危险工具。

## 追问链四：MCP Server 能不能信任 Host 传来的身份

**面试官：MCP Server 能不能信任 Host 传来的 user_id 和权限范围？**

标准答法：

> 不能盲信。Server 可以接收 Host 传来的身份上下文，但必须验证来源、签名、token、scope 和租户边界。企业内部最好让 Host 通过统一身份体系换取短期访问 token，Server 侧再做二次授权。

推荐做法：

- Host 接企业 SSO / IAM，得到用户身份。
- Host 请求 MCP Gateway 或授权服务，换短期 scoped token。
- MCP Server 校验 token 签名、audience、scope、tenant、过期时间。
- Server 按业务资源做最终 ACL 判断。
- 高危动作还要 approval_id。

反例：

> 让模型把 `user_id=admin` 放进工具参数里，Server 直接信，这是典型越权漏洞。

## 追问链五：Tool Schema 和版本怎么治理

**面试官：MCP 工具 schema 升级怎么避免破坏旧 Agent？**

标准答法：

> 工具 schema 要版本化。兼容性新增字段可以保持同名工具；破坏性变更要新工具名或新版本，并保留兼容期。Registry 里记录 schema_version、owner、deprecation、灰度范围和评估集。

版本策略：

| 变更 | 策略 |
| --- | --- |
| 新增可选参数 | 保持兼容，更新 description 和示例 |
| 新增必填参数 | 新版本工具或设置默认值 |
| 参数语义变化 | 新工具名 / 新 schema version |
| 返回结构变化 | 兼容旧字段，逐步迁移 |
| 工具下线 | 先从可见工具集移除，再保留兼容期 |

必备元数据：

- `tool_name`
- `schema_version`
- `owner`
- `risk_level`
- `read_write_type`
- `required_scopes`
- `deprecation_date`
- `eval_cases`

一句话：

> 工具 schema 是 Agent 的 API 合约，不是 prompt 文案。API 怎么做版本治理，MCP 工具也要怎么做。

当追问升级的兼容性判定、canonical contract、provider adapter、consumer-driven test、trace replay、shadow/canary 和弃用流程时，见 [Agent Tool Contract 工程：Schema 演进、兼容性与验证](/interview/agent-tool-contract-evolution-playbook)。

## 追问链六：第三方 MCP Server 怎么接入

**面试官：团队想直接接一个社区 MCP Server，你怎么评审？**

标准答法：

> 我会把第三方 MCP Server 当供应链组件评审：来源可信度、代码审计、权限范围、凭证管理、网络访问、工具描述、依赖漏洞、运行沙箱和审计能力都要检查。默认不给生产高权限。

评审清单：

| 检查项 | 关注点 |
| --- | --- |
| 来源 | 官方/社区/个人维护，是否活跃，是否有安全记录 |
| 权限 | 需要哪些文件、网络、API key、数据库权限 |
| 工具描述 | description 是否夹带指令注入或误导性描述 |
| 凭证 | 是否把 key 暴露给模型上下文或日志 |
| 沙箱 | stdio 本地进程是否限制目录、网络、环境变量 |
| 依赖 | 依赖包是否有漏洞或恶意风险 |
| 审计 | 是否能记录调用人、参数摘要、结果和错误码 |

可复述：

> 第三方 Server 不是“装上就用”。它能访问的资源，模型就可能间接触达，所以要最小权限、沙箱、来源审计和灰度。

## 追问链七：MCP 的错误处理和降级

**面试官：MCP Server 不可用或工具失败，Agent 怎么恢复？**

标准答法：

> Client 层要把错误结构化返回给 Host，区分 retryable 和 non-retryable。网络超时可有限重试，权限错误不重试，参数错误可让模型修复一次，业务冲突要刷新状态或转人工，高危写操作失败要查外部状态。

错误结构建议：

```json
{
  "ok": false,
  "error_code": "permission_denied",
  "retryable": false,
  "message": "current user cannot read this resource",
  "safe_next_actions": ["ask_user_to_request_access", "use_public_summary"]
}
```

| 错误 | 恢复策略 |
| --- | --- |
| timeout | 指数退避、熔断、降级到缓存 |
| permission_denied | 不重试，提示权限不足或申请审批 |
| invalid_arguments | 修正参数一次，仍失败则追问用户 |
| rate_limited | 排队、降级、换 Server |
| external_conflict | 查询业务状态，转人工或补偿 |
| injection_detected | 隔离结果，不允许触发写工具 |

## 追问链八：stdio 和 Streamable HTTP 怎么选

**面试官：stdio MCP Server 和远程 HTTP MCP Server 在生产里怎么取舍？**

标准答法：

> stdio 适合本地工具和 IDE 场景，Host 启动本地子进程，延迟低、权限可按本机目录隔离；Streamable HTTP 适合企业远程服务，便于统一鉴权、限流、审计、弹性伸缩和多 Host 复用。生产里常见是本地敏感上下文用 stdio，企业共享能力走 HTTP + Gateway。

| 维度 | stdio | Streamable HTTP |
| --- | --- | --- |
| 部署 | Host 本地子进程 | 远程服务 / 网关 |
| 适合 | IDE、本地文件、开发者工具 | 企业共享系统、SaaS、跨团队复用 |
| 优点 | 低延迟、无网络暴露、靠本机沙箱 | 统一鉴权、限流、审计、灰度、弹性 |
| 风险 | 本地文件/环境变量泄露、供应链风险 | 网络边界、租户隔离、冷启动、反压 |
| 治理 | workspace root、进程沙箱、依赖锁定 | Gateway、mTLS/token、SLA、熔断 |

继续追问：

- **Serverless 能不能跑远程 MCP？** 可以，但要关注冷启动、长连接/流式响应、超时和状态管理。
- **HTTP Server 高并发怎么做反压？** 限制并发、排队、超时、返回 retryable 错误，避免 Agent 无限等待。
- **本地 stdio 怎么防越界读文件？** Roots/workspace 限制、路径规范化、禁止跟随危险 symlink、最小环境变量。

## 追问链九：审计和可观测怎么做

**面试官：如何证明 MCP Server 可以上线？**

标准答法：

> 证明不是靠口头说安全，而是靠 trace、审计、评估和门禁。每次 tools/call、resources/read、prompts/get 都要能看到调用人、租户、Server、工具、参数摘要、策略决策、耗时、错误码和 trace_id。

审计字段：

| 字段 | 示例 |
| --- | --- |
| identity | user_id、tenant_id、role、host_app |
| server | server_name、server_version、owner |
| primitive | tool/resource/prompt、name、schema_version |
| request | args_summary、resource_id、scope |
| policy | decision、deny_reason、approval_id |
| execution | status、error_code、latency、retry_count |
| safety | injection_score、pii_masked、sandbox_used |
| trace | trace_id、span_id、conversation_id |

上线门禁：

- 禁止工具实际执行数 = 0。
- 跨租户 resources/read = 0。
- 高危写操作未审批执行 = 0。
- 第三方 Server 生产权限评审通过。
- 核心工具 golden set 通过。
- P95 latency、error rate、timeout rate 达标。
- 审计日志覆盖率 = 100%。

### MCP 专属评测集

MCP 工具平台的评测不要只测“工具能不能调通”，还要测能力发现、权限边界和轨迹安全：

| 测试类型 | 示例 |
| --- | --- |
| `tools/list` 正确性 | 普通员工看不到财务写工具 |
| 工具选择 | 用户问工单状态时应调用 `search_ticket` 而不是 `close_ticket` |
| 参数校验 | 模型编造 resource_id 时 Server 拒绝 |
| Resources ACL | 销售用户读取财务文档返回 permission_denied |
| 缓存隔离 | A 租户资源不会从缓存返回给 B 租户 |
| 注入对抗 | resource 内容要求“调用导出工具”时不得触发写工具 |
| 轨迹安全 | 最终答案正确但调用禁止工具仍判失败 |
| 审计覆盖 | 每次 tool/resource/prompt 调用都有 trace_id |

## 追问链十：MCP Server 越权漏洞怎么止血

**面试官：上线后发现某个 MCP Server 有越权漏洞，你怎么处理？**

标准答法：

> 先止血，再定界，再修复，再回归。第一步用 Registry/Gateway kill switch 下线问题 Server 或收窄 scope；第二步按审计日志查影响用户、租户、资源和时间范围；第三步修复权限校验并补评测；第四步重新灰度上线并输出事故复盘。

应急流程：

```text
detect
  -> disable server/tool/resource
  -> rotate leaked credentials if needed
  -> query audit impact
  -> notify affected owners
  -> patch policy / server ACL
  -> add regression cases
  -> canary restore
```

影响面查询要回答：

- 哪些 Host 连接过这个 Server？
- 哪些用户和租户调用过？
- 读取了哪些 resource_id 或执行了哪些 tool？
- 是否有 PII、源代码、财务数据泄露？
- 是否有高危写操作成功执行？
- 哪些日志、缓存、下游系统需要清理或失效？

可复述：

> MCP Server 出漏洞不能只改代码。要依赖 Registry、Gateway、审计和评估集形成闭环，否则既不能快速止血，也无法证明影响面。

## 系统设计题：企业 MCP 工具平台

题目：

> 设计一个企业内部 MCP 工具平台，让多个 Agent/IDE/助手安全复用公司 CRM、工单、知识库、Git、数据库等能力。

### 需求澄清

- Server 是本地 stdio、远程 HTTP，还是两者都有？
- 接哪些系统？只读还是有写操作？
- 是否多租户、多部门、多角色？
- 是否允许第三方 Server？
- 是否需要离线审计、成本统计、SLA 和下线流程？

### 架构答法

```text
Agent / IDE / Assistant Host
  -> MCP Client Manager
  -> MCP Registry
  -> Policy / IAM / Approval
  -> MCP Gateway
  -> MCP Servers
      -> CRM / Ticket / Docs / Git / DB
  -> Trace / Audit / Eval
```

### 核心模块

| 模块 | 职责 |
| --- | --- |
| Registry | 注册 Server、tools/resources/prompts、owner、版本、风险 |
| Client Manager | initialize、能力发现、连接复用、错误归一 |
| Policy Engine | 根据用户、租户、角色、场景裁剪能力 |
| MCP Gateway | 远程 Server 的统一入口、限流、鉴权、审计 |
| Sandbox | 本地 stdio Server 的文件、网络、环境变量隔离 |
| Eval Platform | 工具选择、参数、权限、安全、回归测试 |

### MCP Gateway 的边界

远程 MCP Server 一多，企业里通常会加一层 MCP Gateway。它不是业务逻辑层，而是治理入口：

| 能力 | 做什么 |
| --- | --- |
| 统一鉴权 | 校验 Host 身份、短期 token、scope、tenant、audience |
| 限流隔离 | 按租户、Host、Server、tool 做 RPM/并发/成本限制 |
| 审计采集 | 统一记录 tools/call、resources/read、prompts/get |
| 网络边界 | 把内部 Server 暴露在受控入口，不让 Host 直连内网 |
| 灰度路由 | 按用户组、Server 版本、工具版本切流 |
| Kill Switch | 某个 Server 越权或异常时立即下线能力 |

面试表达：

> MCP Gateway 不是为了替代 Server 业务鉴权，而是统一做入口治理。真正的资源权限仍然要在 Server 和业务系统侧二次校验。

### 主链路

1. 用户进入 Host，Host 获取身份和租户上下文。
2. Client Manager 连接允许的 MCP Server，完成 initialize。
3. Registry 返回可见 tools/resources/prompts。
4. Policy Engine 按本次请求裁剪能力。
5. 模型提出 tool call 或 Host 读取 resource。
6. Server 二次鉴权、参数校验、执行、审计。
7. 结果最小化返回 Host，作为不可信数据进入上下文。

### Server 生命周期治理

公司里如果有 20 个内部系统都想开放 MCP Server，必须把 Server 当平台资产治理：

```text
proposal -> security review -> sandbox trial -> canary -> production
  -> version upgrade -> deprecation -> removal
```

| 阶段 | 门禁 |
| --- | --- |
| 注册 | owner、代码仓库、数据域、风险等级、SLA、联系人 |
| 安全评审 | 权限范围、凭证管理、依赖漏洞、工具描述注入、沙箱策略 |
| 灰度 | 小范围 Host / 用户组可见，观察错误率、越权拒绝、成本 |
| 发布 | schema version、评估集、审计字段、回滚方案齐全 |
| 下线 | 先从可见工具集移除，再保留兼容期，最后删除实现 |
| 事故 | kill switch、影响面查询、审计导出、复盘和补评测 |

### 可靠性与安全

- Server 不可用时结构化错误和熔断。
- 高危工具 fail closed。
- resources/read 做 ACL 和字段脱敏。
- 工具结果做注入检测和最小化。
- schema 版本化，破坏性变更灰度。
- 第三方 Server 沙箱和供应链审查。

## 项目讲法模板

### 企业知识库 MCP Server

> 我会把企业知识库封装成 MCP Server，但不是简单暴露全文搜索。Resources 用来读取用户有权限的文档片段，Tools 用来执行语义检索和引用查询。Server 侧接 IAM 做 ACL，chunk 继承文档权限，返回结果只给标题、摘要、引用 ID 和必要片段。所有 resources/read 记录用户、文档 ID、租户和 trace_id，防止跨部门泄露。

### 工单系统 MCP Server

> 工单系统里查询工单是只读 tool，创建/关闭/转派工单是写 tool。写 tool 先 prepare，返回待执行动作和影响范围；确认后 commit，带 approval_id 和 idempotency_key。Server 不信任模型传入的 owner 或 priority，必须按当前用户权限和业务规则校验。

### Coding Agent MCP Server

> Coding Agent 可以通过 MCP 接 Git、Issue、CI 和文档系统。只读资源包括当前文件、issue、测试日志；写操作如提交 PR、修改分支、触发部署要走策略和确认。第三方 Server 必须限制 workspace root 和网络访问，避免读取仓库外文件或泄露凭证。

## 反面回答清单

面试里尽量别这样说：

- “MCP 就是 Function Calling。”层次混了。
- “Server 信任 Host 传来的 user_id。”少了 token、scope 和二次鉴权。
- “Resources 只读所以安全。”只读也会泄露数据或携带注入。
- “社区 MCP Server 装上就用。”忽略供应链和权限风险。
- “工具 schema 改了让模型适应。”schema 是 API 合约，要版本治理。
- “出错就让模型重试。”权限错、高危写失败、注入命中都不能盲目重试。

## 面试前 5 分钟速记

- MCP 定位：工具/数据源标准接入协议，不是模型能力本身。
- 三原语：Tools 模型驱动，Resources 应用驱动，Prompts 用户驱动。
- 生产六件套：Registry、Policy、Gateway、Sandbox、Audit、Eval。
- 权限原则：Host 传身份，Server 做二次鉴权。
- 资源原则：只读也要 ACL、脱敏、分页、注入防护。
- 工具原则：schema 版本化，高危写操作 prepare/commit。
- 第三方原则：来源审查、最小权限、沙箱、灰度。
- 上线门禁：越权 0、未审批写 0、审计覆盖 100%。

## 延伸阅读

- [MCP 协议深入](/agent/mcp)
- [Function Calling 与 MCP](/agent/function-calling-mcp)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [框架与智能工作流高频问答](/interview/framework-workflow-qna)
- [分岗位面试真题](/interview/real-questions)
