# ITSM / SRE 事故响应 Copilot：从告警噪声到可审计恢复闭环

事故响应是大模型特别有价值、也特别容易造成二次事故的应用场景。值班工程师面对的是告警风暴、变更记录、日志、Trace、指标、拓扑、Runbook、工单和跨团队聊天；AI 可以快速汇总证据、关联症状、草拟沟通和提出排查假设，但它也可能把相关性说成根因、泄露密钥、执行过期 Runbook，或在没有审批时重启关键服务。

因此事故 Copilot 的目标不是“自动修复一切”，而是让人更快建立共享事实、减少重复检索、把变更控制和复盘工件做完整。本文的对象是业务服务和基础设施事故处理工作台；Agent 自身的 telemetry 与证据采集见 [Agent 观测、取证与事故响应手册](/interview/agent-observability-incident-response)，单个 LLM 应用如何排障见 [大模型应用线上排障手册](/interview/application-troubleshooting-playbook)。

## 一、先限定自治等级：建议、准备、执行不是同一件事

| 等级 | Copilot 能做什么 | 例子 | 必须的控制 |
| --- | --- | --- |
| L0 观察 | 汇总告警、检索 Runbook、提取时间线 | “5 分钟内有哪些异常？” | 证据链接和数据脱敏 |
| L1 建议 | 提出假设、生成查询、草拟状态更新 | “检查近期发布与依赖超时” | 人工验证、置信与限制声明 |
| L2 准备 | 预填工单、生成变更计划、构造只读查询 | 创建 Mitigation 草案 | 结构化命令、风险分级 |
| L3 受控执行 | 重启 canary、扩副本、切只读模式 | 执行批准的低风险 Runbook step | Policy、审批、幂等、回执 |
| L4 高风险变更 | 回滚生产、切流、删缓存、扩权限 | 数据库故障切换 | 双人审批、变更窗口、独立验证 |

Copilot 不应通过一段自然语言“我已经修复”越过变更管理。它可以让恢复更快，但每个有副作用的动作都需要被翻译成明确资源、参数、前置条件、回滚方案和授权人的不可变命令。

## 二、统一事故对象：让所有人基于同一份事实工作

事故工作台先建立一个 `incident`，而不是把告警和聊天文本直接塞进 Prompt：

```text
incident
  -> severity / service / region / commander / status / timestamps
  -> alerts and symptom observations
  -> affected users, SLO burn and business impact
  -> topology and dependency snapshot
  -> change / deployment / feature flag timeline
  -> evidence registry and access labels
  -> hypotheses, tests, decisions and mitigations
  -> communication, ticket and postmortem artifacts
```

每项证据记录来源、时间范围、查询定义、完整性、访问标签和 hash。例如“支付成功率下降”应该能追溯到仪表盘查询、指标窗口和聚合方式；“刚发布版本 X”要链接发布系统事件，而不是依赖值班人员记忆。LLM 可以基于 evidence registry 写摘要，但没有来源的推断必须标为假设。

## 三、主链路：从告警接入到恢复验证

```text
alert / user report / SLO burn
  -> deduplicate and correlate -> incident creation / severity policy
  -> evidence collection -> timeline and hypothesis workspace
  -> runbook retrieval + safe investigation queries
  -> human decision / approved mitigation command
  -> execution receipt + verification window
  -> resolution, customer communication, postmortem and knowledge feedback
```

### 1. 去重与关联

告警相似并不表示同一事故。先使用服务、地域、时间、依赖图、错误签名和变更窗口构造候选关联，再由规则/人工确认 incident。错误合并会掩盖独立故障，错误拆分会让多个团队重复排查。Copilot 可给出“可能相关”的证据，而不能静默改写严重级别或关闭告警。

### 2. 证据汇聚

按最小权限并发拉取：SLO/RED 指标、日志模板聚合、Trace exemplars、部署与 feature flag、配置版本、依赖健康、最近变更单、已知问题和 Runbook。原始日志、客户数据、token、SQL 和密钥不应全部进入模型上下文；先由检索/查询服务裁剪、脱敏、摘要并保留可回看的受控链接。

### 3. 假设与验证

每条假设都应是结构化对象：

```json
{
  "hypothesis_id": "h_7",
  "statement": "支付失败与 region-b 的 DNS 解析错误相关",
  "supporting_evidence": ["ev_18", "ev_29"],
  "contradicting_evidence": ["ev_31"],
  "confidence": "medium",
  "next_safe_test": "compare resolver errors across regions",
  "owner": "oncall-payments"
}
```

这能阻止模型把“最近有一次发布”自动升级为根因。假设需经历可复现的验证动作，且时间线会记录何时被支持、证伪或放弃。模型应展示反证和不确定性，帮助 commander 避免锚定偏差。

## 四、Runbook 检索：版本、条件和风险比文字相似更重要

