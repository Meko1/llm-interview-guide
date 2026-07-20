# Prompt 生命周期、实验与发布（PromptOps）

在线上系统里，Prompt 不是一段散落在代码中的字符串，而是一项会影响质量、成本、安全、工具行为和用户体验的**可发布资产**。改一条例子、一个变量默认值、一个模型参数，甚至一个工具 schema，都可能改变线上行为。因此 PromptOps 的目标不是“更快改提示词”，而是让每一次变更可复现、可评测、可灰度、可回滚、可审计。

本页是 Prompt 主栏目中的生产化主路径。它讲资产生命周期和控制面；“如何自动找到更优 Prompt”见 [自动化优化与 Prompt Ops](/prompt/prompt-optimization)，评测方法见 [模型评估与幻觉](/evaluation/evaluation)，发布门禁和线上实验的面试深问见 [LLM 评测与发布门禁实战](/interview/evaluation-release-gates)、[LLM 线上评测与灰度实验](/interview/online-evaluation-rollout-operations) 与 [PromptOps 模板治理与实验回滚](/interview/promptops-production-governance-playbook)。

## 一、为什么 Prompt 需要像代码一样治理

Prompt 具有三个特征：它直接影响模型输出；它通常依赖模型、知识库、工具和策略；它的效果又有非确定性。因此仅在数据库保存一段文本、靠运营同学手工复制粘贴，必然会遇到：

- 不知道线上某个回答到底使用了哪版系统提示、few-shot 和变量。
- 修改温度、工具描述或 RAG 上下文后，无法解释为什么质量变化。
- 离线分数提高但核心客户退化，无法快速回退到完整可工作的组合。
- 同一会话在新旧模板间跳变，导致上下文格式不一致。
- 把密钥、用户数据、实验草稿直接写进 Prompt，形成安全和审计风险。

一句话定义：**PromptOps = 将 Prompt 及其运行依赖作为版本化配置，放进测试、发布、观测与回滚闭环。**

## 二、Prompt 资产到底包含什么

一个“版本”不能只是一段 `system_prompt`。建议把可影响行为的配置收敛到资产清单：

```yaml
prompt_id: customer_support_answer
version: 2026.07.20.3
template: templates/customer_support.jinja
variables_schema: schemas/support-input.json
few_shot_set: support-golden-v12
model_policy: chat-main-v5
decoding: { temperature: 0.2, max_tokens: 700 }
tools: [order_lookup@3, refund_preview@2]
rag_policy: support-index@2026-07-18
safety_policy: support-guardrail@7
eval_suite: support-release@21
```

将这些内容记录为 `release_manifest`。它的价值是：一次线上响应可以还原到“哪份模板、什么变量、哪个模型、哪套检索索引、什么工具契约和策略”共同作用的结果，而不是把所有责任推给“模型随机”。

**版本规则。** 模板正文、变量 schema、few-shot、模型/解码参数、工具 schema、RAG/安全策略任一改变，都应形成新的可追踪 revision。是否让它们共享同一个语义版本号可按团队习惯决定，但 trace 必须能关联到完整 manifest。

## 三、环境、渲染与密钥边界

典型环境为 `dev -> staging -> production`，环境之间不应只差一个模型 URL：

| 环境 | 主要目的 | 数据与权限 |
| --- | --- | --- |
| dev | 模板开发、lint、变量样例 | 合成或脱敏数据，低权限工具 |
| staging | 端到端集成、沙箱工具、回归 | 受控样本，禁止真实写副作用 |
| production | 灰度与正式流量 | 最小权限、审计与稳定分桶 |

模板渲染前应做变量 schema 校验、默认值检查、长度/token 预算检查、敏感字段扫描和引用完整性检查。渲染后的 prompt 可以保存受控哈希和脱敏快照，用于调试与复现；不要在普通日志中无条件写入原始用户数据或密钥。

配置也要分层：稳定的资产存版本库/配置库，环境差异走受控参数，机密走 secret manager。把生产密钥拼进模板既不利于审计，也会扩大提示注入的影响面。

## 四、离线评测：发布前先证明没有明显退化

Prompt 变更的最小发布单元不是“文本改好了”，而是“新 manifest 通过了与任务相称的离线证据”。建议将评测集分成：

| 集合 | 作用 |
| --- | --- |
| golden | 业务最重要、答案或事实可核验的样本 |
| regression | 历史事故、用户投诉、已修复 bad case |
| boundary | 长输入、空字段、冲突约束、多语言等边界 |
| adversarial | 注入、越权、诱导泄露与格式攻击 |
| holdout | 不参与日常调参，用于防止过拟合 |

评测要同时看正确性、结构化成功率、引用/工具正确性、安全拒答、延迟和 token 成本。平均分提高不足以通过发布：关键业务切片、重要租户、长上下文或安全红线只要显著退化，就应阻断或要求明确豁免。

对于非确定性输出，固定一次随机种子并不足够。可重复运行、用 win/tie/lose 对比或置信区间观察，避免将随机波动误判成 Prompt 改进。

## 五、发布门禁：从分数到允许上线的决定

将门禁分成三类会更清晰：

1. **硬门禁**：安全违规、数据越权、工具 schema 不兼容、关键格式失败，任一命中即阻断。
2. **预算门禁**：P95 延迟、平均/尾部 token、缓存命中和单位成本不可超过约定阈值。
3. **质量门禁**：主指标提升或不退化，关键切片不低于基线，低样本指标标记不确定而非强行判赢。

