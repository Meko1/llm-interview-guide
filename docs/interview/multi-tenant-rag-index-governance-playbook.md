# 多租户 RAG 检索隔离与索引演进系统设计

> 多租户 RAG 最危险的错误不是“回答不够聪明”，而是正确地回答了另一个租户的数据。向量检索的语义相似性天然不会理解组织边界，因此权限过滤、版本血缘、删除与重建必须在模型生成之前成为硬约束。

## 一、30 秒面试回答

我会把租户和授权标签绑定到文档、版本、chunk、向量、倒排索引、缓存和引用的每一层。在线查询时，可信身份服务注入 tenant、角色、组织和数据范围，检索器在召回前执行不可绕过的 metadata/ACL 过滤，再做混合检索和 rerank；模型只看已授权的证据。索引更新采用不可变版本、分片重建、离线校验和 alias 原子切换，权限变更和删除通过事件驱动定位所有派生产物并主动失效缓存。隔离策略根据规模选择共享索引加过滤、每租户 collection 或独立集群，并用越权检索测试、召回质量、过滤延迟、删除 SLA 和版本一致性共同验收。

一句话：**RAG 权限不是 UI 上的文档列表过滤，而是查询执行计划和索引生命周期的一部分。**

## 二、先画清数据边界

| 资产 | 必须带的边界 | 常见遗漏 |
| --- | --- | --- |
| 原始文件 | tenant、owner、ACL、生效期、版本 | 文件删了，派生索引还在 |
| 文档解析块 | `document_id`、`version_id`、页码、数据标签 | chunk 没有继承授权 |
| 向量/倒排记录 | tenant/namespace、ACL 标签、索引版本 | 先召回后在应用层筛掉 |
| 检索缓存 | 身份范围、query、index/ACL 版本 | 不同角色复用同一答案 |
| 生成答案与引用 | 证据 ID、版本、可见性 | 引用标题本身泄露文件存在 |
| Trace/评测集 | 脱敏、访问范围、保留期 | 用生产敏感内容做离线样本 |

“向量库里只有 embedding，没有敏感字段”并不意味着安全。embedding、相似度、文件名和引用都可能暴露业务信息，且攻击者能通过探测推断文档存在与否。

## 三、隔离模式：不是所有租户都用一套 collection

| 模式 | 做法 | 优点 | 风险与适用 |
| --- | --- | --- | --- |
| 共享 collection + 强制 filter | 每条记录带 tenant/ACL 元数据，查询前过滤 | 资源利用率高、运维简单 | 过滤必须下推到向量库；适合大量小租户 |
| 每租户 namespace/collection | 物理或逻辑分开索引 | 隔离直观、便于配额 | 租户很多时索引和运维膨胀 |
| 分层模式 | 小租户共享，大客户独立 collection | 成本与隔离折中 | 需要清晰迁移机制 |
| 独立集群/账号 | 客户专享存储、密钥和网络边界 | 最强隔离、适合监管客户 | 成本最高、发布复杂 |

选择标准包括监管等级、数据量、租户数量、查询延迟、客户专享密钥/地域要求和运维能力。不要把“collection 名里有 tenant_id”当成真正的访问控制；调用方仍可能传错 collection 或绕过网关。

## 四、授权数据模型：让过滤可执行、可解释

推荐由可信后端构建查询上下文：

```json
{
  "subject": "user_42",
  "tenant_id": "acme",
  "roles": ["risk_analyst"],
  "org_scopes": ["risk-cn", "policy-read"],
  "clearance": "internal",
  "acl_epoch": 1842
}
```

索引记录则持有可过滤的派生标签：

```json
{
  "chunk_id": "c_789",
  "tenant_id": "acme",
  "document_id": "policy_2026",
  "version_id": "v7",
  "allowed_orgs": ["risk-cn"],
  "classification": "internal",
  "effective_from": "2026-01-01",
  "effective_to": null,
  "index_version": "idx-2026-07-16"
}
```

设计要点：

