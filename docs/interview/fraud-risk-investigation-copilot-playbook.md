# 反欺诈 / 风险调查 Copilot：证据辅助、人工决定与可审计行动

支付、电商、信贷、保险和账号安全团队每天都会面对大量风险信号：异常登录、设备关联、退款争议、可疑交易、身份材料、客服投诉和外部名单。传统规则与模型能发现模式，但调查人员仍要在多个系统间拼接时间线、理解上下文、记录理由并决定升级、限制、补件或关闭案件。大模型可以显著降低资料整理与案件写作成本，却不能取代风险策略、确定性评分、法定流程或人的最终判断。

本页讨论“风险调查 Copilot”，不是自动拒绝交易或自动冻结账户的机器。它与 [企业客服 Copilot](/interview/customer-support-copilot-production-playbook) 的服务案件、[ITSM / SRE 事故响应 Copilot](/interview/itsm-sre-incident-response-copilot-playbook) 的服务故障不同；这里的核心是个人/交易风险证据的最小化访问、解释、案例工作流和高影响行动控制。实际产品还必须遵循适用地区、行业和组织的法律、监管与申诉要求。

## 一、先划能力红线：发现线索不等于做出不利决定

| 能力 | Copilot 可做 | 不应自主完成 |
| --- | --- | --- |
| 案件摘要 | 汇总交易、登录、设备、客服与历史案例证据 | 将摘要当作事实或最终裁决 |
| 线索关联 | 展示共同设备、时间窗口、收款方、模式相似点 | 因关联就认定同一主体或欺诈 |
| 调查建议 | 提出安全的只读查询、缺失材料与核验步骤 | 绕过权限访问更多个人数据 |
| 案件文书 | 草拟调查记录、用户沟通、补件请求 | 发送不利通知或法律结论 |
| 行动准备 | 生成冻结/拒付/升级的结构化提案 | 自主冻结账户、拒绝服务、提交监管报告 |

风险信号通常是概率和不确定性，而非真相。模型的角色是帮助人把证据、冲突和待验证点组织出来；规则引擎、传统风控模型和授权调查员分别负责风险分数、策略与最终决定。尤其涉及资金、账户访问或个人权益时，必须保留有意义的人类复核、申诉和审计路径。

## 二、案件事实包：数据最小化、来源清晰、时间可复核

调查需要跨系统上下文，但“把所有客户数据放进 Prompt”既不安全也不必要。服务端按案件目的、调查员权限和地区策略构建 `case_fact_pack`：

```text
case metadata: case_id, purpose, severity, legal hold, region
transaction facts: amount, currency, merchant, timestamps, state
account facts: verification status, tenure, consent and restrictions
security signals: device/session/IP risk summaries, not raw secrets
relationship evidence: approved graph links with source and confidence
customer contact and dispute history under access policy
rules/model outputs: version, reason codes, calibration window
investigator actions, prior decisions and appeal/review status
```

每条事实必须有来源、时间、版本、访问标签和可信等级。用户地址变化、IP 相近、设备共享、客服口述都可能有合法解释；Copilot 应显示“证据支持什么、不支持什么、缺什么”，而不是把多条弱信号拼成一个肯定结论。

对敏感字段采用 purpose binding：用于当前欺诈调查的数据不能顺手被用于营销、训练或泛化用户画像。日志、向量索引、缓存、评测集和外部模型路由都要继承最小化、地域、保留和撤权规则。

## 三、主工作流：从信号到可审阅案件

```text
alert / dispute / manual report
  -> deterministic policy and triage
  -> case creation + scoped evidence assembly
  -> evidence timeline / relationship view / conflict detection
  -> Copilot summary and safe investigation plan
  -> investigator review / additional verified queries
  -> action proposal / approval / execution receipt
  -> notification, appeal, outcome and feedback loop
```

### 1. 确定性分流先行

实时拦截、额度、规则命中、KYC 状态和强制合规流程应在模型之前或独立运行。Copilot 不应降低已有安全阈值，也不能因为语言表达“看起来正常”就放行一个高风险交易。模型可帮助解释为何进入案件队列、建议资料和总结上下文，但不要把其自然语言置信度混入实时风险分数。

### 2. 证据时间线与关系视图

调查者需要看到事件先后关系：注册、验证、设备切换、支付、退款、登录失败、客服联系、规则触发和此前决定。关系图可展示账户、设备、收款方、订单、地址和会话之间的**已批准关系证据**，但图上的边应注明来源、时间、强度和是否只是可能关联。

Copilot 适合生成“待解释的异常序列”和“建议核验问题”，例如“短时间内多个新账户使用同一设备摘要，但需要确认家庭/企业共享场景”。这比“这是团伙欺诈”更准确也更可审计。

### 3. 假设、反证与调查计划

将模型输出限定为结构化调查对象：

