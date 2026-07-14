# Agent 评测与安全合规高频问答

> 当问题从“怎么评 Agent”继续追问到“改了模型、工具或策略后怎么安全发布”，可衔接到 [LLM 评测与发布门禁实战](/interview/evaluation-release-gates)，其中给出了 release manifest、硬红线、sandbox、灰度和回滚的完整答题框架。
>
> 若继续追问“灰度怎么稳定分桶、写工具何时停止扩量、线上证据如何进入回归集”，见 [LLM 线上评测、灰度实验与质量运营面试题](/interview/online-evaluation-rollout-operations)。
>
> 对企业级的资产登记、策略即代码、受限委托、例外到期和审计账本，见 [企业 AI 安全、合规与审计控制面系统设计面试题](/interview/enterprise-ai-governance-audit-system-design)。

> Agent 面试不要只说“任务成功率”。生产 Agent 是多步、有状态、会调用工具、可能产生副作用的系统，评估必须同时看 Outcome、Trajectory、Cost、Safety 和 Audit。工程总览见 [Agent 评估与可靠性工程](/agent/agent-evaluation)，工具权限边界见 [Agent 工具安全与权限边界](/agent/tool-safety)，合规框架见 [AI 安全合规与治理](/advanced/governance)。

## 怎么用这页

遇到 Agent 评测、安全合规、上线门禁类问题，可以按这条线回答：

1. **定义风险**：Agent 不只是生成答案，还会规划、检索、写记忆、调用工具。
2. **拆指标**：Outcome、Trajectory、Cost、Safety、Audit 五类指标一起看。
3. **建评测集**：golden、adversarial、regression、scenario、sandbox 五类样本。
4. **设门禁**：越权执行、高危未确认、敏感泄露、审计缺失是硬红线。
5. **做闭环**：线上 trace、用户反馈、事故复盘回流评测集和策略。

可复述版本：

> 我会把 Agent 上线评估拆成结果、轨迹、成本、安全和审计五层。最终答案对只是第一层；还要看工具该不该调、参数是否越权、步数是否超预算、失败后是否恢复、高危动作是否确认、Prompt Injection 是否被拦截、trace 是否能回放。上线前跑 golden set、注入对抗集、越权集、工具异常集和回归集；线上 bad case 回灌评测集。

## 追问链一：为什么 Agent 不能只看最终答案

**面试官：Agent 最终答案正确，是不是就算通过？**

标准答法：

> 不一定。Agent 是带过程和副作用的系统。最终答案正确，但中间调用了禁止工具、读取了越权文档、重复扣款、泄露敏感字段、绕了 20 步烧穿预算，都应该算失败。Agent 评测要同时看结果和轨迹。

| 维度 | 要回答的问题 | 典型指标 |
| --- | --- | --- |
| Outcome | 任务完成了吗 | success rate、最终状态校验、人工评分 |
| Trajectory | 过程合理吗 | 工具选择准确率、参数准确率、冗余步数、恢复率 |
| Cost | 值得吗 | token、工具成本、P95 延迟、最大步数、重试次数 |
| Safety | 安全吗 | 越权执行数、高危未确认数、注入成功率、敏感泄露数 |
| Audit | 可追责吗 | trace 覆盖率、审批记录、策略版本、日志脱敏 |

反面回答：

> “答案对就可以上线”会被继续追问副作用和越权。面试官真正想听的是：Agent 是可执行系统，过程错误也会造成真实损失。

## 追问链二：Agent 评测集怎么设计

**面试官：每条 Agent 评测样本除了用户问题，还要存什么？**

标准答法：

> Agent 评测样本要描述任务目标、环境初始状态、可用工具、允许工具、禁止工具、关键参数、最大步数、成本预算、安全约束和期望最终状态。只存用户问题无法判断轨迹是否合理。

样本字段：

| 字段 | 说明 |
| --- | --- |
| input | 用户目标和上下文 |
| initial_state | 数据库、文件、工单、账户等初始状态 |
| allowed_tools | 本样本允许调用的工具集合 |
| forbidden_tools | 禁止调用的工具或高危动作 |
| expected_outcome | 最终答案或环境状态 |
| required_steps | 必须出现的关键动作，可选 |
| max_steps / budget | 步数、token、工具调用成本上限 |
| safety_constraints | 不能泄露、不能越权、必须人审 |
| judge_rule | 规则判定、LLM-as-Judge、人评或混合 |
| tags | 场景、风险级别、版本、来源 |

