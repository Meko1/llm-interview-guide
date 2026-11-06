---
title: 结构化输出与 Schema 约束高频问答
description: 区分JSON语法、schema子集与业务权限，解释grammar/token mask、拒答截断、流式提交、有限修复、版本兼容和端到端验证，而非把合法JSON当正确结果。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 结构化输出与 Schema 约束高频问答

> 如果面试官把问题从“Schema 如何约束模型”推进到“流式 partial JSON、Java DTO、业务事务和写工具怎样衔接”，可继续使用 [Java / Spring AI 生产架构系统设计面试题](/interview/java-ai-production-architecture-system-design) 的三层校验与提交边界回答。

> 结构化输出不是“让模型返回 JSON”这么简单，而是把大模型输出变成后端、工作流、Agent 工具、审批系统可以稳定消费的工程合约。面试里它常和 Function Calling、MCP、RAG 抽取、表单填充、Agent 工具调用、Java/Spring AI、LangChain/LangGraph、Dify 工作流一起出现。原理细节可继续看 [结构化输出详解](/engineering/structured-output)，工具调用部分可看 [Function Calling 与 MCP](/agent/function-calling-mcp)。

## 先给面试官的总览回答

本文是参考问答，“高频”不代表来源频率；JSON、confidence和项目讲法均为构造。结构化输出的目标是可解析、可校验、可审计的数据；数据可重生成不等于外部写操作可回滚。生产系统通常不会只靠 prompt 约束，而是组合使用：

```text
Prompt 约束
  -> JSON Mode / Function Calling / Structured Outputs
  -> Schema 校验
  -> 业务规则校验
  -> 修复或重试
  -> 降级 / 人工兜底
  -> 指标监控和 bad case 回流
```

高分回答要强调三句话：

- **合法 JSON 不等于业务正确**：schema可约束结构、类型及所支持的值约束，但不能核实字段事实或权限。
- **约束解码解决语法问题**：通过 grammar、FSM、token mask 限制每一步只能生成合法 token。
- **生产化靠闭环**：结构化输出必须接 schema 版本、字段级评估、重试降级、审计日志和线上监控。

## Q1：JSON Mode、Structured Outputs、Function Calling 有什么区别？

可以按“约束强度”回答：

| 方式 | 保证什么 | 不保证什么 | 适合场景 |
| --- | --- | --- | --- |
| Prompt 约束 | 模型尽量按要求输出 | 不能保证合法 JSON | 原型、低风险任务 |
| JSON Mode | 在特定模型/API成功完整输出路径约束JSON语法 | 不保证schema；拒答、截断、传输错误需另处理 | 简单抽取、弱结构 |
| Structured Outputs | 在支持的schema子集、模式和成功终态下约束结构 | 不保证事实、权限；拒答/截断不是成功对象 | 表单、合同抽取、API 参数 |
| Function Calling | 生成工具选择/参数候选；严格性依供应商模式 | 不天然保证schema、工具选择或执行成功 | Agent 工具调用、MCP |
| 业务校验 | 字段合法、权限、范围、依赖关系 | 仍需人工兜底高风险 | 生产上线 |

面试表达：

> JSON Mode通常约束语法，原生Structured Outputs可按支持的schema子集约束结构，Function Calling 解决“模型是否能选择工具并生成参数”。但三者都不能天然保证事实正确，所以还需要 evidence、业务校验和评估闭环。

## Q2：约束解码的原理是什么？

约束解码（Constrained Decoding / Guided Decoding）的核心思想是：**在生成每个 token 前，把不符合目标语法的 token 屏蔽掉**。

普通生成流程：

```text
logits -> softmax -> 采样下一个 token
```

约束解码流程：

```text
logits -> 根据 schema/grammar 生成合法 token mask
       -> 非法 token 的 logits 置为 -inf
       -> softmax -> 只能从合法 token 中采样
```

比如已经生成：

```json
{"age":
```

若age只允许number，下一个token的解码字节必须让当前前缀仍可完成为合法数字值。token不等于单个字符，可能一次覆盖数字及逗号；需逐字节/解析器状态判定完整token，不是仅枚举“数字token”。空白可合法，但未开始数字值时不能直接闭合对象。

实现上常见做法：

- 正则或有界结构可用FSM；一般递归/任意嵌套结构需CFG解析器或带栈状态，不能用有限状态机概括所有JSON Schema。仅支持的schema子集可编译，剩余约束需最终验证。
- 解码时根据当前已生成内容判断可接受 token 集合。
- 对词表做 token mask，屏蔽不合法候选。
- 缓存状态和 mask，降低每步开销。

