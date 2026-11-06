---
title: Agent 重复试验：pass@k 不等于持续可靠
description: 区分一次成功、至少一次成功与全部成功，复算有限样本估计，并用隔离环境、最终状态和失败归因评估 Agent。
level: L2
roles:
  - 应用开发
  - 后端转型
  - 算法研究
classification: inferred
---
# Agent 重复试验：pass@k 不等于持续可靠

> **要交付的能力**：解释“任务做成过”与“每次都能可靠做成”的差别，设计可重置、可核查、不会重复真实副作用的评测。
>
> L1 读任务、结果与指标区别；L2 跑通有限样本计算；L3 检查任务异质性、相关试验和分布变化。前置：[Agent 结果与轨迹评估](/agent/agent-evaluation)。

## 1. 一条任务不等于一次运行

Anthropic 的工程文章区分了 task、trial、grader、trace 和 outcome。这里采用这个词汇拆解一次“创建工单”任务：[1]

| 对象 | 本例含义 | 应保存什么 |
| --- | --- | --- |
| Task / 任务 | 为指定账户创建工单并满足业务约束 | 输入、初始状态、成功与禁止条件 |
| Trial / 试验 | 从指定初始状态运行一次 Agent | 模型、提示、工具和预算版本 |
| Grader / 评判器 | 检查是否真的创建且只创建一次 | 校验实现、判定与异常 |
| Trace / 轨迹 | 调用、工具结果、时间和恢复路径 | 可供失败归因的记录 |
| Outcome / 最终结果 | 工单实际存在、归属正确、没有额外写入 | 独立业务状态检查 |
| Harness / 测试设施 | 任务装载、隔离、执行和汇总 | 环境重置与评测配置 |

Agent 说“已创建”只是一段文本。数据库状态正确也不代表全过程合规：可能越权读取、额外扣费或泄露信息。**结果、安全、轨迹和成本必须分别记录，不能靠一个成功标签相互抵消。**

## 2. 三种成功口径，回答三种产品问题

| 指标 | 回答的问题 | 适合的场景与限制 |
| --- | --- | --- |
| pass@1 | 一次尝试成功的比例是多少？ | 单次用户请求；需说明样本和运行条件 |
| pass@k | k 次机会中至少一次成功的概率是多少？ | 多候选搜索；还需要可靠的候选选择与预算 |
| pass^k | k 次试验全部成功的概率是多少？ | 检查重复执行的一致性；不等于无限次可靠 |

只有在**同一任务、独立同分布、固定成功概率 p** 的近似下：

~~~text
pass@k = 1 - (1 - p)^k
pass^k = p^k

p = 0.75，k = 3：
至少一次成功 = 0.984375
全部成功 = 0.421875
~~~

同一个系统可以看起来“几乎总能搜索到一个正确结果”，却并不适合无人工监督地每次执行。这不是指标矛盾，而是产品问题不同。[1]

::: warning 多试几次不是免费的可靠性
pass@k 的“至少一次成功”通常假定能识别正确结果。真实产品若没有可靠验证器，可能选到错误候选；重试还增加延迟、成本与副作用。重复试验应在隔离环境运行，不能重复发真实退款、付款或邮件。
:::

## 3. 不要把全部任务的均值直接乘方

假设两类任务各占一半，其单次成功概率分别是 0.9 与 0.1，平均都是 0.5。三次全部成功的跨任务平均是：

~~~text
先逐任务计算再平均：(0.9^3 + 0.1^3) / 2 = 0.365
把总体均值乘方：0.5^3 = 0.125
~~~

它们不同。任务难度差异、共享缓存、工具限流、同一环境故障、上下文污染和错误恢复都会影响估计。相关性存在时，p^k 也不再是充分模型。应记录每个任务的试验，按任务聚合，必要时按故障批次分组分析。

**连续步骤的成功率**也不是**重复运行整项任务的成功率**。十步流程中，如果每一步在此前步骤成功的条件下都以 0.95 概率成功，链式相乘得到约 0.599；若“单步 95%”只是混合样本上的边际准确率，就不能这样计算。