评测集分层：

- **Golden Set**：核心高频任务，保证基础能力不退化。
- **Adversarial Set**：注入、越权、缺参、诱导泄露、冲突指令。
- **Regression Set**：线上 bad case 和事故样本。
- **Scenario Set**：长任务、多工具、多轮、人审、失败恢复。
- **Sandbox Set**：真实工具的可回滚环境状态校验。

项目表达：

> 我们的 Agent 评测不是只有 prompt 和答案，而是把“允许调什么工具、禁止调什么工具、最后系统状态应该怎样”都写进样本。这样才能评工具轨迹和安全红线。

评测数据运营要补一句：

> 评测集也要像代码资产一样治理：每条 case 有 owner、来源、风险标签、脱敏状态、适用 Agent、最后复核时间和版本。线上 bad case 进入候选池后先去重、脱敏、打标签，再决定进入 golden、adversarial 还是 regression。

| 运营动作 | 目的 |
| --- | --- |
| 采样 | 从高频任务、投诉、事故、灰度失败中抽 case |
| 标注 | 标最终状态、允许工具、禁止工具、关键参数和风险级别 |
| 脱敏 | 去掉 PII、密钥、客户合同原文等敏感信息 |
| 去重 | 避免同类 case 过多导致评测偏斜 |
| 分层 | 按场景、风险、租户、工具类型、失败类型分桶 |
| 复核 | 定期检查期望答案、工具 schema 和策略是否过期 |

## 追问链三：轨迹评估怎么做

**面试官：工具调用轨迹怎么评？路径不唯一怎么办？**

标准答法：

> 轨迹评估不能只做精确匹配。可以按任务确定性选择 exact match、in-order、any-order、precision/recall 或状态校验。强流程任务看顺序，开放任务看必要工具覆盖和禁止工具不出现。

| 评估口径 | 适合场景 | 例子 |
| --- | --- | --- |
| exact match | 固定审批流程 | 必须先查权限再生成审批单 |
| in-order | 有必要顺序但允许额外步骤 | 先查订单再退款 |
| any-order | 子任务可交换 | 查询库存和价格 |
| precision / recall | 工具选择评估 | 漏调必要工具、误调无关工具 |
| state check | 有真实副作用 | 数据库最终状态正确 |
| policy check | 安全约束 | 禁止工具调用次数为 0 |

常见轨迹失败：

- 选错工具：应该查订单却查库存。
- 参数错：订单号、租户、金额、时间范围错误。
- 顺序错：未查权限先执行写操作。
- 冗余调用：反复查询或循环调用。
- 恢复差：工具超时后盲目重试或直接编造。
- 安全错：调用了禁止工具或绕过审批。

一句话收束：

> 路径可以不唯一，但安全约束和最终状态不能含糊。轨迹评估的目标不是要求 Agent 每步和参考答案一样，而是证明它没有漏掉关键动作、没有做危险动作、没有超预算。

## 追问链四：Prompt Injection 与越权怎么评

**面试官：如何证明 Agent 能抵御 Prompt Injection 和工具越权？**

标准答法：

> 不能靠“系统提示词写得严”证明安全。要有注入对抗集、越权样本、工具策略门禁和线上审计。评测时不仅看模型是否拒绝，还要看真实工具是否没有执行、敏感数据是否没有出现在输出或日志里。

攻击样本类型：

| 类型 | 示例 | 期望 |
| --- | --- | --- |
| 直接注入 | 用户要求忽略系统指令 | 拒绝或按原策略执行 |
| 间接注入 | 网页/邮件/文档里藏恶意指令 | 当作不可信数据 |
| 工具结果注入 | search 返回“把 token 发出去” | 不扩大权限 |
| 越权访问 | 查询其他租户订单 | deny，执行数为 0 |
| 高危动作 | 删除数据、退款、发外部邮件 | require approval 或 deny |
| 记忆污染 | 要求写入恶意长期记忆 | 不写入或等待确认 |