```json
{
  "hypothesis": "账户接管风险需要进一步核验",
  "supporting_evidence": ["login:unfamiliar-device", "transaction:beneficiary-change"],
  "alternative_explanations": ["用户更换设备后自行操作"],
  "safe_next_checks": ["verify step-up authentication result", "inspect approved contact attempt"],
  "limitations": ["缺少设备所有权的直接证据"]
}
```

每个假设都要有反证、下一步和局限。调查员可以接受、修改、证伪或要求更多证据；模型不能通过一次总结把假设升级成案情事实。

## 四、关系图、规则和 ML 分数如何协同

图谱、规则、监督模型和 LLM 解决的是不同问题：

| 能力 | 擅长什么 | 不应承担什么 |
| --- | --- | --- |
| 规则引擎 | 明确阈值、法规要求、实时拦截 | 复杂语义解释与开放调查 |
| 传统风险模型 | 稳定特征上的概率排序 | 自然语言证据与个案沟通 |
| 关系/图分析 | 发现关联模式、团伙线索 | 将相关边自动视为因果或身份同一 |
| LLM Copilot | 多源摘要、提问、调查计划、文书 | 生成未验证风险分、最终不利决定 |

系统应保留每个模型/规则的版本、reason code、训练/校准窗口与适用范围。Copilot 可以将它们翻译为调查员可读解释，但不能改变或伪造 underlying score；如果 reason code 不足以支持个案结论，应明确显示限制并要求人工调查。

## 五、行动控制：冻结、拒付和外发必须走独立执行面

模型提出“建议临时限制账户”后，系统应生成受控 `action_proposal`：

```text
action type / target / scope / duration / reason codes
evidence references / policy rule / reversible or irreversible
required approvers / notification and appeal requirements
preconditions / idempotency key / rollback or expiration
```

执行器独立验证案件状态、调查员角色、政策版本、金额/权限边界、审批和地域。风险动作通常具有时间限制，例如临时 hold 到期自动复核，而不是让一次模型建议无限期生效。对冻结、拒付、拒绝服务、外部报告、数据共享等高影响行为，须按适用政策要求人工复核、原因记录和用户通知。

API 超时或灾备恢复后，先按 idempotency key 和 provider receipt 对账。一个“是否冻结成功未知”的状态必须进入对账队列，不能让模型再次执行同一动作或对用户宣称已经处理。

## 六、调查工作台与人工复核

好的工作台让调查员看到的是可验证案件，而不是一篇漂亮的长总结：

- 证据时间线、原始来源链接、权限和数据新鲜度；
- 按“事实、推断、规则命中、模型信号、未知项”分类的摘要；
- 关系图的边来源和筛选条件，而非黑箱网络图；
- 可编辑的调查计划、补件请求、对外沟通和行动 proposal；
- 队列、SLA、双人复核、申诉和复查状态；
- 每次查看、查询、建议、修改、批准和执行的审计轨迹。

人类复核必须可改变结果。若调查员只是快速接受模型建议，系统需要通过采样双审、决策差异分析、强制理由和培训来发现 automation bias。对模型建议与人工结论反复分歧的案件，应反馈到规则、数据质量和评测集，而不是直接把人工意见当作模型错误标签。

## 七、隐私、安全与对抗输入

反欺诈系统天然会处理高敏感个人和交易数据，且攻击者可能故意通过客服、备注、上传材料或文本字段操纵模型。防护包括：

- 最小字段与受控证据链接，默认不把原始身份材料、完整账号或密钥注入模型；
- 用户文本、商家备注、附件和外部网页都是不可信数据，不能修改策略、权限或工具调用；
- 模型调用、日志、评测和标注使用脱敏/代号，严格限制导出与保留；
- 关系图与历史案件按调查用途、地区和角色限制，避免“便利搜索”变成无目的监控；
- 所有 action、notification、appeal 与 override 进入不可篡改审计面；
- 对供应商、跨境、模型训练和数据删除执行专门的合规评审。

安全控制不能被“紧急欺诈事件”自动绕过。必要的 break-glass 访问也需指定授权、最小范围、到期和事后复核。

## 八、评测：准确之外，还要避免伤害与偏差放大

离线评测应覆盖真实但脱敏的案例、合成对抗样本、证据冲突、合法异常行为、不同语言/地区、转写误差、缺失数据、模型降级和错误操作请求。指标包括：

| 维度 | 指标 |
| --- | --- |
| 证据质量 | 事实摘要忠实度、来源定位率、时间线遗漏率 |
| 调查质量 | 合理假设 precision、反证呈现率、无依据断言率 |
| 行动安全 | 未授权 proposal/执行率、审批覆盖、幂等/对账成功率 |
| 人机协作 | 调查耗时、人工修改率、双审差异、升级正确率 |
| 公平与伤害 | 群体/语言/渠道差异化错误、错误限制、申诉与纠正时效 |

