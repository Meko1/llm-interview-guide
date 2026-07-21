# 合同审阅 / 法务 Copilot：条款证据、红线工作流与律师最终判断

合同审阅看似是“上传 PDF，让模型总结风险”，实际包含版本差异、条款依赖、交易背景、批准的谈判底线、签约主体、数据处理、管辖、金额、期限和历史义务。模型能快速定位、比对与草拟红线说明，但它不是律师，也不能在没有完整交易上下文的情况下给出法律结论、接受对方条款或签署合同。

本文描述的是企业法务 Copilot 的系统设计，供工程与面试准备使用，不构成法律意见。通用制品渲染、审批和不可变归档见 [LLM 文档生成与审阅生产化](/engineering/llm-document-generation-production)，供应商/采购背景见 [采购 / 供应商尽调 Copilot](/interview/procurement-vendor-due-diligence-copilot-playbook)，数据外发与审计见 [LLM 数据分级与外发审计](/interview/data-governance-egress-audit-qna)。

## 一、能力边界：加速审阅，不替代法律判断

| 任务 | Copilot 可做 | 必须由人或确定性流程完成 |
| --- | --- | --- |
| 文档理解 | 识别合同类型、章节、表格、签约方、版本差异 | 认证原件、主体资格与签字效力 |
| 条款定位 | 将条款映射到已批准 playbook、定位原文 | 判断法律适用、接受偏离或给出法律意见 |
| 风险整理 | 列出偏差、缺失、冲突、待确认商业事实 | 最终风险评级、例外、谈判策略和签约决定 |
| 红线草拟 | 按已批准模板草拟候选文本和解释 | 向对方发送、接受条款或修改标准模板 |
| 义务管理 | 提取义务、期限、通知与 owner 候选 | 确认是否承担义务、执行法律通知 |

产品必须明确显示：模型的输出是审阅辅助，结论需要有权限的法务/业务负责人审核。尤其涉及适用法律、监管、责任限制、赔偿、知识产权、数据处理、安全、出口管制和争议解决时，不能把高分相似匹配当成可签约建议。

## 二、合同事实包：版本、交易与 playbook 同时固定

合同文本不能脱离交易背景审阅。服务端创建版本化 `contract_fact_pack`：

```text
contract artifact: source file, pages, OCR confidence, hash, language
parties: legal entities, signatory workflow, territory, relationship
transaction: product/service, amount, currency, term, data categories
document state: draft / counterparty redline / approved template / executed
legal playbook: clause taxonomy, approved positions, fallback language, owner
commercial policy: pricing, liability threshold, approval matrix
related evidence: DPA, security addendum, order form, prior amendments
unknowns / conflicts / required reviewers
```

每个事实都需要来源与版本。模型不应从“Acme”自动推断具体法人，也不应因一份旧订单的金额而假定本次责任上限。合同发生任何编辑、OCR 重跑、附件替换、playbook 更新或交易金额变化，都应生成新 revision，而不是静默覆盖审阅中的结论。

## 三、从文本到条款：结构化抽取先于风险叙事

长合同中最先要解决的是结构可靠性：标题层级、定义、条款编号、表格、附件、页码、交叉引用和删除线/修订痕迹。推荐分两步：

```text
document parse -> clause map with stable locators
  -> clause classification / obligation extraction / playbook comparison
  -> reviewer-visible risk and redline draft
```

`clause map` 使用稳定 ID、页码、标题路径、原文片段 hash 和解析置信度。模型生成的摘要、分类、义务和红线建议都指向这些 locator。这样审阅者能一键回到原文，也能判断是模型理解错误、解析遗漏还是 playbook 不适用。

低置信 OCR、扫描件、复杂表格、跨页定义或未能解析的附件必须显示为审阅缺口。不要因为模型能生成连贯摘要，就假装已经读到了所有关键条款。

## 四、条款 playbook：将谈判立场做成受治理资产

playbook 不是一段 system prompt，而是由法务维护、可发布的策略资产：

```text
clause type -> approved baseline / acceptable variants / prohibited positions
            -> required commercial facts / jurisdictions / data conditions
            -> fallback language / escalation owner / approval requirement
            -> effective date, version and retired status
```

