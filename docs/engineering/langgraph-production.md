# LangGraph 生产化与系统设计

> 这页专门回答面试里最容易追问的生产问题：State 怎么设计、Checkpoint 怎么存、HITL 怎么恢复、工具副作用怎么幂等、线上怎么排障。基础概念先看 [LangGraph 与状态图 Agent](/engineering/langgraph)，工具权限边界见 [Agent 工具安全与权限边界](/agent/tool-safety)。

## 面试先背这几句话

- LangGraph 的价值不是“多一个 Agent 框架”，而是把 Agent 做成**可恢复、可审计、可人审的状态机**。
- State 不是聊天上下文垃圾桶，要拆成**业务状态、控制状态、临时状态、审计状态**四类。
- Checkpoint 解决断点续跑和回放，但不能自动解决外部副作用；写操作必须配合 **idempotency key + pending action + 外部状态查询**。
- HITL 不是弹窗确认，而是一个可恢复的审批节点：要保存 checkpoint、展示影响范围、记录审批人，并支持拒绝、超时、回退。
- 生产图不要追求“全自由规划”，而是用确定性图约束路径，把不确定性收敛在少数 LLM 节点内部。
- 上线门禁要同时看结果、轨迹、恢复、安全和成本：最终答案对但重复扣款、越权调用或无法回放，都算失败。

## 一、什么时候需要 LangGraph 生产化

简单 RAG、固定工作流、单次工具调用，不一定要上 LangGraph。出现下面任意三类特征，就值得把 Agent 设计成状态图：

| 特征 | 说明 | 为什么 Graph 更合适 |
| --- | --- | --- |
| 多步长任务 | 任务超过 5~10 步，可能跨分钟或小时 | 需要 checkpoint 和恢复 |
| 动态分支 | 根据工具结果、用户补充、评估结果决定下一步 | 条件边比一串 if/else 更清晰 |
| 高危动作 | 发邮件、建单、退款、改库、提交审批 | 需要 interrupt + 人审 |
| 外部副作用 | 工具调用会改变业务系统状态 | 需要幂等、补偿和审计 |
| 可观测要求高 | 线上 bad case 要能复盘 | 节点、边、state、tool call 可回放 |
| 多角色协作 | planner、researcher、executor、judge 分工 | 需要共享状态和消息协议 |

一句话：

> LangGraph 适合“有状态、有分支、有副作用、要回放”的 Agent；如果只是线性 prompt chain，用它反而会增加复杂度。

## 二、生产级 State 设计

State 设计是 LangGraph 面试的核心。最常见错误是把所有消息、检索结果、工具返回、临时草稿都塞进 State，最后 checkpoint 膨胀、隐私难控、恢复困难。

推荐把 State 拆成四类：

| 类型 | 示例字段 | 设计原则 |
| --- | --- | --- |
| 业务状态 | `task_id`、`tenant_id`、`user_id`、`order_id`、`case_id`、`objective` | 稳定、可序列化、可审计，避免存敏感明文 |
| 控制状态 | `current_step`、`retry_count`、`risk_level`、`next_action`、`stop_reason` | 用于条件边、限步、降级、终止 |
| 临时状态 | 候选文档、草稿答案、临时评分、工具原始返回 | 可重算则只存引用或摘要，避免 checkpoint 膨胀 |
| 审计状态 | `trace_id`、`prompt_version`、`model_version`、`tool_call_id`、`approval_id` | 用于回放、合规、线上排障 |

### 一个可复述的 State Schema

```json
{
  "task": {
    "task_id": "task_123",
    "tenant_id": "t_001",
    "user_id": "u_001",
    "objective": "生成客户投诉处理建议"
  },
  "control": {
    "current_node": "draft_resolution",
    "step_count": 6,
    "retry_count": 1,
    "risk_level": "medium",
    "next_action": "need_approval"
  },
  "artifacts": {
    "retrieved_doc_ids": ["doc_1", "doc_2"],
    "draft_id": "draft_789",
    "tool_result_refs": ["tool_result_456"]
  },
  "audit": {
    "trace_id": "trace_abc",
    "prompt_version": "support-agent-v12",
    "model": "gpt-4.1",
    "approval_id": null
  }
}
```

面试表达：

> 我会让 State 存“恢复和审计所必需的信息”，而不是存所有上下文。大文本、原始文档、工具原始返回尽量存外部对象引用；控制字段用于条件边和失败恢复；审计字段和 trace 对齐。

## 三、Checkpoint 存储与恢复语义

Checkpoint 至少要回答四个问题：

1. **存什么**：State、当前节点、上一步输入输出摘要、工具调用状态、错误码、审批状态。
2. **存哪里**：开发环境可用内存或 SQLite，生产环境通常用 Postgres / Redis / 对象存储组合。
3. **什么时候存**：每个节点完成后存；高危工具执行前必须先存 pending checkpoint。
4. **怎么恢复**：恢复时不能盲目重跑写操作，要先查外部系统状态。

