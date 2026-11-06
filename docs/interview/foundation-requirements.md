---
title: 大模型基础篇岗位要求总纲
description: >-
  把目标岗位描述中的技术词转成可验证能力与项目证据，区分明确要求、解释性假设和待确认事项；不把框架名、题量或教程经历当岗位达标证明。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 大模型基础篇岗位要求总纲

> **目标是把一份真实 JD 翻译成准备计划，不是推断所有公司的招聘标准。** 本页未建立招聘平台的代表性抽样，旧“高频”标题作为导航保留；下文矩阵和题目是练习建议，不是真题认证、频率统计或就业承诺。

先保存目标 JD 的链接、访问日期与明确句子，再分三栏：**写明的要求**、**你推测的约束**、**待招聘方确认事项**。“熟悉 LangGraph”不自动要求某种 checkpoint 存储；“有 RAG 经验”也不自动要求训练 embedding 模型。

面试前需要一问一答速刷时，配合 [大模型基础篇高频问答加厚版](./foundation-qna) 使用；如果目标岗位写了 Spring AI、LangChain、LangGraph、Dify、智能工作流或 Function Calling，继续刷 [框架与智能工作流高频问答](./framework-workflow-qna)；如果写了 RAG、Memory、Agent 评测、安全合规或企业知识库，继续刷 [RAG、Memory 与评测安全高频问答](./rag-memory-eval-qna)；如果写了推理部署、vLLM、SGLang、量化、压测、GPU 或成本治理，继续刷 [推理部署与成本治理高频问答](./inference-cost-qna)；如果写了 SFT、LoRA、QLoRA、RLHF、DPO、MaaS 或模型网关，继续刷 [微调与模型平台高频问答](./finetuning-platform-qna)。

## 面试先背这几句话

不要逐字背成个人经历。以下是组织回答的思路，须用能核实的实现与证据填充：

- 应用和工程岗位可准备模型接入、评估、成本与安全；训练研究岗位则另补损失、实验与系统，不把所有岗位合成一张必修清单。
- 框架名是实现线索：先解释问题，再比较直接 SDK/HTTP 与框架的成本、行为和升级边界，不替招聘方断言其“真正想考”。
- RAG、Agent、Workflow、Function Calling 不是互斥概念。真实项目常见组合是：Workflow 控主流程，Agent 处理不确定子任务，RAG 提供知识，Function Calling 连接业务系统。
- Prompt、检索、长上下文和微调可组合，但先测基线：格式错误可能应由程序/schema 校验解决；RAG 不自动保证权限，偏好对齐不等于执行端安全。
- 区分方案、模拟链路、练习已运行、实验结果和真实上线；效果、成本、延迟、安全与恢复需要分别验收，框架名不是交付证明。

## Boss/JD 高频技能矩阵

| 技能词 | 可转成的能力问题（待岗位确认） | 练习追问 | 站内补课 |
| --- | --- | --- | --- |
| Spring AI | Java 团队如何接入 LLM 能力 | 为什么不用自己封装 HTTP？如何做 SSE、权限、审计？ | [Spring AI 基础与面试题](/engineering/spring-ai) |
| LangChain | LLM 应用编排抽象 | Chain、Runnable、Retriever、Tool 怎么分工？ | [LangChain 与应用框架](/engineering/langchain) |
| LangGraph | 有状态 Agent 工程化 | State、Node、Edge、Checkpoint 怎么让 Agent 可控？ | [LangGraph 与状态图 Agent](/engineering/langgraph) |
| Agent | 多步任务与工具调用 | ReAct、Plan-and-Execute、Memory、Tool Use 怎么讲？ | [Agent 基础](/agent/agent-basics) |
| RAG | 企业知识库与 AI Search | 切分、召回、重排、引用、权限、评估怎么做？ | [RAG 基础](/rag/rag-basics) |
| Dify | 低代码 AI 应用落地 | Dify 适合 PoC 还是生产？怎么做版本和权限？ | [Dify 与低代码智能工作流](/engineering/dify-workflow) |
| 智能工作流 | 确定性编排 | Workflow 和 Agent 如何取舍？五种工作流模式怎么组合？ | [AI 工作流 vs Agent](/agent/workflow) |
| Function Calling / MCP | 工具生态与业务系统连接 | 模型会不会自己执行函数？MCP 比 HTTP 工具有何价值？ | [Function Calling 与 MCP](/agent/function-calling-mcp) |
| SFT / PEFT / LoRA / QLoRA | 低成本模型适配 | LoRA 为什么有效？QLoRA 省什么？PEFT 和全参微调怎么选？ | [微调范式](/finetuning/finetuning) |
| RLHF / DPO | 偏好对齐与安全行为 | DPO 如何简化 RLHF？Reward Model 为什么难？ | [RLHF / DPO 对齐](/finetuning/rlhf) |
| 推理部署 / vLLM / SGLang | 在线模型服务性能与稳定性 | TTFT/TPOT/goodput 怎么压测？vLLM 和 SGLang 怎么选？ | [推理部署与成本治理高频问答](./inference-cost-qna) |
| 量化 / GPU 成本 | 私有化部署与成本优化 | W4A16、W8A8、FP8 怎么选？如何估 GPU 和 $/百万 token？ | [量化实战](/inference/quantization) |
| MaaS 平台 | 模型服务治理 | 多模型、Key、配额、计费、路由、审计怎么设计？ | [MaaS 平台与模型服务治理](/engineering/maas-platform) |
| Agent 评测与安全合规 | 上线门禁 | 如何证明 Agent 可靠？工具越权、注入、审计怎么防？ | [Agent 评估与可靠性工程](/agent/agent-evaluation) |