## 4. 有限样本：为什么 HumanEval 不直接使用成功比例的 k 次幂

HumanEval 作者实现从每个问题的 n 个生成样本、其中 c 个正确样本，估计 pass@k：[2]

~~~text
至少一次成功的子集比例：
1 - C(n-c, k) / C(n, k)

全部成功的子集比例：
C(c, k) / C(n, k)

要求 n >= k；C 是组合数，无法选出足够元素时相应分子为 0。
~~~

第一式是作者实现采用的 pass@k 估计；第二式是本页按同样的“不放回选择子集”思路给出的教学计算，**不是声称 HumanEval 默认提供 pass^k**。

两个层次要分开：

- 对一个已观察到的样本集合，组合数给出所有大小为 k 的子集中目标事件的比例。
- 在样本独立同分布等假设下，它可用于估计未来 k 次事件概率；不满足采样假设时不能承诺生产可靠性。

例如 n=8、c=6、k=3：有限样本“全部成功”比例是 20/56≈0.357143，直接用 (6/8)^3 得到 0.421875。前者没有把有限样本的经验成功比例当成已知真实 p。

## 5. 可运行：每任务计算，再做宏平均

以下三项任务各有八个**构造试验**。只用于验证数学与汇总口径，无真实模型调用。

~~~python
from math import comb, isclose

trials = {
    "create_ticket": [True, True, True, True, True, True, False, False],
    "recover_timeout": [True, True, False, False, False, False, False, False],
    "reject_unauthorized": [False] * 8,
}


def estimate_subset_rates(sample_count, correct_count, attempts):
    if not (1 <= attempts <= sample_count and 0 <= correct_count <= sample_count):
        raise ValueError("Require n >= k >= 1 and 0 <= c <= n")
    denominator = comb(sample_count, attempts)
    failure_subsets = (comb(sample_count - correct_count, attempts)
                       if sample_count - correct_count >= attempts else 0)
    success_subsets = (comb(correct_count, attempts)
                       if correct_count >= attempts else 0)
    return 1 - failure_subsets / denominator, success_subsets / denominator


attempts = 3
rows = []
for task_id, results in trials.items():
    sample_count = len(results)
    correct_count = sum(results)
    at_least_one, all_success = estimate_subset_rates(
        sample_count, correct_count, attempts)
    rows.append((at_least_one, all_success))
    print(task_id, "pass@1", correct_count / sample_count,
          "pass@3", round(at_least_one, 6),
          "all_3_subset", round(all_success, 6))

print("macro_pass@3", round(sum(row[0] for row in rows) / len(rows), 6))
print("macro_all_3_subset", round(sum(row[1] for row in rows) / len(rows), 6))
assert isclose(rows[0][0], 1.0)
assert isclose(rows[0][1], 5 / 14)
assert estimate_subset_rates(8, 0, 3) == (0.0, 0.0)
assert estimate_subset_rates(8, 8, 3) == (1.0, 1.0)
~~~

宏平均 pass@3≈0.547619，全部成功子集比例≈0.119048。宏平均让每个任务等权；生产加权报告则应事先说明任务权重及来源，不能为提高分数临时调整权重。

无效试验不要偷偷删除。任务失败、环境故障、评判器故障分别记账，报告总任务数、每任务试验数、排除规则和有效覆盖；若环境故障属于被测服务应承担的风险，发布口径不应将其排除。

代码中的布尔值只演示集合汇总，真实 trial 还需保留 `success`、`task_failed`、`environment_error`、`grader_error` 和 `unknown_effect` 等原始状态。若写操作终态未知，不能直接转为成功，也不能静默排除；先对账，再按预先声明的发布口径统计。安全违规独立保留，即使目标达成也不自动标整体通过。

