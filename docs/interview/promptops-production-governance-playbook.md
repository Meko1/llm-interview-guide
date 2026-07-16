# PromptOps：提示词模板治理、实验与回滚系统设计

> Prompt 在生产里不是一段散落在代码里的文案。它决定模型行为、成本、工具调用和安全边界，因此需要像配置与代码一样拥有契约、版本、评测、灰度和回滚。

## 一、30 秒面试回答

我会把 Prompt 作为版本化的生产资产，而不是在业务代码里拼字符串。一个发布单元包含模板、变量 schema、示例、系统策略、模型参数、工具 schema、知识库/索引版本和评测集。运行时先校验变量类型、长度、数据标签和渲染后 token 预算，再生成不可变的 prompt snapshot；离线通过 golden set、结构化输出、安全和成本门禁，线上通过 shadow 与小流量实验验证。出现质量、成本或安全退化时，根据 trace 里的 prompt version 精确回滚，并将 bad case 加入回归集。

## 二、Prompt 资产的组成

| 组件 | 作用 | 常见错误 |
| --- | --- | --- |
| System policy | 角色、边界、拒答和证据规则 | 与业务模板混在一起，无法审计 |
| Task template | 任务指令与输出格式 | 复制粘贴到多个服务 |
| Variable schema | 类型、必填、长度、敏感级别 | 直接字符串插值 |
| Few-shot examples | 风格与边界样例 | 过期、泄漏或挤占上下文 |
| Model parameters | temperature、max tokens、seed | 改参数却没改版本 |
| Tool contract | 工具描述和 JSON schema | Prompt 与真实工具不同步 |
| Evaluation binding | 任务集、指标、阈值 | 只凭人工感觉上线 |

模板应有稳定 ID 与不可变版本，例如 `support.answer@v42`。运行记录的是实际渲染快照或哈希，而不只是“当前线上版本”，否则事后无法复现。

## 三、变量安全与渲染边界

变量不是可信指令。用户输入、检索片段、工具结果和外部网页应作为明确分隔的数据注入：

```text
SYSTEM: 只根据已授权证据回答。
USER QUESTION (untrusted): {{question}}
RETRIEVED EVIDENCE (untrusted data): {{evidence}}
```

- 使用 typed schema 校验字段、枚举、长度和默认值，缺失时失败而不是渲染 `null`。
- 对 PII、密钥、内部标签进行脱敏或阻止进入外部模型。
- 对检索结果加来源和权限标签，禁止其覆盖系统策略。
- 对渲染后 token 做预算；超长时按明确规则裁剪、摘要或要求澄清。
- 工具参数使用 JSON schema 和执行器校验，不能依赖 Prompt “要求模型正确输出”。

## 四、版本与发布包

```text
release manifest =
prompt version + variable schema + examples + model/params
+ tool schema + retrieval/index config + policy version + eval version
```

版本策略建议区分：修正文案/示例的小版本、改变输出 schema/工具契约的大版本、紧急安全禁用版本。任何会影响缓存、评测或运行行为的改动都应改变 manifest，缓存 key 也要带入相关版本。

不要允许业务人员直接编辑生产 system prompt 后立即生效。可通过权限、审批和草稿环境让业务参与，但发布路径必须留下作者、原因、评测结果和回滚点。

## 五、离线评测与回归集

Prompt 改动首先在固定回归集上比较稳定基线。评测维度取决于任务：

| 场景 | 核心门禁 |
| --- | --- |
| JSON 抽取 | schema valid rate、字段准确率 |
| RAG 回答 | groundedness、引用完整率、拒答正确率 |
| Agent | 工具选择、参数、权限和任务完成率 |
| 客服 | 解决率代理指标、风格、违规承诺 |
| 高风险 | 安全策略、PII、越权、人工复核路由 |

每个 bad case 都应记录失败环节：Prompt、检索、模型、工具还是数据。不要把所有失败都靠加长 system prompt 修补。

## 六、实验与线上灰度

实验单位可以是租户、用户、会话或场景，但必须稳定分桶，避免同一会话在不同版本间跳变。线上看：

- 任务成功与用户采纳，而不只看 token 数。
- 拒答率、转人工率、安全拦截和投诉。
- TTFT、输出长度、每成功任务成本与缓存命中。
- 按语言、租户、意图、长上下文等切片的退化。

Shadow 模式适合先收集候选输出而不展示；灰度模式才影响真实体验。预先定义停止规则，避免看到个别好样本就扩大流量。

## 七、排障与回滚

一次 trace 至少关联 `prompt_version`、渲染哈希、变量摘要、模型、参数、检索/工具版本、token 与最终结果。出现事故按顺序查：

1. 改动是否改变了变量、示例、系统策略或渲染 token。
2. 是否与模型、工具 schema、索引或缓存版本不兼容。
3. 质量退化是否集中在某些意图、语言或租户。
4. 是否可精确切回上一个 manifest，而不是只回退模板文本。

回滚后保留现场证据，建立修复分支和新的回归样本。紧急禁用可阻断某个版本，但不能删除历史审计记录。

## 八、高频面试问答

**Q：Prompt 为什么需要版本化？**

因为它改变模型行为，且经常与模型、工具、检索和缓存共同决定结果。版本化能让线上请求可复现、实验可比较、事故可回滚；只保存一段最新文本无法解释历史输出。

**Q：如何防止变量注入覆盖系统指令？**

用户输入、检索文本和工具结果都视为不可信数据，通过明确分隔和结构化 schema 注入；外部内容不拥有指令优先级；敏感操作由模型外的权限与策略执行器判定。

**Q：Prompt 改动怎样上线？**

先做模板/变量 lint 与离线回归，再 shadow 和小流量灰度；观察质量、安全、延迟和成本切片，命中停止规则立即回滚到上一个 release manifest。高风险场景需审批与人工抽检。

**Q：如何判断问题该用 Prompt、RAG 还是微调解决？**

指令、格式和流程先用 Prompt；缺少或变化的事实用 RAG；大量稳定、可标注且 Prompt/RAG 仍达不到的模式才评估微调。无论选择什么，都用同一评测集证明改进。

## 九、项目讲法模板

> 我们将 Prompt 从代码中的字符串升级为可发布资产：模板、变量 schema、模型参数、工具/索引配置和评测集组成不可变 manifest。请求运行时记录渲染哈希和版本，变量有类型、权限和 token 预算校验。每次改动先跑回归门禁，再 shadow、灰度，并按场景看成功率、安全、延迟和成本；出现退化可精确回滚整个 manifest。这样业务可以迭代话术，工程侧仍保持可复现、可审计和可控发布。

继续学习：[Prompt 工程](/prompt/prompt-engineering)、[自动化提示优化与 Prompt Ops](/prompt/prompt-optimization)、[LLM 评测与发布门禁实战](/interview/evaluation-release-gates)、[LLM 数据标注与偏好数据运营](/interview/llm-data-feedback-operations-playbook)、[LLM 多供应商故障切换与一致性设计](/interview/llm-multi-provider-failover-playbook)。
