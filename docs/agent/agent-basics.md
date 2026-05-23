# Agent 基础与框架

> Agent（智能体）让大模型从「会说」走向「会做」。本文讲清 Agent 的核心组成、经典范式与设计要点。

## 什么是 LLM Agent？

Agent 是以 LLM 为「大脑」，能够**自主感知、规划、调用工具、执行多步任务**以达成目标的系统。它不止于一问一答，而是能在循环中思考、行动、根据反馈调整。

经典公式：**Agent = LLM + 规划（Planning）+ 记忆（Memory）+ 工具（Tools）**。

## 四大核心组件

### 1. 规划（Planning）

把复杂目标拆解为可执行的子任务，并决定执行顺序。

- **任务分解**：CoT、思维树（ToT）、Plan-and-Execute（先规划全局再逐步执行）。
- **自我反思（Reflection）**：根据执行结果反思、纠错、调整计划。代表：Reflexion、Self-Refine。

### 2. 记忆（Memory）

- **短期记忆**：当前对话/任务的上下文（受上下文窗口限制）。
- **长期记忆**：把历史信息存入外部存储（常用向量库），需要时检索回来——本质是 RAG。

### 3. 工具使用（Tool Use）

通过 Function Calling 调用外部工具（搜索、计算器、代码执行、数据库、API 等），突破模型自身能力边界。详见 [Function Calling 与 MCP](/agent/function-calling-mcp)。

### 4. 行动（Action）

执行工具调用并获取结果，进入下一轮循环。

## 经典范式：ReAct

**ReAct（Reasoning + Acting）** 是最经典的 Agent 范式，让模型在 **Thought（思考）→ Action（行动/调用工具）→ Observation（观察结果）** 的循环中推进，直到得出最终答案。

```
Thought: 我需要查一下今天的汇率
Action: search("USD to CNY today")
Observation: 1 USD = 7.2 CNY
Thought: 现在可以计算了……
Action: Finish("约 720 元")
```

它把推理和行动交织，让模型边想边做、根据真实反馈纠偏，显著减少幻觉。

## 多 Agent 协作

复杂任务可由多个分工的 Agent 协作完成，如「规划者—执行者—评审者」或角色扮演式协作。代表框架：MetaGPT、AutoGen、CrewAI。优点是分工明确、各司其职；挑战是协调成本、误差累积。

## 常见框架

- **LangChain / LangGraph**：生态最全，LangGraph 用图来编排有状态、可循环的 Agent 流程。
- **LlamaIndex**：偏数据/RAG 与 Agent 结合。
- **AutoGen / CrewAI / MetaGPT**：多 Agent 协作。

## 高频追问

**Q：Agent 和普通 LLM 调用最大的区别？** Agent 具备自主性：能多步规划、循环执行、调用工具、利用反馈与记忆，而不是单轮生成。

**Q：Agent 落地的主要难点？** 可靠性（多步累积误差、容易跑偏）、规划能力不足、工具调用出错处理、长任务的成本与延迟、可控性与安全（尤其执行写操作时）。

**Q：如何提升 Agent 可靠性？** 缩小任务范围、明确工具定义与约束、加入反思/重试、人类介入（human-in-the-loop）确认关键操作、用更结构化的流程（如状态机/图）约束自由度。

**Q：ReAct 和 Plan-and-Execute 的区别？** ReAct 边想边做、每步动态决策，灵活但可能短视；Plan-and-Execute 先制定完整计划再执行，全局性好、token 效率高，但对计划质量依赖大。两者常结合。