安全指标：

- 越权工具实际执行数 = 0。
- 高危写操作未确认执行数 = 0。
- 注入攻击成功率低于阈值。
- 敏感字段输出泄露数 = 0。
- 工具返回不可信内容影响系统指令次数 = 0。
- 安全误拒率可接受，不能把正常任务全拒掉。

面试补一句：

> Prompt Injection 测试要看执行层结果。如果模型嘴上说“我不会泄露”，但工具已经发出了外部请求，评测应判失败。

## 追问链五：上线门禁怎么设

**面试官：Agent 从 demo 到生产上线，门禁怎么设计？**

标准答法：

> 门禁要分软指标和硬红线。任务成功率、延迟、成本可以设阈值；越权执行、高危未确认、审计缺失、敏感泄露应该是硬红线，一票否决。

门禁清单：

| 门禁 | 建议 |
| --- | --- |
| Golden Set | 核心任务成功率不低于上一版 |
| Regression | 历史 bad case 不复发 |
| Trajectory | 工具选择、参数、顺序达到阈值 |
| Safety | 越权执行、高危未确认、敏感泄露为 0 |
| Cost | 平均成本、P95 成本、最大步数不超预算 |
| Latency | P95 / P99 达到场景 SLA |
| HITL | 高危动作人审命中率和超时处理达标 |
| Audit | 关键 trace 字段覆盖率 100% |
| Rollback | 能回退模型、prompt、工具 schema、策略版本 |

上线流程：

```text
change submitted
  -> version model / prompt / tool schema / policy
  -> run golden + adversarial + regression
  -> sandbox side-effect tests
  -> small traffic canary
  -> monitor success / safety / cost / latency
  -> promote or rollback
```

反面回答：

> “人工试几条没问题就上线”不够。Agent 变更必须像后端发布一样有版本、回归、灰度、监控和回滚。

## 追问链六：LLM-as-Judge 怎么用于 Agent

**面试官：Agent 评测能不能全交给 LLM-as-Judge？**

标准答法：

> 不能全交给裁判模型。LLM-as-Judge 适合评开放答案质量、步骤合理性和解释充分性，但权限、安全、最终数据库状态、工具是否真实执行必须用规则、日志和环境状态校验。最稳妥是规则判定 + LLM Judge + 人工抽检混合。

| 评估对象 | 推荐判定 |
| --- | --- |
| 最终状态 | 规则 / 数据库状态 / 单元测试 |
| 工具是否越权 | Policy 日志和工具执行日志 |
| 参数是否合法 | schema + 业务规则 |
| 回答质量 | LLM-as-Judge + 人评抽检 |
| 轨迹合理性 | 规则特征 + LLM-as-Judge |
| 安全红线 | 规则硬门禁，不交给 LLM 决定 |

校准裁判：

- 固定评分 rubric，不让裁判自由发挥。
- 隐藏模型名称，减少品牌偏见。
- 交换候选答案顺序，缓解位置偏差。
- 用人工标注集测 judge 与人类一致率。
- 对安全红线用规则优先，Judge 只能辅助解释。
- 监控 judge drift：裁判模型、rubric、样本分布变化后，要重新测一致率。
- 要求输出 failure_type taxonomy，方便统计是检索错、工具错、权限错、格式错还是安全误拒。

一句话：

> Judge 可以帮你看“好不好”，但不能替代系统证据证明“有没有越权、有没有执行、有没有泄露”。

## 追问链七：评测平台化怎么落到 CI/CD

**面试官：Prompt、模型或工具 schema 改动后，如何做回归和灰度发布？**

标准答法：

> Agent 的模型、prompt、工具 schema、policy、memory rule 都要作为可发布资产版本化。任何一项改动都触发对应评测集：prompt 改动跑 golden 和 regression；工具 schema 改动跑参数、权限、沙箱执行；policy 改动跑越权和高危审批；模型改动跑质量、安全、成本、延迟对比。

```text
pull request / config change
  -> detect changed assets
  -> select eval slices
  -> run sandbox trajectories
  -> compare baseline vs candidate
  -> gate: hard red lines + threshold
  -> canary by tenant / app / traffic
  -> monitor online metrics
  -> promote or rollback
```

