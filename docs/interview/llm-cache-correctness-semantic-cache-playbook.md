# LLM 缓存正确性与语义缓存控制面

> 缓存是大模型应用最容易被说成“加个 Redis 就行”的部分，也是最容易制造跨租户泄露、旧知识复用和错误答案放大的部分。高质量的系统设计回答不止解释精确缓存、语义缓存和 prefix cache 的区别，还要说明：**什么可以复用、谁可以命中、何时失效、命中后如何继续验证、如何用实验证明节省的成本没有变成业务风险。**

## 一、问题定义：缓存优化的是哪一段路径

一次 LLM 请求的完整开销通常由输入 token 的 prefill、输出 token 的 decode、检索、工具调用、网络和排队组成。不同缓存命中的是不同阶段：

```text
用户请求
  -> 身份/策略/预算
  -> 精确响应缓存 --------命中--> 直接返回已验证答案
  -> 语义缓存 ------------命中--> 复用候选答案或候选证据
  -> 检索结果缓存 --------命中--> 跳过向量检索/重排
  -> Prompt/KV 前缀缓存 --命中--> 复用模型内部预填充状态
  -> 模型与工具执行
```

它们不能互相替代：KV 前缀缓存节省的是模型计算，通常不改变回答语义；精确响应缓存复用最终文本，命中精确但覆盖率低；语义缓存覆盖更大，却必须证明两个请求在**事实、权限、时间、输出契约和行动风险**上可以等价。把这些混成一个“cache hit rate”，会让系统无法解释命中为何安全或为何错误。

## 二、缓存类型与信任边界

| 类型 | Cache key 的核心 | 复用对象 | 主要收益 | 最大风险 |
| --- | --- | --- | --- | --- |
| 精确响应缓存 | 规范化后的完整请求及影响输出的版本 | 已验证最终响应 | 最低延迟、直接省模型 token | key 漏了权限/版本导致错答 |
| 语义响应缓存 | 查询 embedding + 强约束 metadata | 相似问题的响应或答案草稿 | 提高覆盖率、降低重复问答成本 | 近似相似不等于业务等价 |
| 检索结果缓存 | query、过滤器、索引版本 | chunk id 与排序结果 | 省 embedding/retrieval/rerank | 过期或 ACL 变化后返回错误证据 |
| Prompt/KV 前缀缓存 | token 完全相同的前缀 | K/V 状态 | 降 TTFT 和 prefill 计算 | 缓存驱逐、隔离、计费误判 |
| 工具结果缓存 | 工具名、已授权参数、数据版本 | 只读工具结果 | 降外部 API 压力 | 把实时状态当成静态数据 |
| 负缓存 | 确定的不可用/无结果/拒绝结果 | 短期失败信号 | 防止重试风暴 | 把瞬时错误或权限变更固化 |

第一原则是：**缓存复用的是一个经过授权和验证的计算结果，不是“看起来接近的一段文本”。** 对写操作、实时价格、账户余额、医疗/法务结论、可执行审批等高风险任务，默认不应直接命中语义响应缓存；最多缓存经过权限控制的只读中间结果，且仍由当前请求重新做业务校验。

## 三、精确响应缓存：key 不是 prompt 的 hash

只用 `hash(prompt)` 作为 key 是常见缺陷。模型最终响应还受到 system 指令、模型 revision、temperature、top_p、工具定义、检索索引、输出 schema、用户权限、地域策略和当前时间语义影响。一个更完整的逻辑 key 可写为：

```text
cache_key = hash(
  tenant_scope + subject_scope + policy_version +
  normalized_messages + prompt_version + model_revision +
  decoding_profile + output_contract +
  retrieval_snapshot + tool_contract + locale + time_bucket
)
```

不必把所有字段无差别塞进 key。正确做法是先做一次“输出依赖分析”：若某字段改变会改变允许看到的证据、模型行为、输出格式或事实有效性，它必须进入 key 或成为强制失效条件；若字段不会影响结果，可排除以提高命中率。这个判断应写成版本化策略，而不是散落在业务代码中。

### 3.1 规范化不等于丢掉语义