面试里可以补一句：

> 在正确编译、正确token mask且生成成功完成时，约束解码保障所编译结构；预算截断、拒答、空候选或不支持约束需显式失败。字段值仍可能幻觉、误判或越权。

## Q3：约束解码会不会影响模型能力？

会，主要有三类影响。

第一，**任务表达与质量可能变化**。结构约束不等于禁止模型内部推理，也不证明两阶段一定更好。复杂任务可评估“两阶段”的额外延迟、错误传播与质量：

```text
第一步：自由推理 / 生成中间分析
第二步：按 schema 输出最终结构
```

可输出可核验的简短依据与evidence，不要求记录隐含思维链。模型自报confidence不是校准概率，不能直接用来审批；来源定位后还需核验原文支持程度。

第二，**schema 越复杂越容易出错**。深层嵌套、动态 key、复杂 union、过长 enum 都会让模型和约束解码器更难处理。

第三，**延迟和吞吐可能受影响**。每步生成都要计算 mask，不过成熟实现会预编译 grammar、缓存状态，具体开销需按grammar、模型、batch、词表与schema复用压测。

面试表达：

> 约束解码是工程可靠性的手段，不是免费午餐。简单schema也需语义评估；复杂任务是否分阶段应对照实验；高并发场景要压测 guided decoding 对 TTFT、TPOT 和吞吐的影响。

## Q4：Schema 怎么设计才稳定？

稳定 schema 的原则是：**简单、明确、可校验、可演进**。

推荐做法：

- 字段名使用常见英文或业务通用词，避免生僻缩写。
- 嵌套深度按业务与实现限制设计；2–3层是可读性启发，不是通用协议上限。
- 必填字段和可选字段清晰区分。
- 固定取值使用 enum。
- 区分属性缺失与值为null：required决定是否必须出现，类型联合决定能否为null；unknown/not_found须进入schema允许的枚举或状态字段。
- 每个字段写 description，说明来源、单位、边界。
- 数值字段写单位和范围，例如金额单位、百分比范围。
- 日期字段统一格式，例如 `YYYY-MM-DD`。
- 输出数组时说明最大条数和排序规则。
- 高风险字段加入 `evidence` 或 `source_quote`。

反例：

```json
{
  "data": {
    "result": {
      "items": [
        {
          "x": "anything"
        }
      ]
    }
  }
}
```

问题是字段语义不明确，校验价值低。更好的设计是：

```json
{
  "customer_intent": "refund",
  "confidence": 0.86,
  "evidence": "用户原文中出现“想退款”",
  "needs_human_review": false
}
```

上面的confidence=0.86与needs_human_review=false只是构造字段值，可信服务不能把它们当审批结论。还需按所用draft核对additionalProperties、format是否强制验证及供应商支持子集。

面试里要强调：schema 本身也是 prompt 的一部分，字段名和 description 会影响模型行为。

## Q5：合法 JSON 为什么仍然会失败？

因为结构化输出有三层正确性：

| 层级 | 示例 | 检查方式 |
| --- | --- | --- |
| 语法正确 | JSON 能解析 | JSON parser |
| schema 正确 | 字段、类型、enum 符合定义 | JSON Schema / Pydantic / Zod |
| 业务正确 | 字段值真实、合规、可执行 | 规则引擎、数据库、人工复核 |

常见事故：

- 枚举值合法，但分类错了。
- 日期格式合法，但日期不存在或超出业务范围。
- 金额是 number，但单位错了。
- 工具参数合法，但用户没有权限。
- 抽取字段符合 schema，但证据原文不存在。
- 模型填了 `confidence: 0.99`，但其实是幻觉。

面试表达：

> JSON 合法只是第一关。生产系统必须做 schema 校验和业务校验，尤其是权限、金额、外部动作、用户隐私这些高风险字段，不能让模型输出直接驱动副作用。

## Q6：解析失败后怎么处理？

推荐用“分层兜底链”回答：

```text
1. 解析 JSON
2. schema 校验
3. 业务规则校验
4. 可自动修复则修复
5. 带错误信息重试
6. 切换模型或降级策略
7. 人工兜底 / 拒绝执行
8. bad case 回流评测集
```

不同失败类型的处理：

