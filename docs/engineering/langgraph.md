# LangGraph 与状态图 Agent

> LangGraph 的核心价值不是“又一个 Agent 框架”，而是把自由循环的 Agent 做成显式状态图：节点、边、状态、条件、持久化、人审和回放都可控。Agent 基础见 [Agent 基础](/agent/agent-basics)，框架总览见 [LangChain 与应用框架](/engineering/langchain)。

## 面试先背这几句话

- Chain 适合线性流程，Agent 需要循环、分支和状态，所以复杂 Agent 会从 Chain 走向 Graph。
- LangGraph 用 State 表示共享状态，用 Node 做一步处理，用 Edge/Conditional Edge 决定下一步。
- 相比黑盒 ReAct 循环，LangGraph 的优势是可视化、可测试、可中断、可恢复、可回放。
- Checkpoint 让长任务可以断点续跑；interrupt / human-in-the-loop 让高风险动作能等人确认。
- 生产里的 Agent 通常不是“完全自由”，而是用图把可走路径圈住，把不确定性限制在节点内部。

## 为什么从 Chain 走向 Graph

线性 Chain 适合固定步骤：

```text
输入 -> 改写 query -> 检索 -> 重排 -> 生成答案
```

但 Agent 经常需要运行时决策：

- 工具调用成功就继续，失败就修参数或换工具。
- 信息不足就追问用户，信息足够才执行。
- 高危动作要暂停等待人工确认。
- 规划节点可能把任务拆成多个分支。
- 执行后要评估，没通过再回到修正节点。

这些逻辑本质是状态机。LangGraph 把它显式化，面试里可以概括为：

> LangGraph 用确定性的图结构包住 LLM 的不确定性。模型可以在节点里做判断，但系统允许它走哪些路径、最多走几步、何时停、何时人审，是工程侧控制的。

## 核心概念

| 概念 | 含义 | 面试表达 |
| --- | --- | --- |
| State | 全图共享状态，保存消息、计划、中间结果、工具返回、错误 | Agent 的工作记忆和流程上下文 |
| Node | 一个处理步骤，可以是 LLM、工具、规则函数、评估器 | 每个节点职责要单一 |
| Edge | 节点之间的固定流转 | 确定性流程 |
| Conditional Edge | 按 State 决定下一跳 | 分支、循环、失败恢复 |
| Command | 同时更新状态并控制跳转 | 适合复杂控制流 |
| Checkpoint | 持久化每一步状态 | 断点续跑、回放、人工介入 |
| Interrupt | 暂停图执行，等待外部输入 | 高危动作审批、人类反馈 |

LangGraph 官方文档把图概括为由 Nodes 和 Edges 组成的、随状态演进的工作流；节点做工作，边决定下一步。这句话很适合作为面试开场。

## 一个可面试的 Agent 状态图

```text
用户任务
  -> classify_intent
  -> plan_task
  -> need_tool?
      -> yes: call_tool -> validate_tool_result -> continue_or_fix
      -> no: draft_answer
  -> safety_check
      -> high_risk: interrupt_for_approval
      -> safe: final_answer
```

每个节点职责：

- `classify_intent`：区分闲聊、知识问答、业务查询、高危操作。
- `plan_task`：输出结构化计划，限制最大步数和可用工具。
- `call_tool`：只执行 schema 校验通过的工具调用。
- `validate_tool_result`：检查错误码、权限、空结果、业务状态。
- `continue_or_fix`：决定继续、修参数重试、换工具或转人工。
- `safety_check`：检查注入、越权、敏感输出和高危动作。
- `interrupt_for_approval`：暂停并等待用户或审核人确认。

## Checkpoint、人审与回放

生产 Agent 最怕“失败后不知道它怎么走到这里”。Checkpoint 解决三个问题：

1. **断点续跑**：长任务被中断后，从最近状态恢复，不必重跑全部步骤。
2. **人工确认**：高危节点暂停，把待执行动作展示给人，确认后继续。
3. **失败回放**：保留每步状态、输入、输出、工具结果，定位是规划错、参数错、工具错还是权限错。

