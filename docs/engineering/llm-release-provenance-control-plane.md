---
title: LLM 应用版本血缘与质量归因控制面
description: >-
  将模型、Prompt、检索、工具与策略组合为不可变发布清单，并记录每次请求的实际配置。区分版本溯源、影响分析与因果验证，设计可审计的灰度、回滚和反馈闭环。
level: L2
roles:
  - 后端转型
  - 应用开发
  - Infra
classification: inferred
---
# LLM 应用版本血缘与质量归因控制面

> “昨天回答还对，今天为什么变差了？”在生产里，这不是一句排障口号，而是一个版本血缘问题。Prompt 没改，不代表系统没变：模型供应商、解码参数、检索索引、重排器、工具契约、安全策略、特征开关、租户配置中任意一个变化，都可能改变线上结果。本页讲如何把它们组合成可查询、可回滚、可归因的 LLM Release。

## 一、为什么单独需要 Release Provenance

传统服务常把一次发布理解为“某个 Git commit 上线”。LLM 应用的真实行为由更大的配置闭包决定：

```text
请求 + 用户/租户上下文
  -> 实际命中路由
       -> Prompt revision
       -> Model / provider / API capability
       -> decoding parameters
       -> RAG corpus + chunker + embedding + index + retrieval policy + reranker
       -> Tool schema + tool implementation revision
       -> guardrail / policy revision
       -> feature flags + experiment bucket
  => effective release tuple
```

如果只记录 `prompt_version=v17`，就无法解释以下情况：

- 供应商把同名模型指向了新快照，结构化输出合法率下降；
- 索引 alias 切换后召回文档变了，引用正确率下降；
- reranker 或 metadata filter 调整，某个租户没有再命中关键制度；
- 工具服务升级、字段默认值变化，Agent 走了另一条分支；
- 安全策略/实验开关改变，用户实际命中了不同输出路径；
- 问题只发生在一个地区、一个租户或一个 experiment bucket。

因此本页的目标不是再造一个配置中心，而是建立一个能回答四个问题的控制面：

1. 这次运行实际生效了哪组版本？
2. 某个版本变化影响了哪些 release、租户、评测集和线上请求？
3. 哪些版本元组与质量、成本、延迟或事故变化相关，如何进一步验证根因？
4. 如何安全灰度、回滚和让反馈精准回流到正确修复对象？

## 二、核心对象：不可变 Release Manifest

### 1. 不要把“当前配置”当发布证据

生产数据库里一个可编辑的 `app_config` 只能告诉你“现在是什么”，不能告诉你“一周前那次回答用了什么”。每一次发布应产生不可变 manifest，并让运行实例引用它。

```json
{
  "release_id": "assistant-prod-2026-07-21.3",
  "application": "policy-assistant",
  "environment": "prod",
  "created_at": "2026-07-21T06:00:00Z",
  "components": {
    "service": { "git_sha": "a82f91c", "image": "registry/app@sha256:..." },
    "prompt": { "template_id": "policy.answer", "revision": "17", "renderer": "v4" },
    "model_route": { "policy_revision": "route-12", "primary": "provider-x:model-y@snapshot", "fallback": "provider-z:model-k" },
    "generation": { "temperature": 0.1, "max_output_tokens": 800, "response_schema": "answer-v5" },
    "retrieval": { "corpus": "policy-cn", "corpus_revision": "2026-07-20", "index": "policy-idx", "index_revision": "42", "reranker": "rerank-v3", "policy": "retrieve-9" },
    "tools": [{ "name": "policy_lookup", "schema_revision": "6", "implementation_revision": "2026.07.18" }],
    "safety": { "input_policy": "in-8", "output_policy": "out-11" },
    "flags": { "citation_required": true, "answer_style": "concise" }
  },
  "evaluation": { "baseline_run": "eval-448", "dataset_revisions": ["policy-golden@31", "security@12"] },
  "approvals": [{ "kind": "quality_gate", "id": "gate-893" }]
}
```

Manifest 要求：**不可变、可签名、可 diff、可读取、可被运行记录引用**。`release_id` 是人类友好的名字，内部还应有内容哈希；任何组件变动都生成新 release，而不是修改旧行。密钥不进入 manifest，只记录凭证别名和权限范围版本。

