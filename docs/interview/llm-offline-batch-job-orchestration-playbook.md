---
title: LLM 离线批处理与异步作业编排
description: >-
  在线聊天追求 TTFT、P95 和交互体验；离线大模型任务追求单位成本、总吞吐、可恢复性和结果可审计。把百万份文档摘要、历史工单结构化、质检、批量
  embedding、模型评测或夜间报告生成当成“循环调 API”，很快会遇到重复扣费、部分成功、脏数据回写、供应商回调丢失和离线任务挤占在线 SLA。生产设计需要有状态编排与发布门禁。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# LLM 离线批处理与异步作业编排

> 在线聊天追求 TTFT、P95 和交互体验；离线大模型任务追求单位成本、总吞吐、可恢复性和结果可审计。把百万份文档摘要、历史工单结构化、质检、批量 embedding、模型评测或夜间报告生成当成“循环调 API”，很快会遇到重复扣费、部分成功、脏数据回写、供应商回调丢失和离线任务挤占在线 SLA。生产答案应把它设计为有状态、可重试、可验收的作业系统。

## 一、30 秒面试回答

**答法：**我会把离线 LLM 处理拆成提交、规划、分片、执行、校验、汇总和发布七个可恢复阶段。外部调用至少一次投递不可避免，所以每个输入用稳定的 `source_version + transform_version` 派生幂等键，输出以 staging 写入、通过 schema/质量校验后再原子发布。任务队列区分在线与离线资源池，按 token 而不只是按请求数限流；失败按可重试、需人工、永久失败分类，使用指数退避、死信队列和局部重跑。可观测性记录 batch、shard、item、模型/prompt、token、成本和结果版本，验收看完成率、有效吞吐、重复率、质量门禁和单位成功项成本，而不是只看“跑完了多少请求”。

更准确地说，可靠执行通常要应对至少一次投递/重复处理，而非声称所有外部 API 必然采用同一种投递保证。幂等结果发布不等于只调用或只收费一次；业务结果、供应商任务和物理 attempt 应分别计数。

## 二、离线任务与在线请求的目标函数不同

| 维度 | 在线对话 | 离线批处理 |
| --- | --- | --- |
| 首要目标 | 低 TTFT/P95、连续流式体验 | 吞吐、单位成本、完整性、可恢复 |
| 可接受等待 | 秒级 | 分钟到小时甚至天级 |
| 调度方式 | 排队保护、优先级、快速失败 | 分片、背压、预约容量、错峰 |
| 失败语义 | 及时反馈、可重试/降级 | 局部重跑、人工复核、最终汇总 |
| 输出写入 | 即时返回用户 | 版本化产物、检查点、原子发布 |
| 关键指标 | TTFT、TPOT、goodput | items/hour、cost/success、completion、rework |

因此不能把离线大 batch 混在实时聊天的同一队列中。即使 batch API 单价更低，它也可能占满上游 TPM、GPU prefill 或数据库写入带宽，拖垮用户请求。系统应有独立的配额、优先级和容量池，必要时允许在线流量抢占离线任务。

## 三、作业模型：从一次调用升级为可恢复状态机

推荐的实体层级：

```text
Job                 一个业务目标，例如“重建 2026Q2 合同摘要”
  -> Batch          一次提交/版本，例如输入快照 + prompt v12
      -> Shard       可并行的分片，例如按 tenant、日期或 token 预算
          -> Item    最小幂等处理单元，例如 document_version_id
              -> Attempt  一次真实模型/工具调用尝试
```

状态机应该显式拒绝非法跳转：

```text
CREATED -> PLANNING -> QUEUED -> RUNNING -> VALIDATING -> PUBLISHED
                         |          |            |
                         v          v            v
                    CANCELLED   RETRY_WAIT    PARTIAL_FAILED
                                      |
                                      v
                                  DEAD_LETTER
```

