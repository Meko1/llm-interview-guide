# RAG、Memory 与评测安全高频问答

> 本页回答 RAG 和 Memory 本身如何评；当面试官继续问“索引、Prompt、模型改动怎样通过发布审批”，可使用 [LLM 评测与发布门禁实战](/interview/evaluation-release-gates) 中的版本、门禁和灰度闭环。
>
> 对索引 canary、租户切片、删除传播、知识新鲜度和线上错误预算，继续看 [LLM 线上评测、灰度实验与质量运营面试题](/interview/online-evaluation-rollout-operations)。

> 这页面向 RAG / AI Search、Agent 工程、LLM 应用开发和 AI 平台岗位。目标是把“企业知识库怎么上线、Agent 记忆怎么管、如何证明系统可靠、安全合规怎么过审”整理成面试可直接复述的答案。

## 怎么用这页

- RAG / AI Search 岗：重点刷生产链路、切分检索、权限、删除、缓存和评估。
- Agent 工程岗：重点刷 Memory、工具轨迹评估、HITL、成本和安全门禁。
- Java / LLM 应用岗：重点刷多租户知识库、引用溯源、审计、降级和线上 bad case。
- AI 平台岗：重点刷评测集、上线门禁、监控、合规审计和数据治理。

答题结构建议固定为：**链路拆解 -> 指标证据 -> 权限/安全 -> 成本延迟 -> 回归闭环**。

## RAG 生产化

**Q：生产 RAG 和 demo 最大差距是什么？**

Demo 是“文档切块、向量入库、检索拼 prompt”；生产 RAG 是数据管道、检索系统、权限系统、生成系统、评估系统的组合。真正难点在增量更新、删除不漏、权限过滤、缓存失效、引用溯源、延迟成本和 bad case 回流。

**Q：企业 RAG 的离线链路怎么讲？**

数据源接入后先解析清洗，保留标题、表格、页码、来源；按结构切分并生成 `doc_id -> chunk_id` 映射；对 chunk 做 embedding 并写向量库、倒排索引和元数据；变更时按文档版本增量更新；删除时必须删除旧 chunk；索引带版本，便于灰度和回滚。

**Q：在线链路怎么讲？**

用户 query 先做权限上下文解析，再做 query rewrite / multi-query；向量召回和 BM25 召回都带 ACL 过滤；多路结果融合后 rerank；上下文组装时去重、压缩、排序、加引用编号；生成时要求只依据材料回答；最后做引用回填、日志审计和用户反馈收集。

**Q：RAG 答错了怎么定位？**

按四步拆：第一看召回 Top-K 有没有正确 chunk；第二看 rerank 有没有把正确 chunk 排上来；第三看最终注入 context 有没有丢信息、重复或冲突；第四看生成是否忠于材料。检索没命中先修检索，召回正确但答案错再修上下文组装、prompt 和模型。

**Q：为什么 RAG 权限不能靠 prompt？**

prompt 不是安全边界。越权文档一旦进入上下文，模型就可能泄露。权限必须在检索阶段执行：向量召回、BM25 召回、rerank 前后和生成前都要校验 tenant/user/role/doc ACL。trace 要记录命中文档和权限判断，便于审计。

**Q：文档更新、删除和缓存怎么保证一致？**

文档更新要按 `doc_id` 删除旧 chunk 再写新 chunk，内容 hash 不变的块可跳过重嵌入。删除要传播到向量库、倒排索引、对象存储和缓存。检索结果缓存、生成缓存和语义缓存都要带 `index_version`、权限范围、prompt 版本和模型版本，否则会返回旧答案或越权答案。

## Chunking / Retrieval / Rerank

**Q：chunk size 和 overlap 怎么定？**

没有通用答案，要按文档结构、问题粒度和评估集调。制度/FAQ 可小一些，技术文档和表格要保留结构，长段落可父子分块。overlap 是为避免边界切断语义，但过大也会制造重复和 token 浪费。面试要强调“用评估集找拐点”，不是背一个固定值。

**Q：为什么要混合检索？**

向量检索擅长语义相似，BM25 擅长专有名词、编号、人名、条款号。企业知识库经常有“产品型号、制度编号、字段名”，纯向量容易漏召回，所以常用向量 + BM25 多路召回，再用 RRF 或 rerank 融合。

**Q：Rerank 为什么高性价比？**

向量召回是 bi-encoder，速度快但粗；rerank 是 cross-encoder，把 query 和候选文本一起看，准确但慢。生产里常见“召回 50 条、rerank 取 5 条”，用小成本显著提高注入上下文质量。

## Agent Memory

**Q：Memory 和 RAG 有什么区别？**

两者检索侧都像 RAG，但写入侧不同。RAG 知识库多是离线导入的外部文档；Memory 是 Agent 在交互中持续产生、抽取、更新和删除的个体化状态。Memory 的难点不是向量检索，而是什么该写、何时写、写成什么粒度、冲突怎么处理、用户怎么查看和删除。

**Q：记忆应该存什么？**

存稳定偏好、关键事实、任务结论、用户明确纠错和可复用规则，不存完整对话流水。条目要原子化，带 scope、source、confidence、created_at、updated_at、expires_at。个人记忆、团队记忆、组织知识必须隔离。

