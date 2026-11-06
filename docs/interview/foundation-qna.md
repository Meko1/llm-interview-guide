---
title: 大模型基础篇高频问答加厚版
description: >-
  围绕工具调用、RAG 排障、Agent 状态、微调和推理容量，组织基础面试答法与工程边界。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 大模型基础篇高频问答加厚版

> 这页是 [基础篇岗位要求总纲](./foundation-requirements) 的面试问答版。它不追求长篇解释，而是把面试官最容易连续追问的问题，整理成可直接复述的答法。临场时先用这里组织答案，再点到专题页补细节。框架选型、智能工作流和 Function Calling 追问，继续看 [框架与智能工作流高频问答](./framework-workflow-qna)；RAG、Memory、Agent 评测和安全合规追问，继续看 [RAG、Memory 与评测安全高频问答](./rag-memory-eval-qna)；推理部署、压测、量化和成本治理追问，继续看 [推理部署与成本治理高频问答](./inference-cost-qna)；微调、DPO、MaaS 和模型平台相关追问，继续看 [微调与模型平台高频问答](./finetuning-platform-qna)。

## 怎么用这页

- 面试前 30 分钟：只看每节第一题和最后的速背。
- 面试前 3 天：按目标岗位重点刷 2 到 3 节。
- 项目复盘时：把每个问题改写成“我项目里怎么做”。
- 答题结构固定为：**定义 -> 生产问题 -> 取舍 -> 指标/风险**。

## Function Calling / MCP

**Q：Function Calling 是模型自己执行函数吗？**  
不是。模型只输出结构化调用意图，例如函数名和 JSON 参数；真正执行函数的是业务代码、工具层或 MCP Server。这个区分很重要，因为鉴权、校验、审计、重试、幂等都必须在服务端做，不能信任模型。

**Q：工具 schema 怎么设计才稳定？**  
描述里要写清“何时用、何时不用、参数边界、默认值、返回语义、失败处理”。参数尽量少而扁平，能用枚举就用枚举，读写工具分开，高危写操作必须加确认。详见 [Function Calling 与 MCP](/agent/function-calling-mcp)。

**Q：工具调用失败怎么恢复？**  
先区分失败类型：参数缺失澄清或修正，权限失败不盲重试，业务拒绝保留错误码。只读调用可在截止时间内有限重试；写调用超时可能已成功，先按原操作 ID 查询结果，不换 key 重发。幂等需要业务服务原子去重与可查询结果，不是 Prompt 保证。

