---
title: 投机采样的分布保证：接受、纠错与速度账本
description: 从单步拒绝采样推导目标分布恢复，用精确有理数检查错误回退，并区分接受率、目标前向次数和实际加速。
level: L2
roles:
  - Infra
  - 后端转型
  - 算法研究
classification: inferred
---
# 投机采样的分布保证：接受、纠错与速度账本

> **要交付的能力**：不只复述“小模型猜、大模型验”，还能解释为什么拒绝后的纠错分布不可省，以及为什么接受率高也不一定更快。
>
> L1 读流程和失败类型；L2 复算三词分布与成本示例；L3 检查概率证明、采样变换和实现对照。前置：[投机解码概览](/inference/speculative-decoding)、[推理 SLO 账本](/inference/slo-goodput)。

## 1. 先分开三种“相同”

| 命题 | 正确含义 | 不应推断为 |
| --- | --- | --- |
| 分布保持 | 正确算法在假设与数值精度范围内恢复目标采样分布 | 每次运行输出的文本完全相同 |
| 贪心一致 | 相同有效 logits、规则和已提交前缀下，应遵循目标 argmax | 浮点误差、并列处理和 batch 差异永远无影响 |
| 质量不降 | 算法不主动改成另一个采样目标 | 原模型回答就一定事实正确、安全或合规 |

Leviathan 等与 Chen 等分别给出草稿、验证和拒绝后纠错的采样算法。[1][2] 本页统一记号：**p 是目标分布，q 是草稿分布**；不同论文可能采用相反记号，阅读时先确认定义。

vLLM 官方文档区分理论、算法与运行时数值保证，说明 batch 和浮点差异可能影响 logprobs 与输出。[3] 不把“数学无损”写成所有运行环境都逐字、逐次相同的承诺。

## 2. 单步证明：被接受的概率质量是多少

固定一个已经提交的前缀，先从 q 抽候选 token x：

$$
\begin{aligned}
a(x)&=\min\left(1,\frac{p(x)}{q(x)}\right),\quad q(x)>0\\
q(x)a(x)&=\min(p(x),q(x))\\
\alpha&=\sum_x\min(p(x),q(x)),\quad P(\mathrm{reject})=1-\alpha
\end{aligned}
$$

若 q(x)=0，这个 token 不会由草稿提出，不要对它除以零。它仍可能有目标概率，由拒绝后的纠错分布补回。

拒绝时应使用正差残差：

$$r(x)=\frac{\max(p(x)-q(x),0)}{1-\alpha},\qquad \alpha<1$$

最终输出的概率质量恢复为：

$$\min(p(x),q(x))+(1-\alpha)r(x)=\min(p(x),q(x))+\max(p(x)-q(x),0)=p(x)$$

当 p=q，拒绝概率为零，不需要也不应强行构造 0/0 的残差。[1]

### 为什么“拒绝就从 p 重抽”不对

构造三个 token：

| token | p：目标 | q：草稿 | 接受质量 min(p,q) | 正差残差 |
| --- | --- | --- | --- | --- |
| A | 0.5 | 0.2 | 0.2 | 0.3 |
| B | 0.3 | 0.5 | 0.3 | 0 |
| C | 0.2 | 0.3 | 0.2 | 0 |

总拒绝率 0.3，纠错时应全部补到 A，恢复 (0.5,0.3,0.2)。如果无条件改从 p 重抽，结果反而是：

~~~text
错误输出分布 = min(p,q) + 0.3 × p
              = (0.35, 0.39, 0.26)
~~~

“最终仍然用大模型采样”听起来合理，但已经接受的质量不是零，必须补缺口而非再次完整加一份 p。

## 3. 可运行：用精确有理数复算

以下是标准库概率账本，不加载模型，不宣称完成推理内核实现或框架复现。Fraction 避免这组构造值的二进制浮点舍入干扰证明。

~~~python
from fractions import Fraction