**Q：错误记忆怎么治理？**

写入前先检索相似旧记忆，判断新增、更新、合并或删除；写入后带来源和置信度；低置信度不强注入；过期记忆要衰减或归档；用户要能查看、修改、删除记忆。记忆写得越自动，越要重视误写、冲突和隐私。

**Q：Long Context 能替代 Memory 吗？**

不能。Long Context 解决“本轮放得下”，Memory 解决“跨会话该记什么、何时召回、如何更新、如何删除和审计”。生产里通常是近期上下文、摘要、外部记忆混用。

## Agent 评估与可靠性

**Q：如何判断 Agent 能不能上线？**

不能只看最终答案，要看四类：Outcome 是否完成任务，Trajectory 是否合理，Cost 是否在预算内，Safety 是否越权或产生高危副作用。工具调用还要拆：该不该调、调哪个、参数对不对、顺序是否合理、失败后是否恢复。

**Q：Agent 评测集怎么设计？**

至少三类：Golden Set 覆盖核心高频任务；Adversarial Set 覆盖注入、越权、缺参、工具异常、模糊指令；Regression Set 来自线上 bad case。每条样本不仅要有用户问题，还要有期望结果、允许/禁止工具、关键参数、最大步数、成本预算和安全约束。

**Q：为什么要评轨迹？**

最终答案对，不代表过程安全。Agent 可能绕 20 步、调用了不该调用的工具、泄露了权限数据、重复执行写操作。轨迹评估能发现工具误选、参数错误、冗余调用、失败恢复差和高危动作未确认。

**Q：上线门禁怎么设？**

可以设硬门禁：高危写操作未确认执行为 0；越权工具实际执行为 0；Golden Set 不低于旧版本；关键场景必须通过；P95 成本和延迟不超预算；注入和安全集达到阈值；失败可回滚到旧模型、旧 prompt、旧工具 schema。

## 安全合规

**Q：RAG / Agent 合规评审看什么？**

看数据分类、权限边界、数据出境、PII 脱敏、日志脱敏、保留期限、删除链路、审计证据和人工复核。面试里要说明：LLM 只是系统一环，真正合规靠数据治理、服务端权限、审计和上线门禁。

**Q：Prompt Injection 怎么影响 RAG 和 Agent？**

RAG 检索到的网页、邮件、文档可能含“忽略系统指令、泄露机密”的恶意内容。工具结果也可能携带注入。处理方式是指令/数据隔离，检索内容作为不可信数据，不能覆盖 system 指令；高危工具二次确认；对抗集评估注入拦截率和误拒率。

**Q：面试官问“怎么证明系统安全可靠”，怎么答？**

给证据链：权限过滤发生在检索和工具服务端；trace 记录文档、工具、参数和审批；上线前跑 golden、adversarial、regression 三类评估集；线上监控越权拒绝、注入拦截、误拒率、成本延迟和用户反馈；bad case 回流到评估集。

## 项目讲法

### 企业知识库 RAG

> 我们把 RAG 拆成离线索引和在线检索两条链路。离线侧做文档解析、结构切分、embedding、向量库和 BM25 双索引，chunk 带 tenant、role、source、page、updated_at 和 index_version。在线侧 query rewrite 后做向量 + BM25 多路召回，两路都带 ACL，rerank 后组装带引用编号的 context。上线门禁看 Recall@K、忠实度、引用准确率、拒答率、P95 延迟和 token 成本；线上 bad case 回流评估集。

### 长期助理 Memory

> 我们没有把所有对话原文写入记忆，而是抽取原子化事实和偏好，带来源、置信度、scope 和过期时间。写入前先查相似旧记忆，判断新增、更新、合并或删除。召回时按 relevance、recency、importance、confidence 和 privacy risk 打分，只注入少量高价值记忆，并给用户查看和删除入口。

### Agent 上线评估

> 我们把 Agent 当成多步系统评估，而不是只看最终回答。评测集里记录期望结果、允许工具、禁止工具、关键参数、最大步数和成本预算。上线前跑结果评估、轨迹评估、工具参数评估、安全对抗集和成本延迟门禁；线上 trace 记录 LLM、RAG、Memory、Tool、Judge 的 span，失败 case 回灌回归集。

## 面试前 30 分钟速背

- RAG 排障先分检索、rerank、上下文、生成，不要上来调 prompt。
- 权限必须在检索和工具服务端做，prompt 不是安全边界。
- 删除和缓存一致性要带 `doc_id`、`chunk_id`、`index_version`、权限范围和 prompt/model 版本。
- Memory 难点在写入、冲突、过期、隐私和用户可删，不是“存向量库”。
- Agent 评估看 Outcome、Trajectory、Cost、Safety。
- 高危工具未确认执行、越权工具实际执行，应作为上线硬红线。

## 延伸阅读

- [RAG 基础与完整流程](/rag/rag-basics)
- [RAG 生产化与系统设计](/rag/rag-production)
- [RAG 评估（RAGAS）](/rag/rag-evaluation)
- [Agent 记忆系统](/agent/agent-memory)
- [Agent 评估与可靠性工程](/agent/agent-evaluation)
- [Agent 评测与安全合规高频问答](/interview/agent-evaluation-safety-qna)
- [AI 安全合规与治理](/advanced/governance)