**Q：MCP 比普通 HTTP 工具接口多解决什么？**  
HTTP 定义应用层通信语义，不只是“传输方式”；MCP 在其支持的传输之上规范能力协商、上下文与工具交互。一个 Server 可服务多个 Host，Host 管理 Client 和授权；不是 Server 通过 Client 管 Host。能力需协商，并非每个 Server 都提供 tools/resources/prompts。可对照 [2025-11-25 架构规范](https://modelcontextprotocol.io/specification/2025-11-25/architecture)，详见 [MCP 协议深入](/agent/mcp)。

**Q：工具很多时模型总选错怎么办？**  
不要把所有工具都塞进上下文。常见做法是 Tool RAG：先按用户意图检索相关工具子集，再注入模型；或者按领域拆订单 Agent、知识库 Agent、工单 Agent。评估时看触发准确率、工具选择准确率、参数准确率和恢复率。

## RAG 生产排障

**Q：RAG 回答错了，怎么定位？**  
按链路切：query 改写是否错，召回是否命中正确文档，权限/元数据过滤是否误伤，rerank 是否把正确文档排下去，上下文是否拼错，模型是否忠于材料，缓存或索引是否过期。不要一上来调 prompt，先看检索证据。

**Q：检索没召回怎么办？**  
看问题类型。如果是术语、编号、人名、条款号，补 BM25/混合检索；如果是问法和文档表述差异大，做 query rewrite、Multi-Query 或 HyDE；如果是切分丢上下文，做标题层级切分和父子分块。详见 [RAG 进阶与优化](/rag/rag-advanced)。

**Q：召回到了但答案还是错，问题在哪？**  
可能是上下文太长、噪声太多、关键信息在中间、引用编号不清、prompt 没约束“只依据材料回答”，也可能是模型能力不足。此时优化上下文组装、压缩、排序、引用和生成约束，而不是继续盲目加 Top-K。

**Q：企业 RAG 怎么防越权？**  
文档入库时带 tenant、role、department、owner、有效期等元数据。查询时在向量召回和 BM25 召回两路都做权限过滤，rerank 和生成前再二次校验。绝不能先全局召回，再靠 prompt 让模型保密。

**Q：RAG 评估为什么要拆检索和生成？**  
因为答案错可能是检索没找对，也可能是找对了但模型没用好。检索看 Recall@K、MRR、NDCG、Context Precision；生成看 Faithfulness、Answer Relevancy、引用准确性和拒答质量。详见 [RAG 评估](/rag/rag-evaluation)。

## Agent / Workflow / LangGraph

**Q：Workflow 和 Agent 的本质区别？**  
Workflow 的路径由开发者预先编排，Agent 的路径由模型根据反馈动态决定。能确定流程就用 Workflow，只有路径依赖运行时反馈、无法事先写死时才用 Agent。详见 [AI 工作流 vs Agent](/agent/workflow)。

**Q：Agent 失败怎么排查？**  
先看计划是否错，再看工具是否选错、参数是否错、工具结果是否被正确利用、记忆是否污染、上下文是否超窗、是否死循环、是否触发安全拦截。Agent 排障必须看 trace，不看轨迹只看最终答案很难定位。

**Q：LangGraph 相比 ReAct 的价值是什么？**  
ReAct 是推理与行动交替的模式，LangGraph 是编排/运行框架，二者不是同层替代品；ReAct 可运行在 LangGraph 中。状态图让分支、检查点和恢复更显式，但节点输出与工具状态仍可能不确定，恢复也不自动等于外部副作用 exactly-once。详见 [LangGraph 与状态图 Agent](/engineering/langgraph)。

**Q：Agent 怎么评估？**  
看四类：结果是否完成任务，轨迹是否合理，成本和延迟是否可接受，安全是否越权。工具调用还要拆成该不该调、调哪个、参数对不对、失败后是否恢复。详见 [Agent 评估与可靠性工程](/agent/agent-evaluation)。

## 框架选型：Spring AI / LangChain / Dify

**Q：Spring AI、LangChain、LangGraph、Dify 怎么选？**  
Java/Spring 存量系统选 Spring AI；Python 快速编排和生态集成选 LangChain；复杂有状态 Agent 选 LangGraph；业务 PoC 和低代码流程选 Dify；简单稳定链路可直接 SDK + 薄封装。

**Q：Dify 能不能直接上生产？**  
可以上轻量生产，但要补版本、权限、评估、灰度、日志、成本和审计。复杂状态机、高并发强 SLA、核心写操作和强合规链路，建议迁到 LangGraph、Spring AI 或自研服务。详见 [Dify 与低代码智能工作流](/engineering/dify-workflow)。

**Q：Spring AI 项目怎么讲亮点？**  
不要只说“我用了 ChatClient”。要讲它如何接入 Spring Security、租户权限、RAG ACL、SSE、审计日志、限流降级、模型网关和成本统计。详见 [Spring AI 基础与面试题](/engineering/spring-ai)。

## 微调与偏好优化速答

**Q：SFT、LoRA、QLoRA 解决什么？**  
SFT 让模型学习领域任务和回答格式；LoRA 冻结基座，只训练低秩旁路，成本低；QLoRA 把基座 4-bit 量化再训练 LoRA，进一步省显存。它们主要改变行为和格式，不适合注入频繁更新的事实知识。

**Q：RAG 和微调怎么选？**  
实时私有知识、权限、引用溯源选 RAG；风格、格式、领域术语、固定任务模式选微调；两者可以组合：RAG 提供事实，微调提升领域表达和结构化遵循。

**Q：DPO 和 RLHF 怎么对比？**  
经典 PPO 式 RLHF 常走 SFT -> Reward Model -> PPO，但 RLHF 不只这一实现。DPO 在偏好建模与 KL 目标假设下直接优化偏好对，省去显式奖励模型和在线 RL 循环；工程较简化不等于任意数据/超参都稳定。它优化参考校正后的相对 log 概率差，不保证优答绝对概率上升。可对照 [DPO 原论文摘要](https://arxiv.org/abs/2305.18290)。

更多关于 LoRA/QLoRA 参数、DPO 选型、模型网关和评测门禁的面试答法，见 [微调与模型平台高频问答](./finetuning-platform-qna)。

## 推理部署与成本治理

**Q：推理服务慢，先看什么指标？**
先拆 TTFT 和 TPOT。TTFT 高多半和排队、长 prompt、Prefill、prefix cache 命中率有关；TPOT 高多半和 Decode、batch、显存带宽、KV Cache、量化 kernel 有关。线上还要看 P95/P99、goodput、GPU 利用率、KV 占用和错误率。

**Q：为什么只报 tokens/s 不够？**
tokens/s 可能是牺牲延迟堆出来的裸吞吐。在线服务更看 goodput：满足 TTFT/TPOT SLA 的有效吞吐。面试里可以说，压测报告必须写清输入输出长度、并发、到达模式、分位数延迟、GPU/KV 占用和成本。

**Q：怎么估算要多少 GPU？**
先统一单位：如果容量是达标请求/s，则用峰值请求/s 相除；不能拿 token/s 除以请求/s。若采用 token 吞吐，需要按同样的输入/输出长度分布分别建模 prefill 与 decode，并在混合负载和延迟约束下测服务副本容量。多卡张量并行的测量单位是整个副本，不是某张 GPU。再考虑 KV 容量、突发、模型装载和故障冗余。

构造例：峰值 12 请求/s，某四卡副本在同样长度分布及 SLA 下能稳定服务 3 请求/s，最低需要 4 副本即 16 卡；若要求任一副本故障后仍承载峰值，至少 5 副本即 20 卡，尚未计突发余量。这是条件计算，不是硬件压测。L1 说明请求卡在哪一段；L2 说明副本口径与失效容量；L3 再讨论到达过程与长输出尾部怎样影响容量测量。

更多框架选型、容量规划、量化上线和 $/百万 token 成本口径，见 [推理部署与成本治理高频问答](./inference-cost-qna)。

## 安全合规与评估

**Q：Prompt Injection 和越狱区别？**  
越狱针对模型安全对齐，让模型输出不该输出的内容；Prompt Injection 针对应用指令体系，把外部数据伪装成指令，劫持 RAG/Agent 行为。Agent 读取网页、邮件、文档时尤其危险。

**Q：Agent 高危动作怎么控？**  
写库、付款、删除、发邮件、对外发布必须走人工确认或审批队列。执行前展示动作、参数、依据和影响范围；执行时用幂等键；执行后记录审计日志和 trace。

**Q：如何证明上线后没有变差？**  
建立 Golden Set、对抗集和线上 bad case 回归集。每次改模型、prompt、工具 schema、RAG 参数都跑回归，看任务成功率、忠实度、工具准确率、P95 延迟、单次成本和安全门禁。

## 面试前 30 分钟速背

1. Function Calling：模型只提调用意图，执行、权限和审计在服务端。
2. MCP：标准化能力交互可减少重复适配，但认证、业务语义和版本兼容仍需集成工作；M+N 只是简化示意。
3. RAG 排障：先检索，后生成；Prompt 不能凭空补证据，改写查询则可影响召回并需防语义漂移。
4. Workflow vs Agent：流程能写死就 Workflow，不确定路径才 Agent。
5. LangGraph：用状态图和持久化约束执行；副作用恢复仍靠业务幂等与对账。
6. Spring AI：Java 企业系统接 LLM，要讲权限、SSE、审计、降级。
7. Dify：PoC 很快，生产要补版本、权限、评估、成本和迁移路径。
8. 微调 vs RAG：微调改行为和格式，RAG 管知识和权限。
9. 推理压测：看 goodput，不只看裸吞吐。
10. 成本治理：少 token、提吞吐、模型路由、缓存和量化一起做。
11. Agent 评估：结果、轨迹、成本、安全四类一起看。
12. 安全合规：注入、越权、数据泄露、高危副作用都要有门禁。
