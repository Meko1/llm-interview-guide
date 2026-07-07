# MaaS 平台生产化高频问答

> MaaS 面试不是问“能不能转发模型 API”，而是问你能不能把模型能力做成企业内部可申请、可计费、可评估、可审计、可回滚的平台服务。工程总览见 [MaaS 平台与模型服务治理](/engineering/maas-platform)，请求层治理见 [模型网关与多模型路由](/engineering/llm-gateway)，推理容量与成本见 [推理部署与成本治理高频问答](/interview/inference-cost-qna)。

## 怎么用这页

遇到 MaaS / AI Infra / 模型平台系统设计题，可以按这条主线回答：

1. **平台定位**：MaaS 是模型服务的产品化和治理层，不只是网关。
2. **租户接入**：业务在 Portal 申请模型、虚拟 Key、配额和合规策略。
3. **请求执行**：模型网关负责鉴权、限流、路由、计量、审计和降级。
4. **质量门禁**：模型、Prompt、LoRA、RAG 参数变更都要评估、灰度、回滚。
5. **运营闭环**：成本报表、bad case、告警、容量规划反哺平台策略。

可复述版本：

> 我会把 MaaS 设计成“模型目录 + 租户接入 + 模型网关 + 评测门禁 + 成本账单 + 合规审计”的平台。业务不直接拿上游 Key，而是在 Portal 申请虚拟 Key 和可用模型；请求经过网关做 RPM/TPM、路由、计量、审计；模型升级或路由策略变更前跑 golden set 和安全集，通过后灰度；线上 trace、成本和 bad case 回流到评估集。

## 追问链一：MaaS 和模型网关有什么区别

**面试官：你说做 MaaS，是不是就是搭一个统一模型网关？**

标准答法：

> 模型网关是 MaaS 的流量入口，解决“请求怎么进出、怎么路由、怎么限流、怎么计费”。MaaS 是平台治理层，还要解决“谁能申请、能用哪些模型、预算多少、效果如何证明、模型怎么上架下线、合规风险谁审批”。

| 层级 | 负责什么 | 面试关键词 |
| --- | --- | --- |
| Portal | 模型目录、申请审批、用量报表 | 产品化、自服务、权限 |
| Gateway | 鉴权、限流、路由、计费、审计 | RPM/TPM、虚拟 Key、failover |
| Runtime | 外部 API、自部署 vLLM/SGLang、LoRA 服务 | 容量、SLA、GPU |
| Eval | golden set、bad case、安全集、A/B | 上线门禁、回归 |
| Governance | 数据出境、PII、合规审批、生命周期 | 风险分级、审计 |

反面回答：

> “MaaS 就是统一转发 OpenAI 接口”太窄。面试官通常会继续追问模型目录、租户配额、成本报表、评测门禁和合规审批。

## 追问链二：模型目录怎么设计

**面试官：业务怎么知道该申请哪个模型？模型目录里应该有什么字段？**

标准答法：

> 模型目录不是简单列表，而是业务选择模型的“说明书”和平台治理的“策略入口”。它要描述能力、成本、上下文、合规等级、可用区域、适用场景、禁用场景、SLA 和评测结论。

字段建议：

| 字段 | 作用 |
| --- | --- |
| model_id / version | 路由和审计的稳定标识 |
| provider / runtime | 外部厂商、自部署集群或私有模型 |
| capability_tags | chat、reasoning、vision、embedding、rerank、tool calling |
| context_window | 最大上下文与建议输入长度 |
| price | input/output token 单价或私有化摊销成本 |
| compliance_level | 是否允许外部 API、是否可处理敏感数据 |
| allowed_scenarios | 客服、代码、总结、投研、内部知识库 |
| blocked_scenarios | 医疗诊断、金融交易建议、高危自动操作 |
| eval_summary | 准确率、安全、延迟、成本、回归结果 |
| deprecation_date | 下线时间和迁移建议 |
| owner / status | 平台 owner、模型 owner、生命周期状态 |

继续追问：

**模型能力标签怎么避免变成拍脑袋？**

> 用标准评测集和业务 golden set 给标签背书。例如“适合金融制度问答”必须有制度问答集、拒答集、跨部门权限集和引用准确率；不能只靠供应商宣传或主观体验。