| 失败类型 | 处理方式 |
| --- | --- |
| JSON 语法错误 | 优先显式失败或有限重生成；repair只对批准的语法规则使用，保存原文并重新校验 |
| 缺字段 | 带缺失字段错误重试 |
| enum 错误 | 提供合法枚举列表并重试 |
| 类型错误 | 仅按显式无歧义规则转换；禁止把金额单位、null或证件字符串猜成另一语义 |
| 业务规则失败 | 不自动执行，进入人工或拒答 |
| 证据缺失 | 要求返回 `not_found` 或补 evidence |
| 多次失败 | 降级到人工、模板规则或更强模型 |

重试要注意：

- 限制最大次数，防止成本失控。
- 带上具体校验错误，而不是泛泛说“格式错了”。
- 记录失败样本和模型版本。
- 对有副作用的工具调用，重试前确认未执行或可幂等。

## Q7：流式输出下怎么处理结构化结果？

流式展示与完整对象提交边界不同：前端希望边生成边显示，但 JSON 通常要完整闭合后才能解析。

常见方案：

1. **非流式结构化输出**：等完整 JSON 返回后再渲染，最简单稳定。
2. **字段级流式**：增量解析用于暂态展示；JSON对象字段顺序不是schema语义保证，字段后续可冲突/对象可截断，不能据此提前提交。
3. **事件流协议**：用SSE/NDJSON等确定事件边界，添加序号和终态；单事件JSON合法不代表整任务成功。
4. **Function Calling delta 拼接**：工具参数分片到达，后端拼完再解析执行。
5. **双通道输出**：用户可见文本流式展示，机器可读 JSON 最后返回。

生产建议：

- 有副作用的工具必须等参数完整校验后再执行。
- 前端不要在 partial JSON 未闭合时做危险动作。
- 可以用 incremental parser 提升体验，但最终仍要完整校验。
- 对长任务，结构化事件比一个巨大 JSON 更稳定。

面试表达：

> 流式场景我会把“展示”和“执行”分开。展示可以流式，执行必须等结构化参数完整、schema 校验和权限校验通过后再触发。

## Q8：Function Calling 和结构化输出是什么关系？

Function Calling 可以看成结构化输出的一个特例：模型输出工具名与参数候选；是否严格匹配schema要核所用模型、API模式与支持子集。

例如：

```json
{
  "tool": "create_ticket",
  "arguments": {
    "title": "用户无法登录",
    "priority": "high"
  }
}
```

它多了两个关键问题：

- **工具选择**：该不该调用工具，调用哪个工具。
- **执行安全**：参数合法不代表可以执行，还要看权限、审批和副作用。

面试里可以这样讲：

> 普通结构化输出主要解决“给程序可读结果”，Function Calling 进一步把结构化结果接到真实工具。前者错了可能只是解析失败，后者错了可能造成数据修改、发消息、下单、转账，所以必须加权限、幂等、审批和审计。

## Q9：多模型 fallback 时 schema 怎么兼容？

多模型系统常见问题是：A 模型支持严格 schema，B 模型只支持 JSON Mode，C 模型只会 prompt 约束。fallback 时如果不统一，会出现字段缺失、enum 不一致、错误码不一致。

建议：

- 在应用层定义统一 canonical schema。
- 每个模型适配器负责把能力映射到统一 schema。
- 对弱模型启用更严格的后处理和重试。
- 适配器可用简化的供应商schema，但对外canonical schema和语义不变；无法满足关键字段就显式失败或转人工，不能静默降级权限/证据要求。
- schema 版本写入日志和输出元数据。
- 下游只依赖统一 DTO，不直接依赖某个模型原始输出。

架构示意：

```text
业务代码
  -> canonical schema / DTO
  -> model adapter A: structured outputs
  -> model adapter B: json mode + validation
  -> model adapter C: prompt + repair + validation
  -> unified result / unified error
```

面试表达：

> 多模型 fallback 的关键不是把请求转发出去，而是保证输出合约一致。否则 fallback 成功了，业务解析却挂了。

## Q10：结构化输出怎么评估？

不要只看 JSON 合法率。建议至少看五层指标：

| 指标 | 说明 |
| --- | --- |
| JSON 合法率 | 能否被 parser 解析 |
| Schema 通过率 | 字段、类型、enum 是否符合 |
| 字段级准确率 | 每个字段值是否正确 |
| 业务规则通过率 | 是否满足权限、范围、依赖关系 |
| 端到端成功率 | 下游工作流是否成功完成 |

进一步可加：

- 平均重试次数。
- 修复成功率。
- 单次任务 token 成本。
- P95 延迟。
- 高风险字段人工复核通过率。
- 线上解析错误率。
- 模型升级前后回归差异。

RAG 抽取类任务还要评：

