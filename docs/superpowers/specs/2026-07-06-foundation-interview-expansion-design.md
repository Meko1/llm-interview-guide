# 大模型基础篇 10 万字面试内容扩展设计

## 背景

本次扩展面向大模型岗位面试的“基础篇 + 工程落地篇”高频要求。用户希望逐步增加约 10 万字内容，覆盖 Spring AI、LangChain、LangGraph、Agent、RAG、Dify、智能工作流、Function Calling、模型微调、MaaS 平台、Agent 评测与安全合规等方向，并从 12 张 Boss 岗位截图中提取招聘要求。

当前仓库没有 12 张 Boss 截图原图，但已有 `docs/interview/job-market-2026.md` 把 Boss/JD 共性要求抽象成岗位能力矩阵。因此第一阶段先基于现有岗位矩阵和用户列出的 12 个方向建立内容骨架，后续如果截图加入仓库，再做逐条 JD 校准。

## 总目标

把 LLMGuide 扩展成“面试常问基础篇 + 岗位要求映射 + 项目讲法”的系统化指南：

- 面向求职者，而不是只面向学习者。
- 每个技术名词都回答三个问题：面试怎么问、项目怎么讲、上线怎么做。
- 覆盖 Java AI 工程、LLM 应用开发、Agent 工程、RAG/Memory、模型微调、AI 平台与安全合规岗位。
- 逐步累计到 10 万字左右，但每一轮都能独立发布、独立闭环。

## 内容分期

### 第一阶段：基础篇总纲与缺口专题

目标字数约 1.5 万到 2.5 万字，建立 10 万字扩展的主骨架。

新增或增强页面：

- 新增 `docs/interview/foundation-requirements.md`：基础篇岗位要求总纲。
- 新增 `docs/engineering/spring-ai.md`：Spring AI 基础、企业接入、Java 面试题。
- 新增 `docs/engineering/langgraph.md`：LangGraph 状态图、节点、边、checkpoint、人审与追问。
- 新增 `docs/engineering/dify-workflow.md`：Dify、低代码工作流、知识库、Agent 与企业落地。
- 新增 `docs/engineering/maas-platform.md`：MaaS 平台、模型服务、Key、计费、路由、观测。
- 增强 `docs/agent/agent-evaluation.md`：Agent 评测、安全与合规面试题。

同步更新：

- `docs/.vitepress/config.mts`：新增导航入口。
- `docs/interview/real-questions.md`：新增基础篇 12 类高频追问。
- `docs/interview/job-market-2026.md`：补充“基础篇技能词 -> 岗位要求 -> 面试追问”映射。
- `docs/engineering/langchain.md`：补充与 LangGraph、Spring AI、Dify 的选型边界。

### 第二阶段：高频问答加厚

目标字数约 3 万字，重点加厚已有页面的“面试常问”。

覆盖方向：

- Function Calling、Tool Calling、MCP、工具 schema、工具失败恢复。
- RAG 基础、切分、混合检索、重排、权限、增量索引、引用溯源。
- Agent 基础、ReAct、Plan-and-Execute、Memory、Multi-Agent、Workflow。
- Spring AI / LangChain / LangGraph / Dify 的框架对比。

### 第三阶段：微调与模型平台

目标字数约 2 万到 3 万字。

覆盖方向：

- SFT、PEFT、LoRA、QLoRA、Adapter、Prefix Tuning。
- RLHF、DPO、PPO、Reward Model、偏好数据。
- 微调 vs RAG vs Prompt vs 长上下文的选型。
- MaaS、模型网关、推理平台、评测平台、成本治理。

### 第四阶段：项目实战与模拟面试

目标字数约 2 万字。

覆盖方向：

- Java + Spring AI 银行客服 Agent。
- 企业知识库 RAG。
- 金融投研 Agent。
- Dify 工作流改造成代码化 LangGraph 项目。
- MaaS 平台 / 模型网关系统设计。

## 第一阶段页面设计

### 1. 基础篇岗位要求总纲

页面职责：把 Boss/JD 技能词翻译成准备清单。

建议结构：

- 12 类技能矩阵。
- 每类技能的“岗位在考什么”。
- 高频面试题 5 到 8 个。
- 项目讲法关键词。
- 对应站内学习路径。

12 类技能：

