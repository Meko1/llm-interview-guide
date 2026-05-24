# LangChain 与应用开发框架

> LangChain / LlamaIndex 是大模型应用开发最主流的框架。面试常考它们的核心抽象、适用场景，以及「该不该用框架」的工程判断。

## 为什么需要框架？

直接调用 LLM API 很简单，但真实应用要处理：prompt 模板管理、多步链式调用、对话记忆、RAG 检索、工具调用、流式输出、可观测性……框架把这些**常见模式标准化、可复用**，避免重复造轮子。

> 后端视角类比：就像 Spring 之于 Java Web——你不用框架也能写 Servlet，但框架帮你统一了依赖注入、AOP、生态集成。

## LangChain 核心抽象

| 概念 | 作用 |
| --- | --- |
| **Model（LLM / ChatModel）** | 对各家大模型 API 的统一封装，可一键切换 |
| **Prompt Template** | 带变量的提示词模板，支持 few-shot、格式化 |
| **Output Parser** | 把模型输出解析成结构化数据（JSON、对象） |
| **Chain** | 把多个步骤串成一条可复用的流水线 |
| **Memory** | 管理多轮对话历史的多种策略 |
| **Retriever** | RAG 的检索接口，对接各种向量库 |
| **Tool / Agent** | 给模型赋予调用外部工具、自主决策的能力 |

### LCEL（LangChain Expression Language）

LCEL 用管道符 `|` 声明式地组合组件，类似 Unix 管道：

```python
chain = prompt | model | output_parser
result = chain.invoke({"question": "什么是 RAG?"})
```

好处：天然支持流式、异步、批处理、并行，组合清晰。

### Memory 策略

- **全量缓冲（Buffer）**：保留全部历史，简单但很快撑爆上下文。
- **窗口（Window）**：只保留最近 N 轮。
- **摘要（Summary）**：用 LLM 把旧对话压缩成摘要，省 token。
- **向量检索记忆**：把历史存向量库，按相关性检索回来（长期记忆）。

## LangChain vs LlamaIndex

| 维度 | LangChain | LlamaIndex |
| --- | --- | --- |
| 定位 | 通用 LLM 应用编排框架 | 专注数据接入与 RAG |
| 强项 | Chain、Agent、工具生态、流程编排 | 文档索引、检索策略、查询引擎 |
| 选择 | 复杂流程、Agent、多步编排 | 以 RAG / 知识库为核心的应用 |

二者可结合使用：LlamaIndex 做检索层、LangChain 做编排层。

## LangGraph：有状态的工作流

LangChain 的 Chain 是「单向流水线」，难以表达循环和分支。**LangGraph** 用图（State / Node / Edge）编排**有状态、可循环、带条件分支**的流程，是构建可靠 Agent 工作流的主流选择，详见 [多 Agent 与进阶范式](/agent/multi-agent)。

## 可观测性：LangSmith

生产应用必须能**追踪每一步的输入输出、token 消耗、延迟、错误**。LangSmith（LangChain 官方）提供链路追踪、调试、评估、监控，是排查「Agent 为什么跑偏」「RAG 为什么召回差」的关键工具。

## 工程争议：该不该用 LangChain？

这是一个常见的开放讨论题，要能说出两面：

- **支持**：快速搭原型、生态丰富、统一接口、内置大量集成。
- **反对**：抽象层多、有时「黑盒」难调试、版本变动快、简单需求反而被框架拖累。
- **务实结论**：原型/复杂编排用框架提速；逻辑稳定、性能敏感的核心链路可以「毕业」成直接调 API 的轻量实现。**框架是脚手架，不是枷锁。**

## 高频追问

**Q：LangChain 和直接调 API 的本质区别？** LangChain 提供了统一抽象和可复用模式（模板、链、记忆、工具、检索），省去样板代码；直接调 API 更轻、更可控、无额外依赖。简单需求直接调，复杂编排用框架。

**Q：对话记忆怎么管理上下文爆炸？** 用窗口（只留最近 N 轮）+ 摘要（旧对话压缩成摘要）+ 向量检索（长期记忆按需取回）组合；本质是在「保留信息」和「省 token」之间权衡。

**Q：LangChain 和 LangGraph 什么关系？** LangGraph 是 LangChain 团队为解决「有状态、循环、多 Agent」场景推出的图编排框架，更适合构建复杂可控的 Agent，而经典 LangChain 的链更适合线性流程。

**Q：为什么生产环境一定要可观测性？** LLM 应用是非确定性的「黑盒」，没有链路追踪就无法定位「为什么这次答错/跑偏/变慢/变贵」。LangSmith 等工具记录每步的 prompt、输出、token、延迟，是调试和优化的前提。
