# Dify 与低代码智能工作流

> Dify、Coze、n8n 这类平台把大模型应用从“写代码”变成“搭流程”。面试里问 Dify，不是只问你会不会拖节点，而是看你是否理解低代码 PoC、RAG、Agent、Workflow、工具集成和生产治理的边界。工作流理论见 [AI 工作流 vs Agent](/agent/workflow)，代码化编排见 [LangGraph 与状态图 Agent](/engineering/langgraph)，生产化高频追问见 [Dify 低代码工作流生产化高频问答](/interview/dify-production-qna)。

面试前如果要快速对比 Dify、Spring AI、LangChain、LangGraph 和直接 SDK，先看 [基础篇高频问答加厚版](/interview/foundation-qna)。

## 面试先背这几句话

- Dify 是开源 LLM 应用平台，核心能力包括 Chatflow、Workflow、Knowledge、Tool、Agent 和应用发布。
- 低代码平台最适合快速 PoC、业务人员参与维护、标准问答和轻量流程自动化。
- 生产风险在于版本管理、复杂逻辑表达、权限隔离、评估回归、成本观测和平台锁定。
- Chatflow 偏对话入口，Workflow 偏确定性任务流程；两者都由节点和可视化画布组织。
- 成熟路径常见是：Dify 快速验证业务价值，核心链路再迁移到 LangGraph、Spring AI 或自研服务。

## Dify 适合什么场景

适合：

- 企业内部知识库问答 PoC。
- 客服 FAQ、制度咨询、SOP 助手。
- 市场/运营文案生成与审核流程。
- 简单的 RAG + 工具调用应用。
- 业务专家需要直接维护 prompt、知识库和流程。

不适合直接硬上：

- 高并发、强 SLA、低延迟核心链路。
- 复杂状态机、长事务、多系统一致性。
- 强合规写操作，例如支付、授信、删库、对外发文。
- 需要精细测试、代码审查、灰度和回滚的大规模工程。

面试表达：

> Dify 的价值是缩短从想法到可用 demo 的时间，但生产化要补工程治理。低代码不是不能上线，而是上线前必须回答版本、权限、评估、监控、成本和逃逸路径。

## Chatflow、Workflow、Knowledge、Tool 怎么分工

| 能力 | 作用 | 面试表达 |
| --- | --- | --- |
| Chatflow | 面向多轮对话的流程 | 用户持续交互、客服、问答助手 |
| Workflow | 面向任务的确定性流程 | 输入 -> 多节点处理 -> 输出 |
| Knowledge | 知识库/RAG 能力 | 文档接入、切分、检索、引用 |
| Tool | 外部能力调用 | 搜索、HTTP API、数据库、业务系统 |
| Model Provider | 模型接入 | OpenAI、Claude、Qwen、DeepSeek、本地模型 |
| Dataset / Logs | 数据和运行记录 | 后续评估与 bad case 回流 |

Dify 官方文档把 Workflow 和 Chatflow 都描述为基于共享可视化画布和节点系统构建的 agentic workflow，节点可以负责模型调用、知识检索、代码运行或条件分支。面试里要抓住“节点化编排”这个核心。

## 低代码工作流的上线边界

上线前要补 7 个问题：

1. **版本**：prompt、知识库、工具配置、模型参数有没有版本号？
2. **权限**：不同租户和角色是否只能检索自己的知识、调用自己的工具？
3. **评估**：每次改流程是否跑黄金集？RAG 和生成是否分开评估？
4. **灰度**：新版本能否只给部分用户或部分场景启用？
5. **观测**：能否看到每个节点延迟、token、错误、命中文档和工具调用？
6. **成本**：有没有每应用、每租户、每流程的 token 成本报表？
7. **退出机制**：核心链路是否能迁移到代码，避免被平台能力限制？

## Dify vs Coze vs n8n vs LangGraph vs 自研代码

| 选型 | 优点 | 风险 | 适合 |
| --- | --- | --- | --- |
| Dify | 开源、内置知识库和应用发布、适合企业自部署 | 复杂工程治理要补 | 企业 AI 应用 PoC、内部助手 |
| Coze | 产品化强、渠道/插件生态丰富 | 平台依赖较重 | ToC/运营类智能体、快速发布 |
| n8n | 自动化生态强，传统 SaaS workflow 丰富 | LLM/Agent 专项能力需组合 | 业务系统自动化 |
| LangGraph | 代码化、可测试、可回放、适合复杂状态机 | 开发成本更高 | 生产 Agent、长任务、人审 |
| 自研代码 | 极致可控、性能和合规最好掌控 | 研发成本最高 | 核心业务链路、强合规系统 |

实战路线：