精确缓存可做安全的规范化，例如 Unicode 归一化、无意义空白折叠、稳定 JSON key 顺序、去除不可见控制字符。但不要擅自删除数字、时间、否定词、单位、代码块或引用范围。`“预算不超过 10 万”` 与 `“预算超过 10 万”`，语义距离可能很近，业务含义却相反。

### 3.2 缓存 value 也要有证据

缓存条目不应只保存 `answer: string`。推荐保存产生该答案的证据和版本：

```json
{
  "answer": "...",
  "citations": [{"doc_id": "policy-17", "chunk_id": "c-92", "revision": "r31"}],
  "model_revision": "model-x@2026-07-12",
  "prompt_version": "support-v9",
  "policy_version": "p-2026-07-18",
  "validation": {"schema": "pass", "citation": "pass"},
  "created_at": "...",
  "expires_at": "..."
}
```

有了 evidence set，文档删除、ACL 变化、模型升级和线上事故才能按依赖关系精准失效；没有它只能粗暴清空所有缓存，或更糟地继续返回无法解释的旧答案。

## 四、语义缓存：相似度只是候选召回

语义缓存通常把请求编码成向量，到向量库中找历史查询，再以余弦相似度或向量距离判断是否复用。这里最重要的设计是把它拆成两段：

1. **候选召回**：embedding 负责找到可能相近的历史请求，追求高召回。
2. **命中判定**：规则、metadata、reranker、小模型分类器或 verifier 决定当前请求能否安全复用，追求高精度。

不能让 embedding 距离直接等同于“可回答同一个问题”。例如“北京到上海的高铁票退改规则”和“北京到上海的机票退改规则”文本非常相似，却不能共享答案；“我能否看到合同 A？”和“同事能否看到合同 A？”的语义相似，但权限主体不同。

### 4.1 一个保守的命中判定器

```text
semantic_hit =
  vector_similarity >= threshold_by_intent
  AND tenant_scope == cached.tenant_scope
  AND authorization_fingerprint == cached.authorization_fingerprint
  AND knowledge_snapshot compatible_with cached.evidence_set
  AND prompt/model/policy/output-contract compatible
  AND request_has_no_high_risk_side_effect
  AND semantic_verifier(current_request, cached_request, cached_answer) == PASS
```

`threshold_by_intent` 不应使用全局固定阈值。FAQ、内部政策问答、代码解释、交易查询和操作指令的可接受风险不同，应该拥有不同阈值、不同 verifier 和不同 TTL。更成熟的做法是让语义缓存输出校准分数，按风险预算选择命中覆盖率，而非单纯追求 hit rate。

### 4.2 回答缓存、证据缓存与草稿缓存

- **回答缓存**：直接返回最终答案，收益最高，准入门槛也应最高。
- **证据缓存**：复用已授权的检索候选或工具只读结果，再由当前请求重新生成。风险和收益居中。
- **草稿缓存**：把历史答案作为低权重的草稿或 few-shot 参考，不直接展示给用户；可降低生成成本，但仍需当前模型校验。

面试中提出“分级复用”很加分：高风险任务只允许证据缓存，低风险稳定 FAQ 才允许回答缓存，写操作禁止响应缓存命中后直接执行。

## 五、权限、多租户与数据隔离

缓存层必须在模型之前执行，但**授权判断也必须在缓存之前执行**。如果先按语义找到了答案、再想补 ACL，很容易因为缓存条目不带完整证据而无法判断它是否可见。

推荐的隔离层次：

1. **硬隔离**：不同环境、地域、监管域或最高敏感级租户使用物理或逻辑上独立的 cache namespace。
2. **作用域隔离**：key 至少包含 tenant、组织、角色/ABAC 标签和数据域；不要只包含 user id，因为角色变化也会改变可见性。
3. **证据再授权**：若缓存携带 RAG 证据，命中时对每个 `doc_id/chunk_id` 在当前身份下重新确认可见，或用精确的 authorization fingerprint 保证等价。
4. **响应脱敏**：缓存前和命中后都执行敏感数据策略；历史答案本身可能含有当时合法、现在不应展示的字段。