对多候选产品还要验证**选择器**：pass@k 计算「存在一个成功」，实际系统能否选中它是另一项能力。生成、选择、验证、失败重试都计入 k 次机会的总预算；不能以离线可见金标准选择结果，冒充线上没有金标准时的成功率。

## 6. 可靠性实验需要一个可重置的世界

建议流程：

1. 冻结任务输入、预期初始状态、工具契约、模型与预算。
2. 为每个 trial 创建独立账户、临时数据库或工具模拟器，隔离记忆和缓存。
3. 执行任务，记录时间、外部调用、写操作身份和停止原因。
4. 独立检查最终状态与禁止条件，不仅检查 Agent 的总结。
5. 注入“写入成功但响应超时”“明确未执行”“授权拒绝”等不同故障。
6. 清理试验状态，确认下一轮不继承上轮结果；保存可供复核的脱敏轨迹。

[写操作超时恢复](/agent/agent-basics#agent-recovery)需要业务侧稳定操作身份与查询契约。checkpoint 只保存运行状态，并不自动保证外部操作 exactly-once。生产事故通常也不能通过简单“回滚环境”消除。

## 7. 从排行榜走向发布门禁

Anthropic 区分探索新能力的评测与保护已有能力的回归评测。[1] 工程上可保留：

| 测试集合 | 要回答的问题 | 报告要求 |
| --- | --- | --- |
| 能力集 | 哪类任务仍然不会？ | 难度、失败分布、预算与尝试次数 |
| 回归集 | 已支持的任务是否退化？ | 同条件新旧对照、重要任务切片 |
| 安全集 | 禁止动作有没有发生？ | 不允许被普通成功率抵消 |
| 故障集 | 结果未知时能否安全恢复？ | 环境状态、操作身份、人工接管 |

门禁数值由产品风险确定。本页不推荐一个通用“95% 成功就上线”的阈值，也不把有限评测的零事故当成风险不存在。比较版本时对同一批任务做配对对照，并给任务级不确定性；不要把重复轨迹当独立新任务增加样本量。

## 8. 面试追问与实践产出

- **pass@10 高，为什么用户仍觉得不可靠？** 用户可能只有一次机会，产品可能无法识别正确候选，且重试成本与副作用未被分数反映。
- **把所有 trial 打散求均值可以吗？** 会让试验数多的任务权重更高，隐藏难任务；要说明微平均、宏平均与生产权重。
- **测十次都成功，能说成功率 100% 吗？** 只能说这十次观察成功，不能承诺未知分布上的真实成功概率等于 1。
- **评判器错了怎么发现？** 检查 trace、环境状态和人工复核，区分 Agent 失败与 grader 失败。

**最小交付**：可重置环境说明、每任务 trial 表、最终状态验证器、三类成功口径、故障归因以及预算与安全报告。没有真实执行时，标为实验设计或构造演示。

继续阅读：[裁判校准](/evaluation/judge-calibration) · [推理 SLO 账本](/inference/slo-goodput) · [一手资料阅读地图](/advanced/primary-source-reading)

## 一手来源与证据范围

资料核对日期：2026-11-04；核对原文相关段落与作者实现的可检索代码摘录，未运行真实 Agent benchmark。

1. [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)：支撑评测术语、pass@k/pass^k 的区分与能力/回归评测框架；它是工程经验，不是任意 Agent 的可靠性保证。
2. [OpenAI HumanEval 作者实现：evaluation.py](https://github.com/openai/human-eval/blob/master/human_eval/evaluation.py)：支撑 pass@k 的组合数估计与 n>=k 条件；该链接为可变分支，复现实验应另记录所用提交。

本页工具隔离方案、全部成功子集计算和构造记录为工程教学整理，不能替代生产试验。

本轮补核：实际读取 HumanEval 官方 `evaluation.py` 的 `estimate_pass_at_k` 函数，确认采用 $1-\binom{n-c}{k}/\binom{n}{k}$ 的等价乘积实现；未运行其测试设施，未重新核读 Anthropic 全文。上述补核不新增人工技术审校日期。
