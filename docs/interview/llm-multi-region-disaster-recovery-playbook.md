# LLM 多地域灾备与状态连续性：从模型切换到可恢复运行

多 Provider fallback 可以在一个模型接口失败时换到备用模型，但它不等于灾备。真正的地域故障可能同时影响网关、队列、向量库、对象存储、身份服务、缓存、工作流 checkpoint、模型网络出口和观察系统。此时如果只把请求导向另一个模型，用户仍会遇到会话丢失、流式任务重复执行、Agent 重放外部副作用、RAG 引用与索引不一致，或者因数据驻留要求根本无法跨区处理。

本页给出 LLM 应用的多地域恢复设计框架。它与 [LLM 多供应商故障切换与一致性设计](/interview/llm-multi-provider-failover-playbook) 的模型路由互补，与 [LLM 流式输出与会话恢复设计](/interview/llm-streaming-session-resilience-playbook) 的单次会话协议互补，也依赖 [长任务 Agent 恢复](/interview/long-running-agent-recovery-playbook) 的 checkpoint 和幂等机制。

## 一、先把“可用”拆成可度量目标

灾备设计不能只写“多活、自动切换”。先对每个业务能力定义：

| 指标 | 问题 | 例子 |
| --- | --- | --- |
| RTO | 服务中断后多久恢复可用？ | 普通问答 5 分钟，审批任务 15 分钟 |
| RPO | 最多可丢失多久的数据或状态？ | 审计和审批 0，低风险草稿可 5 分钟 |
| 一致性目标 | 切换时允许重复、延迟还是绝不丢失？ | 工具写操作不得重复，流式文本可从 checkpoint 续传 |
| 降级目标 | 不能完全恢复时，什么功能还能安全提供？ | 只读检索、历史对话、人工接管 |
| 数据驻留 | 哪些租户/字段绝不可跨地域？ | 欧盟客户只在 EU region 处理和备份 |

不同对象的目标不同。模型生成的临时 token 可以容忍丢失；已审批的外发文档、工具执行回执、计费账本和合规审计通常要求近似零 RPO。把所有数据放在同一个复制策略中，既贵又无法说明风险取舍。

## 二、盘点状态：LLM 应用不只有数据库

恢复设计的第一步是建立状态目录，明确每类状态的 owner、复制模式、恢复顺序和幂等语义：

```text
identity / policy / tenant routing
request and conversation metadata
prompt, model route, tool schema and release manifest
agent graph state, checkpoints and pending effects
RAG source metadata, ACL, index generations and embeddings
stream event log and resumable artifacts
queues, outbox records, retry schedules and DLQ
artifacts, approvals, audit evidence, evaluation and billing data
```

尤其要区分 **可重建状态** 与 **不可重建事实**。向量索引可以从已版本化的源文档和 embedding manifest 重建，但重建耗时可能超过 RTO；已向客户发送的报价、一次付款操作的 idempotency key、审批决定和审计证据不能依赖“以后再算一遍”。

每个 run 都应记录其恢复所需的最小 manifest：

```json
{
  "run_id": "run_01",
  "home_region": "ap-southeast-1",
  "tenant_region_policy": "cn-only",
  "release_manifest": "sha256:...",
  "state_schema_version": 7,
  "checkpoint_ref": "object://.../cp-42",
  "pending_effects": ["effect_19"],
  "recovery_epoch": 3
}
```

`release_manifest` 必须固定模型路由、Prompt、工具 schema、索引 generation 和策略版本。否则在备用地域恢复一个旧任务时，会悄悄换成新 Prompt/新工具，既无法复现，也可能改变已经开始的业务流程。

## 三、故障域优先于部署形态

“三个可用区”不等于多地域灾备。设计时明确依赖的故障域：

```text
process / node -> zone -> region -> cloud account -> provider -> identity/DNS/control plane
```

同一地域的多 AZ 能应对机器或机房故障，却不能保证应对地域网络隔离、云平台区域控制面失效、合规封锁或集中式身份服务不可用。反过来，跨云跨区也可能共同依赖同一个 DNS、CI 发布系统、密钥根、模型供应商或消息队列账号，形成隐藏单点。

进行 dependency map：每个在线请求从 DNS、WAF、身份、网关、会话、模型、工具、检索、存储到日志的路径都应标出主/备、地域、限额与 fallback 条件。面试中主动提出“控制面不可用时数据面如何继续”是加分点，例如预先签发短期策略、只读路由快照或允许正在执行的低风险任务完成。

## 四、架构选择：主动-主动、主动-备用与分区自治

### 1. 主动-主动

两个地域都承接流量，适合低延迟、较高可用要求的无状态问答。优势是切换快、容量已预热；代价是会话粘性、冲突解决、跨区复制、缓存失效和成本更复杂。对同一个用户会话通常使用 `home_region` 或一致性哈希固定归属，避免每轮对话在不同地域读取不同记忆。

### 2. 主动-备用