最危险的事故场景是“同一问题不同用户问，缓存命中后返回上一个用户的答案”。所以缓存命中日志要记录 scope hash、证据版本和 policy decision，但不能把明文身份或敏感内容直接写进指标标签。

## 六、一致性：哪些事件会让缓存失效

LLM 缓存通常接受最终一致性，但不能接受“无边界的陈旧”。失效策略应由数据和风险驱动。

| 事件 | 推荐动作 | 原因 |
| --- | --- | --- |
| 文档新增/更新/删除 | 按 doc/chunk 反向索引失效相关答案与检索结果 | 避免引用旧条款 |
| ACL、角色、组织关系改变 | 失效对应 scope；高风险域立即失效 | 可见性变化不是普通 TTL 可解决 |
| prompt/model/policy/schema 发布 | 使用版本 key 或双写新 namespace | 避免新版本读取旧行为 |
| 工具数据版本推进 | 按 resource version 失效或缩短 TTL | 实时状态不可被长期复用 |
| 安全事件或错误答案 | 通过 answer/evidence id 主动 purge 并加入 denylist | 防止错误被反复放大 |
| 上游短暂 429/5xx | 短 TTL 负缓存，区分可重试与永久错误 | 防止重试风暴 |

### 6.1 为什么只用 TTL 不够

TTL 适合控制陈旧窗口，却不知道“哪一份政策刚被删除”。若所有条目统一设置 24 小时 TTL，删除敏感文档后最坏会暴露 24 小时；若缩短到 1 分钟，命中率和成本收益又会急剧下降。解决方向是 **TTL + 事件驱动失效 + 版本化 key + 反向依赖索引** 的组合。

反向索引示例：`doc_id -> cache_entry_ids`、`chunk_id -> cache_entry_ids`、`policy_version -> namespace`。文档更新事件进入消息队列，消费者执行幂等 purge；若事件丢失，应有定期 reconciliation 比对索引版本与缓存版本。

## 七、缓存穿透、击穿与雪崩在 LLM 中的表现

- **穿透**：不存在的实体或永远无答案的问题不断请求，导致每次都调用昂贵模型/检索。可以使用短 TTL 负缓存、输入校验、意图识别和速率限制。
- **击穿**：热门条目过期瞬间，成千请求同时回源模型。使用 request coalescing/singleflight，让一个 leader 回源、其余等待同一 future；需要设置超时和失败广播语义。
- **雪崩**：大量条目同时过期或模型故障，回源流量打满 GPU/上游 API。TTL 加随机抖动、分批预热、分级降级、缓存陈旧可用（stale-while-revalidate）和预算熔断共同应对。

`stale-while-revalidate` 只能用于允许短暂陈旧的低风险内容，且响应要带可观测的 `stale=true` 标识；不能对权限、金额、库存、审批和安全策略无条件启用。

## 八、观测、评测与发布门禁

缓存的北极星指标不是命中率，而是**在正确性与权限约束下节省的有效成本**。至少跟踪：

| 指标 | 解释 |
| --- | --- |
| exact/semantic/retrieval/prefix hit rate | 分层命中，而不是混成一个数 |
| safe reuse precision | 被复用答案中经抽检或 verifier 确认正确的比例 |
| false-hit rate | 不应命中却命中的比例，按租户/意图/风险切片 |
| avoided tokens / avoided tool calls | 真正避免的 prefill、decode 和外部调用量 |
| stale serve rate | 返回陈旧条目的比例与持续时间 |
| invalidation lag | 源事件到相关条目全部失效的时间 |
| cache-induced incident count | 缓存导致的越权、旧知识、错答事故 |

发布语义缓存策略前，离线评测集必须包含最容易误命中的对：否定与肯定、不同金额/日期/单位、不同租户/角色、版本冲突条款、相似产品、相似但不同的代码接口。灰度时比较的不只是成本，还要比较命中与未命中两组的任务通过率、引用覆盖、人工转接率和投诉率。任何权限泄露或关键事实误命中都应是硬门禁。

## 九、系统设计题：设计企业 LLM 缓存控制面

### 9.1 需求澄清

