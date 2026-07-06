# LangChain 与应用开发框架

> LangChain / LlamaIndex / LangGraph 是大模型应用开发最主流的框架阵营。面试常考核心抽象、框架对比，以及「该不该用框架」的工程判断——后者最能看出真实生产经验。

## 为什么需要框架？

直接调 LLM API 很简单，但真实应用要处理：prompt 模板管理、多步链式调用、对话记忆、RAG 检索、工具调用、流式输出、重试降级、可观测性……框架把这些**常见模式标准化、可复用**。

> 后端视角类比：像 Spring 之于 Java Web——不用框架也能写 Servlet，但框架统一了依赖注入、AOP 和生态集成。同样地，框架也会带来「魔法」与调试成本。

## LangChain 核心抽象

| 概念 | 作用 |
| --- | --- |
| **Model（LLM / ChatModel）** | 各家模型 API 的统一封装，一键切换 |
| **Prompt Template** | 带变量的提示模板，支持 few-shot |
| **Output Parser** | 输出解析为结构化数据 |
| **Runnable / Chain** | 多步骤组合成流水线 |
| **Memory** | 多轮对话历史管理策略 |
| **Retriever** | RAG 检索接口，对接各类向量库 |
| **Tool / Agent** | 工具调用与自主决策 |

### LCEL（LangChain Expression Language）

用管道符 `|` 声明式组合组件：

```python
chain = prompt | model | output_parser
result = chain.invoke({"question": "什么是 RAG?"})
```

好处：天然获得流式（`stream`）、异步（`ainvoke`）、批处理（`batch`）、并行（`RunnableParallel`）四种执行方式，不用为每条链手写。

### Memory 策略

全量缓冲（快速超窗）→ 窗口（最近 N 轮）→ 摘要（旧对话压缩）→ 向量检索记忆（长期）。原理与取舍详见 [Agent 记忆系统](/agent/agent-memory)。

## LangGraph：从「链」到「图」

经典 Chain 是单向流水线，表达不了循环和条件分支，而 Agent 的本质是「循环 + 状态」。**LangGraph** 用显式的图模型解决：

- **State**：全图共享的状态对象（消息历史、中间结果），每个节点读写它；
- **Node**：一个处理步骤（调模型/工具/纯函数）；
- **Edge**：固定边 + **条件边**（运行时按状态决定走向，循环由此而来）。

附带生产级能力：**checkpoint 持久化**（断点恢复）、**human-in-the-loop**（中断等人工确认再继续）、时间旅行调试。LangGraph 已取代旧版 AgentExecutor 成为 LangChain 系构建 Agent 的推荐方式——这一演进本身是高频考点：**从「黑盒 Agent 封装」回到「显式状态机」，换取可控性**。

## 框架横向对比

| 框架 | 定位 | 适合 |
| --- | --- | --- |
| **LangChain/LangGraph** | 通用编排 + 图状态机 | 复杂流程、自定义 Agent |
| **LlamaIndex** | 数据接入与 RAG 优先 | 知识库/检索为核心的应用 |
| **Dify / Coze** | 低代码平台 | 快速 PoC、业务人员维护（见 [工作流](/agent/workflow)） |
| **AutoGen / CrewAI** | 多 Agent 协作抽象 | 多角色协作实验（见 [多 Agent](/agent/multi-agent)） |
| **OpenAI/Anthropic SDK 直用** | 无框架 | 逻辑简单或要求极致可控 |

LangChain vs LlamaIndex 一句话：**前者以「流程编排」为中心，后者以「数据/索引」为中心**；可组合——LlamaIndex 做检索层、LangGraph 做编排层。

如果目标是 Java/Spring 存量系统，优先看 [Spring AI 基础与面试题](/engineering/spring-ai)：它更贴近 Spring Boot、权限、审计、SSE 和微服务治理。如果目标是复杂有状态 Agent，继续看 [LangGraph 与状态图 Agent](/engineering/langgraph)：它把 Agent 的循环、分支、人审和 checkpoint 显式化。如果目标是业务 PoC 或低代码流程，先看 [Dify 与低代码智能工作流](/engineering/dify-workflow)，再决定是否迁移到代码框架。

### 面试专项：框架选型表

| 方案 | 选它的理由 | 不选它的理由 |
| --- | --- | --- |
| Spring AI | Java/Spring 存量系统、权限审计、SSE、微服务治理自然接入 | Python Agent/RAG 生态更丰富，复杂状态图要另配 |
| LangChain | 生态广、PoC 快、模型/向量库/工具适配多 | 抽象层多、版本变化快，核心链路要薄封装隔离 |
| LangGraph | 有状态、多分支、可回放、需要 checkpoint 和人审 | 简单线性流程会显得重 |
| Dify | 低代码 PoC、业务人员可维护、内置知识库和发布 | 复杂生产逻辑、严格测试和灰度能力有限 |
| 直接 SDK | 简单稳定、性能敏感、完全可控 | RAG/Agent/观测/工具治理要自建 |

