---
title: 前沿对齐技术（2025-2026）
description: 区分优化器、反馈来源与训练配方，核对 GRPO、DAPO、Dr. GRPO 的优势和长度归一化，并设计可比实验。
level: L2
roles:
  - 算法研究
  - 应用开发
classification: inferred
---
# 前沿对齐技术（2025-2026）

## 从 RLHF 到新一代对齐

本页是方法索引，不是截至某年的完整排行榜。先分清三个轴：**如何优化策略、奖励来自哪里、数据是否重新采样**。方法不能排成一条「后一项替代前一项」的进化链；L2 重点是成本和选型，L3 进一步核对优势、裁剪与 loss reduction。

```
优化机制：PPO / GRPO / DAPO / Dr. GRPO；偏好目标：DPO / SimPO
反馈来源：人类、AI、规则/验证器；RLVR 描述可验证奖励
训练配方：SFT、拒绝采样、在线 RL、蒸馏可以组合
```

## GRPO（Group Relative Policy Optimization）

### 核心思想

DeepSeekMath 提出的 GRPO 不训练独立 Critic，以同题组内奖励统计量构造优势。它使用数值奖励的中心化/标准化，**不是只取排名**：

1. 对同一个 prompt 采样一组回复（如 8-16 个）
2. 用奖励模型或规则对每个回复打分
3. 在组内计算相对优势（advantage）：高于均值的为正样本，低于均值的为负样本
4. 用相对优势更新策略

```
传统 PPO:
  策略模型 + Critic 模型 + 奖励模型（3 个模型）
  → 训练复杂，显存占用大

GRPO:
  策略模型 + 奖励模型（2 个模型）
  → 无 Critic，用组内统计量代替
  → 少一个价值估计职责，但组内 rollout、参考评分仍有成本
```

### 数学表达

```
序列奖励 r_i；原始 outcome-supervision 优势：
A_i = (r_i - mean(r_group)) / std(r_group)
ρ_i,t = π_θ(y_i,t | x,y_i,<t) / π_old(y_i,t | x,y_i,<t)
J = mean_i { (1/T_i) sum_t [min(ρ_i,t A_i, clip(ρ_i,t,1-ε,1+ε) A_i)
                           - β D_i,t] }
最小化损失 L = -J；D_i,t 是参考 KL 的采样估计项
```

这里 $T_i$ 仅包括有效生成 token，prompt 和 padding 不计；过程奖励会产生不同的逐 token 优势。`π_old` 用于采样和 PPO 比率，`π_ref` 用于参考约束，不能互换。原始目标对每条序列内部平均、再对组平均，并不等于整个 batch 的 token 平均。

**组内无信号算例**：奖励 `[0,0,1,1]` 的总体均值、标准差为 `0.5、0.5`，对应优势 `[-1,-1,1,1]`；若用样本标准差则数值不同，应记录实现约定。全组都是 1 时方差为零，没有相对优劣信号：实现需稳定化或过滤，增加 epsilon 只是防数值错误，不创造学习信息。

### 应用

- DeepSeek-R1 的核心训练方法
- 特别适合数学/代码等有明确正确性标准的任务
- 可用规则奖励（如代码执行通过率）替代奖励模型

## DAPO（Decoupled Clip and Dynamic Sampling Policy Optimization） {#dapo-distribution-aware-policy-optimization}

### 动机

DAPO 不是 Distribution-Aware，也不是对 DPO 偏好损失加「分布感知」。它是面向在线长推理 RL 的系统与算法工作，论文介绍四项关键设计：

1. **Clip-Higher**：上下裁剪范围解耦，给低概率 token 提升留出空间；不是无限制放大更新。
2. **Dynamic Sampling**：过滤组内全部正确/全部错误等无区分信号的组，继续采样补 batch；额外采样成本必须计入。
3. **Token-Level Policy Gradient Loss**：按有效 token 聚合，使长短回答的权重不同于原始 GRPO 的逐序列平均。
4. **Overlong Reward Shaping**：针对超长和截断处理奖励，避免把未完成推理简单当作普通错误。