- 授权上下文由身份/权限服务签发，不能来自前端 body 或模型工具参数。
- 低基数、高选择性的字段适合索引过滤；复杂 ACL 可用预计算 scope、访问位图或授权服务，但必须评估延迟。
- `acl_epoch` 和 `index_version` 进入缓存 key，使权限或索引变化能自然隔离旧缓存。
- 文档的继承、例外和时间生效规则要在入库时规范化，不能在每次向量命中后临时猜测。

## 五、安全检索执行计划：过滤必须早于召回

```text
identity -> auth context -> query rewrite (untrusted text only)
  -> tenant/ACL/data-label filter
  -> dense + BM25 + metadata retrieval
  -> fusion / rerank within authorized candidate set
  -> evidence pack with version and page
  -> LLM generation -> citation visibility recheck
```

关键约束：

1. **先过滤、后排序**：不要先从全库取 top-k 再在应用层丢弃未授权结果。这样既可能泄露相似度，也会让有效 top-k 被无权候选挤占。
2. **Reranker 也只接触授权候选**：否则第三方 rerank 服务本身会看到越权文本。
3. **引用二次校验**：权限可能在长请求期间变化，渲染引用前需确认其仍可见。
4. **空结果不泄露**：避免返回“你没有权限访问《某客户合同》”；统一为无可用证据或按产品策略提示申请权限。

## 六、元数据过滤与召回质量的权衡

过滤会缩小候选集，可能降低召回；反过来为了召回而放宽过滤是安全事故。正确做法是：

- 分别度量“全局语义召回”和“授权集合内的 Recall@k”；用户真正需要后者。
- 对权限粒度极细的场景，选择能高效执行 filter 的索引结构，并压测高基数标签。
- 将文档类型、区域、生效期、语言等可解释条件显式加入查询，减少语义检索承担不该承担的范围判断。
- 如果授权后候选太少，宁可请求澄清、扩大用户已授权范围或返回无证据，也不能回退到全局库。

## 七、文档更新、删除与权限变更

### 7.1 更新：不可变版本，而非原地覆盖

文档更新生成新的 `version_id`，解析与 embedding 产物同样版本化。新版本通过质量校验后写入候选索引，最后用 alias 或读版本原子切换；旧版本按保留策略退役。这样可避免同一次查询混入新旧 chunk，也支持追溯“当时依据的是哪版制度”。

### 7.2 删除：找到所有派生产物

删除请求不能只调用向量库 `delete(document_id)`。应根据血缘记录清理：原件对象、解析文本、向量、倒排记录、视觉索引、缓存、引用快照、异步任务和有保留期约束的日志。为每一步记录状态与证据，形成可审计删除工作流。

### 7.3 权限变更：快于 TTL 的主动失效

角色、部门或文档 ACL 变化后，旧检索缓存与生成缓存必须主动失效，或通过 `acl_epoch` 使其不再命中。高敏资源不能依赖数小时 TTL “最终一致”地撤权。正在进行的 Agent/流式请求在工具执行和最终引用前也要重新校验。

## 八、零停机索引演进

embedding 模型、切块策略、metadata schema 和向量库参数都会变化。安全的演进流程：

```text
source of truth
  -> build index_v2 in background
  -> completeness + ACL + retrieval regression checks
  -> shadow reads / compare candidates
  -> alias: index_v1 -> index_v2 (atomic)
  -> monitor -> retire index_v1 after rollback window
```

每个索引版本都要记录：解析器、chunking、embedding 模型、归一化、向量维度、metadata schema、数据快照时间和 ACL 规则版本。若 schema 变更不兼容，采用双写/双读或显式迁移，不能让新客户端静默读取旧字段。

## 九、缓存、引用与跨服务泄露面

缓存通常有 embedding cache、检索结果 cache、rerank cache、最终回答 cache。它们的 key 至少要考虑：

```text
tenant + authorization scope/epoch + query canonical form
+ index version + embedding/retrieval config + prompt/model version
```

对于最终答案缓存，还要考虑输出中是否包含用户私有上下文、对话状态和个人数据。相似问题的语义缓存只能在相同授权边界与相同知识版本内复用；“跨 tenant 提升命中率”是明显的错误优化方向。