## 追问链三：虚拟 Key 和租户接入怎么做

**面试官：为什么业务不能直接拿上游模型 Key？虚拟 Key 要支持什么能力？**

标准答法：

> 上游 Key 直接散落在业务里，会导致泄漏难回收、成本难归因、权限难限制、供应商切换困难。虚拟 Key 是 MaaS 给业务应用的租户凭证，背后绑定模型权限、预算、限流、数据策略和审计主体。

虚拟 Key 生命周期：

```text
app register
  -> owner / tenant / cost_center
  -> allowed models / scenarios
  -> RPM / TPM / daily budget
  -> data policy / region policy
  -> virtual key issued
  -> rotate / freeze / revoke
```

关键设计：

- Key 绑定 `app_id`、owner、部门、成本中心和可用模型。
- 支持过期、轮换、冻结、吊销和泄漏应急。
- 不同环境分 Key：dev、staging、prod 配额不同。
- 高风险模型或外部 API 申请要审批。
- 网关日志必须能从 Key 追到业务 owner。

项目表达：

> 我不会把上游 Key 发给业务，而是发平台虚拟 Key。业务侧只知道统一 OpenAI-compatible endpoint；平台侧按 Key 查租户策略，再决定可用模型、配额和路由。

## 追问链四：RPM / TPM / 预算怎么设计

**面试官：普通 API 限流和大模型限流有什么不同？**

标准答法：

> LLM 要同时限 RPM 和 TPM。RPM 控请求频率，TPM 才接近真实容量和成本。因为输出 token 未知，通常用“预扣 + 完成后校正”：请求前按输入 token、`max_tokens` 或历史分位数预扣，生成结束后按真实 token 结算。

| 维度 | 设计 |
| --- | --- |
| RPM | 控制请求速率和并发冲击 |
| TPM | 控制 token 容量和成本 |
| 日预算 | 防止 bug 或滥用烧穿预算 |
| 单次上限 | 限制 max_tokens、上下文长度和工具轮数 |
| 优先级 | 核心业务优先，离线任务排队 |
| 熔断 | 超预算时降级、排队、拒绝或转人工 |

预算止血流程：

```text
cost spike detected
  -> locate app / key / model / prompt_version
  -> freeze risky key or reduce quota
  -> route simple traffic to cheaper model
  -> disable expensive strategy: Best-of-N / long context / high top_k
  -> notify owner and produce incident report
```

反面回答：

> “加 Redis 限流就行”不够。MaaS 还要讲 token 预扣、成本中心、预算熔断、账单归因和异常止血。

## 追问链五：多模型路由由谁决策

**面试官：业务传 model 参数就行了吗？平台要不要替业务选模型？**

标准答法：

> 可以分三层：业务显式指定模型、平台按策略改写模型、平台按任务动态路由。生产里一般先支持显式指定和白名单，再逐步引入成本路由、能力路由、合规路由和故障 failover。

路由策略：

| 策略 | 适合场景 | 风险 |
| --- | --- | --- |
| 指定模型 | 业务强依赖某模型能力 | 成本不可控 |
| 能力路由 | 代码、视觉、推理、embedding 分流 | 需要能力标签和评测证据 |
| 成本路由 | 简单任务走小模型 | 质量下降要可检测 |
| 合规路由 | 敏感数据固定私有化通道 | 召回和性能可能受限 |
| 健康路由 | 429/5xx/超时切备用 | fallback 兼容性要评估 |
| 灰度路由 | 新模型小流量试用 | 要能回滚和对比 |

继续追问：

**fallback 会不会改变业务效果？**

> 会，所以 fallback 不是简单换模型。要验证 prompt 兼容、JSON schema、工具调用、拒答策略、引用格式和安全边界；路由变更本身也应进入评测门禁。

## 追问链六：模型上线门禁怎么做

**面试官：新模型、新 LoRA、新 Prompt 要怎么上线？**

标准答法：

> 上线门禁要把“换模型”变成平台发布流程。任何会影响输出行为的变更，都要有版本、评估证据、灰度计划、监控指标和回滚路径。

门禁清单：