def recover_distribution(target, draft):
    if set(target) != set(draft):
        raise ValueError("Require the same token space")
    for distribution in (target, draft):
        if any(value < 0 for value in distribution.values()) or sum(distribution.values()) != 1:
            raise ValueError("Probabilities must be nonnegative and sum to one")
    accepted = {token: min(target[token], draft[token]) for token in target}
    rejection = 1 - sum(accepted.values())
    residual = ({token: max(target[token] - draft[token], 0) / rejection
                 for token in target} if rejection else None)
    recovered = {token: accepted[token] + (rejection * residual[token] if residual else 0)
                 for token in target}
    naive = {token: accepted[token] + rejection * target[token] for token in target}
    return rejection, residual, recovered, naive


target = {"A": Fraction(1, 2), "B": Fraction(3, 10), "C": Fraction(1, 5)}
draft = {"A": Fraction(1, 5), "B": Fraction(1, 2), "C": Fraction(3, 10)}
rejection, residual, recovered, naive = recover_distribution(target, draft)
print("rejection", rejection)
print("residual", residual)
print("recovered", recovered)
print("wrong_fallback", naive)
assert rejection == Fraction(3, 10)
assert residual == {"A": Fraction(1), "B": Fraction(0), "C": Fraction(0)}
assert recovered == target and naive != target
assert recover_distribution(target, target)[1] is None
assert recover_distribution(target, target)[2] == target
missing_draft_target = {"A": Fraction(1, 2), "B": Fraction(1, 2)}
missing_draft = {"A": Fraction(0), "B": Fraction(1)}
assert recover_distribution(missing_draft_target, missing_draft)[2] == missing_draft_target
~~~

这只检验固定前缀的一步概率质量。真实自回归算法还需要在每一步按正确前缀构造条件分布，维护位置、KV 与采样状态。

最后一个检查故意令草稿不产生 A：目标仍可由残差恢复 A 的概率。实现中只对真正从 q 抽出的候选计算接受比值，不对整个词表无条件执行 `p/q`。

## 4. 多 token 草稿：第一个拒绝点改变后续前缀

1. 草稿按自身前缀依次产生 K 个候选，并保存实际 q。
2. 目标模型对这些候选前缀计算相应条件分布 p。
3. 从前向后逐项执行接受检验；第一个拒绝点之前的 token 才能提交。
4. 拒绝点从残差采样，后面的候选及其计算基于错误前缀，不能继续当作有效输出。
5. 如果 K 个都接受，可从对应目标分布再生成一个 token；仍受 EOS、输出上限和停止规则限制。[1][2]

因此一轮理论上产生 1 到 K+1 个 token。不是“比较两个模型的 argmax 是否一样”就实现了随机采样的分布保证，也不能把未验证的草稿直接作为正式流式输出。

## 5. 采样变换与约束必须进入概率账本

p 必须是基线实际要采样的目标分布，而不是随手读取的原始 softmax；q 则必须对应草稿实际提出候选的分布。

- 温度、top-k、top-p、重复惩罚和语法约束可能改变可采样概率。
- 不要求 p 与 q 使用完全相同的过滤策略，但接受比例必须使用两者**实际、已归一化的分布**。
- 若草稿与目标的 token 空间不同，需要明确的对齐算法；不能直接将不同 token ID 的概率相除。
- 语法状态、可见前缀、位置和 KV 回退不一致，即使单步公式正确也可能破坏整体条件分布。
- 固定随机种子不保证采样文本逐字一致：两套算法消耗的随机数次序不同，还可能有 batch 数值差异。

## 6. 接受率不是实际速度：写出轮次成本

在接受事件独立同分布、接受率 alpha 固定等简化假设下，一轮平均输出：[1]

~~~text
E[tokens per round] = 1 + alpha + ... + alpha^K
                   = (1-alpha^(K+1))/(1-alpha)
alpha=1 时为 K+1
~~~

增加 K 只能在这些假设下增加每轮期望输出，不能推出总时延变小。论文的简化成本模型假定验证成本约等于一次目标前向；实际账本可写成：

~~~text
T_round = K × T_draft_step + T_verify(K) + T_extra
速度比 ≈ E[tokens per round] × T_target_step / T_round
~~~