### Checkpoint 表设计

| 字段 | 说明 |
| --- | --- |
| `thread_id` | 一条任务/会话的唯一 ID |
| `checkpoint_id` | 单个状态快照 ID |
| `node_name` | 当前或刚完成的节点 |
| `state_json` | 可恢复 State，敏感字段脱敏 |
| `status` | running / interrupted / completed / failed / cancelled |
| `parent_checkpoint_id` | 支持回放和分支比较 |
| `created_at` / `updated_at` | 排障和 SLA 统计 |
| `trace_id` | 关联可观测平台 |

### 恢复时的关键判断

| 场景 | 恢复策略 |
| --- | --- |
| LLM 节点失败 | 可从上一个 checkpoint 重试，注意固定 prompt/model 版本便于复现 |
| 只读工具失败 | 可有限重试或换工具 |
| 写工具超时 | 先查外部业务单状态，再决定跳过、补偿或转人工 |
| 人审超时 | 标记 approval expired，回到重新 prepare 或取消分支 |
| State 版本升级 | 做 schema migration，保留旧版本回放能力 |

## 四、HITL：人审不是弹窗

生产级 human-in-the-loop 是一个可审计节点，而不是简单 `confirm()`。

```text
detect_risk
  -> prepare_action
  -> interrupt_for_approval
      -> approved: commit_action
      -> rejected: revise_or_cancel
      -> timeout: expire_and_notify
```

人审节点要展示：

- Agent 想执行什么动作。
- 参数、资源、影响范围和风险级别。
- 引用证据和模型给出的理由。
- 可撤销性、回滚方式和预计成本。
- 审批人、审批时间、审批意见。

高危写操作推荐两段式：

| 阶段 | 作用 |
| --- | --- |
| `prepare_*` | 校验参数和权限，生成待执行动作、影响范围、审批单 |
| `commit_*` | 审批通过后带 `approval_id` 和 `idempotency_key` 真正执行 |

面试官如果问“用户确认后怎么继续”，可以这样答：

> interrupt 时保存 checkpoint，并把 approval_id 写入审批服务。审批通过后，由后端恢复同一个 thread_id 的 checkpoint，把 approval_id 注入 State，然后从 commit 节点继续执行。拒绝或超时则走 cancel / revise 分支，不能让模型自己伪造确认。

## 五、工具副作用与幂等

Checkpoint 恢复最容易踩坑：图恢复了，但外部动作已经发生过。

### 写操作节点的标准流程

```text
1. 生成 business_idempotency_key
2. 写 pending_action 到业务库
3. checkpoint 记录 tool_call_id、action_id、参数摘要
4. 执行外部写操作
5. 写执行结果和外部单号
6. checkpoint 标记 committed
```

### 幂等策略

| 问题 | 做法 |
| --- | --- |
| 重试导致重复扣款 | 业务接口按 `idempotency_key` 去重 |
| 恢复后不知道是否执行成功 | 用 `action_id` 查询外部状态 |
| 外部系统不支持幂等 | 在本系统落 pending/committed 状态，串行化调用 |
| 已执行但后续节点失败 | 设计补偿动作或人工处理队列 |
| 并行工具都有副作用 | 高风险写操作默认不并行，必要时拆成审批后的事务步骤 |

可复述版本：

> Checkpoint 只保证图状态可恢复，不保证外部世界可回滚。所以写工具要像分布式系统一样设计：幂等键、pending 状态、外部状态查询、补偿和审计缺一不可。

## 六、失败恢复与条件边

不要把所有失败都交给模型自由判断。生产图里常见的错误应该变成显式条件边。

| 错误类型 | 条件边 |
| --- | --- |
| 参数缺失 | `ask_user_for_missing_info` |
| JSON/schema 错误 | `repair_args_once`，超过次数转人工 |
| 权限错误 | `deny_or_request_approval`，不要盲目重试 |
| 只读工具超时 | `retry_with_backoff` 或 `use_fallback_tool` |
| 业务状态冲突 | `refresh_state_then_replan` |
| 安全/注入命中 | `quarantine_context` 或 `human_review` |
| 成本/步数超限 | `summarize_progress_and_stop` |

面试亮点：

> 我会把“可预期失败”建成图上的边，把“开放判断”留给 LLM 节点。这样失败恢复可测、可回归，也更容易给面试官讲清楚。

## 七、可观测与上线门禁

LangGraph 的 trace 要能回答：这次任务为什么走到这个节点、为什么选择这个工具、为什么停止、哪里花了钱。