主地域承载写流量，备用地域维持最小可用容量与复制。适合状态写入强一致、流量可预测或数据驻留严格的系统。需要定期演练“冷路径”，否则备用环境经常在真正故障时发现模型凭证、索引版本、配额、镜像或策略没有同步。

### 3. 分区自治

按租户、数据驻留或业务域固定地域，跨区只复制匿名指标、模型制品或加密备份。它降低了数据合规和跨区冲突复杂度，但需要接受某个地域故障时该分区的服务降级，或准备同一合规边界内的备用区域。

没有通用最优解。选择取决于 RTO/RPO、写路径、成本、法规和团队的演练能力；最危险的是宣称多活，却无法解释同一 Agent run 或同一审批单在双写时谁拥有最终决定权。

## 五、恢复顺序：先控制风险，再恢复体验

地域失效后的优先级通常不是“尽快恢复 token 流”，而是：

1. **冻结风险**：停止新写操作、外发、审批提交和可能跨区泄露的数据路径。
2. **建立事实**：判断是局部、区域、供应商、网络还是控制面故障；避免错误地把短暂 429 当成地域灾难。
3. **路由隔离**：将新会话导向健康且合规的地域，保留 sticky assignment，避免抖动式来回切换。
4. **恢复身份和策略**：确保备用区拥有正确的 tenant、ACL、撤权和密钥版本；不确定时 fail closed。
5. **恢复状态与队列**：从 checkpoint、outbox 和事件日志重放未完成工作，先去重再执行。
6. **恢复检索与制品**：验证索引 generation、ACL tombstone、对象存储和引用可用性。
7. **分级放量**：先只读，再低风险生成，最后受审批保护的副作用操作。

用户体验应有明确状态：`temporarily_unavailable`、`migrating`、`resuming`、`completed_after_failover`、`needs_manual_review`。不要将恢复中的请求静默重置成一段新对话，否则用户会重复下达有副作用的指令。

## 六、会话、流式与 Agent run 如何续命

### 会话与记忆

会话元数据、摘要、短期记忆和权限指纹应带 revision，跨区复制要注明延迟。切到备用区时，若最新上下文未复制完成，应向用户说明“已恢复至某个检查点”，或要求确认继续，而不是假装拥有完整历史。语义缓存不能跨 region 盲目复用，缓存键至少包含 tenant、授权、数据驻留、索引与输出契约版本。

### 流式生成

模型 token 流无法精确从 GPU 的中间状态迁移。正确做法是持久化可见事件、最后安全 checkpoint、Prompt manifest 和已确认的工具结果；恢复后要么从最后稳定段落重新生成并以新 epoch 续流，要么以最终制品方式完成。事件携带 `run_id`、序号和 `recovery_epoch`，客户端去重并能显示“恢复后输出”。

### Agent 与副作用

Agent 最危险的是“模型以为没有执行，业务系统已经执行”。每个外部 effect 使用稳定 idempotency key，并通过 outbox/回执记录状态：

```text
planned -> prepared -> approval_required -> committed
        -> compensated / unknown / needs_reconciliation
```

恢复时先查询业务系统的回执，再决定重试、补偿或人工介入。绝不直接从起点重放完整工具轨迹。对于无法证明是否执行的 `unknown` 写操作，默认冻结并进入人工对账。

## 七、RAG、索引和数据驻留

RAG 的灾备常被低估。源对象、ACL、删除墓碑、chunk、embedding、倒排索引、向量索引、reranker 与引用制品都有不同复制和恢复时间。最低要求包括：

- 复制源文档版本、ACL 与删除/撤权事件的顺序，撤权优先级高于索引可用性；
- 索引按 immutable generation 发布，查询只命中“数据与 ACL 都已就绪”的 generation；
- 备用区未追平时可降级到受限旧 generation，并向结果标明数据截至时间；
- embedding 模型升级或跨区重建必须与 generation、源版本和权限规则绑定；
- 数据驻留禁止跨境时，不能为了恢复率把原始文档或向量复制到不合规地域。

在灾备场景中，“宁可暂时没有答案，也不能用已撤权或不合规的数据回答”是更合理的默认值。

## 八、复制、冲突与一致性策略

不同数据采用不同策略：

| 对象 | 合适策略 | 关键控制 |
| --- | --- | --- |
| 审批/计费/外部 effect | 单主或共识写入 | 全局 ID、幂等、严格审计、人工对账 |
| Agent checkpoint | 追加事件 + 定期快照 | state schema、顺序、恢复 epoch |
| 会话草稿 | 异步复制可接受 | revision、冲突提示、用户确认 |
| RAG 索引 | 源数据复制 + generation 发布 | ACL/删除优先、可重建、freshness 标签 |
| 模型与 Prompt 制品 | 不可变制品镜像 | hash、签名、manifest pinning |
| 缓存 | 最好可丢弃 | 版本/权限键、切换时保守失效 |

