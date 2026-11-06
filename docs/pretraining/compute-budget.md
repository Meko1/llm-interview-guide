---
title: 训练预算与生命周期成本：从 6ND 到条件性最优
description: 区分训练 FLOPs、墙钟与部署成本，复算假设损失曲线的预算分配和推理需求盈亏平衡，避免把 20:1 当成通用配方。
level: L2
roles:
  - 算法研究
  - Infra
  - 后端转型
classification: inferred
---
# 训练预算与生命周期成本：从 6ND 到条件性最优

> **要交付的能力**：说明“训练计算最优”究竟优化什么，能列出参数、token、墙钟和长期服务需求的不同账本，而不是照搬 20:1。
>
> L1 读预算口径与选型边界；L2 运行构造预算；L3 再推导曲线、分析外推与成本约束。前置：[缩放定律](/pretraining/scaling-law)、[推理预算](/inference/slo-goodput)。

## 1. 先问“最优”对应哪个目标

| 目标 | 固定条件 | 需要最小化或最大化的量 |
| --- | --- | --- |
| 训练计算最优 | 总训练计算、数据/架构/配方范围 | 可比较的验证损失 |
| 同质量服务最优 | 通过同一质量与安全约束 | 训练 + 生命周期推理成本 |
| 生产容量最优 | 服务质量、负载、延迟与可靠性约束 | 满足 SLO 的容量或单位任务成本 |
| 研究贡献判断 | 可比较基线、数据、计算与实现 | 明确归因的机制增量 |

Chinchilla 研究在给定训练计算预算下比较参数与训练 token 的分配，得到模型规模与数据量应协调增长的结果。[1] 这不等于为任何 tokenizer、数据质量、架构与推理需求提供固定比例。

计入推理需求的缩放研究进一步在质量约束下考虑训练与服务成本，分析了需求增加时较小、训练更久的模型可能更划算的条件。[2] **“可能更划算”需要质量可比和成本模型成立，不是小模型一定最优。**

## 2. 6ND 是模型计算近似，不是显存或租卡账单

对本页采用的稠密 Transformer 简化口径：

~~~text
N：近似参与计算的模型参数数
D_train：训练处理的 token 数（含重复处理，不等于独特文本量）
C_train ≈ 6 × N × D_train，单位 FLOPs
~~~

训练 token 增多可以来自新语料，也可以来自多次重复，二者的质量收益不应视为相同。论文中的模型计算近似用于预算分析，但实际部署还需要额外边界。[2]

- 长上下文注意力、激活重计算、优化器和其他模块可能使简化计数不完整。
- MoE 的总参数、激活参数与路由/通信开销不同，不直接将总参数塞进稠密 6ND。
- 数据加载、通信、checkpoint 和失败恢复占墙钟时间，却不一定进入模型 FLOPs。
- 显存是权重、梯度、优化器、激活与工作区的空间账本，不能从总 FLOPs 直接得到。
- 训练 FLOPs、输出 token 数、GPU 小时与货币成本单位不同，不能相互替代。

### 先检查可行域，再求最优

数据上限要拆成独特可用 token、允许重复的处理 token 和冻结验证集。若算出的 D* 超过可用数据，不能把重复多轮当作等量新数据；应在限定重复范围的小规模实验上重新拟合损失曲线。模型 N* 也必须满足显存、截止时间与部署质量约束，连续最优点未必对应可训练的整数层数/宽度配置。

预算应预留试跑、故障回退和 checkpoint 恢复时间。恢复账本至少保存优化器、学习率调度、RNG、数据游标与累计 token；只保存权重是在启动一条新训练轨迹，不是完整续训。

### 从计算量到时间还缺什么

若有效模型计算速率为 R_eff FLOP/s，可写 T≈C/R_eff。若用峰值和 MFU 估计 R_eff，必须对齐硬件、数值精度、算术计数与时间范围，不能把某篇论文的 MFU 常数搬到自己的集群。

例如构造 C=6e20 FLOPs、R_eff=4e14 FLOP/s，代数上 T=1.5e6 秒，约 17.36 天；这不是实际完工预测，还未包含未计入速率的停机与运行开销。只有明确计时与统计范围的实际数据才可校验估算。

## 3. L3：预算分配如何由损失模型决定

下面采用**假设性经验曲线**演示最优化，不使用论文拟合系数，也不声称已复现其估计：