例如责任限制条款的可接受位置可能随合同金额、客户/供应商角色、产品类型和地域变化。Copilot 的职责是把当前文本与**本次交易适用的** playbook 进行对比，输出：原文、偏差类型、依赖的事实、可用 fallback、未确认问题和所需审批；而不是把一个通用模板套给所有案件。

模型不能自行发明“标准红线”。如果 playbook 没有匹配规则，应路由给法务并标记 `no_approved_position`，这比一段貌似专业的改写更安全。

## 五、风险、红线与义务：每条建议必须有出处和状态

推荐的 reviewer object：

```json
{
  "clause_id": "cl_42",
  "type": "limitation_of_liability",
  "source_locator": "MSA p.14 section 9.2",
  "playbook_revision": "enterprise-saas-6.1",
  "deviation": "cap excludes service fees",
  "evidence": ["cl_42", "transaction.amount"],
  "status": "needs_legal_review",
  "approved_fallback": "fallback-ll-03",
  "limitations": ["counterparty role not confirmed"]
}
```

这里的 `status` 很关键：`matched`、`missing_clause`、`needs_business_fact`、`needs_legal_review`、`approved_exception`、`rejected` 都是工作流状态，不能让模型用一段自然语言掩盖。红线必须以候选 patch 或结构化差异呈现，审阅者能接受、修改、拒绝或升级；最终合同由版本控制和签约系统生成，而不是直接拿模型文本替换 Word 内容。

义务抽取同样要保守：将 `actor`、`action`、`object`、`deadline`、`trigger`、`notice requirement`、`source locator` 和 `confidence` 结构化存储。含糊、条件性或交叉引用的义务应要求人工确认，不能自动创建不可撤销任务。

## 六、审阅状态机与协作：律师不是最后一个“确认按钮”

```text
received -> parsing -> triage -> in_review -> awaiting_business_facts
  -> awaiting_legal -> redline_prepared -> approved_for_signature
  -> executed -> obligation_monitoring -> amended / expired / archived
```

不同角色拥有不同权限：业务确认交易事实，采购确认供应商信息，安全/隐私确认控制项，法务审核条款和例外，签约人执行最终签署。Copilot 维护待办、依赖和差异，但不可把一次评论或会议纪要自动升级成正式批准。

多人并发审阅时采用 revision 和乐观锁。每个红线、评论、批准与例外绑定原文和 playbook revision；当对方回传新版本，系统重建 clause map、计算 diff 并标记哪些结论失效。不要把上一个版本的“已批准”静默迁移到文本已经改变的合同。

## 七、安全、保密与特权边界

合同、谈判记录和法务意见通常高度敏感。系统需要：

- 按事务、法域、法务团队、业务 owner 和目的进行最小权限；
- 区分对方提供的合同、内部策略、律师意见和审批评论，禁止不当横向检索；
- 对 OCR、解析、向量索引、日志、缓存、评测和外部模型使用不同的保留/脱敏/地域策略；
- 禁止模型或用户文本改变批准链、工具权限、模板来源或导出范围；
- 受控外发：红线、条款建议和最终制品由授权角色、版本和发送渠道确认；
- 在合法保留、案件冻结或删除请求间执行明确的保留优先级与审计。

合同附件和网页内容可能包含 prompt injection。它们是证据数据而不是指令；模型对工具的调用权限只来自服务端 policy。不要为了“更好地解析附件”而让模型拥有文件系统、邮箱或合同库的泛化写权限。

## 八、评测：合同摘要好看不代表审阅可靠

离线回放集应覆盖：不同语言、扫描件、修订版、附件、条款缺失、定义冲突、不同金额/地域、过期 playbook、对方反复修改、低置信 OCR 和恶意文本。指标可以包括：

| 维度 | 指标 |
| --- | --- |
| 解析 | clause locator 正确率、附件/表格遗漏率、OCR 低置信提示率 |
| 对比 | 条款分类、偏差发现、playbook 匹配、无依据红线率 |
| 工作流 | reviewer 路由、版本失效检测、例外到期、签约前阻断 |
| 安全 | 权限泄露、未批准外发、注入诱导执行、敏感数据留存 |
| 效率 | 初审准备时间、人工修改率、重复审阅减少、义务遗漏率 |

高风险条款的漏检、错误主体、未经批准例外和错误签约路径应视为硬门禁。不要用“平均摘要得分很高”抵消它们。最终质量要结合律师抽检、真实谈判反馈和版本后果持续校准。