## 按岗位方向怎么准备

| 岗位方向 | 优先掌握 | 项目证据 | 容易被追问 |
| --- | --- | --- | --- |
| Java AI 工程 | Spring AI、SSE、RAG、Tool Calling、网关治理 | Java + Spring AI 客服/知识库/业务助手 | 线程阻塞、流式返回、权限、审计、降级 |
| LLM 应用开发 | LangChain、结构化输出、RAG、评估、成本 | 企业知识库、AI Search、Text-to-SQL | JSON 不稳定、RAG 答错、模型路由、可观测 |
| Agent 工程 | LangGraph、Workflow、Function Calling、Memory、评测 | 投研 Agent、运营 Agent、Coding Agent | 死循环、工具失败、高危动作、轨迹回放 |
| RAG / Memory | 切分、混合检索、Rerank、引用、权限、评估 | 多租户知识库、客服问答、金融制度检索 | 删除一致性、ACL 过滤、表格/图片、增量索引 |
| AI 平台 / MaaS | 模型网关、配额、计费、观测、评测、推理服务 | 企业统一模型平台、模型网关、评测平台 | RPM/TPM、成本账单、灰度、fallback、合规 |
| AI Infra / 推理部署 | vLLM、SGLang、量化、压测、GPU、成本 | 私有化推理服务、模型服务容量规划 | TTFT/TPOT、KV Cache、goodput、$/百万 token、P99 排障 |
| 算法微调 | SFT、LoRA、QLoRA、DPO、评估集 | 领域问答模型、风格对齐、分类/抽取小模型 | 数据质量、过拟合、灾难遗忘、RAG vs 微调 |

## 13 类技能高频追问

### 1. Spring AI 与 Java AI 工程

1. Spring AI 相比自己封装模型 HTTP API 的收益是什么？
2. Java 服务如何做大模型流式输出？SSE、WebSocket、Streaming HTTP 怎么选？
3. 大模型接口慢且贵，如何做超时、重试、限流、排队、降级和缓存？
4. 银行/政企场景如何把用户权限、审计日志和 RAG 检索绑定？
5. Spring AI 和 LangChain4j、LangChain 的边界在哪里？

### 2. LangChain 应用编排

1. LangChain 的 Model、Prompt Template、Output Parser、Retriever、Tool 分别负责什么？
2. LCEL / Runnable 的价值是什么？什么时候不用框架更好？
3. 在固定任务上比较 LangChain、LlamaIndex 与直接 SDK 的抽象、数据接入、调试和升级成本。
4. 框架升级导致行为变化，你怎么隔离风险？
5. 生产环境如何做 trace、dataset 和 prompt 回归？

### 3. LangGraph 状态图 Agent

1. 什么任务需要显式状态图？何时简单调用或固定工作流更合适？
2. State、Node、Edge、Conditional Edge 怎么解释？
3. Checkpoint、interrupt、human-in-the-loop 解决什么问题？
4. LangGraph 如何防止 ReAct 自由循环失控？
5. 如何回放一次失败的 Agent 轨迹？

### 4. Agent 基础与多步任务

