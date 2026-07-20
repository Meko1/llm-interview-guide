# 企业 Connector 增量同步与撤权：把外部知识安全地带进 LLM

企业知识助手接入 Google Drive、Confluence、Slack、Notion、SharePoint 或 CRM 后，最难的不是 OAuth 登录成功，而是后续几十万份内容如何持续同步：新建、改名、移动、编辑、权限变化、删除、API 限流和 webhook 丢失都可能让索引与源系统不一致。

本页讨论 Connector 的**数据面**。用户同意、OAuth、token 刷新和 Credential Broker 见 [Agent 外部连接与 OAuth 凭证生命周期](/interview/agent-connector-identity-lifecycle-playbook)；RAG 检索隔离与索引演进见 [多租户 RAG 检索隔离与索引演进系统设计](/interview/multi-tenant-rag-index-governance-playbook)。这里回答的是：连接已建立后，如何把数据变化可靠地同步成可权限过滤、可引用、可删除的知识资产。

## 一、Connector 数据面应交付什么

一个 Connector run 的结果不是“成功/失败”布尔值，而是可审计的同步账本：

```text
connector instance + tenant + source scope
  -> source object revision and ACL snapshot
  -> normalized document version and derivatives
  -> indexing/publication status
  -> cursor/watermark, retry state, error classification
```

每份源对象至少有稳定的 `source_object_id`、外部 revision/etag、父目录/空间、修改时间、删除标记、ACL 版本和抓取时间。不要以文件名或路径作为唯一身份：改名、移动或同名文件会让增量同步重复/遗漏。

## 二、全量、轮询、Webhook 与 Delta API 如何组合

| 机制 | 优点 | 风险 | 适用 |
| --- | --- | --- | --- |
| 全量扫描 | 语义简单、可重建基线 | 成本高、易触发限流 | 首次接入、周期性对账 |
| 轮询 modified time | 实现较简单 | 时钟偏差、分页漏项、重复 | 小规模或无变化 API |
| Webhook | 近实时、低扫描成本 | 丢事件、重复、乱序、签名验证 | 支持事件订阅的平台 |
| Delta cursor | 精确增量、可恢复 | cursor 过期/语义差异 | 支持 delta token 的平台 |

生产系统常采用**事件触发加周期性对账**：Webhook 快速触发增量，Delta API/cursor 拉取变化，全量或抽样扫描发现漏事件。任何单一机制都不能假设“永不丢失”。

## 三、Cursor、watermark 与重叠窗口

cursor 代表“我已安全消费到的变化位置”，应只在相关对象**已经持久化并可重放**后提交。若先推进 cursor 再处理，worker 崩溃会永久丢变化；若处理完却未提交，则重放会发生，因此下游必须幂等。

对于仅支持 `modified_time` 的 API，使用重叠窗口：下一次从 `last_watermark - overlap` 开始抓，再按 `(source_object_id, revision/etag)` 去重。不能完全依赖本地时间，因为外部系统写入延迟、分页排序和时钟差都会制造漏洞。

```text
fetch changes -> persist event -> enqueue object sync
-> complete object revision + ACL -> advance cursor atomically
```

“原子”通常通过 outbox/事务记录实现：同步状态与待投递事件一起持久化，后台可靠投递到队列，避免数据库成功但消息丢失。

## 四、对象状态机：删除与权限不是普通更新

```text
discovered -> fetching -> normalized -> indexed -> published
     |            |             |            |
     +-> skipped  +-> retrying  +-> quarantined
     +-> deleted / access_revoked / unavailable
```

- **内容更新**：创建不可变 document revision，成功后原子切换 active pointer；不要原地覆盖导致检索读到半新半旧内容。
- **删除**：写 tombstone，撤销所有派生产物、向量、缓存和引用卡片的可见性，再异步物理清理。
- **权限变化**：比普通 TTL 更紧急。先阻断在线检索权限，再更新 ACL 快照和索引元数据，最后清理缓存。
- **暂时不可访问**：不要立即当作删除；区分 404、403、限流、上游故障和用户撤权，使用不同重试/升级策略。

## 五、ACL 继承与安全检索

Connector 拉取的文档应携带源系统的访问控制快照，例如 owner、group、share link、空间/目录继承关系和 policy version。解析出的页面、chunk、embedding、摘要、缩略图和缓存都继承同一资产/ACL 血缘。

检索时执行：`tenant filter -> source policy/ACL filter -> recall -> rerank -> evidence validation`。权限过滤必须在召回前或受服务端强制的查询阶段完成，不能先全库召回再让模型“不要引用无权限内容”。引用 UI 同样要重查权限，避免文件名、页码或摘要泄露。

高权限共享盘、公开链接和外部协作者是常见边界案例。Connector 需要明确是同步“当前用户可见内容”“管理员可见内容”还是“组织共享空间内容”，并把这个选择写入实例策略，不能由模型猜测。

## 六、API 限流、分页和失败分类

外部 SaaS 的限制常按应用、租户、用户、资源类型或时间窗计。Connector 调度器应把并发与请求预算按实例隔离，避免一个大租户的历史回填耗尽全局 API 配额。

| 错误 | 处理 |
| --- | --- |
| 429/临时 5xx | 带抖动退避，遵守 Retry-After，保留 cursor |
| token 失效 | 通知 credential control plane 刷新/重新授权，不盲目重试 |
| 403 | 记录 access revoked 或 scope 不足，停止对该对象外发 |
| 404 | 结合事件和目录语义判断删除/移动，不直接清空所有派生物 |
| 解析失败 | 隔离对象、保存安全错误摘要，支持新 transform 重跑 |
| schema/API 变更 | 版本化 adapter，暂停发布并回归测试 |