Runbook 不是普通知识库。一个过期的“清缓存”步骤可能造成更大范围的故障。每个步骤需要结构化元数据：

```text
runbook_id / revision / owner / service / environment
preconditions / required role / risk tier / change window
read-only investigation steps
mitigation commands / idempotency / rollback
verification signals / abort conditions / expiry
```

检索时先按服务、环境、版本、事故类型和权限过滤，再按语义匹配。Copilot 给出的建议必须展示适用条件、版本、风险和验证信号；不满足前置条件时只能解释为什么不能执行或创建人工审批草案。

对于临时经验，不要立即变成可执行 Runbook。先作为候选知识条目，经过 owner 审核、演练和版本发布后才进入生产检索索引。

## 五、把自然语言建议编译成受控变更

模型说“扩大支付服务副本”无法直接执行，系统应把它转换为结构化 change proposal：

```json
{
  "action": "kubernetes.scale",
  "resource": "deployment/payment-api",
  "scope": {"region": "ap-southeast-1", "namespace": "prod"},
  "desired_replicas": 18,
  "preconditions": ["hpa_not_saturated", "cluster_capacity_available"],
  "verification": ["payment_error_rate_below_1pct_for_10m"],
  "rollback": "restore_replicas:12",
  "risk_tier": "medium"
}
```

执行面独立检查：资源存在、环境正确、调用者角色、变更窗口、配额、依赖状态、双人审批、幂等键与当前 incident。系统反馈的是 provider receipt 和验证结果，不是模型自述。若执行 API 超时，先以命令 ID 对账，不能盲目重试。

高风险操作例如数据库 failover、流量全量切换、数据删除、关闭安全控制，应默认 require approval；即使启用了自动化，也应限制在预演过、可回滚、明确范围的 action catalog 中。

## 六、协作与沟通：Copilot 维护公共时间线，不替代指挥

事故中常见的信息损失是：不同频道的观察相互矛盾、手工状态更新落后、后加入成员不知道已验证什么。Copilot 可以维护：

- 当前影响、严重级别、已知事实与仍未确认的问题；
- 追加式时间线，区分 observation、hypothesis、decision、action 和 result；
- 面向工程、客服、管理层和客户的不同摘要模板；
- 需要的 owner、队列、下一次更新时间和 SLA；
- 会议纪要、行动项和未完成风险。

状态外发尤其需要审批和模板。对客户承诺恢复时间、根因或数据影响前，必须由 incident commander/沟通负责人确认。模型可草拟“我们正在调查，下一次更新在 15 分钟后”，但不能把预测性推理变成对外事实。

## 七、安全边界：事故现场的输入尤其不可信

日志、告警描述、聊天消息、工单、监控标签和网页文档都可能含 prompt injection、密钥或恶意构造内容。安全设计包括：

- 将外部/低信任文本作为数据字段，绝不提升为系统或工具指令；
- 只给模型必要的脱敏片段，原始证据留在受控链接后；
- 命令 allowlist、参数 schema、环境限制、短时凭证与独立策略判定；
- 对查询、下载、截图和命令分别设置审计与保留期；
- 事故模式不能成为绕过正常审批、数据分级和网络隔离的“紧急后门”。

紧急权限可以存在，但必须是显式的 break-glass 流程：指定授权人、最小范围、到期、全量审计和事后复核。模型不应有权自己升级到 break-glass。

## 八、验证恢复：没有验证的缓解只是猜测

一次 mitigation 后，应在预定义观察窗口检查：

| 维度 | 例子 |
| --- | --- |
| 症状 | 错误率、延迟、队列深度、SLO burn 是否恢复 |
| 影响 | 用户成功率、订单/支付/数据处理是否仍异常 |
| 副作用 | 成本、容量、重试风暴、其他地域是否恶化 |
| 变更正确性 | 实际资源版本/副本/路由是否与命令一致 |
| 稳定性 | 恢复是否持续足够窗口，而非一次瞬时波动 |

模型可以生成验证 checklist 和图表摘要，但恢复状态应由规则、监控和人类确认共同决定。若缓解无效或出现新副作用，按 Runbook 自动回滚或升级，不让系统在“模型认为好像好了”时静默关闭事故。

## 九、复盘与知识回流：从聊天记录变成可用资产

事故结束后，Copilot 可基于证据账本生成复盘草案：影响、检测、时间线、根因证据、缓解措施、为什么没有更早发现、行动项及 owner。人工必须验证根因、责任表述和对外承诺，避免模型把相关事件当作因果。

高价值的回流不只是存一篇 postmortem：

1. 将新的告警签名、反例和恢复验证加入评测集；
2. 更新 Runbook，加入前置条件、风险、验证和 rollback；
3. 修正服务目录、依赖图和 on-call 路由；
4. 将有效查询/证据选择沉淀为受控检索模板；
5. 用复盘行动项追踪技术债、演练和发布门禁。

