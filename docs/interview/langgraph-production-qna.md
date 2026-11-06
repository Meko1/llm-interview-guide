---
title: LangGraph 状态图 Agent 生产化高频问答
description: >-
  这页不重复讲 LangGraph 基础 API，而是模拟面试官连续追问：State 怎么拆、checkpoint 怎么恢复、人审怎么
  resume、写操作怎么防重复、trace 和上线门禁怎么做。系统设计细节见 LangGraph 生产化与系统设计。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# LangGraph 状态图 Agent 生产化高频问答

> 这页不重复讲 LangGraph 基础 API，而是模拟面试官连续追问：State 怎么拆、checkpoint 怎么恢复、人审怎么 resume、写操作怎么防重复、trace 和上线门禁怎么做。系统设计细节见 [LangGraph 生产化与系统设计](/engineering/langgraph-production)。

## 怎么用这页

如果面试官问“你用过 LangGraph 吗”，不要只背 State / Node / Edge。更好的回答顺序是：

1. **为什么用**：复杂 Agent 有分支、循环、状态、人审和恢复需求。
2. **怎么设计图**：把不确定性限制在少数 LLM 节点，把可预期失败做成条件边。
3. **State 怎么管**：业务状态、控制状态、临时状态、审计状态分开。
4. **副作用怎么控**：写操作 prepare/commit、幂等键、pending action、外部状态查询。
5. **怎么上线**：trace、golden set、恢复演练、安全门禁、成本指标。

可复述版本：

> 我会把 LangGraph 当作生产状态机，而不是 prompt 串联器。图结构约束路径，State 支撑恢复和审计，checkpoint 支撑断点续跑，人审节点控制高危动作，写工具用幂等和 pending 状态避免重复副作用，最后用 trace 和评估集做上线门禁。

## 追问链一：State 怎么设计

**面试官：LangGraph 的 State 应该怎么拆？**

标准答法：

> 我会把 State 拆成业务状态、控制状态、临时状态和审计状态。业务状态用于恢复和权限判断，控制状态用于条件边和限步，临时状态只存可重算结果的引用或摘要，审计状态记录 trace、prompt 版本、模型版本和审批状态。

| State 类型 | 该放什么 | 不该放什么 |
| --- | --- | --- |
| 业务状态 | task_id、tenant_id、user_id、目标、业务单号 | 大段原始文档、密钥、完整 PII |
| 控制状态 | step_count、retry_count、risk_level、next_action | 只给模型看的解释性长文本 |
| 临时状态 | retrieved_doc_ids、draft_id、tool_result_ref | 可重算的大对象全文 |
| 审计状态 | trace_id、graph_version、prompt_version、approval_id | 无法脱敏的敏感明文 |

**继续追问：哪些字段应该进 checkpoint，哪些只存引用？**

回答要点：

- 进 checkpoint：恢复路径必需字段、当前节点、控制计数、审批状态、工具调用状态、版本号。
- 存引用：长文档、原始工具返回、附件、检索大结果、模型中间草稿。
- 不长期存：密钥、token、完整隐私字段、可从业务库重新查询的冗余数据。

反例：

> “把全部 messages 和工具返回都存进去”不是好答案。短期能跑，长期会造成 checkpoint 膨胀、隐私风险和恢复不稳定。

State 四分法是本文建模建议，不是框架固定字段。业务身份应由可信执行上下文提供并在读取/写入时重验，不能从 checkpoint 中的 `role` 直接授权。只存文档引用会减少体积，但恢复时必须确认引用版本、可见性和删除状态；重新检索的结果不一定与旧状态一致。

## 追问链二：Checkpoint 与外部副作用

**面试官：Checkpoint 恢复时，外部写操作已经成功了，怎么避免重复扣款、重复发邮件或重复建单？**

标准答法：

> Checkpoint 只能恢复图状态，不能保证外部世界没有变化。写操作节点必须有业务幂等键和 pending action。恢复时先用 action_id 或 idempotency_key 查询外部系统状态：如果已成功，就把结果写回 State 并跳过 commit；如果失败或未知，再决定重试、补偿或转人工。