- evidence 命中率。
- 引用准确率。
- 无依据字段率。
- 资料不足时拒答正确率。

Agent 工具类任务还要评：

- 工具选择准确率。
- 参数准确率。
- 工具执行成功率。
- 越权调用率。
- 副作用事故率。

## Q11：为什么模型会编造字段值？怎么缓解？

原因是模型的训练目标是生成高概率文本，不是事实数据库。强制必填且缺少未知出口可能诱发填值；是否加剧幻觉需实验，不能认为约束强度与幻觉率必然单调。

缓解方式：

- schema 允许 `null` 或 `not_found`。
- prompt 明确“原文没有就填 null，不要猜”。
- 加 `evidence` 字段，要求引用原文。
- 对关键字段做规则或数据库校验。
- 温度可减少采样变化，不保证事实正确，也不是安全控制。
- 拆分任务，先定位证据，再抽取字段。
- 对高风险字段人工复核。
- 用评测集统计字段级幻觉率。

面试表达：

> 结构化输出会让幻觉更隐蔽，因为错误被包装成了合法字段。所以要让模型有“不知道”的出口，并要求关键字段带证据。

## Q12：结构化输出系统设计怎么讲？

如果面试官让你设计一个“模型抽取并写入业务系统”的结构化输出平台，可以这样分层：

```text
Schema Registry
  管理 schema 版本、字段描述、兼容性

Model Adapter
  屏蔽不同模型的 JSON Mode、Structured Outputs、FC 差异

Generation Runtime
  prompt 模板、解码参数、重试策略、fallback

Validation Layer
  JSON parser、schema 校验、业务规则校验、权限校验

Execution Layer
  下游 API、幂等 key、事务、审批、回滚

Observability
  原始输入输出、校验错误、字段准确率、成本延迟

Evaluation
  golden set、bad case、字段级指标、回归门禁
```

关键追问：

- schema 如何版本化？
- 老版本客户端怎么办？
- 模型升级怎么回归？
- 工具执行如何防重复？
- 用户权限在哪里校验？
- 输出错误怎么定位是模型问题还是 schema 问题？

高分回答：

> 我会把结构化输出当成 API 合约治理，而不是 prompt 技巧。schema 要版本化，模型要适配，输出要校验，执行要幂等，失败要可观测，变更要有评测门禁。

## Q13：项目里怎么讲结构化输出亮点？

下面均为参考/mocked表达，未经实际实施时使用“方案计划”，不当作作者或读者的上线经历。

不要只说“我让模型返回 JSON”。可以按下面方式升级表达：

**普通说法：**

> 示例方案只用prompt要求JSON，然后解析。

**更好的说法：**

> 参考方案把模型输出定义成版本化 schema，使用结构化输出或 Function Calling 约束生成；后端用 schema 和业务规则做双层校验，失败后带错误信息重试；关键字段要求 evidence，避免无依据抽取；线上监控 JSON 合法率、schema 通过率、字段准确率、平均重试次数和 P95 延迟。

如果是客服工单项目：

> 模型抽取用户意图、优先级、产品线和工单摘要，但不会直接创建高风险工单。只有 schema 校验、权限校验和重复工单检测通过后才写入系统；低置信度或高风险标签进入人工队列。

如果是合同抽取项目：

> 对金额、日期、主体、违约条款等字段要求原文 evidence，并对金额单位、日期范围、主体名称做规则校验；没有证据时必须返回 null，避免模型补全。

如果是 Agent 工具调用项目：

> 工具 schema 明确参数、权限和副作用等级；模型只生成调用意图，执行层做鉴权、幂等和审批；所有工具调用轨迹进入审计日志。

## Q14：常见反面回答

这些回答容易被追问打穿：

- “我在 prompt 里写清楚就行。”
- “JSON Mode 可以保证字段都正确。”
- “结构化输出就不会幻觉了。”
- “模型返回参数后直接调用工具。”
- “解析失败就无限重试。”
- “schema 越详细越好。”
- “只要 JSON 合法率高，系统就稳定。”
- “fallback 到其他模型不用改下游。”

修正思路：

- prompt 只是第一层，生产还要约束解码、校验、重试、降级。
- JSON 合法不代表 schema 正确，schema 正确不代表事实正确。
- 工具执行必须有权限、幂等、审批和审计。
- 评估要看字段级准确率、业务通过率、成本和延迟。

## Q15：Spring AI / LangChain / LangGraph / Dify 里怎么落地？

### Spring AI

Java 后端通常会把结构化输出映射成强类型 DTO。重点是：