先问清：缓存的是聊天 FAQ、RAG 回答、工具结果还是模型 KV？是否多租户、是否有 ACL、哪些数据必须实时、是否允许 stale、峰值 QPS/TPM、可接受的错误命中率和 P95 延迟是什么。没有这些前提就给“Redis + 向量库”方案，通常拿不到高分。

### 9.2 推荐架构

```text
Client
  -> AuthN/AuthZ + policy decision
  -> Cache policy engine
       -> exact cache (scope/version key)
       -> semantic candidate index
       -> verifier + evidence compatibility check
       -> retrieval/tool cache
  -> LLM orchestrator / model gateway
  -> output validator + citation checker
  -> cache writer + dependency index + audit stream

Knowledge/ACL/model/prompt events
  -> invalidation bus -> purge workers -> reconciliation job
```

策略引擎负责“是否允许查、是否允许写、可否返回陈旧、TTL、阈值、命中后必须经过哪些校验”。它应由配置和策略版本驱动，避免每个业务各自复制相似度阈值和失效逻辑。缓存写入只接受通过 schema、安全、引用或业务校验的结果；失败输出和未经验证的模型草稿不应进入高优先级响应缓存。

### 9.3 可用性与降级

缓存系统不可用时，正确降级是回源到正常 RAG/模型路径并受预算/限流保护，而不是把“缓存服务异常”伪装成答案。语义向量库不可用时可以只使用精确缓存，或禁用语义命中；失效总线异常时应切换到更保守 TTL/版本 namespace，必要时禁用跨请求答案复用。对写操作和高风险查询，宁可缓存未命中也不能在权限不确定时放行。

## 十、面试高频问答

### Q1：语义缓存和 RAG 有什么区别？

**答法：**RAG 从知识库检索当前问题所需证据，再由模型生成；语义缓存复用历史问题的答案、证据或中间计算。RAG 解决“这次该查什么”，语义缓存解决“是否已有可安全复用的结果”。它们可以组合，但语义缓存不能绕过 RAG 的 ACL、索引版本和引用要求。

### Q2：如何防止语义缓存答非所问？

**答法：**把向量相似度定位为候选召回，而非最终判定；按意图设置保守阈值；强制 tenant/authorization/version 等 metadata 相等；对高风险任务引入 reranker 或 verifier；缓存证据集并在命中时检查兼容性；用相似但语义相反、数值不同的 hard negative 回归测试 false hit。

### Q3：文档更新后怎么让历史回答失效？

**答法：**缓存写入时记录 answer 到 doc/chunk/index revision 的依赖，更新事件通过消息总线触发反向索引 purge；同时 key 包含索引或知识快照版本，防止漏事件时读到旧 namespace。TTL 只作为兜底，不应是删除与权限变更的唯一机制。

### Q4：prefix cache 与语义缓存为什么不能混为一谈？

**答法：**prefix cache 复用 token 完全相同前缀的 KV 状态，只减少 prefill 计算，模型仍会基于当前完整请求生成；语义缓存复用的是跨请求的语义结果，可能直接返回历史答案，因此需要更严格的权限、版本、事实性和失效治理。

### Q5：怎样评价缓存项目是否成功？

**答法：**看受正确性和权限约束的有效收益：避免了多少 token/工具调用和 P95 延迟，命中回答的任务通过率是否不低于回源基线，false hit、陈旧服务、失效延迟和缓存诱发事故是否在门禁内。只报命中率没有意义，阈值放宽就能把它做高。

## 十一、项目讲法

> “我们为企业知识助手设计了分层缓存控制面。精确缓存以租户、权限指纹、模型、prompt、索引与策略版本构造 key；语义缓存只做候选召回，再经过意图阈值和证据兼容性校验。缓存条目保留引用 chunk 与反向依赖，文档更新、ACL 变化和模型灰度都通过事件总线精确失效。发布时用否定词、金额、跨租户和版本冲突样本专项测试 false hit，并把权限泄露和关键事实误命中设为硬门禁。结果以安全复用精度、避免 token、P95 和失效延迟共同衡量，而不是单看命中率。”

这段叙述能把缓存从一个基础设施名词，提升为兼顾成本、可靠性、数据治理与评测的应用工程能力。