一句话回答：

> 我按团队栈和流程复杂度选。Java 企业系统优先 Spring AI，Python 快速编排用 LangChain，复杂 Agent 用 LangGraph，业务 PoC 用 Dify，简单核心链路用直接 SDK 加薄封装。

## 可观测性：LangSmith 与同类

LLM 应用是非确定性黑盒，生产必须能追踪每步的输入输出、token、延迟、错误。LangSmith（官方）、Langfuse（开源自部署）、Helicone 等提供链路追踪 + 评估 + 监控。没有 trace 的 Agent 故障排查 = 盲人摸象；评估闭环方法见 [模型评估](/evaluation/evaluation)。

## 工程争议：该不该用 LangChain？

经典开放题，要能说两面：

- **支持**：原型极快、集成生态最全（几百个向量库/模型/工具适配）、统一接口便于换模型。
- **反对**：抽象层级多、出错栈深难调试、版本迭代快破坏兼容、简单需求被框架绑架；对 prompt 的隐式包装可能与你的优化冲突。
- **务实结论**：PoC 与复杂编排用框架提速；逻辑稳定、性能敏感的核心链路「毕业」成直接 SDK + 自己的薄封装。**框架是脚手架，不是枷锁**——面试这么答，再补一个你真实踩过的坑（如调试链路过深、升级破坏兼容），说服力最强。

## 高频追问

**Q：LangChain 和直接调 API 怎么选？**
看复杂度与生命周期：多组件编排、要快速试错 → 框架；单链路、性能敏感、长期维护 → 直接 SDK + 薄封装。中间态：用框架的个别组件（如 retriever），编排自己写。

**Q：LangGraph 相比旧版 Agent（AgentExecutor）改进了什么？**
把隐式的 Agent 循环变成**显式状态图**：每个节点、边、状态可见可测；支持 checkpoint 恢复、人工介入、条件分支与循环上限。本质是用「状态机的确定性」包住「LLM 的不确定性」。

**Q：对话记忆怎么管理上下文爆炸？**
窗口 + 摘要 + 向量检索三级组合：近期原文、远期摘要、更久的入库按需检索。关键约束单独固化，不依赖摘要保留。详见 [记忆系统](/agent/agent-memory)。

**Q：LlamaIndex 的核心抽象和 LangChain 有何不同？**
LlamaIndex 围绕「数据 → 索引 → 查询引擎」：Document/Node 切分、多种索引结构（向量/树/关键词）、QueryEngine 封装检索+合成。它把 RAG 的数据侧做深，而 LangChain 把流程侧做广。

**Q：为什么生产环境必须上可观测性？**
非确定性系统无法靠复现调试，必须靠 trace 回放定位「哪一步、什么输入、模型输出了什么」；同时 token 成本与延迟也需按链路归因才能优化。trace 数据还是构建评估集的原料。

**Q：框架版本升级踩过什么坑？（经验题）**
可答：LangChain 0.x→0.1/0.2 的大规模 API 迁移、隐式 prompt 包装变化导致行为漂移、依赖冲突。应对：锁版本、薄封装隔离框架 API、关键行为回归测试兜底。

## 面试专项：LangChain 生产风险控制

LangChain 的强项是生态和速度，风险是抽象和变化。面试里要能说出“怎么用它，但不被它绑架”。

| 风险 | 表现 | 控制手段 |
| --- | --- | --- |
| 抽象泄漏 | 出错栈很深，不知道真实 prompt、retriever、tool 输入 | 全链路 callback/trace；关键步骤显式打日志；保留 request_id |
| 版本升级 | Runnable、Agent、Retriever API 或默认行为变化 | 锁依赖版本；框架 API 外包一层 adapter；升级先跑评估集 |
| 隐式 prompt 改动 | 框架默认模板变化导致输出风格漂移 | 核心 prompt 显式管理和版本化；不要依赖默认 prompt |
| 工具调用黑盒 | Agent 为什么选某个工具不可解释 | 限制工具集合；记录 tool selection；为工具选择单独做评估 |
| RAG 组件堆叠 | loader、splitter、retriever、reranker 混用后难定位 | 检索和生成分开评估；固定数据集做 Recall@K 和忠实度回归 |
| 性能和成本 | 链路多跳、callback 重、上下文拼接过长 | 拆 token 账单；缓存中间结果；把稳定链路迁成薄封装 |

### 什么时候“毕业”出框架

当链路已经稳定、逻辑简单、性能敏感、团队需要强测试和强审计时，可以从 LangChain 毕业为直接 SDK + 自研薄封装。保留框架思想和评估资产，但不让核心业务依赖深层框架对象。

面试可以这样说：

> 我会用 LangChain 快速验证 RAG/工具编排，但生产核心链路会有边界：prompt、retriever、tool schema、output parser 都由我们自己版本化；框架外包一层 adapter；每次升级跑 golden set、bad case 和成本延迟回归。如果链路足够稳定，就把它收敛成直接 SDK 调用，降低长期维护风险。