```text
Dify PoC
  -> 业务验证：用户是否真用、回答是否有价值
  -> 流程固化：确认节点、工具、知识库、评估集
  -> 工程迁移：LangGraph / Spring AI / 自研服务
  -> 平台治理：MaaS、模型网关、评估、监控、成本
```

## 面试专项：Dify PoC 到生产迁移清单

Dify PoC 成功后，不要直接把画布当核心系统。迁移时先把“业务验证资产”沉淀下来，再决定哪些保留在 Dify，哪些迁到代码服务。

| PoC 资产 | 迁移方式 | 生产补强 |
| --- | --- | --- |
| Prompt 和变量 | 转成版本化 prompt 模板 | 加灰度、回滚、评估集 |
| Knowledge 设置 | 固化切分、Embedding、Top-K、引用策略 | 补 ACL、增量索引、删除一致性 |
| Tool / HTTP 节点 | 转成后端 Tool API 或 MCP Server | 加鉴权、幂等、错误码、审计 |
| 业务画布流程 | 映射成 LangGraph/Workflow 状态机 | 加测试、checkpoint、人审和回退路径 |
| 运行日志 | 抽取高频问题和 bad case | 建 golden set 和回归集 |
| 模型配置 | 接入模型网关 / MaaS | 加配额、计费、路由和成本报表 |

### 低代码画布复杂化后的反模式

- 一个画布里塞大量条件分支，业务人员已经看不懂。
- 多个节点共享隐式变量，改一个 prompt 影响后续所有节点。
- 工具节点既读又写，失败后不知道是否已经产生副作用。
- 没有版本化，线上问题无法还原当时的 prompt、模型和知识库。
- 缺少自动评估，改流程只靠人工点几下试试。

判断迁移的信号：开始需要代码审查、单元测试、强权限、长任务恢复、灰度发布、审计证据或高并发 SLA。此时 Dify 可以继续做业务配置和 PoC，核心链路应迁到 Spring AI、LangGraph 或自研服务。

## 高频面试题

**Q：Dify 的 Workflow 和 Chatflow 有什么区别？**  
Chatflow 面向对话场景，有多轮上下文和用户交互；Workflow 面向任务处理，更像确定性流程。两者都可以用节点编排模型、知识、工具和条件分支。

**Q：低代码平台为什么适合 PoC？**  
业务专家可以直接改 prompt、知识库和流程，不必等研发排期；内置模型接入、RAG、工具和发布能力，能快速验证价值。但 PoC 通过不等于生产就绪。

**Q：Dify 生产化最容易踩什么坑？**  
权限隔离不严、prompt 版本不可追踪、知识库更新无评估、工具调用缺审计、节点成本不可见、复杂逻辑堆在可视化画布里难维护。

**Q：什么时候应该从 Dify 迁到代码？**  
当流程开始涉及复杂状态、长任务、人审、强测试、严格权限、高并发、核心业务写操作时，应把核心链路迁到 LangGraph、Spring AI 或自研服务。Dify 可以继续作为配置台或运营工具。

**Q：Dify 如何和 MaaS/模型网关配合？**  
Dify 不直接保存每个模型厂商 Key，而是接统一模型网关或 MaaS 平台。模型选择、配额、计费、路由、审计在平台层做，Dify 只作为应用编排层。

## 项目讲法

企业知识库 PoC 可以这样讲：

> 我先用 Dify 快速搭了一个制度问答 Chatflow，接入公司制度文档作为 Knowledge，并在回答里强制引用来源。PoC 阶段验证了业务高频问题、知识库覆盖率和用户反馈。进入生产前，我们补了权限过滤、评估集、日志和成本统计；对复杂流程，比如工单创建和审批，改为后端工具 API，并计划把核心状态机迁到 LangGraph 或 Spring AI 服务，Dify 保留给业务维护 prompt 和知识库。

## 系统设计追问

1. 设计一个 Dify 企业知识库平台，如何支持多部门权限、文档更新、引用溯源和评估？
2. 如果 Dify 工作流里某个工具节点失败，应该重试、跳过、追问用户还是转人工？
3. 如何给 Dify 应用做版本管理和灰度发布？
4. 如何统计每个 Dify 应用、每个用户、每个模型的 token 成本？
5. 如何把一个 Dify PoC 迁移成 Spring AI 或 LangGraph 生产服务？

## 延伸阅读

- [Dify 官方介绍](https://docs.dify.ai/en/introduction)
- [Dify Workflow & Chatflow 官方文档](https://docs.dify.ai/en/cloud/use-dify/build/workflow-chatflow)
- [Dify Knowledge 集成文档](https://docs.dify.ai/en/cloud/use-dify/knowledge/integrate-knowledge-within-application)
- [AI 工作流 vs Agent](/agent/workflow)
- [MaaS 平台与模型服务治理](/engineering/maas-platform)
