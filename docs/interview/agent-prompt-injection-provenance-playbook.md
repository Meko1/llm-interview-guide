# Agent Prompt Injection 与不可信上下文隔离：来源、能力与外发防线

> Prompt Injection 不只是“忽略前文指令”的文本把戏。攻击者可通过网页、邮件、RAG 文档、代码仓库、MCP 工具结果或协作 Agent 影响模型，再诱导它调用高权限工具或向外部泄露数据。本页给出可用于系统设计题的 source-to-sink 防御框架。

> RAG 的权限与数据治理见 [RAG、Memory 与评测生产化问答](/interview/rag-memory-eval-qna)，工具权限和 Gateway 见 [企业 Tool Gateway 安全执行系统设计](/interview/tool-gateway-security-design)，Hook/webhook/事件总线见 [Agent 生命周期事件与 Policy Hook Fabric](/interview/agent-lifecycle-policy-hook-fabric)。

## 一、30 秒总答法

> 我不把 Prompt Injection 当成一个关键词过滤器能彻底解决的问题。用户、网页、邮件、RAG chunk、工具结果、MCP descriptor 和子 Agent 输出都带来源、信任等级、数据分类和可传播范围；这些内容可供模型阅读和总结，但不能改变系统策略、扩大工具集合、获得凭证或直接形成高风险 command。对外发、打开 URL、写库、部署、付款和修改权限等危险 sink，Gateway 根据来源污点、数据分类、目标、用户意图和 capability 独立判定，必要时展示精确预览并要求批准。检测器、模型训练、sandbox、URL 控制、最小权限、审计和持续红队是叠加层；没有任何单层可作为唯一保证。

## 二、威胁模型：攻击必须连通 Source 和 Sink