| 门禁 | 看什么 |
| --- | --- |
| 功能评估 | golden set、业务 case、格式遵循、工具调用成功率 |
| 安全评估 | Prompt Injection、越权、PII、违规内容、拒答正确率 |
| 成本评估 | input/output token、平均成本、P95 成本、缓存命中率 |
| 延迟评估 | TTFT、TPOT、E2E、goodput、错误率 |
| 兼容评估 | OpenAI schema、SSE、JSON mode、tool schema |
| 灰度策略 | 按 app、租户、流量比例、场景逐步放量 |
| 回滚策略 | 模型版本、prompt_version、route_policy 一键回退 |

RACI 可以这样讲：

| 角色 | 负责什么 |
| --- | --- |
| 业务 owner | 提供业务 golden set、验收效果、承担成本中心 |
| 平台 owner | 模型上架、网关策略、容量、账单和发布流程 |
| 安全 owner | 数据分级、外部 API 审批、日志脱敏、审计要求 |
| FinOps / 财务 | 预算、账单口径、成本异常规则 |
| 运维 / SRE | SLA、告警、事故响应、容量演练 |

回答模板：

> 我会把模型、Prompt、工具 schema、RAG 参数都版本化。上线前跑离线评测和安全集；上线时按租户灰度；线上监控质量、成本、延迟和投诉；指标异常就回滚到上一版路由策略和 prompt_version。

## 追问链七：账单和成本归因怎么做

**面试官：老板问哪个部门花了最多 token，你怎么回答？**

标准答法：

> MaaS 必须把每次请求变成可聚合的计量事件。事件里至少要有 app、tenant、user、cost_center、model、prompt_version、input_tokens、output_tokens、单价、缓存命中、路由策略和 trace_id。

计量事件：

```json
{
  "request_id": "req_123",
  "app_id": "crm-assistant",
  "tenant_id": "sales-cn",
  "cost_center": "sales",
  "model": "qwen-plus",
  "prompt_version": "crm-v7",
  "route_policy": "cost-tier-v3",
  "input_tokens": 1800,
  "output_tokens": 420,
  "cache_hit": false,
  "cost": 0.018,
  "latency_ms": 2300
}
```

报表维度：

- 部门 / 应用 / 模型 / 场景成本排行。
- 单次请求成本 P50/P95/P99。
- 高价模型误用和长 prompt 增长趋势。
- 缓存命中率、降级命中率、重试成本。
- 预算使用率和预计耗尽时间。

继续追问：

**成本突然上涨 5 倍如何定位？**

> 先按 app、model、prompt_version、route_policy、input/output token 分桶，判断是流量涨、prompt 变长、输出变长、高价模型误路由、缓存失效、重试风暴还是 Best-of-N / Self-Consistency 被误开。止血动作是冻结 Key、降配额、回滚路由、关闭昂贵策略或临时转便宜模型。

## 追问链八：合规与审计怎么做

**面试官：金融/政企业务能不能调用外部大模型 API？**

标准答法：

> 不能一概而论，要按数据分级和场景风险决定。MaaS 要在模型目录和路由策略里绑定合规标签：敏感数据、个人信息、涉密材料只能走私有化或合规通道；外部 API 需要脱敏、审批、审计和数据出境评估。

合规控制点：

| 环节 | 控制 |
| --- | --- |
| 接入申请 | 数据类型、用途、owner、审批记录 |
| 请求前 | PII 检测、脱敏、敏感场景拦截 |
| 路由时 | 根据合规标签选择私有化或外部模型 |
| 生成后 | 内容安全、引用校验、拒答策略 |
| 日志 | 摘要化记录、敏感字段脱敏、访问控制 |
| 审计 | request_id 串起 Key、用户、模型、输出和工具调用 |

多租户隔离要补一句：

> 模型权限、RAG 文档权限、工具权限、日志权限和缓存命中都要按 tenant 隔离。语义缓存尤其危险，不能让 A 租户的问题命中 B 租户的历史答案；缓存 key 至少要包含 tenant、model、prompt_version、数据域和权限标签。

项目表达：