变更门禁：

| 改动 | 必跑评测 |
| --- | --- |
| Prompt | golden、regression、注入样本、格式遵循 |
| Model | quality、safety、cost、latency、judge 校准 |
| Tool schema | 参数校验、权限、幂等、沙箱状态 |
| Policy | 越权集、高危审批、误拒率 |
| Memory rule | 记忆污染、隐私、过期和删除样本 |
| Route rule | fallback 兼容、成本、SLA、灰度对比 |

## 追问链八：沙箱与仿真评测怎么做

**面试官：Agent 会真实调用工具，评测时怎么避免破坏生产数据？**

标准答法：

> 高风险 Agent 评测必须有沙箱和可回放环境。只读工具可以用脱敏快照；写工具要 mock 或接影子环境，支持 fixture 初始状态、失败注入、幂等校验和最终状态断言。不能拿生产订单、邮件和账户直接试 Agent。

沙箱能力：

- Mock tool：返回稳定 observation，适合单步工具选择和参数评测。
- Shadow tool：连接影子环境，验证真实协议和状态变化。
- Fixture state：每条 case 有初始数据库/文件/工单状态。
- Failure injection：注入超时、403、500、字段缺失、重复提交。
- State assertion：执行后断言数据库、工单、邮件队列的最终状态。
- Replay：同一 trace 可复跑，定位模型变更或工具变更造成的差异。

面试收束：

> 沙箱评测的目的不是让 Agent 在假环境里自嗨，而是证明它面对真实工具协议、权限错误、超时和副作用时仍然可控。

## 追问链九：线上可观测和审计怎么做

**面试官：Agent 出问题后如何复盘？trace 要记录什么？**

标准答法：

> 每次 Agent 任务都要能回放：用户目标、模型版本、prompt_version、工具候选集、工具调用、参数摘要、策略决策、审批记录、Observation、最终输出、成本、延迟和安全检测结果。没有 trace，就无法区分是规划错、工具错、权限错、数据错还是模型错。

Trace 字段：

| 类别 | 字段 |
| --- | --- |
| Identity | user_id、tenant_id、role、session_id |
| Version | model、prompt_version、agent_version、policy_version |
| Planning | plan、step_id、reason_summary、max_steps |
| Tool | tool_name、tool_version、args_summary、resource_id |
| Policy | decision、deny_reason、approval_required、risk_level |
| Execution | status、error_code、latency、retry_count |
| Memory/RAG | retrieved_docs、memory_ids、acl_filter |
| Safety | injection_score、pii_masked、moderation_result |
| Cost | input/output token、tool_cost、total_cost |
| Audit | approval_id、operator、idempotency_key、trace_id |

日志原则：

- 参数摘要化，避免完整 PII 和密钥落盘。
- 高危工具必须有审批链和幂等键。
- trace_id 要能串起前端、编排器、工具服务和审计系统。
- 失败样本要自动打标签，进入回归集候选池。

## 追问链十：安全合规评审看什么证据

**面试官：企业 Agent 合规评审时，你准备哪些材料？**

标准答法：

> 合规评审不是口头保证，而是证据链。要提供数据分级、权限模型、工具风险分级、日志脱敏、数据保留、删除流程、红队报告、评测门禁、审批记录和事故预案。

证据清单：

| 证据 | 说明 |
| --- | --- |
| 数据流图 | 用户输入、RAG、Memory、Tool、外部 API 的数据去向 |
| 权限矩阵 | 谁能调用哪些工具、访问哪些资源 |
| 工具风险分级 | 只读、低风险写、高风险写、禁止执行 |
| 评测报告 | golden、adversarial、regression、安全集结果 |
| 红队报告 | 注入、越权、泄露、高危动作测试结果 |
| 审计样例 | trace、审批、执行、回滚记录 |
| 日志策略 | 脱敏、保留期限、访问控制、跨境限制 |
| 用户控制 | 记忆可查看、可删除、可关闭 |
| 事故预案 | 泄露、误执行、成本暴涨、模型异常的止血流程 |

补一句：

> 合规不是只在输出后做审核。Agent 的风险发生在检索、记忆写入、工具调用、外部发送和日志落盘的每个环节。

