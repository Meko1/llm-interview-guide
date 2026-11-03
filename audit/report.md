# 全站机械体检

由 npm run catalog 重建；数字可从 inventory.csv 复算。知识文章不含首页、路径页、目录页与 docs/superpowers 设计文档。保留旧 URL。

- 知识文章：233
- 清单 Markdown 页面：244
- 缺少 frontmatter 的知识文章：0
- 无外部引用链接的知识文章：185
- 初次自动分级、待人工核实：228
- 无效站内路径或资源链接：0（不含锚点语义）

## 板块

| 板块 | 知识文章 |
| --- | --- |
| 入门与数学 | 7 |
| 模型原理 | 19 |
| 预训练 | 7 |
| 微调与对齐 | 9 |
| Prompt 工程 | 7 |
| RAG 检索 | 11 |
| Agent 工程 | 17 |
| 推理与部署 | 11 |
| 评估与安全 | 2 |
| 工程实战 | 24 |
| 面试专题 | 89 |
| 研究与前沿 | 12 |
| 模型专题 | 6 |
| 多模态 | 5 |
| 开发工具 | 7 |

## 优先精读候选（短文粗筛，不是深度评分）

- basics/tokenizer.md：机械字符数 1690，是否扩写需人工判断。
- beginner/getting-started.md：机械字符数 1814，是否扩写需人工判断。
- basics/moe.md：机械字符数 1954，是否扩写需人工判断。
- beginner/math-basics.md：机械字符数 1969，是否扩写需人工判断。
- basics/distributed-training-memory.md：机械字符数 1997，是否扩写需人工判断。
- advanced/state-space-models.md：机械字符数 2013，是否扩写需人工判断。
- beginner/llm-capabilities.md：机械字符数 2013，是否扩写需人工判断。
- rag/multimodal-rag.md：机械字符数 2040，是否扩写需人工判断。
- advanced/vector-search.md：机械字符数 2084，是否扩写需人工判断。
- basics/long-context.md：机械字符数 2119，是否扩写需人工判断。
- advanced/flash-attention.md：机械字符数 2120，是否扩写需人工判断。
- finetuning/frontier-alignment.md：机械字符数 2125，是否扩写需人工判断。
- rag/embedding-vectordb.md：机械字符数 2164，是否扩写需人工判断。
- rag/graphrag.md：机械字符数 2174，是否扩写需人工判断。
- agent/multi-agent.md：机械字符数 2195，是否扩写需人工判断。
- engineering/coding-agent.md：机械字符数 2209，是否扩写需人工判断。
- agent/deep-research.md：机械字符数 2234，是否扩写需人工判断。
- basics/autoregressive-training.md：机械字符数 2238，是否扩写需人工判断。
- basics/backpropagation-optimization.md：机械字符数 2251，是否扩写需人工判断。
- advanced/safety.md：机械字符数 2259，是否扩写需人工判断。

## 同构标题组

- interview/computer-use-browser-agent-system-design.md：Computer Use / 浏览器 Agent 生产系统设计面试题
- interview/customer-support-copilot-production-playbook.md：企业客服 Copilot 生产系统设计：可信答复、人工接管与服务闭环
- interview/fpa-financial-planning-analysis-copilot-playbook.md：FP&A / 财务经营分析 Copilot：口径一致、可追溯分析与受控计划协作
- interview/fraud-risk-investigation-copilot-playbook.md：反欺诈 / 风险调查 Copilot：证据辅助、人工决定与可审计行动
- interview/hr-copilot-production-playbook.md：企业 HR Copilot 生产系统设计：敏感决策中的人机协作与证据边界
- interview/itsm-sre-incident-response-copilot-playbook.md：ITSM / SRE 事故响应 Copilot：从告警噪声到可审计恢复闭环
- interview/legal-contract-review-copilot-playbook.md：合同审阅 / 法务 Copilot：条款证据、红线工作流与律师最终判断
- interview/procurement-vendor-due-diligence-copilot-playbook.md：采购 / 供应商尽调 Copilot：可验证证据、审批工作流与商业风险控制
- interview/sales-crm-copilot-production-playbook.md：销售 / CRM Deal Copilot 生产系统设计：从账户事实到可控的成交工作流
- interview/text2sql-chatbi-production-playbook.md：Text-to-SQL / ChatBI 生产系统设计：语义层、安全边界与可信回答

标题相似不证明正文重复，需对照业务约束、数据流、评测与失败案例。暂不删除或合并，收入主题导航和全量目录。

## 无效路径

未发现。

## 审校边界

不生成五维伪评分，不把图表数量当作技术深度。五篇核心页仅完成本轮局部审校；其他文章的论文、模型参数、版本、成本与招聘断言仍需逐篇核实。自动分类不等于人工定级，L4 仅对明确前沿专题人工授予。Git 修改时间不是技术审校日期。