> 我们把合规策略前置到 MaaS。业务申请时声明数据类型和用途，平台给模型目录打合规标签；请求进入网关后按租户策略和内容检测结果路由。敏感数据默认走私有化模型，外部 API 只允许脱敏后的低风险内容。

## 追问链九：SLA / SLO 和服务分级怎么做

**面试官：100 个业务都接入 MaaS，平台资源不够时怎么分配？**

标准答法：

> MaaS 要把模型服务分级。在线客服、交易辅助、风控解释这类强 SLA 场景要有高优先级、独立配额和更稳的模型；离线总结、批量打标、研发助手可以排队或走低成本模型。平台不能只做“先到先服务”，否则离线任务会挤爆在线业务。

| 分级 | 典型场景 | 策略 |
| --- | --- | --- |
| P0 / 金牌 | 客服在线会话、风控辅助、生产 Copilot | 独立预算、强 SLA、优先队列、私有化或高可用链路 |
| P1 / 标准 | 内部知识库、办公助手、投研摘要 | 常规配额、可降级、按预算路由 |
| P2 / 离线 | 批量总结、数据标注、报表生成 | 排队、低价模型、错峰调度 |
| 实验 | PoC、新模型试用 | 小配额、低优先级、强审计 |

面试收束：

> 服务分级要落到 Key、配额、队列、路由和告警上。不是文档里写“高优先级”，而是高优先级租户在限流、排队、fallback、容量预留和事故通知上都有不同策略。

## 追问链十：事故处理怎么讲

**面试官：MaaS 线上事故一般怎么止血？**

标准答法：

> 先识别事故类型，再做请求级止血、策略回滚和 owner 通知。MaaS 的优势是所有请求经过统一入口，所以能按 app、Key、模型、路由策略、prompt_version 快速定位并控制影响面。

| 事故 | 定位字段 | 止血动作 |
| --- | --- | --- |
| 成本暴涨 | app、model、prompt_version、output_tokens、retry_count | 冻结 Key、降配额、回滚路由、关闭昂贵策略 |
| 质量劣化 | model_version、prompt_version、eval_slice、complaint_tag | 灰度回退、切旧模型、加入 bad case |
| 外部 API 故障 | provider、status_code、latency、fallback_hit | 切备用供应商、降低超时、告警业务 |
| Key 泄漏 | key_id、IP、user_agent、异常调用区域 | 吊销 Key、轮换凭证、追溯日志 |
| 合规违规 | data_policy、tenant、request_id、audit_flag | 停止外部路由、封存日志、触发安全流程 |
| 模型下线 | model_id、dependent_apps、traffic | 通知 owner、迁移路由、兼容性验证 |

事故复盘要回答三件事：

1. 为什么平台没有提前拦住：门禁、预算、合规、告警是否缺失。
2. 影响面多大：哪些租户、模型、请求和成本被影响。
3. 怎么防复发：新增评测集、预算规则、路由保护或审批策略。

## 系统设计题：企业统一 MaaS 平台

**题目：设计一个企业内部 MaaS 平台，支持 100 个业务应用接入 20 个模型。**

### 需求澄清

- 业务应用数量、QPS、RPM/TPM、是否支持流式输出。
- 模型来源：外部 API、自部署 vLLM/SGLang、行业模型、LoRA。
- 是否有金融、政企、医疗等敏感数据。
- 是否需要统一账单、成本中心和审批流程。
- 模型变更是否要评测门禁和灰度回滚。

### 架构草图

```text
Business Apps
  -> MaaS Portal
     - model catalog
     - app registration
     - key / quota / budget
     - reports / approvals
  -> Model Gateway
     - auth / RPM / TPM
     - routing / fallback
     - metering / audit
  -> Model Runtime
     - external APIs
     - private vLLM / SGLang
     - embedding / rerank / LoRA
  -> Eval Platform
     - golden set
     - safety set
     - A/B and regression
  -> Observability & FinOps
     - trace / metrics / logs
     - billing / alerts / capacity plan
```

### 数据流