确有业务原因需要豁免时，豁免应记录审批人、范围、有效期和观察指标。永久“临时放行”会让门禁失去意义。

## 六、从 Shadow 到 Canary，再到 A/B

离线通过并不等于可以全量。线上实验需要先定义假设、主指标、护栏、停止条件和受众：

```text
shadow  : 复制请求给新版本，只记录结果，不影响用户
canary  : 小比例真实用户实际看到新版本，可随时停止
A/B     : 稳定分桶对照，比较预先定义的业务指标
ramp-up : 通过每一阶段门槛后逐步扩大比例
```

Shadow 绝不能复用生产写权限。涉及工具调用时应使用 dry-run、sandbox 或只执行无副作用路径；否则“不可见实验”会在真实系统制造不可见事故。

分桶要有会话粘性：同一 `conversation_id` 或稳定用户 hash 在实验期间固定进入同一版本，避免前几轮用旧 Prompt、后几轮突然换新 Prompt。分桶还应按租户、区域、语言、场景和风险等级做切片观察，防止总体平均掩盖重要客户退化。

## 七、回滚的对象是完整 manifest，不是一段文本

真正的回滚应恢复到最后一个已验证的 release manifest，包括 Prompt、模型路由、温度、few-shot、工具契约、RAG 索引与安全策略的兼容组合。只回滚模板正文却保留新工具 schema 或新缓存键，可能继续出现格式错配和行为漂移。

回滚控制面至少支持：按版本一键回退、按租户/场景回退、停止实验、冻结进一步发布、保留证据包。回滚后仍要检查会话粘性、缓存污染和进行中的长任务；不能假设修改配置后所有请求立即消失。

## 八、观测与可追溯性

每条 trace 应关联：

```text
prompt_id + revision + rendered_prompt_hash
release_manifest_id + model/decoding policy
retrieval/index/tool/safety versions
experiment_bucket + conversation_id + tenant
usage, latency, finish_reason, feedback and policy events
```

这样才能回答线上排障的关键问题：“这个错误是否只出现在某个 Prompt revision？是否只影响某个模型路由、某个知识库版本或某个实验桶？”没有版本关联的用户点赞/差评很难成为可行动证据。

bad case 回流前应经过脱敏、去重、授权和人工复核，再进入 regression 集。否则生产日志可能把敏感数据、攻击样本或偶然噪声直接变成后续优化的污染源。

## 九、一个轻量的交付流水线

```text
author -> lint/render -> local eval -> review
       -> staging integration -> release manifest
       -> offline gate -> shadow -> canary -> A/B ramp
       -> observe -> promote / rollback -> bad-case regression
```

小团队不需要第一天就构建复杂平台。可以从 Git 管理模板、CI 跑小型 regression、人工审批灰度、在日志中记录版本号开始；随着应用增多，再建设模板目录、评测服务、实验分桶、门禁和审计控制面。关键是先建立可复现的“版本 -> 证据 -> 发布”链条。

## 十、面试高频问答

### Q1：为什么 Prompt 版本不能只存一段文本？

行为还受变量 schema、few-shot、模型/温度、工具、RAG、策略和缓存影响。只存文本无法复现线上输出，也无法做安全回滚；应通过 manifest 锁定完整依赖组合。

### Q2：改 `temperature` 或工具 schema 算 Prompt 变更吗？

它们都可能改变生成行为和工具执行结果，因此至少必须形成新的可追踪 release revision。是否与模板使用同一版本号是实现选择，但 trace 与门禁必须看到这个变化。

### Q3：离线分数提升，为什么不能直接全量？

离线集无法完全覆盖真实流量、会话、多轮工具和租户差异；模型也有非确定性。先 shadow 验证无副作用，再 canary 观察护栏和关键切片，才能降低全量风险。

### Q4：某关键租户退化但全局平均提升，是否扩量？

不应仅靠全局平均决定。先检查该租户是否属于受保护切片、样本量是否足够、退化是否越过护栏；必要时按租户回退或停止实验。企业产品的正确性常常是分层约束，不是总平均最大化。

### Q5：回滚后如何确认没有遗留问题？

确认路由已切回旧 manifest、会话粘性和缓存键没有把新旧结果混用、长任务/工具执行按原版本收敛；然后用 trace、错误率和关键评测切片观察一段时间。回滚是一次受控发布，不是点击按钮后就结束。

### Q6：PromptOps 和 LLMOps 的关系？

PromptOps 是 LLMOps 的一个资产维度，聚焦提示模板、实验与发布；LLMOps 还覆盖模型、RAG、工具、观测、成本和运行治理。二者共享评测、发布和审计基础设施，但边界不同。

## 十一、60 秒面试收束

> 我会把 Prompt 当作可发布资产，而不是代码里的字符串。每次发布用 manifest 锁定模板、变量 schema、few-shot、模型参数、工具/RAG/安全策略和评测集；开发环境先做 lint、渲染与 token 预算检查，离线门禁同时看质量、安全、结构化成功率、延迟和成本。上线先 shadow，再按稳定会话分桶做 canary/A-B，重点看关键租户和业务切片。出现退化时回滚完整 manifest，并通过 trace 中的版本和渲染哈希定位影响范围；bad case 经脱敏复核后进入 regression 集，形成下一轮发布证据。
