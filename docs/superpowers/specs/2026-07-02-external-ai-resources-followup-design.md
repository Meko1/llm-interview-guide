# 外部 AI 资源吸收改版设计

## 输入来源

本次根据以下资料继续完善站点内容：

- JavaGuide AI 应用开发面试指南。
- JavaGuide AI 编程实战。
- 鱼皮 AI 知识库专题页。
- Datawhale GitHub 组织及其大模型/RAG/Agent 系列开源教程。
- 掘金 AI Coding 专题。
- ProcessOn 公开复习图谱链接。

## 设计原则

- 不复制外部文章结构，转成本站的面试问题、学习路线和工程清单。
- 不新增孤立页面，优先加厚已有模块。
- 面向求职者，强调可复述、可落地、可验证。
- 对无法直接读取完整内容的图谱链接，只作为复习图谱入口收录，不臆造具体节点。

## 落地模块

### AI Coding

在 `docs/engineering/ai-coding-tools.md` 中补充：

- Vibe Coding 到工程化 AI Coding 的四层能力模型。
- Loop Engineering 小闭环。
- 上下文包模板。
- AI Coding 简历项目讲法。

### LLM 应用开发

在 `docs/engineering/llm-app-dev.md` 中补充：

- 企业级 LLM 应用架构。
- Java / Spring AI 接入清单。
- 从需求到上线的流程。

### 面试题与岗位路线

在 `docs/interview/real-questions.md` 与 `docs/interview/job-market-2026.md` 中补充：

- AI Coding / 工具提效追问。
- Claude Code、Cursor、Codex、Trae 等工具链的岗位信号。
- AI Coding 转型路线。

### 资源索引

在 `docs/interview/resources.md` 中补充：

- JavaGuide、鱼皮 AI 知识库、掘金 AI Coding、Datawhale、ProcessOn 图谱入口。

## 验收标准

- VitePress 构建通过。
- 新增内容能从导航已有页面访问。
- 所有外部链接只作为延伸阅读，不影响本站自洽学习路径。