### 关键改进

论文配方移除 KL 项，使用规则奖励；不能反写为「自适应 KL」。复现时同时核对裁剪、组过滤、长度阈值与奖励，不只改一个算法名称。过滤后通过率不能当未筛选题目分布的模型准确率。

## RLVR（Reinforcement Learning with Verifiable Rewards）

### 核心理念

对于有**可验证正确性**的任务（数学、代码、逻辑推理），不需要人类标注偏好数据，直接用验证器作为奖励信号：

```
任务类型            奖励信号
数学推理  →  最终答案是否正确（执行验证）
代码生成  →  测试用例是否通过
逻辑推理  →  逻辑检验器验证
开放式翻译 → 相似度/偏好可作代理，但不是完整正确性验证器
```

### 优势

- 无需昂贵的人类偏好标注
- 奖励可以可重复计算，但答案提取、测试覆盖、超时和数值容差都会引入误差
- 可大规模自动化训练
- DeepSeek-R1 报告讨论数学/代码规则奖励；不从产品能力反推未公开训练细节

### 局限

- 正确性只能在验证器覆盖的范围内成立：过拟合公开单元测试、特殊答案格式与超时规则，都可能造成奖励利用。
- 对开放式任务可结合偏好和规则，但必须区分代理分数与事实/安全验收。形式化证明检查也只检验给定形式系统中的命题。

## Dr. GRPO：修正 GRPO 优化偏差 {#dr-grpo-distilled-grpo}