- DTO 字段和 schema 一致。
- 显式执行Bean Validation约束；另用业务服务校验事实、权限与账户状态。
- 对解析错误做异常分类。
- 工具调用前做权限校验。
- 记录 request id、schema version、model version。

### LangChain

LangChain 常用 output parser、Pydantic schema、tool calling 等机制。重点是：

- parser 不只是解析，还要作为重试反馈的一部分。
- Pydantic 校验错误可以回传给模型修复。
- chain 中要显式处理 fallback 和异常。

### LangGraph

LangGraph 适合把结构化输出放到状态图节点中：

- 一个节点负责生成结构化结果。
- 一个节点负责校验。
- 校验失败走 retry edge。
- 高风险或多次失败走 human-in-the-loop。
- 工具执行节点只接收校验后的状态。

### Dify

Dify 工作流中结构化输出常用于变量抽取、分类、路由和工具参数。重点是：

- 输出变量要和下游节点字段匹配。
- 分类节点要设计兜底类别。
- 高风险操作要加人工确认节点。
- 对解析失败和空值设置 fallback 分支。

面试表达：

> 不同框架实现不同，但工程原则一样：schema 是合约，校验是边界，重试是恢复，人工兜底是安全阀。

## 最后一页速记

面试前记住这张表：

| 追问 | 关键词 |
| --- | --- |
| 怎么保证 JSON 合法 | Structured Outputs、约束解码、token mask |
| JSON Mode 和 Structured Outputs 区别 | 语法与支持的schema子集；都需识别拒答/截断 |
| 约束解码原理 | FSM / grammar / logits mask |
| 合法 JSON 还会错吗 | 会，业务值和事实仍可能错 |
| 失败怎么处理 | parser、schema、业务校验、修复、重试、降级 |
| 工具调用怎么安全 | 参数校验、权限、幂等、审批、审计 |
| 流式怎么做 | 展示可流式，执行等完整校验 |
| 怎么评估 | JSON 合法率、schema 通过率、字段准确率、业务成功率 |
| 项目怎么讲 | 从“返回 JSON”升级为“输出合约治理” |

一句话收尾：

> 结构化输出的终点不是模型会写 JSON，而是模型输出能像 API 合约一样被版本化、校验、观测和治理。

## 概率、分母与提交不变量

[官方XGrammar实现](https://github.com/mlc-ai/xgrammar) README本轮实读CFG支持片段；不把其性能宣传迁移成本站SLO。[Spring AI converter文档](https://docs.spring.io/spring-ai/reference/api/structured-output-converter.html) 本轮实读best-effort片段。JSON Schema对象文档本轮403，未重试；具体draft与供应商限制仍需独立核验。原系统示意中的“原始输入输出”应理解为受控、脱敏或引用式留存，不是默认全量日志。

令合法token集合为A、原模型概率为p，mask后 `p_A(x)=p(x)/Σ_(y∈A)p(y)`（x∈A），集合外为0。这会改变原分布，不等于模型“原本就会生成正确字段”。构造p=(0.5,0.3,0.2)、A={第二、第三类}，新概率为(0,0.6,0.4)。若A为空或分母为0，返回解码错误；不能放开mask偷偷继续。

构造1000个请求：980个JSON可解析、其中950个schema通过、其中900个业务正确。全请求解析率98%、schema率95%、业务正确率90%；条件schema率 `950/980≈96.94%`，两种分母不能混写。还需报告拒答、截断、修复前/后、重试预算和权限事故；只从修复成功子集算准确率会隐藏失败。

<details>
<summary>L1：字段在流中已出现，为什么不能创建工单？</summary>

完整对象可能仍缺必填字段或含冲突/重复key。工具delta按调用ID累积，限制字节/深度，终态后完整解析（包括重复key策略）、schema/业务/权限验证，再执行。对截断、拒答或取消不提交。
</details>

<details>
<summary>L2：JSON修复和fallback如何不改变业务含义？</summary>

保存原始输出hash、修复diff与适配器版本；不猜金额单位、证据、账户ID或审批结论。用null/缺失、重复key、非法日期、供应商不支持schema、预算耗尽等mocked负例验证统一错误码；同操作幂等键跨重试稳定。
</details>

<details>
<summary>L3：怎样证明schema升级兼容？</summary>

分别验证新生产者→旧消费者、旧生产者→新消费者；必填新增、枚举扩展、null语义和additionalProperties可能破坏不同方向。用同一固定输入集比较原始/修复/最终字段指标与成本；不能仅凭JSON合法率或同seed输出判断兼容。
</details>