1. Agent 和普通 LLM 调用的本质差异是什么？
2. ReAct、Plan-and-Execute、Reflexion 分别适合什么任务？
3. Agent Memory 该写什么、不该写什么？
4. 单 Agent 和多 Agent 如何取舍？
5. 如何给 Agent 设置最大步数、预算和终止条件？

### 5. RAG 与知识库

1. RAG 的离线链路和在线链路分别做什么？
2. chunk size、overlap、父子分块、标题层级切分怎么选？
3. 向量召回、BM25、混合检索、Rerank 各解决什么问题？
4. 知识库删除、更新、权限变更如何保证一致？
5. RAG 回答错了，如何定位是召回错、排序错还是生成错？

### 6. Dify 与低代码工作流

1. Dify 的 Chatflow、Workflow、Knowledge、Tool 怎么分工？
2. 低代码和代码服务分别满足哪些部署、恢复与治理约束？什么条件下才需要迁移？
3. Dify 工作流如何做版本管理、灰度、评估和成本统计？
4. Dify、Coze、n8n、LangGraph、自研代码如何取舍？
5. 如何把一个 Dify PoC 迁移为 Spring AI 或 LangGraph 服务？

### 7. 智能工作流

1. Workflow 和 Agent 的本质区别是什么？
2. Prompt Chaining、Routing、Parallelization、Orchestrator-Workers、Evaluator-Optimizer 怎么记？
3. 何时固定工作流更可控，何时需要模型决定下一步？怎样用同预算基线证明收益？
4. 评估-优化循环什么时候有效，什么时候会浪费钱？
5. 业务流程中哪些节点必须程序化校验？

### 8. Function Calling / Tool Calling / MCP

1. Function Calling 的完整流程是什么？模型会自己执行函数吗？
2. 工具 schema 怎么设计才能减少误调用？
3. 工具调用失败有哪些类型？参数错、权限错、网络错、业务失败如何恢复？
4. MCP 的 Host、Client、Server、Tools、Resources、Prompts 分别是什么？
5. MCP 和普通 HTTP 工具接口相比，优势和代价是什么？

### 9. SFT / PEFT / LoRA / QLoRA

1. SFT 解决什么问题，不能解决什么问题？
2. PEFT 的核心思想是什么？为什么 LoRA 能低成本适配？
3. LoRA 的 rank、alpha、target modules 怎么调？
4. QLoRA 主要省显存在哪里？对效果有什么风险？
5. 微调后如何评估灾难遗忘和领域泛化？

### 10. RLHF / DPO / 偏好优化

1. 经典 RM+PPO 路线中各模型负责什么？为什么它不是全部 RLHF 的定义？
2. DPO 如何绕过显式奖励模型和在线 RL？
3. 偏好数据如何采集，如何避免标注偏差？
4. 安全对齐和过度拒绝如何平衡？
5. DPO、IPO、KTO、ORPO 这类方法共同想解决什么？

### 11. MaaS 平台与模型服务治理

1. MaaS 和模型网关、LLMOps、推理平台是什么关系？
2. 如何设计模型目录、虚拟 Key、租户配额、计费账单？
3. 多模型路由如何兼顾能力、成本、可用性和合规？
4. 模型升级如何做灰度、回滚和评测门禁？
5. 如何按业务线拆 token 成本和质量报表？

### 12. 推理部署、压测与成本

1. Prefill 和 Decode 的瓶颈分别是什么？为什么 TTFT 和 TPOT 要分开优化？
2. vLLM、SGLang、TensorRT-LLM、llama.cpp 分别适合什么场景？
3. 为什么 goodput 比裸吞吐更适合作为上线指标？
4. 给定 QPS、输入输出长度和 SLA，如何估算 GPU 数量？
5. W4A16、W8A8、FP8、KV Cache 量化分别解决什么成本问题？

### 13. Agent 评测、安全与合规

1. Agent 评估为什么不能只看最终答案？
2. 工具调用准确率怎么拆指标？
3. Prompt Injection、工具越权、数据泄露分别怎么防？
4. 高危动作如何做人工确认、沙箱和审计？
5. 如何用冻结回归与高风险切片识别退化？测试没发现退化与全分布保证有什么区别？

## 项目讲法模板

可以提框架，但要解释职责与限制。按下面 7 类证据讲，缺失项明确说未完成：