分页必须使用供应商提供的稳定 cursor/page token；不要在 offset 分页中假设列表不会变化。发现上游排序不稳定时，宁可增加重叠去重和对账，也不要为了“快”接受静默漏同步。

## 七、内容归一化、版本和引用血缘

不同 Connector 的对象要规范为统一文档模型：

```text
document_id, source_type, source_object_id, revision, title, canonical_url
content blocks, attachments, timestamps, ACL snapshot, retention policy
processing manifest, evidence locators, content hash
```

归一化层不应丢掉源系统的重要语义：Slack thread、Confluence page hierarchy、Drive 权限继承、CRM 记录字段都可能影响检索和引用。与其强行塞成一段纯文本，不如保留结构化 metadata 和 source locator，让下游能按场景解析。

任何回答引用应带 `document revision + source URL/locator + retrieval time`。源对象在回答后更新时，旧回答仍可审计其依据是什么；新查询则默认使用 active revision。

## 八、回填、迁移与 Connector 版本发布

首次全量回填和 Connector adapter 升级会产生巨大流量。建议分片、限速、优先级队列和 checkpoint，避免把在线用户检索挤出资源池。新解析器/切块器应先在 shadow collection 或小租户上验证，确认质量、权限和成本后再切 active pointer。

Adapter 变更也应有 release manifest：connector 版本、字段映射、解析器、ACL 映射、索引 schema、评测集和回滚版本。否则“修复一个 API 字段”可能在不知不觉中改变全租户的检索边界。

## 九、可观测性与对账

| 指标 | 用途 |
| --- | --- |
| source lag / cursor age | 变化到可检索的延迟 |
| discovered vs published vs failed | 漏处理与解析质量 |
| delete/revoke propagation lag | 撤权是否快于数据泄露窗口 |
| ACL mismatch / denied retrieval | 同步权限是否与源系统一致 |
| API quota / 429 / retry budget | 外部依赖是否成为瓶颈 |
| duplicate reuse / replay count | 幂等和 cursor 提交是否正确 |
| cost per active document | 同步与索引的真实成本 |

周期性对账不能省：随机抽取源系统对象和索引对象，比对 revision、ACL、删除状态和可引用性。对账发现的漏同步、幽灵文档和越权样本应进入 regression suite。

## 十、系统设计题回答框架

题目：“设计一个企业知识助手，连接 Google Drive、Confluence 和 Slack，要求内容分钟级更新、权限实时生效。”

1. 澄清数据规模、更新时效、用户/管理员同步模式、外部 API 限额、删除 SLA 和数据驻留。
2. 将 OAuth/token 留在 Connector 控制面；数据面用 connector instance、稳定 source id、revision、ACL snapshot 和 cursor 建模。
3. Webhook 加 Delta cursor 提供近实时变化，周期性全量/抽样对账兜底；cursor 仅在对象处理和投递持久化后提交。
4. 每次更新创建不可变 revision，索引完成后原子发布；删除/撤权先阻断检索再清理派生物和缓存。
5. 以 ACL 血缘贯穿原件、chunk、embedding、缓存和引用；检索前服务端强制过滤。
6. 通过按租户预算、退避、DLQ、重叠窗口和幂等键处理上游限流、丢事件和重复投递。
7. 用 source lag、撤权延迟、ACL mismatch、对账差异和单位文档成本运营系统。

## 十一、面试高频问答

### Q1：Webhook 已经实时，为什么还要周期性对账？

Webhook 可能丢失、重复、乱序或订阅失效；供应商也可能有临时延迟。对账为正确性兜底，发现漏同步与幽灵文档，不能把“收到了事件”当成“一致性已经成立”。

### Q2：cursor 应在什么时候推进？

只在变化事件已持久化、对象任务可可靠重放且必要状态已提交后推进。先推进会丢事件，后推进会重放，因此下游需要以 revision/etag 做幂等。

### Q3：权限变化和内容更新为什么要走不同路径？

内容更新通常可短暂保持旧版本并原子切换；权限收紧直接涉及泄露风险，必须先阻断在线读取和缓存命中，再异步更新索引/派生物。二者的时效和失败策略不同。

### Q4：用户从共享文档移除后，如何保证 RAG 不再回答？

Connector 传播 ACL 变更并撤销索引可见性，但在线检索仍要以当前权限做服务端过滤；引用展示同样复查权限。不能只依赖离线同步延迟。

### Q5：外部 API 频繁 429 怎么办？

遵守 Retry-After、指数退避加抖动、每 connector/租户限流、保留 cursor 并对高优先级增量优先。不要无限并发重试；历史回填应与在线更新隔离。

### Q6：如何处理文件被移动或改名？

用供应商稳定 object id 识别对象，路径和标题只是可变 metadata。接到移动/改名事件时更新 locator 与显示信息，不把它误判成删除加新建。

### Q7：Connector 升级如何避免全库检索事故？

版本化字段映射、解析器和 ACL 规则，在 shadow collection/小范围租户回归验证；通过 manifest 原子切换，保留旧版本可回滚，并对权限与引用做专项对账。

## 十二、60 秒收束回答

> 我会把 Connector 分成凭证控制面和数据同步面。数据面以稳定 source id、revision、ACL 快照和 cursor 建模，Webhook 触发增量、Delta API 保证可恢复、周期性对账发现漏事件；cursor 只在对象处理可重放后推进。内容更新创建不可变版本并原子发布，权限收紧和删除则先阻断在线检索、缓存与引用，再清理派生产物。所有 chunk、embedding 和证据继承源 ACL，检索与引用展示都重新校验当前权限。最后用 source lag、撤权传播、ACL mismatch、429 和单位文档成本持续运营，并把 Connector/解析器升级作为可回滚发布处理。
