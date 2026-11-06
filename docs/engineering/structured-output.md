---
title: 结构化输出详解
description: >-
  区分 JSON 解析、schema 约束、事实一致与业务授权，解释约束解码的适用边界。用拒答、截断、字段修复与流式工具参数的失败例建立可靠消费协议。
level: L2
roles:
  - 后端转型
  - 应用开发
  - Infra
classification: inferred
---
# 结构化输出详解

> 结构化输出解决的是程序消费契约，不是事实或授权。先判定供应商结果是否完整成功，再解析 JSON、验证 schema 和业务规则，最后决定是否允许执行动作。

## 为什么结构化输出是难点？

LLM 本质是「文字接龙」，天生输出自由文本。直接要求输出 JSON 的常见翻车：

- 多了解释文字（「好的，这是你要的 JSON：……」）；
- 用 Markdown 代码块包裹；
- 引号/逗号/括号不匹配，JSON 非法；
- 字段缺失、类型不对、枚举值乱编。

构造测算：若每次格式成功概率为 99%，1 万次的期望失败数是 100，不保证每天恰有 100 次，也不代表各请求独立。要区分拒答、截断、schema 不支持、服务错误与格式错误，不能把全部失败都用修 JSON 解决。

## 实现手段：从弱到强的谱系

| 手段 | 原理 | 可靠性 |
| --- | --- | --- |
| **Prompt 约束** | 提示里要求 JSON + 给示例 | 最弱，模型可能不守规矩 |
| **Function Calling** | 让模型提出工具及参数 | 是否严格约束取决于 provider/模式；调用提案不是执行许可 |
| **JSON Mode** | 约束 JSON 语法 | 不约束字段；仍有截断、拒答与终态分支 |
| **Schema 约束 / 约束解码** | 按支持的 schema/语法限制候选 token | 完整成功路径可受结构约束；不承诺所有请求 100% 返回业务对象 |
| **校验 + 重试/修复** | 检查解析、schema 和业务规则 | 有界恢复；修复可能改变值，副作用未知时禁止盲目重试 |

> JSON Mode 面向语法，schema 面向形状，业务校验面向可用性。SDK 的反序列化成功也不证明事实正确。

## 约束解码（Constrained Decoding）原理

核心思想：生成每个 token 前，根据目标格式**屏蔽所有不合法候选**，只从合法集合采样：

```
已生成前缀 + schema/语法状态 + tokenizer
  -> 判断每个候选 token 解码出的字节是否仍可延伸为合法结果
  -> 不合法候选 logits 置 -inf
  -> 从合法集合采样，更新语法状态
```

正则/受限结构可用有限状态机；一般递归嵌套 JSON 需要处理栈或等价语法状态，不应说任何 schema 都能编译成固定 FSM。JSON Schema 还有跨字段/数值/引用等约束，各引擎支持的子集不同；编译成功不代表业务规则也被解码器实现。token 可能包含多个字符甚至跨结构边界，不能按“下一字符是数字”粗略筛词表。