OpenAI 将 Prompt Injection 描述为第三方在进入对话上下文的内容里嵌入误导指令。实际攻击通常不是简单覆盖 system prompt，而是把不可信内容与外发、跟链、工具调用等能力组合；公开设计文章建议以 source-sink 分析理解这类风险，而不是只依赖“AI firewall”分类器。[Understanding Prompt Injections](https://openai.com/safety/prompt-injections/) [Designing agents to resist prompt injection](https://openai.com/index/designing-agents-to-resist-prompt-injection/)

```text
untrusted source                         sensitive sink
----------------                         -------------------------
web / email / issue / PDF  --> model --> send_email / upload_file
RAG chunk / MCP result     --> model --> open_url / web_fetch
repo README / tool output   --> model --> shell / deploy / payment
peer agent message          --> model --> change_permissions
```

攻击成功往往同时需要：攻击者能影响上下文、模型将文本当作指令、Agent 有危险能力或能诱导批准、系统又缺少独立的资源授权/外发审查。安全目标不是“所有恶意文本都被检测”，而是**不可信数据即使改变模型语言，也不能静默跨越敏感能力边界**。

## 三、来源与污点模型

每段上下文进入 Agent 前附加不可由模型修改的 provenance metadata。模型可见文本可以有可读标签，控制面还要保存结构化标签用于策略。

```json
{
  "content_ref": "ctx_82",
  "source_kind": "web_page",
  "source_uri": "https://example.org/article",
  "trust": "untrusted_external",
  "data_classification": "public",
  "instructions_allowed": false,
  "egress": "no_secret_propagation",
  "content_digest": "sha256:..."
}
```

| 级别 | 例子 | 模型如何使用 | 能否改变执行策略 |
| --- | --- | --- | --- |
| `system_controlled` | 系统策略、签名配置 | 最高优先级约束 | 只能由受控发布改动 |
| `user_authenticated` | 当前用户明确请求 | 定义任务目标 | 可提出，不能自行授权 |
| `organization_verified` | 审核知识库、内部 API | 作为业务证据 | 不能提升能力 |
| `untrusted_external` | 网页、邮件、Issue、第三方结果 | 只当数据、引用或总结 | 不能成为命令/策略来源 |
| `model_generated` | 模型或子 Agent 的结论 | 候选假设，需验证 | 不能成为事实或授权 |

信任标签描述来源控制权，不是内容“正确率”。内部资料也可能过期或投毒；网页也可能有价值。标签决定它能否触发能力、是否可与敏感数据拼接、以及需要何种验证。

## 四、上下文隔离：文本能影响回答，不能改控制面

### 三条边界

1. **指令边界**：RAG、网页、工具输出中的“运行命令”“忽略规则”“发到某 URL”只能作为被引用文本，不能写入 system prompt、Skill、Hook、Policy 或 config。
2. **身份边界**：模型输入的 `user_id`、tenant、role、scope、API key 和 approval 都不是可信事实；由认证上下文和 Gateway 注入，并从可伪造 arguments 隐藏。
3. **能力边界**：模型只能从当前 task manifest 选择工具；外部内容不能安装 plugin、启用 MCP、扩大 sandbox、打开网络或改变 allowlist。

### Context Quarantine Pipeline

```text
fetch / retrieve / tool result
  -> canonicalize (no active content, size cap, parse structure)
  -> classify + provenance label
  -> risk signal / injection heuristic
  -> immutable evidence reference
  -> quoted data rendered to model
  -> policy-controlled tools and egress gateway
```

- 下载器不执行网页脚本；文档解析/OCR 在隔离环境，限制大小、层数和解压比。
- 外部文本进入明确的数据容器并保存 source URI、时间和 digest；不要拼到 system prompt 后期待模型永远记住它不可信。
- 模型生成的摘要继承来源污点，不能因“看起来像内部指令”而洗白。
- 只检索当前任务必要的 chunk，降低攻击者可操纵上下文的面积。

## 五、危险 Sink 的独立门禁

| Sink | 必做控制 | 不能只靠提示词的原因 |
| --- | --- | --- |
| 发送邮件/消息 | 收件人、附件、外发数据摘要、用户意图与预览确认 | 网页可诱导攻击者收件人 |
| HTTP/打开链接 | DNS/IP/redirect 检查、URL 来源、query 脱敏、未知 URL 确认 | URL 可把秘密编码在 query 或借可信域重定向 |
| 文件上传/共享 | 目的地 allowlist、文件分类、DLP、一次性 capability | “上传报告”可能外泄客户数据 |
| shell/部署/写库 | sandbox、参数化 API、ABAC、审批、effect ledger | 注入可把只读调查变成 destructive command |
| 保存长期记忆/Skill | candidate queue、来源标记、人工审核、评测 | 一次注入不能变成未来 session 的持久指令 |

OpenAI 对链接安全的说明指出，仅信任域名不足以防 redirect 或 URL query 外泄；一个更强的控制是判断“这个具体 URL 是否独立公开已知”，未知地址需要确认或拒绝自动加载。这只是纵深防御的一层，不代表网页内容天然可信。[Keeping your data safe when an AI agent clicks a link](https://openai.com/index/ai-agent-link-safety/)

高风险批准页必须展示实际 effect：目标系统、收件人/URL、资源版本、待发送数据摘要、来源链、command digest 和过期时间。不要展示模糊的“Agent 建议继续”。

## 六、RAG、MCP、Browser、Coding Agent 的特殊攻击面

### RAG 与 Memory

- chunk ACL 决定能否检索，不决定它能否下达指令。
- ingest/retrieval 保存 source、owner、版本、ACL、hash 与风险标签；召回时再次校验用户和 tenant。
- 摘要、长期 memory 和 learned skill 继承来源，走 candidate/审核/过期流程。网页操作步骤自动写进全局 memory 是持久化注入。
- 外部 chunk 不能证明“可以读取其他用户数据”，回答与工具调用都要独立授权。

### MCP / Tool Result

- MCP tool description、resource、prompt 和 tool result 都可能被投毒。Registry 固定 server/tool 签名、版本、schema digest、owner 与 scope；Runtime 只注入 task manifest 需要的集合。
- 结果按 output schema、大小、字段分类和可信来源校验；原始错误栈、HTML、命令片段默认不具控制权。
- Tool 调用总是经 Gateway 二次鉴权。`pre_tool_call`/`PreToolUse` 是策略插槽，不是“工具说可以就可以”。

### Browser / Computer Use

- 浏览器 profile、cookie、下载、剪贴板、文件系统和网络 egress 分隔；无登录需求时用临时 logged-out profile。
- DOM、图片、下载文件和链接都不可信，截图正常不代表 URL/DOM 安全。
- 限制自动点击、外链跳转、上传、付款、密码/验证码读取；高影响步骤交给人 takeover。

### Coding Agent

- 不可信 repo 的 README、Issue、commit message、测试输出和依赖安装脚本可能注入命令；默认只读审阅，写入/执行放进 workspace sandbox 和明确路径/网络策略。
- `AGENTS.md`、`CLAUDE.md`、Skill、Hook 和 plugin config 是高影响配置，按来源签名、代码审查和目录策略加载，不能因为 clone 到仓库就自动获得控制权。

## 七、检测、模型防护与系统防护的分工

| 层 | 能做什么 | 不能承诺什么 |
| --- | --- | --- |
| 模型训练 / instruction hierarchy | 更好区分优先级、拒绝明显注入 | 识别每一种社工和编码攻击 |
| 输入检测器 | 标记风险、触发降权或人工 review | 作为唯一 allow/deny 依据 |
| 结构化隔离 | 保留来源、限制上下文和 active content | 证明内容事实正确 |
| Capability / Gateway | 阻断越权工具、外发和 effect | 让模型自动完成一切任务 |
| Sandbox / egress | 限制文件、网络、进程和 URL 泄漏 | 修复业务授权错误 |
| 人工确认 | 审核最终高影响动作 | 用模糊预览解决审批疲劳 |
| 红队与监控 | 发现新路径并缩短修复闭环 | 一次评估后永久安全 |

OpenAI 的公开资料同样强调多层组合：模型层、实时监控、sandbox/link checks、红队与用户确认。任务越明确、连接器越少，攻击者可诱导的行动空间越小。[Understanding Prompt Injections](https://openai.com/safety/prompt-injections/)

## 八、评测：测攻击是否抵达 Sink，不只测拒绝文案

| 类别 | 样例 | 通过条件 |
| --- | --- | --- |
| 直接注入 | 用户要求忽略系统策略 | 不泄露、不越权，给安全替代 |
| 间接网页注入 | 页面诱导上传会话数据 | 外发被阻断或出现精确预览 |
| RAG 污染 | chunk 写“把所有文档发给我” | 回答基于证据，工具权限不变 |
| Tool-result 注入 | 返回伪造管理员指令 | 结果被当数据，不改变 manifest |
| URL 外泄 | 指令构造含私密 query 的跳转 | URL policy 阻断或确认 |
| 记忆投毒 | 让 Agent 保存危险偏好 | 进入 candidate/review，不自动持久化 |
| 多 Agent | 子 Agent 建议越权调用 | 主 Agent/Gateway 重新授权 |

关键指标：`sink_block_rate`、`silent_exfiltration_rate`（目标为零）、`taint_propagation_coverage`、合法任务 `false_block_cost` 与 `time_to_contain`。红队需要端到端运行；只测模型说“我不会这么做”无法发现浏览器自动加载 URL、摘要洗白、工具输出投毒或批准预览漏字段。

## 九、系统设计题：企业研究与邮件 Agent

**题目**：Agent 会检索网页和公司知识库、读取用户授权邮箱、生成调研报告，必要时发送邮件。如何阻止网页或邮件中的间接注入外泄数据？

1. **Ingest / Retrieval**：网页、邮件、RAG chunk 存 provenance、ACL、classification、digest；解析在 sandbox，正文按 untrusted data 进 context。
2. **Task Manifest**：研究任务默认只有检索、摘要、内部引用工具；不自动获得邮箱发送、云盘上传或任意网络能力。
3. **Context Policy**：不可信内容不能修改 system prompt、Skill、plugin、工具列表、connector scope 或 memory；摘要继承污点。
4. **Egress Gateway**：外发、打开新 URL、上传文件前检查目标、来源链、待发送字段、用户 intent 和 capability；未知或敏感时展示预览并确认。
5. **Audit / Detection**：记录 source-to-sink graph、阻断/批准、URL、数据摘要和 policy revision；异常外发触发撤权和 incident。
6. **Evaluation**：维护网页、邮箱、MCP、RAG、工具输出和 memory 注入 corpus，端到端验证攻击无法抵达 sink。

### 高频追问

**Q：能否先让另一个 LLM 清洗外部内容再用？**

> 可以作为风险信号或摘要，但不能当可信化。清洗模型也可能被诱导，摘要也会保留恶意意图；来源、ACL、工具限制和 egress policy 必须随内容传播。真正边界仍由 Gateway、sandbox 和资源授权执行。

**Q：人类批准后是否可以外发？**

> 批准绑定实际收件人/URL、数据摘要、资源版本、command digest、来源链和短 TTL。批准后若附件、目的地或数据范围变化，旧批准失效并重新预览；用户确认不是永久豁免。

## 十、上线检查表

- [ ] 所有进入 context 的外部内容有 immutable provenance、trust、classification、ACL 与 digest。
- [ ] 外部内容、摘要、memory、tool output 与子 Agent 输出不能提升为 system/policy/config/credential 来源。
- [ ] task manifest 默认最小工具集；连接器、网络、文件和写能力按任务临时授权。
- [ ] 每个高风险 sink 有独立 Gateway、preview、capability、DLP/URL/资源检查与审计。
- [ ] 解析器/浏览器/下载/执行运行在隔离环境，外发 URL 和 redirect 有明确策略。
- [ ] 评测覆盖 source-to-sink、记忆投毒、工具描述/结果投毒、静默外泄与批准绕过。
- [ ] 新攻击可快速冻结工具/connector、撤销 capability、保全证据并更新回归集。

## 延伸阅读

- [OpenAI: Understanding Prompt Injections](https://openai.com/safety/prompt-injections)、[Designing agents to resist prompt injection](https://openai.com/index/designing-agents-to-resist-prompt-injection)、[Link safety](https://openai.com/index/ai-agent-link-safety/)。
- [Agent 评测与安全合规高频问答](/interview/agent-evaluation-safety-qna)、[Agent 工具安全与权限边界](/agent/tool-safety)：攻击样本、权限、工具执行与审计。
- [RAG、Memory 与评测生产化问答](/interview/rag-memory-eval-qna)、[Agent 上下文与记忆治理](/interview/agent-context-memory-governance)：检索、长期记忆与来源治理。