~~~text
L(N,D) = E + A/N^alpha + B/D^beta
A,B,alpha,beta > 0
约束 C = 6ND
~~~

E 是拟合中的常数项，不是自动测得的物理熵下界。把 D=C/(6N) 代入，对 N 求导：

~~~text
alpha × A/N^alpha = beta × B/D^beta
N* = [(alpha A)/(beta B) × (C/6)^beta]^(1/(alpha+beta))
D* = C/(6N*)
~~~

如果 alpha=beta，两者随 C 的平方根增长；比例仍由 A/B 和计量单位决定。指数不同、成本项改变、数据受限或跨架构拟合时，最优关系也会变化。

所以“20 token / 参数”是特定研究与近似条件下的经验参考，不能充当物理定律。即使某配置符合比例，数据质量、验证分布和训练稳定性也可能不满足要求。

## 4. 可运行：一个明确单位的构造最优点

避免将“B 参数”的数字 7 与原始参数 7e9 混算。这里统一使用归一化单位：

~~~text
N_bar = N / 1e9
D_bar = D / 1e9
budget = C / (6e18)，因此 N_bar × D_bar = budget
构造 A=1、B=4、alpha=beta=0.5、E=1、budget=100
~~~

~~~python
from math import isclose

coefficient_model = 1.0
coefficient_data = 4.0
exponent_model = 0.5
exponent_data = 0.5
floor_loss = 1.0
budget = 100.0


def toy_loss(parameters_billion, training_tokens_billion):
    if min(parameters_billion, training_tokens_billion) <= 0:
        raise ValueError("Counts must be positive")
    return (floor_loss
            + coefficient_model / parameters_billion ** exponent_model
            + coefficient_data / training_tokens_billion ** exponent_data)


optimal_parameters = ((exponent_model * coefficient_model)
                      / (exponent_data * coefficient_data)
                      * budget ** exponent_data) ** (1 / (exponent_model + exponent_data))
optimal_tokens = budget / optimal_parameters
compute_flops = 6 * (optimal_parameters * 1e9) * (optimal_tokens * 1e9)
print("parameters_billion", optimal_parameters)
print("training_tokens_billion", optimal_tokens)
print("tokens_per_parameter", optimal_tokens / optimal_parameters)
print("model_compute_flops", compute_flops)
print("toy_loss", toy_loss(optimal_parameters, optimal_tokens))
assert isclose(optimal_parameters, 2.5)
assert isclose(optimal_tokens, 40.0)
assert isclose(compute_flops, 6e20)
for candidate in [1.0, 2.0, 3.0, 5.0, 10.0]:
    assert toy_loss(candidate, budget / candidate) > toy_loss(optimal_parameters, optimal_tokens)
~~~

得到 2.5B 参数、40B 训练 token、比值 16 和构造 loss≈2.264911。这个 16 **不是新的推荐配比**，只是选定系数和单位下的代数结果；换 A/B 或指数就会变化。

实际拟合需要多组受控训练、明确数据与 tokenizer、同验证目标、损失不确定性及外推检查。没有训练记录时，只能交付预算推导或实验方案，不能填写“最优模型已验证”。

## 5. 生命周期：多训练一次，能否换更低服务成本

采用稠密模型的一阶近似：[2]

~~~text
C_total ≈ 6N D_train + 2N D_inference
~~~

D_inference 是整个服务周期内按该近似计入的输入与输出处理 token，不是请求数，也不是单条最大上下文。缓存、注意力、不同输入/输出利用率、量化和实际硬件都可能改变成本，不能从该式直接给 API 定价。

若较小模型额外训练量为 Delta_C_train，服务每 token 节省 Delta_f，计算盈亏平衡约为：

~~~text
D_break_even = Delta_C_train / Delta_f
前提：Delta_C_train>0、Delta_f>0，且两模型已满足同一质量约束
~~~

### 可运行：两份假设配置的计算交叉点

本例没有证明两份配置同质量，仅演示**如果它们通过同质量验证**，计算量账本如何比较。A/B 不是实际模型，不是选型推荐。

~~~python
from math import isclose

plans = {
    "A": {"parameters": 7e9, "train_tokens": 140e9},
    "B": {"parameters": 3e9, "train_tokens": 500e9},
}


def model_compute(plan, served_tokens):
    if served_tokens < 0 or min(plan["parameters"], plan["train_tokens"]) <= 0:
        raise ValueError("Invalid token or parameter count")
    return 6 * plan["parameters"] * plan["train_tokens"] + 2 * plan["parameters"] * served_tokens