面试里可以这样答：

> 对外部写操作，我不会让 Agent 直接执行。图执行到写操作节点时先 interrupt，保存 checkpoint，把动作、参数、风险展示给用户或审核人。确认后从 checkpoint resume；拒绝则走取消或转人工分支。这样既保留 Agent 灵活性，也把高风险副作用控制住。

## LangGraph vs ReAct vs AgentExecutor

| 维度 | ReAct 自由循环 | 旧式 AgentExecutor | LangGraph |
| --- | --- | --- | --- |
| 控制流 | 模型每步决定 | 框架封装循环 | 显式图结构 |
| 可调试 | 看日志追轨迹 | 抽象较黑盒 | 节点、边、状态可回放 |
| 状态管理 | 靠上下文拼接 | 框架管理 | 显式 State |
| 人工介入 | 自己实现 | 支持有限 | interrupt + checkpoint |
| 失败恢复 | 靠 prompt | 靠重试 | 条件边 + 回退节点 |
| 适合 | 简单探索任务 | 快速 demo | 生产 Agent / 复杂工作流 |

结论：

- 简单工具问答可以用 ReAct。
- 流程固定就用 [Workflow](/agent/workflow)。
- 有状态、多分支、要人审和回放的 Agent，用 LangGraph 更稳。

## 高频面试题

**Q：LangGraph 相比普通 LangChain Chain 改进了什么？**  
Chain 是线性或 DAG 编排，表达循环和动态分支弱；LangGraph 把状态、节点、边、条件跳转显式化，适合多步 Agent、失败恢复和人审。

**Q：怎么防止 LangGraph Agent 死循环？**  
工程侧设最大步数、最大 token、最大耗时；状态里记录最近动作，检测重复工具调用；条件边必须有终止分支；连续失败时走 fallback 或人工接管。

**Q：Checkpoint 存什么？**  
至少存 thread/session id、state、消息历史、当前节点、工具调用结果、错误码、模型版本、prompt 版本、用户审批状态。不要把敏感明文长期存储，必要时脱敏或引用外部安全存储。

**Q：Human-in-the-loop 放在哪里？**  
放在高风险或低置信节点前：转账、删除、发邮件、提交工单、写数据库、对外发布。人审节点不只是弹窗确认，还要展示动作原因、参数、影响范围和取消路径。

**Q：LangGraph 能替代 Dify 吗？**  
不是完全替代。Dify 适合低代码 PoC 和业务人员维护，LangGraph 适合代码化、可测试、可版本控制的复杂 Agent。常见路径是 Dify 验证价值，核心链路迁移到 LangGraph 或 Java 服务。

## 项目讲法

投研 Agent 可以这样讲：

> 我没有让模型自由 ReAct 到底，而是用 LangGraph 把流程拆成意图识别、检索、工具调用、分析、风险校验和报告生成几个节点。每个节点只做一件事，状态里保存证券代码、时间范围、引用材料和工具结果。行情查询、公告检索、财务指标都通过工具节点执行。生成投资结论前有风险校验节点，涉及敏感建议会进入人工确认。线上失败时可以按 checkpoint 回放整条轨迹，定位是检索漏召回、工具参数错还是分析节点幻觉。

## 系统设计追问

1. 设计一个支持人审的长任务 Agent 平台，如何存 checkpoint、如何恢复、如何防重复执行？
2. 设计一个多 Agent 协作系统，Supervisor、Worker、共享状态和消息协议怎么划分？
3. 如果工具调用连续失败，图应该重试、换工具、追问用户还是转人工？
4. 如何把 LangGraph Agent 的 trace 接入 LangSmith/Langfuse 之类平台？
5. 如何从一个 Dify 工作流迁移到 LangGraph，同时保留评估集和工具定义？

## 延伸阅读

- [LangGraph Graph API 官方文档](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Interrupts 官方文档](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Agent 基础与框架](/agent/agent-basics)
- [多 Agent 与进阶范式](/agent/multi-agent)
- [Agent 评估与可靠性工程](/agent/agent-evaluation)