1. **业务目标**：这个系统服务谁，解决什么高频痛点。
2. **输入输出**：用户输入是什么，最终产物是什么。
3. **主链路**：Workflow、RAG、Agent、Tool Calling 分别在哪一步。
4. **关键取舍**：为什么不用另一种方案，比如为什么 RAG 而不是微调，为什么 LangGraph 而不是自由 ReAct。
5. **可靠性**：超时、取消、未知提交、恢复时重新核权；哪个动作可重试，哪个须先对账。
6. **评估证据**：定义样本、分子/分母与计时边界；逻辑任务和重试次数分开；报告高风险错误、覆盖、延迟及成本。
7. **复盘迭代**：一次真实失败或构造故障如何定位与回归；没有线上经历就讲练习限制。

**可填写的证据卡，不是可复制的上线经历**：

~~~text
任务 / 允许用户 / 成功终态：
我的职责与实践状态（方案 / 模拟 / 已运行 / 上线）：
数据、模型、提示、代码版本：
直接实现基线与选择框架的理由：
权限、引用、参数校验与未知提交处理：
冻结样本、指标分母、延迟边界与成本组成：
一次失败、修复后回归与剩余风险：
~~~

**构造练习**：知识助手引用了已撤销政策，工具又创建了重复工单。先分开诊断证据版本与外部写入，再追查索引/缓存更新、业务幂等键和提交未知恢复；不能只换模型或写“不要出错”。练习日志不是线上日志，未测过的数值不能写成个人指标。

## 4 周基础篇补齐路线

四周是安排示例，不是岗位达标保证。按目标选一条主分支，其余保留待补，不用每日题数代替验收。

| 周次 | 目标 | 建议动作 | 可核产出 |
| --- | --- | --- | --- |
| 第 1 周 | 对齐 JD 与缺口 | 选任务，口述 token/证据/结构化结果并跑最小基线 | 要求—证据—待确认事项表 |
| 第 2 周 | 补主分支 | RAG 或工具工作流，加入无权限/无证据/超时负例 | 链路图、错误样例和断言 |
| 第 3 周 | 补工程或研究约束 | 工程测负载/成本/恢复；研究写数据划分/同预算对照 | 带单位、环境和限制的记录 |
| 第 4 周 | 模拟追问与修订 | 解释替代方案、故障与未验证项，只补相关微调/前沿 | 不虚构经历的项目证据卡 |

<details>
<summary>L1 / L2 / L3 如何回答同一个“RAG 答错了”？</summary>

- **L1**：从原文、索引、召回、上下文和答案逐层找丢失/误用证据的位置，展示可复查文档指针。
- **L2**：加入版本、租户 ACL、缓存、超时、增量更新与发布门禁；投诉数不是准确率的分母。
- **L3**：固定问题和证据做对照；按问题组划分数据，避免同源变体泄漏并报告不确定性。

层级是能力深度，不是回答越长越高级；站内分级也不是职称或薪资标准。

</details>

## 站内学习路径

- Java AI 工程：[Spring AI 基础与面试题](/engineering/spring-ai) -> [LLM 应用开发实战](/engineering/llm-app-dev) -> [模型网关与多模型路由](/engineering/llm-gateway)
- Agent 工程：[Agent 基础](/agent/agent-basics) -> [LangGraph 与状态图 Agent](/engineering/langgraph) -> [Agent 评估与可靠性工程](/agent/agent-evaluation)
- RAG 与知识库：[RAG 基础](/rag/rag-basics) -> [RAG 生产化](/rag/rag-production) -> [RAG 评估](/rag/rag-evaluation)
- 低代码到工程化：[Dify 与低代码智能工作流](/engineering/dify-workflow) -> [AI 工作流 vs Agent](/agent/workflow) -> [LangGraph 与状态图 Agent](/engineering/langgraph)
- 推理部署与成本：[推理优化与部署](/inference/inference-optimization) -> [推理框架对比](/inference/serving-frameworks) -> [推理性能压测](/inference/inference-benchmark) -> [推理部署与成本治理高频问答](./inference-cost-qna)
- 微调与对齐：[微调范式](/finetuning/finetuning) -> [LoRA / QLoRA](/finetuning/lora) -> [RLHF / DPO](/finetuning/rlhf)
- 平台治理：[MaaS 平台与模型服务治理](/engineering/maas-platform) -> [模型网关](/engineering/llm-gateway) -> [LLMOps](/engineering/llmops)

## 资料性质与待核范围

本页为岗位描述解读与练习设计，没有招聘频率、薪资或教育效果实证，不用培训广告定义能力。具体机制沿站内专题核对原论文、官方文档与版本。JD 未写明硬件、框架版本、SLA 或权限边界时应向对方确认，不能自动填造。