`PUBLISHED` 不是“最后一个请求返回 200”，而是所有必须项已通过校验、汇总清单生成、产物版本可追溯且读路径已切换。对允许部分成功的业务，`PARTIAL_FAILED` 也应包含成功范围、失败清单、重跑策略和对下游的可见性约束。

## 四、输入快照、分片与幂等键

### 4.1 为什么必须冻结输入

离线作业通常运行很久。如果任务执行中源文档被编辑、删除或权限改变，直接从“当前表”持续读取会使同一 batch 的结果来自不同时间点，导致无法复现。提交时应记录 input manifest：数据源查询、筛选条件、source snapshot/version、item 清单或可重放游标、prompt/model/tool/policy 版本。

对于需要处理最新状态的任务，也应明确语义：是处理开始时快照、每个 item 读取时最新版本，还是流式增量。三者成本、可重复性和一致性不同，不能默认混用。

**L1：冻结事实不冻结授权。** 一份合同快照在提交时合法，运行到一半撤权或删除后仍需阻断读取/外发/发布。input manifest 记录 tenant、源版本、用途与授权 epoch；worker 在实际读取和提交结果时复核当前策略。模型端、对象存储与日志也属于数据路径，不把私有合同因为“夜间作业”发送到未获批准的 endpoint。文档或回调中的 URL、指令、路径都不可信，执行器只允许受控存储引用与输入 ID。

### 4.2 幂等键不应只用 job id

一个可复用的 item key 形态：

```text
idempotency_key = hash(
  tenant_scope + source_id + source_version +
  transform_name + transform_version +
  prompt_version + model_policy_version + output_schema_version
)
```

这样同一文档版本在同一转换契约下重复投递只会产生一个有效结果；文档更新或 prompt 升级则自然形成新结果版本。外部模型调用可能因超时而“服务端已执行但客户端没收到响应”，所以不能假设 exactly-once；应以幂等写入、可查询 attempt 和去重结果来实现业务上的 effectively-once。

该 key 是逻辑输出身份，不是外部请求自动去重承诺。用数据库唯一约束与条件提交选出唯一 accepted result，winner 规则在运行前固定（如首个通过当前校验的有效 attempt）；重复队列投递不能各自调用后覆盖彼此结果。领取 item 使用 lease/generation，提交时原子检查仍为有效租约。若所有 attempt 内容都不一致，保留 provenance 与未采用结果，不能把“最后到达”当正确答案。

### 4.3 按什么分片

按固定条数分片最简单，但对 LLM 往往不公平：一份 200k token 的 PDF 和一条 20 token 工单成本相差悬殊。更好的规划器会同时考虑：

- 估算输入/输出 token、文件页数、图像数量和工具调用上限；
- tenant 与数据域，便于隔离和归因；
- 数据局部性，例如相同索引、相同模型或相同对象存储分区；
- 业务优先级和截止时间；
- 失败重跑粒度，避免一个坏文件拖住整个巨型 shard。

分片大小是调度控制旋钮。太大，失败恢复慢且长尾明显；太小，队列、数据库和调度开销变高。应通过真实长度分布压测，而非套固定“每批 1000 条”。

## 五、执行层：排队、背压与 token 配额

### 5.1 两级限流

LLM 的成本单位是 token，输出长度又在调用前未知。离线 worker 至少需要：

1. **并发槽位**：限制同时在飞的请求，保护连接、回调和下游写入。
2. **Token budget/TPM**：按估计输入 token 加保留输出 token 预扣，完成后按实际 usage 结算。

若只按 QPS 限流，十个超长文档即可挤掉数千条短任务；若只按预估 token 又不设并发上限，慢调用会累积太多连接和内存。预算耗尽后 worker 应暂停取新任务而非无限重试，等待补充令牌、下一个时间窗或调度器降级。

**L2：token 预算与并发是不同上限。** 构造 quota=600,000 token/分钟、每 item 输入均值 2,000、输出 300，则 token 配额理论上约 260.9 item/分钟；若 20 个并发槽、平均调用 10 秒，则并发约束仅 120 item/分钟。取较小值只是理想预算起点，还要考虑输出长尾、重试、校验与存储背压；Batch API 若使用独立配额或计量口径，应按该 API 文档核查，不能默认与在线 TPM 共用。硬费用上限要预留可执行最大消耗，历史均值不能保证不会超额。

