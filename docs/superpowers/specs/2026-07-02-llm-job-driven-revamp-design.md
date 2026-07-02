# LLMGuide 岗位驱动内容改版设计

## 背景

本次改版来自 12 张 Boss 招聘岗位截图。岗位集中在大模型应用开发、Agent 工程、RAG/Memory、Java AI 工程、AI Infra 与行业落地方向。共同特点是：面试不再只考模型原理，而是要求候选人能把 LLM 做成可上线、可评估、可治理、可控成本的业务系统。

## 目标

把 LLMGuide 从“知识点导航”进一步增强为“面向求职的岗位能力指南”：

- 让求职者能按岗位画像补齐能力，而不是只按技术目录学习。
- 把招聘 JD 里的技能词转成面试题、系统设计追问和项目讲法。
- 补齐 Agent、MCP、RAG、Memory、评估、可观测、部署成本、安全合规等 2026 岗位高频要求。
- 提供 2-3 个可写进简历、可面试展开的项目案例。

## 改版范围

### 1. 岗位驱动改版

新增 `docs/interview/job-market-2026.md`，作为求职核心页面。页面包含：

- 2026 大模型岗位能力矩阵。
- 五类岗位画像：LLM 应用开发、Agent 工程、RAG & Memory、Java AI 工程、AI Infra。
- JD 技能词到站内学习路径的映射。
- 面试追问清单与项目讲法。
- 面试前 4 周冲刺计划。

同时增强 `docs/interview/real-questions.md`，补充与这些岗位画像对应的真实追问。

### 2. 专题加厚改版

增强以下专题页：

- `docs/agent/function-calling-mcp.md`
- `docs/agent/agent-memory.md`
- `docs/agent/agent-evaluation.md`
- `docs/rag/rag-production.md`
- `docs/rag/rag-evaluation.md`

重点补充：

- 工具 schema 设计、工具失败模式、并行调用与重试边界。
- MCP client/server、Tools/Resources/Prompts 与 Function Calling 的关系。
- Memory 的短期、长期、情景、偏好与业务记忆设计。
- RAG 生产化中的索引、召回、重排、引用、增量更新、权限控制。
- LangSmith、LangFuse、Arize 等可观测与评估思路。
- Token 成本、prompt caching、batch、模型路由、fallback、SSE/Streaming HTTP。

### 3. 项目实战改版

增强 `docs/engineering/projects.md`，新增或重写 3 个项目案例：

- 金融投研 Agent。
- 企业知识库 RAG。
- Java + Spring AI 银行客服 Agent。

每个案例包含：

- 业务场景。
- 系统架构。
- 核心模块。
- 技术选型。
- 评估指标。
- 面试讲法。
- 常见追问与回答。
- README 亮点。

## 导航设计

新增页面应加入顶部“面试专题”和 `/interview/` 侧边栏。建议位置：

- 顶部面试菜单：放在“高频面试题速记”之前或之后，命名为“2026 岗位能力地图”。
- 侧边栏：放在 `高频面试题速记` 之前，作为面试专题入口页。

首页“必看”区域可增加一条岗位能力地图链接，但不强制改变首页结构。

## 图示设计

新增一张 Excalidraw 图，用于 `job-market-2026.md`：

- 中心是“可上线的 LLM 应用能力”。
- 向外展开五条能力分支：应用开发、Agent、RAG & Memory、Java 工程、AI Infra。
- 每条分支标注核心技能、典型面试追问、可讲项目。
- 图应服务理解，不做装饰。

## 验收标准

- 新页面能独立解释 Boss 截图抽象出的岗位能力要求。
- 三类改版内容互相引用，形成“岗位画像 -> 专题学习 -> 项目讲法 -> 面试追问”的闭环。
- VitePress 构建通过。
- 新增导航链接可达。
- 不破坏现有内容结构，不删除用户现有未跟踪内容。