写操作节点可以按这个流程讲：

```text
prepare_action
  -> 生成 action_id / idempotency_key
  -> 写 pending_action
  -> checkpoint
  -> commit_action
  -> 记录 external_id / committed 状态
```

**继续追问：如果外部系统不支持幂等怎么办？**

回答要点：

- 在本系统建立 action 表，保证同一个 action 只会被一个 worker 执行。
- 对高危写操作串行化，不做并行 tool calls。
- 执行前查业务状态，执行后记录外部单号。
- 失败进入人工处理或补偿队列，而不是让 Agent 自由重试。

一句话：

> 不支持幂等的外部系统，不能靠模型“谨慎一点”解决，要靠本系统的 action 状态机兜住。

action 表与单 Worker 只能减少并发，不足以证明 exactly-once。构造窗口：Worker A 已发邮件，未保存 external_id 就崩溃；租约到期后 B 接手，不知道邮件是否已发。即使串行化仍可能重复。若远端没有稳定操作查询/唯一业务键，`unknown` 应暂停并人工对账，不自动重试。只做“执行前查一次”也有检查与写入之间的竞态。

## 追问链三：Human-in-the-loop 怎么做

**面试官：Human-in-the-loop 在图里怎么设计？用户审批通过后怎么 resume？**

标准答法：

> 人审需要持久化 checkpointer 和稳定 thread_id。先准备不可变动作及幂等审批单，再在节点中 interrupt；审批后由受权后端用 Command(resume=...) 恢复同一 thread。它不是任意跳到 commit：动态 interrupt 所在节点会从开头重新运行，resume 值成为 interrupt 的返回值，再由代码选择批准/拒绝分支。过期由应用策略处理，不能假设框架会自动超时取消。