| Span | 关键字段 |
| --- | --- |
| Graph Run | thread_id、graph_version、entry_node、final_status、duration |
| Node | node_name、input_summary、output_summary、state_diff、latency |
| Edge | from、to、condition、reason |
| LLM Call | model、prompt_version、tokens、temperature、finish_reason |
| Tool Call | tool_name、args_summary、risk_level、status、error_code |
| Checkpoint | checkpoint_id、state_size、status |
| Approval | approval_id、approver、decision、duration |

上线门禁建议：

- Golden set 任务成功率达标。
- 禁止工具实际执行数 = 0。
- 高危写操作未审批执行 = 0。
- checkpoint 恢复成功率达标。
- 重复副作用数 = 0。
- P95 任务耗时、token 成本、工具失败率在预算内。
- 关键节点 trace 覆盖率 = 100%。

## 八、系统设计题答法

题目：

> 设计一个支持人审和断点续跑的 LangGraph Agent 平台。

### 需求澄清

- 任务是实时对话、异步长任务，还是两者都有？
- 是否有写操作？哪些动作高危？
- 需要多租户隔离和权限审批吗？
- 最长任务持续多久？checkpoint 保留多久？
- 失败后是自动恢复、用户恢复，还是运营手动恢复？

### 架构拆分

```text
API / SSE Gateway
  -> Graph Runner
  -> State Store / Checkpoint Store
  -> Tool Router + Policy Engine
  -> Approval Service
  -> Executor / Sandbox
  -> Trace & Eval Platform
```

### 主链路

1. API 创建 `thread_id`，加载图版本和用户权限上下文。
2. Graph Runner 执行节点，每步写 checkpoint 和 trace。
3. Tool Router 执行 schema 校验、权限校验和风险分级。
4. 高危动作进入 Approval Service，图状态变为 interrupted。
5. 审批通过后恢复 checkpoint，从 commit 节点继续。
6. 结束后生成最终结果、审计摘要和评测样本。

### 可靠性

- Graph version 固定，避免恢复后图结构漂移。
- State schema 带版本，升级时做迁移。
- 写操作幂等，恢复前查外部状态。
- 策略服务故障时高危动作 fail closed。
- 审计不可用时暂停高危写工具。

### 项目讲法

> 我会把 LangGraph 当作生产状态机，而不是 prompt 串联工具。图版本、State schema、checkpoint、工具策略和审批服务都独立治理。高危动作先 prepare 再 interrupt，人审通过后 resume 到 commit；写工具用幂等键避免恢复后重复执行；所有节点、边、工具和审批都进 trace，线上 bad case 可以回放并沉淀成回归集。

## 高频追问

**Q1：LangGraph State 应该存完整消息历史吗？**  
不建议无脑全存。消息历史可以按窗口、摘要或引用管理；State 应优先保存恢复、路由、审计必需字段。否则 checkpoint 会膨胀，也会增加敏感数据风险。

**Q2：Checkpoint 能不能替代数据库事务？**  
不能。Checkpoint 保存图状态，不保证外部系统副作用原子性。写操作仍要靠业务事务、幂等键、pending/committed 状态和补偿机制。

**Q3：恢复 checkpoint 时发现外部工具已经执行成功怎么办？**  
不要重放写操作。先按 action_id 或 idempotency_key 查询外部状态，把结果写回 State，然后跳过 commit 节点或进入后续节点。

**Q4：人审节点如何防止模型伪造审批？**  
approval_id、confirm token、审批人身份都由后端审批服务生成和校验，模型只能看到审批状态摘要，不能自己构造通过信号。

**Q5：LangGraph 怎么防死循环？**  
最大步数、最大重试、最大耗时、重复动作检测、失败分支、成本预算和人工接管。条件边必须有终止路径，不能让模型无限 replan。

**Q6：并行节点怎么处理共享 State 冲突？**  
并行节点只写各自命名空间，汇总节点做 merge；冲突字段用 reducer 或显式优先级；高风险写操作不要并行执行。

**Q7：图版本升级后老任务怎么恢复？**  
checkpoint 记录 graph_version 和 state_schema_version。老任务优先用旧图恢复；必须升级时做 state migration，并保留回放能力。

**Q8：为什么说 LangGraph 更适合生产 Agent？**  
因为它把节点、边、状态、checkpoint、人审和回放显式化，让 Agent 从“黑盒循环”变成可测试、可恢复、可审计的软件系统。

## 相关学习路径

- [LangGraph 与状态图 Agent](/engineering/langgraph)
- [AI 工作流 vs Agent](/agent/workflow)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [Agent 评估与可靠性工程](/agent/agent-evaluation)
- [框架与智能工作流高频问答](/interview/framework-workflow-qna)
- [LangGraph 状态图 Agent 生产化高频问答](/interview/langgraph-production-qna)