extra_training = model_compute(plans["B"], 0) - model_compute(plans["A"], 0)
saving_per_token = 2 * (plans["A"]["parameters"] - plans["B"]["parameters"])
break_even = extra_training / saving_per_token
print("extra_training_flops", extra_training)
print("saving_flops_per_served_token", saving_per_token)
print("break_even_served_tokens", break_even)
for demand in [1e10, break_even, 1e12]:
    print("demand", demand, {name: model_compute(plan, demand) for name, plan in plans.items()})
assert isclose(break_even, 3.9e11)
assert isclose(model_compute(plans["A"], break_even), model_compute(plans["B"], break_even))
assert model_compute(plans["A"], 1e10) < model_compute(plans["B"], 1e10)
assert model_compute(plans["B"], 1e12) < model_compute(plans["A"], 1e12)
~~~

构造额外训练量 3.12e21 FLOPs，每服务 token 节省 8e9 FLOPs，交叉点约 390B 处理 token。若服务需求、模型寿命、更新频率或质量约束不同，结论可能反转。没有质量可比证据，即使 B 的账单低也不能称它“同质量更优”。

## 6. 实际货币成本需要拆开输入与输出

计入推理的研究指出，仅优化总 FLOPs 不足以代表真实成本，输入与输出的利用率、硬件和量化等条件会影响结果。[2] 工程账本建议至少包含：

| 成本项 | 要核查的条件 |
| --- | --- |
| 训练 | 全流程 GPU 时长、数据处理、调参/失败预算与 checkpoint |
| 输入 / prefill | 输入长度、批处理、缓存命中、硬件利用率 |
| 输出 / decode | 输出长度、并发、带宽、调度与延迟目标 |
| 附加服务 | 检索、工具、验证器、路由、多次采样与人工接管 |
| 生命周期 | 服务需求、流量变化、迭代次数、模型淘汰与运维 |
| 质量 | 同任务、同数据与同约束的独立验证，含重要切片 |

小模型输出更多 token、需要更多重试或工具，可能抵消每 token 的节省。大模型不一定单位任务更贵，小模型也不一定端到端更快；使用 [SLO 账本](/inference/slo-goodput)核对完成率和达标吞吐，而不是按参数数推断收益。

## 7. 不要将训练 token 和推理思考 token 视为可直接兑换

训练影响模型参数与通用行为；额外推理通常针对当前请求增加计算。更多候选还需要选择器或验证器，可能增加错误筛选、时间和工具成本。

本页仅比较声明过的计算模型，不证明训练与推理预算可按固定比例互换。相关背景见 [推理时算力扩展](/inference/test-time-scaling)；做产品决策时用同质量、同需求与同预算对照，不把“多想”自动当作“更强”。

## 8. 面试追问与实践交付

- **6ND 可以直接算训练需要几张卡吗？** 还缺实际有效速率、显存、并行、通信和截止时间等约束。
- **20:1 是不是所有训练的最佳比例？** 不是；目标、系数、数据、架构与服务需求都会影响分配。
- **模型训练更多 token，代表更多独特知识吗？** 不必然，可能是重复数据；需要分别记录独特来源与处理量。
- **小模型长期服务一定省钱吗？** 还要过质量门禁，并计入输出长度、重试、附加调用和生命周期。

**最小交付**：单位明确的预算表、模型计算与墙钟分开、数据/验证条件、需求敏感性和未验证假设。构造算例仅标代数验证；真实训练与服务成本需另测。

## 一手来源与证据范围

资料核对日期：2026-11-04。

1. [Hoffmann 等：Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)：核对训练预算研究目标、模型与 token 协调增长的实验摘要；本页不照搬论文拟合系数。
2. [Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448)：核对计入推理需求的研究目标、6ND/2N 近似与输入/输出成本差异段落。[v2 正文第 6 节](https://arxiv.org/html/2401.00448v2#S6)明确其成本模型仍忽略延迟约束，并假设 MFU 与每 FLOP 成本不随模型规模、配置、序列长度变化；工程选型不能沿用这些简化而不测量。

本页只使用已核对的研究目标与成本段落，不使用未核对的论文拟合参数；损失系数与两份配置均为构造假设，不能当成真实训练结论。继续阅读：[一手资料阅读地图](/advanced/primary-source-reading)。