T_extra 包含采样、同步、调度、缓存和回退等未计入阶段的开销。真实系统可能有重叠执行，应避免重复计时；上述顺序相加是教学模型，不是所有框架的墙钟公式。

### 可运行：更长草稿可能更慢

~~~python
from math import isclose


def projected_speed(acceptance, draft_tokens, target_step_ms, draft_step_ms,
                    verify_ms, extra_ms):
    if not (0 <= acceptance <= 1) or draft_tokens < 1:
        raise ValueError("Invalid acceptance or draft length")
    if target_step_ms <= 0 or min(draft_step_ms, verify_ms, extra_ms) < 0:
        raise ValueError("Invalid latency")
    expected_tokens = sum(acceptance ** index for index in range(draft_tokens + 1))
    round_ms = draft_tokens * draft_step_ms + verify_ms + extra_ms
    if round_ms <= 0:
        raise ValueError("Round latency must be positive")
    return expected_tokens, expected_tokens * target_step_ms / round_ms


short = projected_speed(0.8, 4, 10, 1, 15, 2)
long = projected_speed(0.8, 8, 10, 1, 30, 2)
print("K=4", short)
print("K=8", long)
assert isclose(short[0], 3.3616)
assert short[1] > long[1]
assert projected_speed(0, 4, 10, 1, 15, 2)[1] < 1
~~~

构造结果：K=4 的预测速度比约 1.601，K=8 约 1.082。所有耗时均是假设，不是 GPU 实测。短输出、EOS 与接受率随前缀变化还会使这个长期平均近似失效。

## 7. 怎样验证实现，而不是只验证这篇推导

| 检查 | 应留下的证据 |
| --- | --- |
| 固定前缀分布 | 构造概率、拒绝/残差边界、经验样本与目标分布对照 |
| 贪心路径 | 相同配置下基线与投机的 token 序列；分析数值/并列差异 |
| 多步状态 | 拒绝后的前缀、KV、语法、EOS、输出上限与位置索引 |
| 采样策略 | 变换前后概率、tokenizer、温度与过滤/约束配置 |
| 性能 | draft/verify/额外计时、平均提交 token、接受率分布、失败与 SLO |
| 资源 | 草稿显存、KV、工作区、并发、调度与峰值负载 |

不能只看“两个随机样本不同”就判算法有损，也不能只看一条文本相同就证明分布一致。经验分布对照需足够样本与不确定性；框架测试通过也不替代目标部署的验证。

vLLM 当前 stable 文档将中低 QPS、偏访存的工作负载作为重要应用场景，同时提示数值与批处理差异。[3] 文档会更新；实际测试应固定框架提交或镜像，不抄历史文章给任意高并发承诺收益。

## 8. 面试追问与实践交付

- **拒绝后为什么不能直接从目标分布重抽？** 已接受质量为 min(p,q)，要补正差残差，否则重复分配概率。
- **草稿不会提出的 token 怎么补回来？** q 为零的项不做除法，可由目标正差残差产生。
- **接受率 90% 就一定更快？** 还取决于 K、验证成本、调度、显存、并发与输出长度。
- **无损代表两个运行输出相同？** 不是；分布保持、贪心路径与数值确定性需要分别讨论。

**最小交付**：概率恢复账本、错误回退反例、状态一致性检查和同负载性能方案。未跑模型时写“代数验证/实验设计”，不写“无损内核已实现”或“部署加速成功”。

## 一手来源与证据范围

资料核对日期：2026-11-04；核对原论文算法、残差与期望输出/成本段落，以及官方文档可检索摘录。未运行真实推理 benchmark。

1. [Leviathan 等：Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)：接受/残差算法、多步验证与简化成本分析。
2. [Chen 等：Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318)：修改拒绝采样、硬件数值范围与 K+1 流程。
3. [vLLM 官方投机解码说明](https://docs.vllm.ai/en/stable/features/speculative_decoding/)：运行时数值、批处理与保证范围；stable 是可变文档，不代表本页已验证任意版本。

构造分布、Fraction 检查与扩展成本示例是本页教学整理。继续阅读：[一手资料阅读地图](/advanced/primary-source-reading)。