[Understanding R1-Zero-Like Training](https://arxiv.org/html/2503.20783v1)分析原始 GRPO 的长度与难度相关偏差，提出 Dr. GRPO：移除按回答长度归一化及按组标准差缩放，使用不依赖实际回答长度的全局归一化常数。它不是 Distilled GRPO，也不是 DeepSeek-R1-Distill 的训练方法。

**为何分母是算法的一部分**：相同优势的 10-token 与 100-token 回答，逐序列平均分别给每个 token `1/10` 与 `1/100` 的聚合系数；换成全 batch 有效 token 分母后，每个 token 的聚合系数相同，长序列整体权重更大；固定上限常数又是另一个目标。梯度本身和优势符号仍决定更新方向，不可由这个算例断言任何长回答都受益。

DeepSeek-R1-Distill 用教师生成的数据对小模型做监督微调。蒸馏与在线 RL 可以组合，但必须分别记录数据和目标。

## RLAIF（RL from AI Feedback）

用 AI 模型代替人类标注偏好数据：

```
传统 RLHF:  人类标注偏好对 → 训练 RM → PPO
RLAIF:      AI 模型评判偏好 → 训练 RM → PPO（或直接 DPO）
```

- Anthropic Constitutional AI 的核心方法
- 转移部分标注劳动到 AI 评审，但需计入生成、校准与专家复核成本
- 需要确保 AI 评判的质量和一致性

## Constitutional AI

Anthropic 提出的方法，用**宪法原则**指导 AI 自我改进：

1. **候选生成**：从挑战性提示生成回答
2. **自我批评**：模型根据宪法原则评判自己的回复
3. **自我修正**：根据批评修正回复
4. **RLAIF**：用 AI 偏好训练

### 宪法原则示例

- "回答应当有帮助、无害且诚实"
- "避免歧视和偏见"
- "在不确定时表达不确定性"

## SimPO（Simple Preference Optimization）

DPO 的简化变体，去掉了参考模型：
- 使用序列平均对数概率作为隐式奖励
- 长度平均与目标 margin 改变优化几何，能缓解部分长度利用，不保证消除所有长度偏差
- 质量排序依赖底座、偏好数据与评测协议，不把论文内胜率当通用结论

```
DPO:   L = -log σ(β * (log π(y_w)/π_ref(y_w) - log π(y_l)/π_ref(y_l)))
SimPO: L = -log σ(β * (avg_log_π(y_w) - avg_log_π(y_l)) - γ)
```

## 方法对比总结

| 方法 | 是否需要 RM | 是否在线 | 适用场景 | 代表工作 |
|------|------------|---------|---------|---------|
| PPO (RLHF) | 是 | 是 | 通用 | InstructGPT / ChatGPT |
| DPO | 否 | 否（离线） | 通用 | Zephyr / 各开源模型 |
| GRPO | 是/规则 | 是 | 可验证任务 | DeepSeek-R1 |
| DAPO | 原配方规则奖励 | 是 | 长推理 RL | DAPO 系统论文 |
| RLVR | 验证器 | 通常在线 RL | 可验证任务 | DeepSeek-R1 等公开报告 |
| SimPO | 否 | 否 | 通用 | 轻量对齐 |
| RLAIF | AI 评判 | 可选 | 规模化 | Constitutional AI |

## OpenRLHF / veRL 训练框架

### OpenRLHF
- 开源的统一 RLHF 训练框架
- 按具体版本核对算法、采样后端、训练后端与配置，不把项目名称当功能承诺

### veRL
- 字节跳动开源的 RL 训练框架
- 专注高效的在线 RL 训练
- DAPO 论文使用 verl 系统；是否支持某一变体应核对对应版本的优势和损失实现

## 高频面试追问

1. **GRPO 相比 PPO 的核心优势？为什么去掉 Critic？**
   - 少独立价值模型，但仍要组内多次采样；数值标准化不等于排名，方差为零时没有区分信号

2. **DPO 为什么会在分布偏移时退化？**
   - 固定偏好数据可能覆盖不到部署分布；策略偏离参考本身并不使目标失效，要核查标注质量、覆盖和独立评测

3. **RLVR 的适用范围和限制？**
   - 仅适用于有客观验证标准的任务；开放式生成仍需人类偏好

4. **DeepSeek-R1 的训练流程？**
   - 区分 R1-Zero 的直接 RL、R1 的冷启动和多阶段训练，以及用教师生成数据做小模型 SFT；后者不是 Dr. GRPO

5. **Constitutional AI 如何保证 AI 评判质量？**
   - 原则是评审标准，不是质量保证；用专家校准、位置交换和独立风险集检查偏差

6. **SimPO 相比 DPO 省了什么？丢了什么？**
   - 省了参考模型的前向传播（训练更快）；可能在分布偏移严重时不如 DPO 稳定

## 复现时应该交付什么

保留底座、题目分布、采样参数、每题组大小、生成总 token、有效更新 token、超长处理和验证器版本。比较 GRPO / DAPO / Dr. GRPO 时分别消融分母、标准差、裁剪与过滤，并同时报告正确率、长度分布、全对/全错组比例、总采样成本与多次运行波动。没有等预算比较，就不能归因「换优化器后更强」。

<details>
<summary>自测：动态过滤后奖励上涨，是否证明模型变强？</summary>

不一定。训练 batch 的题目分布改变了，且过滤丢弃的采样也有成本。用固定未过滤评测集、相同生成预算比较，同时记录题目难度和长度切片；检查提升是否来自答案提取捷径或测试泄漏。

</details>

## 一手来源与范围

- [DeepSeekMath §4.1](https://arxiv.org/html/2402.03300v3)：原始 GRPO 目标与 outcome/process supervision。
- [DAPO §3](https://arxiv.org/html/2503.14476v1)：四项设计及其在线 RL 系统，而非 DPO 变体。
- [Dr. GRPO](https://arxiv.org/html/2503.20783v1)：长度与标准差归一化分析。
- [SimPO](https://arxiv.org/html/2405.14734v2)：平均 log-prob 和目标 margin。
- [DeepSeek-R1](https://arxiv.org/html/2501.12948v1)：R1-Zero、R1 与蒸馏的不同流程。

本文不声称运行了上述训练，框架版本支持清单和产品未公开细节不作已验证结论。