### 5.2 背压不是失败

当模型供应商限流、输出存储变慢或质量校验积压时，调度器应降低派发率，保留队列中的任务而不是把所有 item 标记失败。背压信号可来自：429 比例、队列等待、P95 调用时长、validator backlog、数据库写入延迟、预算消耗速度。把背压与熔断、重试分开，才能避免故障时产生指数级请求放大。

### 5.3 Batch API 与自托管批量推理

供应商 Batch API 适合延迟要求宽松、输入明确、可接受异步回调或轮询的任务，通常以较低单价交换较长完成时限。自托管推理可通过动态批处理提高吞吐，但仍需避免长 prompt 队首阻塞、处理 OOM、隔离低优先级流量。选型时需要比较总成本而不是单价：包括等待时间、失败重跑、数据传输、结果校验、人工复核和运维成本。

提交 provider batch 本身也要可恢复：先记录 submission 意图与输入哈希，成功后存 provider job ID；若创建超时，先用供应商支持的查询/幂等机制确认是否已建，不能立即重新上传整批。缺少可关联查询时标 `submission_unknown` 并对账。回调只触发同步任务，不直接发布；验证回调来源、关联 job，再拉取受控结果。没有可靠回调则有界轮询，注意取消/暂停/失败不是“所有 item 成功”。

结果按稳定 item key 映射，不依赖输出文件行号或完成顺序；重复 key、未知 key、缺项、逐项 error 和文件校验失败分别隔离。完整性检查使用 `planned_ids − returned_ids` 和 `returned_ids − planned_ids`，而不只是行数相同。价格与完成期限按实际合同验证，本页没有实读任何供应商价格表，不承诺统一折扣或 SLA。

## 六、输出写入：staging、校验与原子发布

模型返回成功不代表业务结果可用。正确的写入顺序是：

```text
model result
  -> schema/类型/范围校验
  -> 安全、PII、引用、业务规则校验
  -> 写入 item staging result（带 attempt/provenance）
  -> shard/batch 聚合校验
  -> 原子切换 published manifest 或结果版本
```

例如批量从合同提取付款日期，JSON 可解析不代表日期存在、币种正确、条款可追溯。对关键字段应保存 source span/citation、置信度、校验结果和人工复核状态；无法校验的 item 不应悄悄混入发布集。

### 6.1 为什么不能边跑边覆盖线上结果

若直接覆盖生产索引或客户可见摘要，半批失败、错误 prompt 或模型回归会让用户看到混合版本。staging + manifest 的好处是允许完整跑完、做抽样验收、比较旧新质量后一次性切换；回滚只需切回上一 manifest，而不是逐条修复已覆盖的数据。

“原子发布”应有明确线性化点，例如当前 manifest 指针的条件更新：对比 expected_previous_revision、job generation、用途 epoch 与必需 item 完整性后切换。每个分片上传对象不等于整个发布原子；读者要在一次读取期间固定 manifest 版本。发布历史版本回滚也必须复核当前删除/ACL，不能重新暴露已经撤销的结果；已发送报告、邮件或下游写库另行补偿，指针回切不能收回外部副作用。

## 七、失败分类与重试策略

| 失败类型 | 例子 | 自动动作 | 是否消耗重试预算 |
| --- | --- | --- |
| 瞬时基础设施 | 429、连接超时、5xx | 指数退避 + 抖动，尊重 Retry-After | 是 |
| 容量/预算 | 令牌不足、队列满 | 暂停/延迟调度、申请预算或降级 | 否，等待条件变化 |
| 输入问题 | 空文件、格式损坏、超大页 | 标记永久失败或走专用解析路径 | 否 |
| 输出不合格 | schema 失败、缺引用、字段越界 | 有限修复 prompt/重试，之后人工队列 | 是，且有小上限 |
| 权限/策略 | ACL 拒绝、敏感数据违规 | 不重试，记录 policy decision | 否 |
| 下游写入 | 数据库冲突、对象存储失败 | 幂等重放 staging 写入 | 视错误而定 |