[XGrammar 论文摘要](https://arxiv.org/abs/2411.15100) 描述了上下文无关语法、可预检查与需运行时判断的 token、持久栈以及与 GPU 执行重叠。其低开销结论属于论文配置下的结果，不是任意模型/schema 的零开销保证。本轮只读摘要，未复现实验。

代表实现：OpenAI **Structured Outputs**、**Outlines**、**XGrammar**、vLLM/TGI 的 guided decoding、llama.cpp 的 GBNF 语法。

## 约束解码的副作用（高分考点）

1. **「合法 ≠ 正确」**：约束只管语法，字段值照样可能是编的。schema 要给「不知道」留出口（nullable/`"unknown"` 枚举），否则模型被迫编造。
2. **强制选择隐藏不确定性**：只有两个 enum 选项且无 unknown 时，合法输出仍可能是猜测。设计缺失、冲突与需确认状态，不能用格式通过率奖励强行填值。
3. **任务质量与格式相互影响**：复杂 schema、输出顺序或两阶段生成可能改变质量与成本，应配对评测。`reasoning` 字段前置不保证正确，也不应要求暴露内部思维链；若业务需要解释，输出短的证据依据和计算结果即可。

## 工程最佳实践

- **优先用原生能力**：API 的 Structured Outputs / FC 优先于裸 prompt；
- **Schema 按任务设计**：层级、递归和引用以当前引擎支持范围为准，没有通用“最多两层”；多调用拆分要承担版本拼接和一致性成本；
- **善用枚举与描述**：固定取值用 enum；每个字段写 description（它们会被模型读到）；
- **事实出处可校验**：提取字段绑定 source locator，允许 null；关键金额、身份和权限由服务端事实校验；
- **流式解析只预览**：增量字段在终态前是候选，最终解析与全局校验通过前不提交业务动作；
- **兜底分类**：拒答/截断/服务异常先处理，不把 refusal 当 JSON；格式失败可有界重试，修复须保留原文/diff，不自动补金额、ID 或确认；
- **参数不是正确性保证**：温度和随机种子只作为评测配置记录，不代替事实验证；
- **评估**：抽取类任务建评估集量化「字段级准确率」，不要只看 JSON 合法率。

## 与 Function Calling 的关系

Function Calling 的「参数生成」本质就是一次结构化输出——模型按工具参数 schema 产出合法 JSON，许多推理引擎用同一套约束解码机制支撑两者。所以结构化输出能力是 [Function Calling 与 MCP](/agent/function-calling-mcp) 可靠性的地基。

这里“合法 JSON”只适用于该 provider 已启用并支持的成功约束路径。工具 schema、参数生成、执行授权、幂等回执是四层契约；即使参数严格符合 schema，`order_id` 仍可能属于其他租户。OpenAI 官方 [Python SDK helpers](https://github.com/openai/openai-python/blob/main/helpers.md) 展示了 parsed/refusal 分支，并说明解析 helper 在 length/content_filter 终态可能抛错，不能无条件取 parsed 字段。

### 可运行负例：合法 JSON 仍不能退款

以下 Python 3 标准库例子验证一个狭窄的自定义字段契约与业务上限，**不是通用 JSON Schema 校验器**，不调用真实退款 API。保存后运行 `python example.py`，三个断言分别覆盖坏语法、结构错误和业务越界：

```python
import json

def classify_candidate(raw, refundable_cents):
    try:
        candidate = json.loads(raw)
    except json.JSONDecodeError:
        return "parse_error"
    if not isinstance(candidate, dict):
        return "schema_error"
    if set(candidate) != {"order_id", "amount_cents"}:
        return "schema_error"
    if not isinstance(candidate["order_id"], str):
        return "schema_error"
    if type(candidate["amount_cents"]) is not int:
        return "schema_error"
    if not 0 < candidate["amount_cents"] <= refundable_cents:
        return "business_error"
    return "needs_authorization_and_approval"

assert classify_candidate('{"order_id":', 1000) == "parse_error"
assert classify_candidate('{"order_id":"demo","amount_cents":true}', 1000) == "schema_error"
assert classify_candidate('{"order_id":"demo","amount_cents":2000}', 1000) == "business_error"
assert classify_candidate('{"order_id":"demo","amount_cents":500}', 1000) == "needs_authorization_and_approval"
```

拒答/截断是供应商响应层状态，应在调用这个函数之前分流。例子特意排除 Python 中可作为整数的 bool；实际服务还需金额币种、资源归属、当前订单版本与确认绑定。

## 高频追问

**Q：怎么保证大模型一定输出合法且符合结构的 JSON？**
先明确完整成功、支持的 schema 和终态假设。约束解码减少成功路径的格式错误，应用仍要分流拒答/截断/服务错误，并验证解析、schema、事实和授权；不能保证每次调用都返回可执行 JSON。

**Q：JSON Mode 和 Structured Outputs 的区别？**
JSON Mode 不规定字段结构；严格 Structured Outputs 在支持的完整成功路径约束 schema。两者都不免除终态检查、版本校验和业务校验，不能“省去防御性校验”。

**Q：约束解码的原理？为什么几乎不增加延迟？**
题目的“几乎不增加延迟”不是普遍前提。递归语法状态、tokenizer、schema 编译/缓存和 CPU/GPU 重叠都会影响开销；分别测冷编译、热缓存和端到端负载，不能只测掩码查表后宣称零开销。

**Q：约束解码有什么副作用？怎么缓解？**
允许 unknown/null，记录证据，按任务测试 schema 复杂度和两阶段生成的质量/延迟取舍。不把可见 reasoning 字段或固定顺序当成通用增强策略。核心认知：**约束管格式，不管事实**。

**Q：抽取任务里模型总编造不存在的字段值怎么办？**
schema 允许 null 并在描述中明确「原文没有就填 null」；字段加 evidence/quote 要求附原文依据；低温度；评估集按字段统计准确率定位高发字段，针对性改描述或拆步骤。

**Q：流式场景怎么处理结构化输出？**
增量解析可预览完整字段，但收到成功终态、完成 JSON/schema/业务/授权校验前不能执行工具或永久写入。断流后的 partial 必须标记未完成，不自动补闭合括号变成成功。

L1 区分上述四个失败/待批准结果；L2 设计终态分流、修复审计与有界重试；L3 在相同抽取样本上比较 prompt、JSON mode 和约束模式，同时报告字段正确率、拒答/截断率、冷/热延迟与成本，不能只比较“JSON 合法率”。