[LangGraph 官方 interrupts 文档](https://docs.langchain.com/oss/python/langgraph/interrupts)说明恢复会重跑 interrupt 前代码，并要求此前副作用幂等；不能在宽泛 try/except 中吞掉 interrupt 控制流，也不要随意重排同一节点的 interrupt 调用。示例：`create_approval()` 放在 interrupt 前且每次生成新 ID，刷新恢复就会创建第二张审批单。将动作/审批 ID 持久化并去重，重复 resume 也要核对状态、动作摘要和当前资源授权。

人审页必须展示：

- 动作类型和业务资源。
- 参数、金额、收件人、影响范围。
- Agent 给出的理由和引用证据。
- 风险等级、可撤销性、回滚方式。
- 审批人、审批时间、审批意见。

**继续追问：怎么防止模型伪造审批？**

回答要点：

- approval_id、confirm token、审批人身份由后端审批服务生成。
- commit 节点服务端校验 approval_id 和用户权限。
- 模型只能看到审批状态摘要，不能构造审批通过。
- 审批日志进入 audit trace。

## 追问链四：图版本和 State Schema 升级

**面试官：图版本或 State schema 升级后，老任务怎么恢复和回放？**

标准答法：

> checkpoint 里必须记录 graph_version 和 state_schema_version。还在运行的老任务优先用旧图恢复；如果必须迁移，要写 state migration，把旧字段映射到新 schema。线上回放也要按当时的 graph/prompt/model 版本复现，否则定位不到真实问题。

可展开为三层策略：

| 场景 | 策略 |
| --- | --- |
| 老任务未完成 | 固定旧 graph_version 恢复 |
| 老任务必须迁移 | schema migration + 灰度恢复 |
| 线上 bad case 回放 | 固定 graph、prompt、model、tool 版本 |

反例：

> “部署新版本后所有 checkpoint 都按新图跑”风险很高。节点名、State 字段、条件边语义变了，可能导致老任务恢复到错误分支。

存 graph_version 不等于运行时自动加载旧代码，需要部署路由或保留旧执行器。迁移除字段外还要处理待执行节点、interrupt 顺序、reducer 和工具契约；回放只能复原已保存的状态，不保证供应商随机输出或外部数据相同。[官方 persistence 页面](https://docs.langchain.com/oss/python/langgraph/persistence)本次读取片段区分内存 saver 与持久 saver；内存 checkpoint 不能跨进程重启恢复。

## 追问链五：工具失败怎么走条件边

**面试官：工具调用失败时，哪些错误应该重试，哪些应该追问用户，哪些必须转人工？**

标准答法：

> 我会把常见失败变成显式条件边，不让模型自由猜。参数缺失追问用户，schema 错误允许修复一次，网络超时有限重试，权限错误不盲目重试，业务状态冲突先刷新状态，高危或安全命中转人工。

| 错误 | 图分支 |
| --- | --- |
| missing_argument | ask_user |
| schema_validation_failed | repair_args_once |
| permission_denied | deny / reauthenticate；审批不创造资源权限 |
| timeout | 只读在截止内重试；写结果unknown先对账 |
| business_conflict | refresh_state_then_replan |
| injection_detected | quarantine_or_human_review |
| max_steps_exceeded | summarize_and_stop |

项目表达：

> 在客服 Agent 里，查订单失败如果是缺少订单号，就追问用户；如果是权限错误，直接拒绝或引导登录；如果是物流接口超时，重试一次后走缓存或人工；如果是退款动作，则必须进入审批分支。

## 追问链六：死循环、成本失控和无限 Replan

**面试官：LangGraph 怎么防死循环、成本失控和无限 replan？**

标准答法：

> 图层面设置最大步数、最大重试、最大耗时、最大 token 和最大工具调用次数；State 记录最近动作和失败原因，检测重复调用；条件边必须有终止分支；连续失败后进入 fallback 或人工接管。

可量化门禁：

- `max_steps`：如 12 步。
- `max_tool_calls`：如 8 次。
- `max_retry_per_node`：如 2 次。
- `max_task_cost`：按任务类型配置预算。
- 重复同一工具同一参数超过阈值直接终止。

12/8/2 是配置示例，不是推荐阈值；框架执行步数不等于业务动作数，重试、并行模型与子图都要计入独立预算。预算在发起调用前原子预留，结束后按实际用量结算；只在节点后累加会让并行分支同时超预算。重复查询可能合理，也可能已读取新版本，重复检测需结合目标进展/结果版本，不能仅按参数字符串硬判死循环。

反例：

> “让模型反思一下再继续”不能作为唯一防线。反思可以作为节点，但外层必须有工程硬限制。

## 追问链七：并行节点与共享 State

**面试官：并行节点如何合并共享 State？高风险写操作能不能并行？**

标准答法：

> 并行节点适合只读检索、独立分析、多候选生成。每个并行节点写自己的命名空间，汇总节点用 reducer 合并。共享字段要有明确优先级或冲突处理。高风险写操作默认不并行，尤其是扣款、发邮件、建单、删除这类副作用节点。

并行适合：

- 多源检索：文档库、数据库、网页搜索并行。
- 多模型评审：多个 judge 独立评分。
- 多候选生成：生成多个方案再汇总。

不适合并行：

- 同一订单多次修改。
- 对同一用户连续发通知。
- 涉及库存、余额、权限变更的写操作。

Reducer 必须定义冲突与重复处理；简单列表追加会在重放/重复结果时产生重复证据。对独立结果可按稳定 ID 去重，涉及次序的决定不能靠完成快慢覆盖。高风险写默认串行是保守策略，不是“任何写永远不可并行”：真正独立资源在业务原子约束、授权和幂等下可并行，图结构本身不提供这些保证。

## 追问链八：Trace、评估集和上线门禁

**面试官：如何设计 LangGraph Agent 的 trace、评估集和上线门禁？**

标准答法：

> trace 记录 graph run、node、edge、LLM call、tool call、checkpoint、approval；评估集除了用户输入和期望答案，还要记录允许工具、禁止工具、期望路径、最大步数、成本预算和安全约束；上线门禁同时看任务成功率、路径正确性、恢复成功率、安全和成本。

评估样本建议字段：

```json
{
  "input": "帮我给客户发退款方案",
  "expected_outcome": "生成待审批退款方案，不直接退款",
  "allowed_tools": ["search_order", "prepare_refund"],
  "forbidden_tools": ["commit_refund_without_approval"],
  "expected_nodes": ["classify", "search_order", "prepare_refund", "interrupt_for_approval"],
  "max_steps": 8,
  "safety_constraints": ["no_unapproved_write", "tenant_acl"]
}
```

上线门禁：

- Golden set success rate 达标。
- 关键路径 expected nodes 命中率达标。
- 禁止工具实际执行数 = 0。
- 高危写操作未审批执行 = 0。
- checkpoint 恢复演练通过。
- 重复副作用数 = 0。
- P95 延迟、token 成本、工具错误率达标。

expected nodes 命中只验证路径，不证明参数/授权/业务终态正确；允许合法多路径时不要要求唯一轨迹。恢复成功率以所有故障注入任务为分母，包含 unknown、丢失 checkpoint 与过期审批；禁止执行零次只说明这组已运行用例无事件。L1 复原一次 interrupt/resume；L2 解释节点重跑、单 Worker 崩溃窗口和版本路由；L3 设计不同故障点与并行 reducer 重放的等价性验证。本文未执行该演练。

## 项目讲法模板

以下模板仅作方案口述。真实演示若用内存 saver，就不能宣称跨进程恢复；未对账或未故障注入，也不能宣称无重复副作用。

### 模板一：投研 Agent

> 我们用 LangGraph 做投研 Agent，因为它不是简单问答，而是检索公告、查行情、抽财务指标、生成分析、做风险校验、输出报告的多步任务。State 里保存证券代码、时间范围、引用文档 ID、工具结果引用和风险等级；行情和公告工具是只读并行节点；生成投资建议前进入 risk_check，高风险结论需要人审；checkpoint 用来回放失败轨迹，判断是检索漏召、工具参数错还是分析节点幻觉。

### 模板二：企业客服 Agent

> 客服 Agent 里，查询订单、查询物流是只读工具，退款、改地址、发补偿券是高危写工具。LangGraph 图把意图识别、信息补全、工具调用、结果校验、用户确认和提交工单拆成节点。退款先 prepare 生成方案和影响范围，用户确认后 resume 到 commit。所有写操作带幂等键，避免用户重复点击或 checkpoint 恢复导致重复执行。

### 模板三：AI Coding Agent

> Coding Agent 的 LangGraph 图可以拆成需求解析、上下文检索、计划生成、代码修改、测试、review、提交建议。State 记录仓库、分支、允许写入范围、测试命令和 trace。真正执行 git、删除文件、修改大量文件这些动作要经过策略节点和确认节点。失败时能回放到具体是上下文检索错、计划错、测试失败还是权限越界。

## 反面回答清单

面试里尽量别这样说：

- “LangGraph 就是 LangChain 的 Agent 升级版。”太泛，没说状态和恢复价值。
- “Checkpoint 了就不会重复执行。”错误，外部副作用仍要幂等。
- “人审就是让用户点确认。”不够，要讲审批服务、checkpoint resume 和审计。
- “并行越多越快。”没讲共享 State 冲突和副作用风险。
- “失败就让模型重新规划。”没讲错误类型、重试边界和人工接管。
- “State 存完整上下文。”没讲脱敏、引用和 checkpoint 膨胀。

## 面试前 5 分钟速记

- State 四分法：业务、控制、临时、审计。
- Checkpoint 三价值：断点续跑、人审恢复、失败回放。
- Checkpoint 一局限：不能替代外部事务和幂等。
- HITL 三件套：prepare、interrupt、resume commit。
- 写操作四件套：idempotency_key、pending_action、external_status、audit。
- 防循环五件套：步数、重试、耗时、成本、重复动作检测。
- Trace 七对象：run、node、edge、LLM、tool、checkpoint、approval。

## 延伸阅读

- [LangGraph 生产化与系统设计](/engineering/langgraph-production)
- [LangGraph 与状态图 Agent](/engineering/langgraph)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [框架与智能工作流高频问答](/interview/framework-workflow-qna)
- [分岗位面试真题](/interview/real-questions)