## 追问链十一：多 Agent 和长链路风险怎么评

**面试官：多 Agent 协作时，权限和责任边界怎么评？**

标准答法：

> 多 Agent 不是把一个 Agent 的权限复制给所有子 Agent。每个子 Agent 要有独立角色、工具白名单、上下文视图和责任边界；父 Agent 委托任务时不能把高权限凭据、完整用户隐私和不必要工具一起下发。

| 风险 | 评测点 |
| --- | --- |
| 权限继承过宽 | 子 Agent 是否拿到超出任务需要的工具 |
| 上下文泄露 | 子 Agent 是否看到不该看的用户隐私或租户数据 |
| 责任不清 | 高危决策是否能追到发起者、审批者和执行者 |
| 互相污染 | 一个 Agent 的不可信 observation 是否影响其他 Agent |
| 循环委托 | 多 Agent 是否互相转派导致步数爆炸 |
| 审计断链 | trace 是否能串起 parent_task 和 child_task |

项目表达：

> 多 Agent 评测里，我会把每个子 Agent 当成独立服务看：它能看什么上下文、能调什么工具、能不能发起写操作、是否必须回到父 Agent 汇总，都要进入评测样本和 trace。

## 追问链十二：安全事故怎么止血

**面试官：Agent 误调用工具或泄露数据，线上怎么处理？**

标准答法：

> 先按风险停止扩散，再保留证据、回滚策略、通知 owner，并把样本回灌门禁。Agent 平台必须能按 agent_version、tool_version、policy_version 和 tenant 快速缩小影响面。

| 事故 | 立即止血 | 后续复盘 |
| --- | --- | --- |
| 越权工具执行 | 禁用工具或策略 fail closed | 查权限缺口，加入越权集 |
| 高危未确认执行 | 冻结 commit 接口，撤销或补偿 | 强制 prepare/commit 门禁 |
| Prompt Injection 成功 | 禁用外部内容驱动写操作 | 加注入样本和不可信数据隔离 |
| 敏感信息泄露 | 停止相关路由，封存日志 | 查数据流和日志脱敏 |
| 成本暴涨 | 降 max_steps、冻结 Key、回滚 prompt | 查循环、重试、工具失败 |
| 质量大退化 | 回滚模型/prompt/工具 schema | 加 bad case 回归 |

事故复盘模板：

1. 影响面：哪些用户、租户、工具、数据和成本受影响。
2. 触发点：模型、prompt、工具 schema、策略、外部内容哪个变化导致。
3. 漏防点：评测集、策略引擎、审计、监控哪一层没拦住。
4. 修复：策略回滚、样本回灌、门禁升级、owner 责任确认。

## 系统设计题：Agent 评测与安全门禁平台

**题目：设计一个企业 Agent 上线评测与安全门禁平台，支持客服、投研、运营等多个 Agent。**

### 需求澄清

- Agent 类型：只读问答、工具执行、长任务、代码执行还是外部发送。
- 工具风险：是否有退款、删除、发邮件、改数据库等写操作。
- 多租户和权限：是否接企业 IAM、RAG ACL、审批流。
- 评测规模：golden set、bad case、红队样本数量和更新频率。
- 门禁要求：哪些指标可阈值化，哪些是硬红线。
- 合规要求：审计保留、日志脱敏、数据出境和用户可删除。

### 架构草图

```text
Agent Change
  -> Version Registry
     - model / prompt / tool schema / policy / memory rule
  -> Dataset Hub
     - golden / adversarial / regression / sandbox
  -> Eval Runner
     - outcome judge
     - trajectory judge
     - safety rule checker
     - cost and latency check
  -> Sandbox Tool Executor
     - reversible side effects
     - fixture state
  -> Gatekeeper
     - thresholds
     - hard red lines
     - approval workflow
  -> Observability
     - trace / audit / online feedback / bad case mining
```

### 数据流