未经审核的事故总结不能直接加入 RAG 索引作为“事实”，否则下一次 Copilot 会把猜测继续传播。

## 十、评测：衡量是否帮助恢复，而不是是否会写总结

离线演练集应包含告警风暴、依赖故障、最近发布、错误 Runbook、跨地域异常、敏感日志、工具超时和多个并发事件。核心指标：

| 类别 | 指标 |
| --- | --- |
| 证据质量 | 正确证据召回、时间线完整率、来源可定位率 |
| 推理质量 | 已验证假设 precision、反证呈现率、错误根因断言率 |
| 运行安全 | 越权命令率、审批覆盖率、错误环境/资源操作率、幂等对账成功率 |
| 人机协作 | 人工采纳率、摘要节省时间、重复提问减少、交接完整率 |
| 业务结果 | MTTD/MTTA/MTTR、SLO 影响、复发率、变更失败率 |

不要把 MTTR 降低单独作为成功：如果系统更快地下达了错误变更，或让事故被过早关闭，短期指标可能好看但风险更高。安全违规、错误环境操作和未经证据支持的高置信根因应设为硬门禁。

## 十一、系统设计题：设计 ITSM / SRE 事故响应 Copilot

推荐回答顺序：

1. **范围与自治等级**：明确只读调查、变更草案和实际执行的边界；先定义紧急变更和 break-glass。
2. **事故与证据模型**：建立 incident、evidence、hypothesis、decision、action、receipt 的关联 ID 与访问标签。
3. **证据与 Runbook**：从可审计的监控/日志/Trace/CMDB/发布系统采集，按服务版本/环境/权限检索受版本控制的 Runbook。
4. **命令控制面**：模型输出结构化 proposal，策略和执行器验证前置条件、审批、幂等、回滚与回执。
5. **协作和恢复**：维护公共时间线、不同受众摘要、验证窗口与升级路径；人类 commander 拥有最终判断。
6. **学习闭环**：审核复盘、评测回放、Runbook 演练、行动项与发布门禁。

```text
Alerts / tickets / user reports / telemetry
        -> incident orchestrator -> evidence registry + timeline
        -> RAG (Runbooks / postmortems) + safe query tools
        -> hypothesis workspace -> change proposal / approval
        -> execution gateway -> receipts -> recovery verifier
        -> comms, postmortem, evaluation and knowledge governance
```

## 十二、高频追问

### Q1：为什么不能让 Copilot 自动根据告警重启服务？

告警可能误报、根因可能在依赖或配置，重启还可能丢失状态并掩盖证据。Copilot 可以建议或准备命令；真正执行需要资源/环境校验、风险策略、幂等、审批和恢复验证。只有经过演练、低风险、可回滚的目录化动作才适合有限自动执行。

### Q2：如何防止模型把相关性误判为根因？

将 observation、hypothesis、verified cause 分成不同状态，要求每条主张绑定证据和反证；所有根因结论需要可复现测试、变更对照或人工确认。复盘草案不能直接作为事实入库。

### Q3：Runbook RAG 与普通文档 RAG 有何不同？

Runbook 带环境、服务版本、前置条件、风险、权限、可执行命令、rollback 和 expiry。检索必须先按这些元数据和权限过滤；一个语义相似但过期的操作步骤不应被当成可执行建议。

### Q4：执行 API 超时后如何避免重复操作？

结构化命令带全局 idempotency key 和 command ID，执行器在超时后查询 provider receipt、资源实际状态和审计事件。状态不确定时标为 `unknown` 并人工对账，而不是让模型再次发出同一命令。

### Q5：如何证明 Copilot 真正改善事故响应？

用历史事故回放和演练集测证据、假设、审批和命令安全；线上对照观察人工采纳、时间线完整、MTTA/MTTR、误变更、SLO 影响和复发率。还要抽检是否过早关闭或错误归因，不能只以模型生成速度评价。

## 十三、60 秒项目讲法

“我们把事故 Copilot 设计为证据和协作平台，而不是自动运维机器人。告警、日志、Trace、发布、拓扑和工单先进入带权限标签的 incident evidence registry，模型只能基于受控证据建立时间线和可验证假设，并展示反证与局限。Runbook 按服务、环境、版本、前置条件、风险和回滚方案检索。模型提出的缓解动作会被编译成结构化 change proposal，由策略和执行网关检查环境、审批、幂等和变更窗口，再以 provider receipt 对账；缓解后还要用 SLO、错误率和副作用窗口验证。事故结束后，人工审核复盘并把有效案例回流到评测、Runbook 和发布门禁。我们同时测 MTTR、证据准确率、未经审批动作、错误根因断言和复发率。”

这个项目讲法展示的是：你会把大模型放进成熟的 ITSM/SRE 控制体系，帮助人更快恢复服务，但不把模型变成新的单点风险。