## 九、上线策略：先做可复核的阅读与整理

```text
clause map / search -> reviewer summaries -> obligation drafts
  -> playbook comparison -> redline drafting -> controlled collaboration
  -> limited workflow automation with approvals
```

初期将 Copilot 用于定位、比较、摘要与待办，不自动生成对外文本或改变合同状态。影子模式将模型建议与律师最终审阅对比，收集遗漏、误报、人工改写和无适用 playbook 的情形。只有对明确、低风险、已批准条款类型建立稳定评测后，才逐步开放候选红线草拟；签约、例外与外发始终保持独立控制面。

## 十、系统设计题：设计企业合同审阅 Copilot

建议按以下顺序回答：

1. **边界与角色**：模型辅助条款定位与草拟，法务/业务/签约人各自负责正式判断与动作。
2. **版本化事实包**：合同原件、交易背景、主体、附件、playbook、审批矩阵和未知项全部 version pinning。
3. **处理链路**：解析成 clause map -> 分类/义务/差异 -> 绑定 playbook 与证据 -> reviewer object / redline draft -> 多角色工作流 -> 签约与义务监控。
4. **正确性**：稳定 locator、OCR 置信、unknown、文本 diff、版本失效检测和确定性商业计算。
5. **安全与合规**：最小权限、特权/保密隔离、地域/保留、外发、注入防护和审计。
6. **评测与演进**：合同回放、律师审阅、门禁、影子模式和 playbook 的 owner/版本治理。

```text
Contract artifacts + deal / vendor context + legal playbooks
        -> authorization + versioned fact-pack
        -> parser / clause map / evidence registry
        -> comparison and reviewer-object service
        -> redline workspace + approval / signature gateway
        -> obligation register, audit, evaluation and playbook feedback
```

## 十一、高频追问

### Q1：为什么不能直接把合同交给模型并让它“找风险”？

没有稳定条款定位、交易上下文、适用 playbook 和版本控制，模型只能给出泛化文本。可靠系统先解析并绑定原文，再将偏差和建议映射到批准的立场；无匹配规则时升级给法务而不是自造红线。

### Q2：如何处理对方回传的新红线版本？

创建新 artifact revision，重建 clause map 与文本 diff，标记受影响的 reviewer object、审批和义务为需复核；旧版本结论保留审计但不能自动迁移。多人评论使用乐观锁与版本绑定，防止在错误文本上继续批准。

### Q3：模型草拟红线时如何防止越权或错误外发？

红线作为候选 patch，引用 playbook ID、原文和适用条件；只有授权 reviewer 能接受/编辑。最终外发从签约/协作 gateway 完成，检查角色、版本、审批、收件人和渠道，模型没有邮件或合同库的泛化写权限。

### Q4：义务抽取如何避免遗漏或错误任务？

每项义务带 source locator、条件、触发、期限和置信度；对含糊/低置信/交叉引用项要求人工确认。签约后再由 owner 确认进入义务台账，系统持续检查版本变更、到期和完成回执。

### Q5：怎样评估合同 Copilot 是否真的有用？

用历史合同和红线回放评估 clause 定位、偏差发现、playbook 匹配、版本失效和安全门禁；线上观察律师初审准备时间、人工改写、遗漏、例外路由与义务跟踪。高风险漏检或未经批准外发不能被平均效率提升抵消。

## 十二、60 秒项目讲法

“我们把合同 Copilot 做成版本化审阅与协作系统，不是自动法律意见工具。合同、附件、交易事实和 playbook 被固定到同一个 fact pack；解析服务产出带页码和 hash 的 clause map，模型只在此基础上分类条款、提取义务、发现与已批准立场的偏差，并把每条建议绑定原文、playbook revision、缺失事实和状态。律师在工作台中审核可编辑红线和例外，多角色审批与签约网关控制最终外发。对方回传新版本后，系统重新做 diff 并使受影响结论失效。我们按条款定位、偏差漏检、版本一致性、审批、权限和人工改写评测，并从摘要/定位的影子模式逐步扩展。”

这段回答展示的是将大模型放进高风险专业工作流的正确方式：提高阅读和协作效率，但不替代专业判断、签约权和法律责任。