## 十、容量、配额与滥用防护

多租户检索除了安全，还要防止资源争用：

- 为租户设文档数、向量数、写入 QPS、查询 QPS 和 token 预算。
- 异步入库使用幂等 `document_version_id`，避免重复上传产生双倍索引。
- 大租户的重建任务限速并隔离，不能把全局索引写入队列打满。
- 检索请求限制 top-k、filter 复杂度和查询长度，防止昂贵的宽过滤扫描。
- 对探测型请求、频繁空召回和异常相似度扫描做审计与速率控制。

配额拒绝应返回可操作的错误，不应泄露其他租户的容量或索引状态。

## 十一、评测与安全测试

| 测试类别 | 例子 | 验收点 |
| --- | --- | --- |
| 越权检索 | 用户 A 查询用户 B 独有条款 | 不返回文本、标题、相似度或引用 |
| 权限撤销 | 查询缓存后撤销角色 | 下一次请求不命中旧缓存 |
| 删除传播 | 删除文档后查询相似问法 | 所有索引与缓存均不可命中 |
| 版本一致性 | 制度更新过程中持续查询 | 单次回答不混用两个版本 |
| 过滤性能 | 高基数 ACL + 并发查询 | P95 延迟与 Recall@k 满足目标 |
| 恶意文档 | 文档内含注入指令 | 内容只作为证据，不驱动工具 |

上线门禁应包含索引完整率、授权过滤正确率、授权集合内召回、删除/撤权 SLA 和缓存隔离测试。仅在公开数据集上得到高检索分数，不能证明企业 RAG 可上线。

## 十二、高频面试问答

**Q：为什么不能向量检索后再做权限过滤？**

因为未授权候选会占据 top-k，导致授权内容召回不足；相似度、标题或后续 rerank 也可能泄露信息。权限条件必须成为向量库/检索引擎的查询约束，在召回前下推执行。

**Q：共享 collection 和每租户 collection 怎么选？**

小租户多、访问模式相似时共享 collection 加硬过滤更经济；监管、高价值或超大租户可独立 collection/集群以换取更强隔离和可预测性能。可采用分层架构，关键是网关强制路由和迁移流程，而不是命名约定。

**Q：文档删除后如何证明不会再被回答？**

用 document-version 血缘定位原件、解析、向量、倒排、视觉索引和缓存；删除工作流记录每层完成状态。线上查询还带索引版本和 ACL epoch，避免旧缓存命中；用语义相近的回归问题验证删除后不可召回。

**Q：索引重建怎样避免影响线上？**

在后台构建新版本，进行数据完整、ACL 和检索回归校验；先 shadow compare，再通过 alias 原子切换。保留旧索引直到回滚窗口结束，缓存 key 带 index version，避免新旧结果混用。

**Q：metadata filter 会降低召回，怎么办？**

安全边界不能放宽。应优化数据模型、在授权集合内评测、使用适配 filter 的索引与分片、把文档类型/时间等条件显式结构化，并在授权候选不足时请求澄清或返回无证据。

## 十三、项目讲法模板

> 我负责企业知识库的多租户检索边界。我们将 tenant、文档版本、数据等级和 ACL 标签继承到每个 chunk、向量和缓存 key；查询时由身份服务注入授权上下文，向量库在召回前执行 filter，rerank 和 LLM 只处理授权证据。索引更新采用不可变版本和 alias 原子切换，权限变化通过 ACL epoch 主动失效缓存，删除工作流覆盖对象、解析、向量、倒排和视觉索引。我们用越权查询、撤权缓存、删除传播和版本一致性作为发布门禁，既保证了权限隔离，也让重建和回滚可运营。

继续学习：[RAG 生产化与系统设计](/rag/rag-production)、[RAG 评估](/rag/rag-evaluation)、[富文档与多模态 RAG 系统设计](/interview/multimodal-rag-document-intelligence-playbook)、[数据分级与外发审计](/interview/data-governance-egress-audit-qna)、[LLM 数据标注与偏好数据运营](/interview/llm-data-feedback-operations-playbook)。