不要用“最后写入者获胜”处理审批、工具执行或知识权限。跨区恢复发生分区脑裂时，必须有明确的 fencing token 或 lease，确保同一 run 在任一时刻只有一个地域可以提交副作用。DNS 切换不是 fencing；旧地域可能仍能访问部分依赖。

## 九、演练不是一次故障转移按钮

Runbook 至少包含失效判定、授权人、切流步骤、冻结名单、数据一致性检查、回切条件、沟通模板和复盘归档。演练场景不应只关停一个 Pod，应覆盖：

- 单区域模型/网络不可用，但数据库仍可访问；
- 主区域完全隔离，DNS 或身份控制面部分失效；
- 复制延迟，备用区缺少最新 checkpoint 或 ACL 撤权；
- 正在流式输出、正在等待审批、正在调用外部写工具；
- 备用区模型配额不足、索引 generation 落后、密钥或发布制品不一致；
- 故障恢复后回切，验证重复任务、补偿、日志顺序和计费归因。

每次演练要量化实际 RTO/RPO、未完成 run 数、重复 effect 拦截数、数据差异、人工介入时长和用户可见错误。演练产生的缺口应进入回归集和发布门禁；没有演练证据的 RTO 只是愿望。

## 十、系统设计题：设计跨地域企业 Agent 平台

回答时可按以下顺序展开：

1. **分层目标**：按问答、草稿、审批、工具写入、审计和索引分别定义 RTO/RPO，确认数据驻留边界。
2. **状态目录**：列出会话、run、checkpoint、effect、RAG generation、制品、队列和策略，并为每类给出主从/复制/重建方案。
3. **路由与归属**：tenant 或 session 有 home region；健康路由只在合规地域选择，切换带 epoch 和 fencing，避免双主提交。
4. **恢复工作流**：冻结副作用，恢复身份/策略，读取 manifest 与 checkpoint，对账 effect，恢复队列和索引，再分级放量。
5. **正确性控制**：idempotency key、outbox、immutable release manifest、revision、ACL tombstone 优先、缓存保守失效。
6. **演练与观测**：故障注入、真实 RTO/RPO、跨区复制滞后、恢复成功率、未知副作用数和地域/租户维度的合规告警。

可以用下图描述核心数据流：

```text
Global routing / policy
        -> Region A: orchestrator, queue, model gateway, index generation A
        -> Region B: orchestrator, queue, model gateway, index generation B

Immutable manifests + audit/effect ledger + source/ACL event log
        -> replicated under residency and consistency policy
Run checkpoint / outbox -> recovery worker -> reconcile -> resume or human review
```

## 十一、高频追问

### Q1：多模型 fallback 和多地域灾备的区别是什么？

fallback 是在当前应用路径中替换模型供应商，解决调用级可用性与能力兼容；多地域灾备要恢复整条依赖链和持久状态，包括身份、队列、会话、工具回执、索引、对象存储、审计和合规路由。两者都需要，但不能互相替代。

### Q2：如何避免切换时 Agent 重复执行付款或外发？

外部写操作使用全局稳定 idempotency key，先写 outbox 和 effect state，再调用业务系统；恢复前以 key 查询业务回执。使用 fencing/lease 确保只有一个地域能提交，状态不确定则标为 `unknown` 并人工对账，而不是自动重试。

### Q3：为什么缓存通常不应该复制为关键状态？

缓存可以失效和重建，复制会增加延迟、冲突和权限泄露风险。切换时缓存按 tenant、ACL、索引、模型和契约版本保守失效；真正要复制的是让答案可重建的权威事实、manifest 与审计链路。

### Q4：RAG 备用区索引落后怎么办？

只服务已验证的完整 generation，并显示 freshness；对于需要最新知识或已撤权数据的请求，拒答或转人工。删除/撤权事件优先传播，不能为了提高可用性使用未经 ACL 验证的旧索引。

### Q5：如何验证 RTO/RPO 不是纸面指标？

通过定期故障注入和全链路演练记录真实切换时间、最大数据滞后、恢复后的 checkpoint 成功率、重复副作用拦截、索引/ACL 一致性和人工接管时间。将结果与目标比较，并把未达标场景变成发布前回归测试。

## 十二、60 秒项目讲法

“我们把灾备设计成状态连续性问题，而不是简单换模型。首先按问答、草稿、审批、外部写操作、RAG 索引和审计分别定义 RTO/RPO 与数据驻留边界。每个 Agent run 固定 release manifest、home region、checkpoint、pending effect 和 recovery epoch；写操作通过 outbox、全局幂等键和业务回执对账，切换时有 fencing 防止双地域重复提交。RAG 使用带 ACL 和删除事件的 immutable generation，备用区未追平时只读降级并明确数据新鲜度。故障时先冻结高风险副作用，再恢复身份策略、状态、索引与队列，最后分级放量。我们定期演练区域隔离、复制延迟和在途任务恢复，直接用实际 RTO/RPO、未知 effect 数和撤权一致性来验收。”

这套讲法能表明你理解 LLM 应用在真实故障中最难恢复的不是模型，而是状态、权限和业务后果。