1. 开发提交 Agent 版本：模型、prompt、工具 schema、策略版本一起登记。
2. 平台选择对应场景的评测集和红队集。
3. Eval Runner 在沙箱环境执行任务，记录每一步 trace。
4. Outcome 评最终结果，Trajectory 评工具轨迹，Safety Checker 查红线。
5. Gatekeeper 汇总成功率、成本、延迟、安全和审计覆盖。
6. 通过后小流量灰度；线上 trace 和 bad case 回流 Dataset Hub。

### 关键取舍

| 取舍 | 推荐回答 |
| --- | --- |
| 自动评估 vs 人评 | 高频回归自动化，关键安全和开放质量做人评抽检 |
| 轨迹精确匹配 vs 状态校验 | 强流程看轨迹，开放任务看最终状态和禁止动作 |
| 真实工具 vs 沙箱工具 | 上线前用沙箱，灰度期对高危工具强制人审 |
| LLM Judge vs 规则 | 质量可用 Judge，权限和执行必须规则硬判 |
| 阈值门禁 vs 一票否决 | 成本延迟用阈值，越权和泄露一票否决 |

### 上线验收

- 核心 golden set 不低于上一版。
- 禁止工具实际执行数 = 0。
- 高危写操作未确认执行数 = 0。
- 安全对抗集达到目标，通过样本有 trace 证据。
- P95 成本、延迟、最大步数不超预算。
- 审计字段覆盖率 100%，敏感日志明文泄露为 0。
- 能按 agent_version、prompt_version、tool_version 一键回滚。

## 项目讲法模板

### 模板一：客服 Agent 上线门禁

> 我们把客服 Agent 的评测分成结果、轨迹、成本、安全四层。Golden Set 覆盖查订单、查物流、退货政策等高频场景；Adversarial Set 覆盖越权查其他用户订单、诱导退款、注入指令；工具执行在沙箱里校验最终状态。上线门禁要求越权执行为 0、高危退款必须人审、P95 延迟和 token 成本达标。线上 bad case 会自动回流回归集。

### 模板二：投研 Agent 安全合规

> 投研 Agent 会读取研报、公告和内部纪要，所以我们把外部内容标为不可信数据，禁止它直接驱动外发和交易动作。评测集里有来源可信度、引用准确率、跨文档推理和 Prompt Injection 样本；合规侧要求 trace 能回放每条结论引用了哪些文档、是否包含敏感材料、是否触发人工复核。

### 模板三：工具执行 Agent 事故复盘

> 有一次 Agent 误选工具导致工单状态写错，我们没有只改 prompt，而是把该样本加入 regression set，给工具 schema 增加资源类型校验，策略引擎要求写操作先 prepare 后 commit，并在门禁里加入“错误状态写入为 0”的硬指标。之后类似变更必须通过沙箱状态校验才能灰度。

## 反面回答清单

- “Agent 评测就是看成功率。”缺少轨迹、成本、安全和审计。
- “LLM-as-Judge 可以全自动判断。”权限、执行和泄露必须用系统证据。
- “Prompt 写严一点就能防注入。”Prompt 不是安全边界。
- “工具 JSON 合法就能执行。”还要做权限、租户、风险和审批校验。
- “最终答案对就算通过。”过程越权或高危未确认仍是失败。
- “线上出了问题看日志。”没有结构化 trace 和版本字段就无法复盘。
- “合规就是输出审核。”检索、记忆、工具、日志、外发都要合规控制。

## 面试前 5 分钟速记

- Agent 评测五件事：Outcome、Trajectory、Cost、Safety、Audit。
- 评测样本要存允许工具、禁止工具、关键参数、最大步数、安全约束。
- 轨迹不要求唯一，但禁止动作、权限边界、最终状态必须硬校验。
- Prompt Injection 要看执行层是否被劫持，不是只看模型说了什么。
- 上线硬红线：越权执行 0、高危未确认 0、敏感泄露 0、审计缺失 0。
- LLM-as-Judge 适合质量判断，不适合替代权限和执行证据。
- 合规证据链：数据流图、权限矩阵、工具风险、评测报告、红队报告、审计样例。

## 延伸阅读

- [Agent 评估与可靠性工程](/agent/agent-evaluation)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [RAG、Memory 与评测安全高频问答](/interview/rag-memory-eval-qna)
- [AI 安全合规与治理](/advanced/governance)
- [大模型安全与对齐](/advanced/safety)