1. Spring AI 与 Java AI 工程。
2. LangChain 应用编排。
3. LangGraph 状态图 Agent。
4. Agent 基础与多步任务。
5. RAG 与知识库。
6. Dify 与低代码工作流。
7. 智能工作流与业务编排。
8. Function Calling / Tool Calling / MCP。
9. SFT / PEFT / LoRA / QLoRA。
10. RLHF / DPO / 偏好优化。
11. MaaS 平台与模型服务治理。
12. Agent 评测、安全与合规。

### 2. Spring AI 专题

页面职责：服务 Java 岗、银行/政企/客服 AI 岗。

核心内容：

- Spring AI 的定位：Java 生态里的 LLM 抽象层。
- ChatClient、Prompt Template、Embedding、VectorStore、Tool Calling。
- 与 Spring Boot、Spring Security、Observability、配置中心的结合。
- SSE/Streaming、超时、重试、限流、降级。
- 与 LangChain4j、LangChain 的对比。
- 面试题：为什么不用自己封装 HTTP、如何做流式输出、如何接企业权限。

### 3. LangGraph 专题

页面职责：把 LangGraph 从“框架名”讲成 Agent 工程可靠性方案。

核心内容：

- State、Node、Edge、Conditional Edge、Command。
- Checkpoint、持久化、断点续跑、人工确认。
- ReAct 循环与显式状态图的区别。
- 多 Agent、任务分解、失败恢复。
- 面试题：如何防死循环、如何回放轨迹、为什么比 AgentExecutor 更可控。

### 4. Dify 与智能工作流专题

页面职责：服务低代码 AI 应用、企业 PoC、业务流程自动化岗位。

核心内容：

- Dify 的 Chatflow、Workflow、Knowledge、Tool、Dataset。
- 低代码平台适合什么，不适合什么。
- Dify / Coze / n8n / LangGraph / 自研代码的边界。
- 从 Dify PoC 迁移到生产代码的路径。
- 面试题：如何做权限、版本管理、评估、灰度和成本控制。

### 5. MaaS 平台专题

页面职责：服务 AI 平台、模型服务、模型网关和企业大模型中台岗位。

核心内容：

- MaaS 的核心能力：模型目录、Key 管理、配额、计费、路由、观测、评估。
- 与模型网关、LLMOps、推理平台的关系。
- 多模型路由、fallback、灰度、A/B。
- 租户隔离、审计、安全合规。
- 面试题：如何设计统一模型平台，如何拆成本，如何做模型升级不影响业务。

### 6. Agent 评测、安全与合规加厚

页面职责：把 Agent 从 demo 拉到可上线系统。

核心内容：

- 任务成功率、工具调用准确率、轨迹质量、成本、延迟。
- Prompt Injection、工具越权、敏感信息泄露、错误记忆。
- 人工确认、最小权限、沙箱、审计日志。
- LLM-as-Judge 与人工标注的边界。
- 面试题：Agent 误调用工具怎么办，高危动作如何审批，如何证明 Agent 变可靠。

## 导航设计

导航尽量接入现有结构，不新增过深层级。

- `/interview/` 侧边栏新增“基础篇岗位要求总纲”。
- `/engineering/` 侧边栏新增 Spring AI、LangGraph、Dify、MaaS 平台。
- Agent 侧边栏继续使用已有 `Agent 评估与可靠性工程`，只加厚内容。
- 顶部“工程实战”菜单保留现有入口，新增页面通过工程侧边栏可达。

## 写作标准

每个专题页都按同一套模板写，保证适合面试复习：

1. 面试先背的 5 句话。
2. 核心概念与工程边界。
3. 典型架构或流程。
4. 与相邻技术的对比。
5. 高频面试题与标准答法。
6. 项目讲法。
7. 系统设计追问。
8. 站内延伸阅读。

## 验收标准

- 第一阶段新增页面全部能从导航访问。
- `npx vitepress build docs --outDir ../.vitepress-build-check` 构建通过。
- `docs/interview/foundation-requirements.md` 能独立承接“Boss 截图岗位要求”的抽象。
- Spring AI、LangGraph、Dify、MaaS 四个缺口专题都有面试题、项目讲法和系统设计追问。
- 既有 Agent/RAG/微调/评测页面不被重复拆散，只通过交叉链接形成学习路径。
- 不提交 `outputs/` 等无关未跟踪文件。