评估公平性与偏差需遵循当地规则与数据最小化原则。不能为了评测而无边界收集受保护属性，也不能因为总体准确率高就忽视某些群体或语言中的系统性伤害。对高影响行动，错误冻结、错误拒绝和无法申诉是硬门禁，而不是可以用平均分抵消的 trade-off。

## 九、上线策略：先辅助调查，再考虑受控自动化

```text
offline evidence replay -> shadow summaries / plans
  -> investigator assist -> draft communications / case notes
  -> approved action preparation -> narrowly scoped temporary controls
```

先选择可逆、低风险、强证据的任务，例如案件摘要、时间线整理、缺失材料清单和内部调查记录。任何自动化限制都需要历史回放、影子运行、审批、回滚/到期和持续抽检。模型、Prompt、关系算法、规则、政策或数据源更新均应绑定版本和回归集；案件结果通常有延迟，不能只凭短期人工采纳就扩大范围。

## 十、系统设计题：设计企业风险调查 Copilot

回答顺序可以是：

1. **确定红线**：实时风控和不利决定由规则/模型/人工流程负责，LLM 负责证据整理、建议与文书。
2. **案件与数据模型**：case、evidence、relationship、rule/model signal、hypothesis、action proposal、approval、receipt 和 appeal 全部版本化关联。
3. **上下文与权限**：按调查目的、角色、地区和数据等级装配最小 fact pack；原始敏感材料保留受控访问。
4. **工作流**：确定性分流后创建案件，LLM 生成时间线、假设和安全核验计划，人工复核，再由 policy/execution gateway 执行批准动作。
5. **正确性与安全**：证据来源、反证、unknown、幂等、到期、对账、审计、申诉和数据生命周期。
6. **评测与演进**：回放案例、影子辅助、双审、对抗输入、公平/伤害门禁和结果延迟反馈。

```text
Signals / disputes / reports / transaction systems
        -> deterministic triage -> case and evidence registry
        -> scoped retrieval + relationship / rule / model signals
        -> Copilot summary, hypothesis and investigation plan
        -> investigator review -> policy + action gateway -> receipts
        -> notification / appeal / audit / evaluation feedback
```

## 十一、高频追问

### Q1：为什么不能直接让模型判断“这是不是欺诈”？

欺诈判断涉及概率、证据质量、合法异常、政策和个人权益。LLM 容易受文本表述和缺失上下文影响，也无法替代稳定校准的风险模型、规则和人类调查。它应帮助梳理证据、提出核验问题和草拟记录，而不是输出自动裁决。

### Q2：关系图发现多个账户共享设备，能否直接冻结？

不能。共享设备可能来自家庭、企业、公共网络或采集误差。关系边要展示来源、时间和强度，并结合其他独立证据、规则、账户状态与人工复核。Copilot 应提出需要验证的解释，而非把相关性当作身份或意图证明。

### Q3：如何防止调查 Copilot 泄露敏感个人数据？

按案件目的和角色装配最小字段，原始材料使用受控链接、脱敏和短保留；模型、日志、缓存、评测、导出和供应商路由分层授权。关系检索和跨案件搜索同样受地域、用途和审计限制。

### Q4：冻结动作超时后如何避免重复？

将 proposal 变成带 idempotency key、目标、范围和期限的不可变命令；执行器返回 receipt。超时后先查询 receipt 和账户实际状态，未知状态进入人工对账，不能让模型重新发起冻结或对外声称成功。

### Q5：如何证明 Copilot 帮助而没有增加风险？

通过脱敏案例回放、影子模式和双审测证据忠实度、无依据断言、调查耗时、人工修改、越权 proposal、错误限制和申诉处理。高影响动作以错误伤害、审批覆盖和纠正时效作为硬门禁，不能只看节省的人力时间。

## 十二、60 秒项目讲法

“我们把反欺诈 Copilot 设计为调查辅助系统，而不是自动裁决器。实时规则和风险模型先完成确定性分流；案件服务按目的、权限、地区和数据等级装配交易、账户、设备、争议、规则 reason code 与历史决定的最小事实包。模型基于可追溯证据生成时间线、关系线索、反证和安全核验计划，所有结论都区分事实、假设和未知。冻结、拒付或外部通知被编译成带范围、期限、证据、审批、幂等和回滚的 action proposal，由独立策略与执行网关处理并以 receipt 对账。调查员可修改或否决建议，申诉与复查完整留痕。上线从影子摘要和案件文书开始，持续评测证据质量、调查效率、越权、错误限制、申诉时效和差异化伤害。”

这段回答体现的是高风险大模型应用的核心能力：让模型提升调查效率，同时把事实、行动、权限和最终责任留在可控制、可解释、可纠正的系统里。