摘要证明内容一致，签名证明受信任签发者对这些内容作了声明；两者都不证明业务质量通过。还要限定签发者、环境、审批身份及防回放规则。可借鉴 [SLSA v1.1 provenance](https://slsa.dev/spec/v1.1/provenance) 区分参数、已解析依赖和运行详情的做法，但这里是应用自定义契约，不是宣称符合 SLSA 等级。`index=policy-current` 仍是可变别名，应记录解析后的不可变 revision/digest。

### 2. “发布版本”与“实际生效版本”必须分开

一个发布 manifest 描述候选配置，但请求还会受到动态路由、地域、租户开关、降级和缓存影响。因此每个 trace 需要记录 `effective_config`：

| 字段 | 用途 |
| --- | --- |
| `release_id` | 候选发布的统一身份 |
| `effective_model` | 实际 provider、模型快照、区域、fallback 原因 |
| `effective_retrieval` | 实际 index/corpus、filter、top-k、reranker 与命中文档 |
| `effective_tools` | 调用过的工具 schema/implementation 与回执摘要 |
| `effective_policy` | 输入、输出、授权、内容策略实际命中版本 |
| `experiment` | experiment ID、bucket、分流理由 |
| `config_digest` | 当前组件元组的内容哈希，用于聚合与排障 |

举例：release 声明主模型是 A，但因 A 的 429 走了 B。记录 `fallback_reason=rate_limit` 和实际模型能缩小排查范围，但还需控制请求难度、负载与上下文变化才能判断是否由 B 引起。一次 run 可能多次调用模型，effective config 应逐 attempt/span 记录，不应只有最终模型字段；缓存命中需保留内容生成时的版本和当前授权决定。

## 三、版本血缘图：让组件变更可追踪

### 1. 用图而非一张“版本表”思考

版本依赖天然是一张有向图：

```text
Prompt revision ----\
Model route ---------> Release Manifest -> Deployment -> Request Trace -> Feedback / Incident
RAG index -----------/         |                    \-> Evaluation Run
Tool contract -------/         \-> Experiment bucket
Safety policy -------/
```

图中的边回答“依赖了什么”与“被谁使用”。最有价值的两类查询是：

- **正向影响**：某个 `rerank-v3` 有缺陷，哪些 release、租户和请求使用了它？
- **反向溯源**：某个低分请求 `trace-123` 的有效模型、Prompt、索引、工具和策略各是什么？

实现不一定要先引入图数据库。关系表也能表达：`component_version`、`release_manifest`、`release_component`、`deployment`、`trace_effective_component`、`feedback_link`、`evaluation_run`。重要的是边关系不可丢失、查询可索引，而不是存储引擎名称。

### 2. 组件版本的最小字段

所有组件至少有：`component_type`、`component_id`、`revision`、`content_digest`、`created_by`、`created_at`、`environment`、`status`、`compatibility`、`supersedes`。不同组件另有专有字段：

- Prompt：模板、变量 schema、渲染器、系统消息、输出契约。
- 模型：provider、模型快照、区域、能力标签、上下文限制、价格表版本。
- RAG：文档集合、切分器、embedding、索引、filter policy、召回/rerank 参数。
- Tool：输入/输出 schema、权限、幂等语义、实现映像/commit、超时与重试策略。
- Policy：规则集、风险等级、豁免与审批链。

`revision` 不能仅靠一个可变的“latest”标签。若供应商无法提供固定模型快照，运行记录必须额外保存请求时间、provider 响应头/模型标识、采样结果与 sentinel 评测，明确标注“上游版本不可完全钉死”的风险。

## 四、从代码到线上：Release 生命周期

### 1. 候选构建

CI 从各 registry 读取已审核的组件版本，生成候选 manifest。拒绝无受控例外的可变模型别名、缺少 schema 的工具、无基线的高风险变更、明文生产凭证及未声明开关。供应商不提供快照时，显式记录 unresolved dependency、责任人和风险接受决定并限制用途；不能把“不知道版本”伪装成已固定。

### 2. 离线验证

不是只跑一个总分。根据变更类型选择评测切片：

| 变更 | 必跑验证 |
| --- | --- |
| Prompt / 输出 schema | 结构合法率、关键字段、语气/安全、回归集 |
| 模型或路由 | 质量、TTFT/总延迟、成本、拒答与工具选择 |
| RAG 索引/检索策略 | recall、引用正确、权限过滤、时效与空召回 |
| Tool contract / 实现 | 契约、鉴权、幂等、错误码、回放 |
| Safety policy | 攻击集、误杀率、越权/外发测试 |

评测记录也要链接 release manifest 和 dataset revision。否则后来无法区分“模型变了”还是“评测集变了”。

### 3. 影子、灰度与强制回滚条件

高风险变更先跑影子流量：新 release 处理真实输入但不产生业务副作用，只记录差异。随后按租户、用户、区域、场景或显式实验桶灰度。不要按请求随机比例灰度强权限场景，因为同一案件可能被新旧路径混用。

提前定义停止条件和观察口径。结构合法率下降 2 个百分点、工具失败率翻倍只是构造的策略示例，不是通用门槛；需结合样本量、绝对失败数、风险和基线误差。确认越权写入可直接停止，不必等统计显著。回滚产生新的部署事件：旧 manifest 不变，路由指针可以回到已验证版本，但切换必须留痕。

### 4. 运行中降级也必须可归因

线上常见动态变化有 fallback 模型、缓存命中、检索索引 alias 切换、工具 breaker 打开、内容策略升级、地区路由调整。将它们作为 `runtime_override` 事件写入 trace，并声明原因、开始/结束时间、批准人和影响面。这样“今天为什么突然答得简短”不会变成猜谜。

## 五、质量、成本与反馈的正确归因

### 1. 不要看一个平均分

将指标按有效版本元组切片：

```text
task_success_rate
  by release_id, effective_model, index_revision, tool_revision,
     tenant_segment, locale, experiment_bucket, fallback_reason
```

平均分可能掩盖一个小租户的灾难。也不能只按 release 分，因为一个 release 内可能有模型 fallback 或不同 index。另一方面，切片维度过多会造成高基数和样本不足，应维护预定义的诊断维度，并只对异常样本开启深度采样。

**可复算反例：总体下降不等于每个切片退化。** 旧版在简单任务通过 90/100、困难任务通过 60/100，总通过率 150/200 = 75%；新版分别通过 19/20 和 112/160，即 95% 和 70%，却因困难任务更多，总体为 131/180 ≈ 72.8%。两个切片都上升，总分仍下降。这是构造的流量组成变化，不是实测收益。

L1 应从一条失败 trace 找出实际 attempt 与证据版本；L2 应解释组成偏差、回滚兼容性和采样成本；L3 应在固定样本配对评测或稳定随机分桶中检验变更效应，报告样本量、不确定性与 judge 版本。血缘提供关联与复现输入，不自动完成因果归因。

### 2. 用户反馈如何精确回流

点赞、点踩、人工修正、转人工、工单升级、工具失败、护栏命中都是反馈事件。反馈事件至少关联：`trace_id`、`run_id`、`release_id`、`config_digest`、用户/租户匿名化标识、任务类型、时间、反馈来源与数据保留策略。

人工标注时先做根因标签：`prompt_instruction`、`model_reasoning`、`retrieval_miss`、`stale_document`、`reranker`、`tool_error`、`policy_block`、`user_input_ambiguous`、`upstream_provider`。一个 bad case 可以有主因和次因，但不要把所有低分都塞回“改 Prompt”的队列。

反馈路由示例：

```text
低引用正确率 + index=42             -> RAG/index owner
工具参数不合法 + schema=tool-v6     -> Tool contract owner
仅 fallback model-B 质量下降         -> model routing owner
安全策略误杀 + out-policy=11         -> policy owner
同一版本下用户需求模糊               -> 产品追问/交互设计
```

这使“数据飞轮”变成可执行的责任闭环，而不是泛泛收集聊天记录。

## 六、RAG、工具与 Agent 的特殊血缘

### RAG：记录“检索发生了什么”，不是只记录最终答案

RAG trace 至少包含 query rewrite revision、metadata filter、候选集合 ID、top-k、reranker、最终片段 ID/文档版本/页码、拒绝/过滤原因。否则当用户说“制度答错了”，你无法区分是没召回、召回后被重排丢掉、权限过滤错误、还是模型没有忠实使用证据。

### Tool：schema 与实现必须各自版本化

工具名相同不代表行为相同。`create_ticket@schema-v5` 的默认优先级、字段校验和返回错误码可能已变，而调用方仍使用旧 Prompt。manifest 同时引用 schema revision 与 implementation revision；工具响应记录真实服务版本和业务回执。高风险工具还要记录授权策略和幂等策略版本。

### Agent：一次运行会产生动态组件

Agent 的工具序列、子 Agent、上下文压缩、计划版本会在运行时动态出现。不要要求 manifest 预先穷举每一步；采用“两层血缘”：release manifest 固定允许的模型/工具/策略集合，trace 记录实际选中的节点、工具、参数摘要、预算、边路由和子图版本。这样既可复现授权边界，也不牺牲动态执行的真实性。

## 七、系统设计题：设计一个 LLM Release Control Plane

### 需求澄清

多个业务团队共享模型网关与 RAG/工具平台。要支持每日 Prompt、模型、索引和工具变更；线上发生质量下降时要在 15 分钟内定位受影响版本并回滚；用户反馈要准确进入相应团队；不能把原始 PII 全量写入观测系统。

### 参考架构

```text
Git / Prompt Registry / RAG Registry / Tool Registry / Policy Registry
                        -> Manifest Builder -> Eval Gate -> Release Registry
                                                   |               |
Traffic Router <-----------------------------------+               -> Deployment / Flag service
    |
LLM Application -> Trace SDK -> Event Stream -> Provenance Store -> Metrics / Incident Console
    |                                               ^
    -> Model / RAG / Tool Gateway ------------------|
                                                    |
Feedback UI / Human correction -> Feedback linker --+
```

### 数据与职责划分

- **Release Registry**：不可变 manifest、批准、环境状态、rollback/retire 生命周期。
- **Registry adapters**：从各组件 registry 读取固定 revision 与兼容性，不保存明文 Secret。
- **Trace SDK**：在请求入口创建 trace，记录 effective components 和 override；对敏感正文做哈希、脱敏或引用化。
- **Provenance Store**：存版本图、trace 到有效组件的边、评测/反馈关联，支持影响分析。
- **Router/Flag service**：按稳定分桶选择 release，保证同一会话/案件保持一致；可触发 kill switch。
- **Quality service**：用离线基线、在线抽样、用户反馈和业务回执形成切片指标。

### 15 分钟事故处置路径

1. 告警发现任务成功率下降，按 `release_id`、模型、索引、租户、fallback 原因切片。
2. 对异常 trace 做反向血缘：确认实际有效配置，而非仅查看当前配置。
3. 用正向影响查询找出同一组件版本的所有受影响 release/租户。
4. 对高风险 release 触发 router kill switch，稳定会话保持旧版或转降级路径。
5. 回放最小脱敏样本/评测切片，确定根因；修复后产生新 manifest 再灰度。
6. 将事故与 trace、组件版本、修复评测、反馈标签关联，成为后续门禁案例。

## 八、面试高频问答

**Q：Prompt 已经版本化了，为什么还需要 release manifest？**

Prompt 只是一项依赖。真实行为还受模型快照、参数、索引、重排、工具、策略和实验分桶影响。manifest 把一次可发布的跨组件组合固定下来，trace 再补充请求实际生效的动态路由与降级。

**Q：如何定位“没改 Prompt 但模型变笨了”？**

先比对异常与基线的 effective config：实际模型/provider/region、fallback、解码参数、索引/reranker、工具实现、policy 与 flag。随后按版本元组切片质量指标，并跑固定 sentinel 集。若供应商未提供可固定快照，要把上游不确定性纳入风险、保留请求时间与响应标识，并用灰度/多供应商降级控制影响。

**Q：为什么不能只靠日志搜索？**

日志适合逐条排查，不擅长回答跨 release 的影响面和统计归因。控制面将 trace、版本边、评测、反馈和事故用稳定 ID 关联，能从一个组件查询所有受影响请求，也能从一个差评回到真实配置。

**Q：如何避免版本维度导致指标高基数爆炸？**

聚合层使用 `release_id`、少数关键 effective component 和预定义业务切片；完整 config digest 仅用于 trace/异常采样；对旧版本降采样和归档。先让诊断问题可回答，再控制存储成本，不能把所有 Prompt、用户、文档 ID 都做成指标标签。

**Q：回滚是不是将配置改回旧值？**

不是。回滚应是可审计的路由/发布事件：明确来源/目标 release、分桶、时间、批准人和原因。旧运行只有在当前授权、工具契约和安全策略仍允许时才可继续；涉及漏洞时冻结/取消并核对已有副作用。模型回滚不撤销已发邮件、扣款或数据库迁移，必须另行核对回执与补偿。

## 九、项目讲法模板

以下为版本控制面的参考设计叙述，索引事故是假设情境，不是实际上线证据；不能直接作为个人经历。

> 我们发现单独记录 Prompt 版本不足以定位线上质量变化，因为一次请求还依赖模型路由、检索索引、重排器、工具 Schema、策略和 feature flag。于是为每个候选发布生成不可变 release manifest，并在 trace 中记录请求实际命中的 effective config、fallback 原因和证据引用。质量、成本、延迟和用户反馈都关联到 `release_id + config_digest`，再按模型、索引、租户和实验桶切片。某次质量告警出现后，我们先做反向溯源确认实际索引 alias 已切换，而不是误改 Prompt；通过影响查询只回滚受影响租户，旧会话保持版本一致。最终 bad case 被准确路由到索引 owner，修复评测成为下一次发布门禁。

## 十、与已有专题的分工

- Prompt 模板、A/B 与回滚细节见 [Prompt 生命周期、实验与发布](/prompt/prompt-lifecycle)。
- RAG 的切分、召回、索引建设与评测见 [RAG 生产化与系统设计](/rag/rag-production)。
- 通用指标、trace 与数据飞轮见 [LLMOps：大模型应用的生产运营](/engineering/llmops)。
- 发布门禁、Judge 校准和线上实验的具体方法见 [LLM 评测与发布门禁实战](/interview/evaluation-release-gates)。
- Agent 运行配置闭包与复现细节见 [Agent 可复现运行与配置溯源](/interview/agent-reproducibility-provenance-playbook)。

本页只聚焦一个问题：将这些组件组合成可追溯、可归因、可影响分析的生产 release。

项目讲法中的索引事故是叙述示例；没有事故记录、版本证据和评测数据时，不应当作个人实绩使用。