重试必须携带相同 idempotency key，并记录 attempt ordinal、错误类、退避时间和是否真正发出上游调用。死信队列不是垃圾桶：需要可检索的失败上下文、归因标签、修复后重放入口、保留期和告警 SLO。对某个坏 item 的反复失败要隔离，不能让它阻塞整个 shard。

逻辑 key 保持不变，attempt ID 每次新建；若修复改变 Prompt/transform/output schema，则创建新结果版本，不能伪装为原版本的重试。模型结果已持久化但 staging 写入失败时，只重放写入/校验，不再调模型；provider 未知超时则先查询。限流退避和队列 requeue 也要总时间/次数上限，避免 DLQ 自动回流变成永久重试环。

## 八、取消、恢复与部分结果

取消命令可能与 worker 完成写入同时发生。推荐使用 fencing token 或版本化 lease：worker 在提交结果前检查 job/run generation 是否仍有效；取消后的迟到结果只能进入审计或隔离区，不能重新发布。恢复时从已成功 item 的 checkpoint 和 staging manifest 继续，而不是从头重复调用模型。

对于“允许 95% 完成即可”的业务，阈值本身是产品契约：哪些 item 可以缺失、如何标记、是否可供搜索、是否必须人工补齐。不能把完成率 95% 解释为“剩余 5% 随便丢掉”。

取消是停止未来派发和提交，不是已发生计算免费或远端立即停止。先原子推进 job generation，迟到 worker 提交被拒；取消期间到达的 usage 仍入账，敏感输出按保留策略清理，不因审计需要永远存正文。恢复先读当前 generation、用途/撤销账本与 provider job 状态，对账后仅补缺项；不能直接把旧队列备份重放到新版本。部分发布按重要性指定必需项，关键合同缺失时不能由大量低风险成功项凑到 95% 就通过。

## 九、观测与验收指标

| 指标 | 为什么重要 |
| --- | --- |
| end-to-end completion rate | 成功发布的 item/计划 item，而非 HTTP 200 数 |
| useful throughput | 通过校验的 item 或 token / 小时 |
| cost per accepted item | 把模型、重试、工具和人工复核一起计入 |
| retry amplification | 每个有效产物平均产生多少次调用 |
| queue age / deadline miss | 是否已无法在业务窗口内完成 |
| validation reject rate | 模型/模板/数据变化是否让结果变差 |
| duplicate suppression rate | 重复派发/提交中被抑制的比例；不直接等于避免的费用 |
| partial publish / rollback count | 发布流程是否稳定 |

所有指标应能按 tenant、作业类型、数据域、模型、prompt、版本、分片长度和错误类切片。平均成功率很好但某个大租户持续超时，或平均成本下降但质量拒绝率上升，都不能算作成功。

**L3：完成、质量和费用用三个分母。** 构造计划 10,000 个 item、实际 11,000 次模型调用，9,500 个通过校验并发布，总消耗 220 元，则 completion=95%，物理调用/计划项放大=1.1，cost/accepted=220/9,500≈0.02316 元。若以 accepted 作重试放大分母，则是 11,000/9,500≈1.158，必须标明，不混用。校验通过是已执行规则的通过率，不等于人工业务正确率；只抽成功项也会遗漏难例，按风险/失败切片复核并报告不可判定。

夜间窗口预算也要分开输入输出：构造一百万项、均值输入 2,000/输出 200 token、8 小时=28,800 秒，理想需求约 69,444 prefill token/s 和 6,944 decode token/s，另加重试和工具开销。不能把总 token/s 除以纯 decode benchmark。全管道吞吐受读取、模型、validator、发布最慢环节限制；记录计划到达与队列 age，不只在任务“终于完成”后算吞吐。