1. 业务在 Portal 注册应用，申请模型、配额和虚拟 Key。
2. 管理员根据数据策略审批，平台写入租户配置。
3. 业务请求带虚拟 Key 调统一 endpoint。
4. Gateway 校验 Key、预算、RPM/TPM 和合规策略。
5. Router 根据模型名、能力、成本、合规和健康状态选后端。
6. Runtime 调外部 API 或自部署模型，流式返回。
7. Gateway 记录 token、成本、延迟、错误、trace 和审计事件。
8. 报表与 bad case 回流到模型目录、评测集和路由策略。

### 关键取舍

| 取舍 | 推荐回答 |
| --- | --- |
| 自研还是开源网关 | 中小团队先用 OneAPI/NewAPI 或 LiteLLM，强治理需求再自研控制面 |
| 平台替业务选模型吗 | 先白名单 + 显式指定，再逐步加入策略路由 |
| 成本优先还是质量优先 | 按场景分层，核心场景质量优先，批处理和草稿场景成本优先 |
| 外部模型还是私有化 | 按数据敏感度、成本、延迟、能力缺口组合 |
| 评测自动化到什么程度 | 上线门禁自动化，业务指标和安全边界保留人工审批 |

### 上线验收

- 100 个应用的虚拟 Key 可独立限流、冻结和账单归因。
- 新模型上线必须经过 golden set、安全集、成本和延迟评估。
- 主模型 429/5xx 时 fallback 链路可用，并有兼容性评测。
- 成本异常 5 分钟内告警，能定位到 app、model、prompt_version。
- 敏感数据不走非合规外部通道，审计日志可回放。

## 项目讲法模板

### 模板一：企业统一模型服务平台

> 我们做了企业统一 MaaS 平台，业务通过 Portal 申请模型能力和虚拟 Key，不再各自保存供应商 Key。网关统一做鉴权、RPM/TPM、路由、计量和审计；模型目录维护能力标签、价格、合规等级和评测结果。新模型上线前跑 golden set、安全集和成本延迟评估，通过后按租户灰度。上线后用 trace 和账单定位质量投诉和成本异常。

### 模板二：模型成本治理平台

> 我们把每次模型请求抽象成计量事件，记录 app、tenant、model、prompt_version、input/output token、路由策略和成本。平台按部门、应用、模型生成账单，配置日预算和熔断。某次成本异常时，我们能定位是 prompt 变长、缓存失效、高价模型误路由还是重试风暴，并通过冻结 Key、回滚路由或降配额止血。

### 模板三：模型上线门禁

> 我们把模型、LoRA、Prompt、RAG 参数都纳入发布流程。提交变更后自动跑业务 golden set、bad case、安全集和成本延迟评估；通过后小流量灰度；线上指标异常就回滚模型版本或路由策略。这样平台不是“谁想换模型就换”，而是每次变更都有证据、有预算、有回滚。

## 反面回答清单

- “MaaS 就是模型网关。”忽略模型目录、审批、评测和生命周期。
- “业务自己填 model 参数。”缺少平台路由、合规和成本治理。
- “Redis 限流就够了。”没有 TPM、预扣、预算和成本归因。
- “新模型效果更好就上线。”没有 golden set、安全集、灰度和回滚。
- “账单按接口调用次数算。”LLM 成本核心是 token、模型单价和输出长度。
- “敏感数据脱敏一下就能发外部 API。”缺少数据分级、审批和出境策略。

## 面试前 5 分钟速记

- MaaS = 模型目录 + 虚拟 Key + 网关 + 评测门禁 + 成本账单 + 合规审计。
- 网关管请求，MaaS 管平台规则、生命周期和运营闭环。
- 限流要讲 RPM + TPM，计费要讲预扣 + 校正。
- 模型目录要有能力、价格、上下文、合规、评测和下线信息。
- 模型变更要版本化、评估、灰度、回滚。
- 成本异常定位看 app、model、prompt_version、route_policy、token 和缓存。
- 合规路由按数据分级决定外部 API、私有化模型或拒绝。

## 延伸阅读

- [MaaS 平台与模型服务治理](/engineering/maas-platform)
- [模型网关与多模型路由](/engineering/llm-gateway)
- [推理部署与成本治理高频问答](/interview/inference-cost-qna)
- [微调与模型平台高频问答](/interview/finetuning-platform-qna)
- [LLMOps 生产运营](/engineering/llmops)