## 十、系统设计题：夜间处理千万份企业文档

### 10.1 架构

```text
Job API -> metadata DB + immutable input manifest
       -> planner (token-aware shards)
       -> priority queue / scheduler
       -> worker pools (online isolated / batch isolated)
       -> model gateway or Batch API
       -> validators -> staging object/table
       -> batch reconciler -> published manifest

events -> metrics/traces/cost ledger/DLQ/operator console
```

### 10.2 回答顺序

1. 先确认延迟窗口、准确率、允许部分成功比例、数据敏感等级和成本上限。
2. 冻结输入快照，生成 manifest，按 token/风险/租户做分片。
3. 用 idempotency key、staging 与检查点实现可恢复处理。
4. 用并发与 TPM 双限流、优先级队列和在线隔离保护实时业务。
5. 对模型输出做 schema、证据、安全和业务校验，再原子发布版本。
6. 设计 DLQ、局部重跑、取消 fencing、观察成本和质量门禁。

这套回答把大模型调用放入成熟分布式作业的语义里，同时保留了 token、prompt、模型版本和输出校验等 LLM 特有约束。

## 十一、高频面试问答

### Q1：为什么离线任务也需要幂等？

**答法：**网络超时、回调丢失、worker 重启和队列至少一次投递都会造成重复执行。模型调用既贵又可能有副作用，不能依赖“不会重复”。应由 source version、转换版本和输出契约构造稳定幂等键，结果写入做唯一约束，重复 attempt 只关联同一有效产物。

### Q2：如何避免离线任务拖垮在线聊天？

**答法：**物理或逻辑隔离 worker/GPU 池与队列；在线拥有更高优先级和保留容量；离线按 token 预算、并发和背压调度；监控在线 P95、队列 age 和预填充占用，当在线 SLO 告警时自动降速或暂停离线派发。

### Q3：Batch API 半批成功怎么处理？

**答法：**不要把批次作为唯一重试单位。输出按 item key 对齐，成功项经校验写 staging，失败项分类进入重试/DLQ/人工队列；reconciler 根据 manifest 生成完成报告。确认成功项不再调用可避免主动重跑它们，但未知提交和供应商重复执行仍可能收费，需按 job/attempt 对账，不能承诺永无重复费用。

### Q4：怎么证明批处理成本优化没有牺牲质量？

**答法：**将“通过校验的有效结果”作为分母，比较不同模型、Batch API、prompt 和分片策略下的 accepted-item cost、字段准确率、引用覆盖、人工复核率、完成时限和重试放大。只比较 API 单价或请求成功率无法证明业务收益。

## 十二、项目讲法

> “我们把百万文档抽取从同步循环改成了版本化异步作业。提交时冻结 input manifest，按 token 和租户分 shard；每个 document version 与 prompt/schema/model policy 生成幂等键。worker 在独立离线池按并发和 TPM 双预算处理，结果先过 schema、引用和字段规则后写 staging，全部达标才切换 manifest。429 与 5xx 退避重试，坏文件和反复 schema 失败进入 DLQ，支持按 item 局部重跑。我们按有效产物成本、完成率、队列 age、质量拒绝率和重复抑制率运营，在线 SLO 紧张时自动暂停离线派发。”

这类项目故事能清楚展示：你不只是会调用 Batch API，而是能把 LLM 推理嵌入可靠、可审计、可控成本的数据处理系统。

实读主源：[Kubernetes Job 官方说明](https://kubernetes.io/docs/concepts/workloads/controllers/job/)中单并发也可能重复启动、backoff 与 successPolicy 片段；[Google Gen AI Python SDK](https://github.com/googleapis/python-genai/blob/main/README.md)的 Batch Prediction 示例中输入 key、upload/create、按 job name 查询与 state 轮询。SDK main 示例不是完整 API 契约，且其平台支持说明需部署时再核。Gemini Batch 网页因 TLS 错误未读，仅作为待核入口；没有运行批任务、上传数据、实测吞吐或验证供应商折扣，全部数值为构造。
