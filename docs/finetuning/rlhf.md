---
title: RLHF / DPO 对齐
description: 从偏好数据与目标函数理解 RLHF、PPO、DPO 和 GRPO，掌握奖励代理、评测偏差与上线边界。
level: L2
roles:
  - 算法研究
  - 应用开发
classification: inferred
---
# RLHF / DPO 对齐

> **优化偏好分数，不等于优化事实正确性。** 本页主阅读级别 L2；L1 先看数据与选型，L3 再读目标函数与复算，L4 追问奖励、探索和评测的外推边界。对齐全貌见 [偏好优化](/finetuning/preference-optimization)。

<LessonLab kind="dpo" />

## 一、为什么需要对齐？

预训练主要学习文本分布；SFT 用示范答案训练特定行为；偏好优化利用“在这个条件下更喜欢哪个回答”调整策略。它们可以互补，不代表所有任务都必须走完整 RLHF 链路。

SFT 也可以教会拒答、格式和安全边界，并非只能教“做什么”。偏好优化能表达多个合理回答之间的选择，但标注或奖励存在偏差时，也会学到冗长、谄媚或错误拒答。

RLHF 是利用人类反馈进行强化学习的范畴；经典 InstructGPT 流程是 SFT → 奖励模型 → PPO，不是所有现代对齐方法的固定三阶段。不能把 DPO、AI 反馈、可验证奖励都当成“人类标注 + PPO”的同义词。

## 二、RLHF 经典三阶段

### 阶段 1：SFT

在 prompt 与示范回答上做监督训练，得到适合继续优化的初始策略。记录模板、回答范围、数据来源和 loss mask；格式或数据问题不应留给强化学习修复。

用于约束的参考策略常来自 SFT，但具体方法可以选择不同参考。SFT 的质量不是只看训练 loss，也要看 held-out 任务、正常请求误拒和安全边界。

### 阶段 2：训练奖励模型（Reward Model, RM）

在相同上下文 `x` 下，对 chosen `y_w` 与 rejected `y_l` 学习相对偏好。常用 Bradley–Terry 形式：

```text
P(y_w 优于 y_l | x) = sigmoid(r(x, y_w) − r(x, y_l))
L_RM = −log(sigmoid(r(x, y_w) − r(x, y_l)))
```

这是一个建模选择，不是人类偏好的完整定律。相对比较可能比绝对评分更易标注，但仍受标注者、顺序、长度、领域知识和 rubric 影响，不能保证稳定一致。

同一上下文必须包含比较所需的证据与条件：如果判断引用是否支持结论，就需要提供原材料。不同问题、不同权限或不同知识版本的回答，不宜直接拼成一个偏好对。

### 阶段 3：强化学习优化（通常用 PPO）

经典设置让策略生成回答，由冻结 RM 给出奖励，并用参考策略控制漂移。一个序列层面的理想化目标为：

```text
最大化 J(π) = E_x E_{y~π(.|x)}[r(x, y)]
              − β · E_x[KL(π(.|x) || π_ref(.|x))]
```

实现中常使用采样 token 的 log-prob 比构造 KL 估计，具体归一化、奖励位置和长度处理需要核对实现。不能把一次样本的 log-prob 差直接当成完整分布的精确 KL。

PPO 还使用采样时的旧策略概率做更新比率和裁剪。**旧策略与参考策略不同：** 前者约束一次更新，后者在上述设置中用于长期参考。KL、裁剪和好 RM 只能缓解问题，不保证事实性、安全或无 reward hacking。

## 三、PPO 为什么复杂？

经典基于 RM 的 PPO 链路有四种模型职责：

| 职责 | 用途 | 训练状态 |
| --- | --- | --- |
| 策略 / Actor | 生成候选并学习 | 更新策略参数 |
| 参考 / Ref | 提供参考 log-prob | 通常冻结 |
| 奖励 / RM | 为输出提供代理奖励 | PPO 阶段通常冻结 |
| 价值 / Critic | 估计回报、构造优势 | 学习价值估计 |

这是职责图，不意味着所有实现都常驻四份同尺寸独立模型。有的共享参数、分离采样服务、卸载或缓存；可验证奖励也不一定需要神经 RM。

成本来自 rollout、策略/参考评分、奖励、价值估计、反向、数据同步和长序列。不能由“有四种职责”推导出显存恰好翻倍，或由“去掉 Critic”推导出成本必然减半。

## 四、DPO（Direct Preference Optimization）

DPO 把特定 KL 正则奖励目标与偏好模型联系起来，直接使用偏好对训练策略，无需显式 RM 训练和 PPO rollout 循环。这里讨论原始离线 DPO，不把所有在线扩展混为一谈。

<details>
<summary>L3 推导：参考策略与隐式奖励的关系</summary>

在固定 `x`、`β > 0`、参考分布支持目标回答的条件下，上述理想化目标的最优解满足：

```text
π*(y|x) = π_ref(y|x) · exp(r(x,y)/β) / Z(x)
r(x,y) = β · log(π*(y|x) / π_ref(y|x)) + β · log Z(x)
```

同一 prompt 下两个回答的奖励作差，`log Z(x)` 抵消。代入 Bradley–Terry 偏好模型，得到 DPO 目标。这个关系依赖目标和假设，并不是无条件证明“所有奖励学习都等于监督分类”。

</details>

令：

```text
Δ = [log π_θ(y_w|x) − log π_ref(y_w|x)]
    − [log π_θ(y_l|x) − log π_ref(y_l|x)]
L_DPO = −log(sigmoid(β · Δ))
```

原始损失使用回答序列的条件 log-prob，通常对有效回答 token 求和，排除 prompt 与 padding。长度、EOS、模板和截断会影响结果；不能不加说明地改成 token 平均，再说仍是完全相同的目标。

DPO 增大 chosen 相对 rejected 的参考校正优势，**不保证每次更新都让 chosen 的绝对概率上升、rejected 的绝对概率下降**。共享参数与归一化会影响其他序列。

标准目标需要参考概率，但实现不一定同时加载两份完整模型：固定参考 log-prob 可预计算；PEFT 场景可能共享冻结基座并切换适配器。是否适用要核对配置，不随意把训练中的同一策略当作冻结参考。

### 可复算：一个偏好对的 DPO 损失

下面是构造的 token log-prob，不来自真实模型。代码只验证损失代数，不执行 DPO 训练或 autograd。

```python
import math

chosen_token_logps = [-1.0, -1.0]
rejected_token_logps = [-1.5, -2.5]
ref_chosen_token_logps = [-1.5, -1.5]
ref_rejected_token_logps = [-1.5, -1.5]
beta = 0.1

def dpo_loss(chosen_logp, rejected_logp, ref_chosen_logp, ref_rejected_logp):
    advantage = (chosen_logp - ref_chosen_logp) - (rejected_logp - ref_rejected_logp)
    logit = beta * advantage
    loss = max(-logit, 0.0) + math.log1p(math.exp(-abs(logit)))
    return logit, loss

chosen_logp = sum(chosen_token_logps)
rejected_logp = sum(rejected_token_logps)
ref_chosen_logp = sum(ref_chosen_token_logps)
ref_rejected_logp = sum(ref_rejected_token_logps)
logit, loss = dpo_loss(chosen_logp, rejected_logp, ref_chosen_logp, ref_rejected_logp)
print(f"Logit: {logit:.6f}")
print(f"Loss: {loss:.6f}")
_, initial_loss = dpo_loss(ref_chosen_logp, ref_rejected_logp,
                          ref_chosen_logp, ref_rejected_logp)
print(f"Policy equals reference: {initial_loss:.6f}")
_, shifted_loss = dpo_loss(chosen_logp + 1.0, rejected_logp + 1.0,
                          ref_chosen_logp, ref_rejected_logp)
assert math.isclose(shifted_loss, loss)
print("Shared log-prob shift leaves pair loss unchanged")
```

预期输出：

```text
Logit: 0.200000
Loss: 0.598139
Policy equals reference: 0.693147
Shared log-prob shift leaves pair loss unchanged
```

最后的共同平移仅演示代数不变性，不声称任意模型参数更新都能实现这种平移。beta 是目标中的权衡/尺度参数，不是学习率；调整它仍需评估偏好收益、漂移与回归。

## 五、对齐方法谱系

| 方法或反馈来源 | 主要机制 | 不宜混淆的点 |
| --- | --- | --- |
| PPO | 基于采样轨迹与优势更新策略 | 不限于人类偏好奖励 |
| DPO | 用参考校正的偏好对直接优化 | 标准离线形式不做在线探索 |
| RLAIF | 使用 AI 提供反馈 | 描述反馈来源，不指定唯一优化器 |
| Constitutional AI | 以原则指导批评修订及 AI 反馈 | 原论文包含监督与 RL 阶段 |
| KTO | 利用可取/不可取反馈建模 | 仍需条件、质量与数据分布治理 |
| ORPO | 结合监督与偏好目标，无独立参考模型 | 不等于原始 DPO 去掉一个参数 |
| GRPO | 用同题组内相对奖励估计优势 | 算法机制，不是奖励来源 |
| RLVR | 使用可验证奖励 | 验证器也可能不完整或被利用 |
| 拒绝采样微调 | 生成、筛选、再监督训练 | 不等于 PPO 轨迹优化 |

GRPO 与 RLVR 经常组合，但不等价。GRPO 可以使用不同奖励；可验证奖励也可以用于其他 RL 算法。相关专题见 [推理模型](/advanced/reasoning-models) 与 [DeepSeek](/models/deepseek)。

## 六、PPO vs DPO vs GRPO 对比

| 维度 | 经典 RM + PPO | 标准离线 DPO | GRPO |
| --- | --- | --- | --- |
| 训练数据来源 | 策略生成 rollout + 奖励 | 固定 chosen/rejected 偏好对 | 每个问题采样一组回答 |
| 显式奖励模型 | 经典流程使用 | 不需要训练显式 RM | 可用 RM 或规则奖励 |
| 价值估计 | 通常有 Critic | 无 rollout 价值估计 | 组内相对基线，无独立 Critic |
| 参考信息 | 经典流程用于 KL | 目标需要参考 log-prob | 原始形式包含参考约束 |
| 成本关键 | 多阶段评分、采样与更新 | 序列评分、反向、参考处理 | 组内多次采样与评分 |
| 核心限制 | 奖励质量、探索与稳定性 | 数据覆盖、偏差与参考设定 | 组大小、奖励区分度与验证器 |

GRPO 不训练独立 Critic，仍可能被长 rollout 与组内多次采样主导。若同组奖励没有区分度，组内相对优势信号可能很弱；需检查任务难度、采样与奖励，不只增加训练步数。

## 七、工程坑：reward hacking 与对齐税

| 症状 | 应核查什么 | 为什么“分数更高”不够 |
| --- | --- | --- |
| 回答更长、更礼貌但更空 | 长度偏差、标注 rubric、Judge 位置偏差 | 偏好模型可能奖励风格而非解决问题 |
| RM 分数升，人工质量降 | 过度优化、分布漂移、独立评测 | 奖励是代理，不是真实效用 |
| 拒答率升 | 危险请求与正常请求分别统计 | 安全拒答与误拒不能混成一个指标 |
| 引用格式更好，事实仍错 | 原材料、引用支持与证据范围 | 形式对齐不保证事实正确 |
| 数学或代码回归 | 通用 held-out 任务与数据混合 | 对齐收益可能伴随能力损失 |

KL 与更好的偏好数据可以缓解风险，但不能独自证明安全。DPO 没有显式 RM，也可能过拟合偏好噪声与长度捷径；不应说“DPO 不会 reward hacking”。

“对齐税”指某些能力的回归现象，不是每个对齐模型必然下降；事实错误也不能全部归因为 RLHF。用独立样本与变更前后对照定位。

## 八、面试专项：RLHF/DPO 项目怎么讲

### 偏好数据流水线

```text
授权收集问题与材料 → 候选生成 → 同上下文偏好标注
→ 分歧与证据核查 → 来源/时间去重划分 → 训练
→ 独立任务、安全与偏好评测 → 小流量验证 → 失败回流
```

记录问题、上下文、候选模型、模板、来源、标注者、rubric、平局/分歧与知识版本。不要把“更长”或“有引用”直接当 chosen，也不要未经核实用强模型判断事实性。

划分时避免同一问题改写或同文档多版本跨 train/test 泄漏；固定验收集不用于反复挑选超参数。敏感日志需合法授权、脱敏与保留期。

### 方法选型

| 已知约束 | 可以先评估 | 需要的证据 |
| --- | --- | --- |
| 仅需格式或拒答示范 | Prompt / SFT | 示范质量与 held-out 行为 |
| 有可靠偏好对，资源受限 | DPO | 偏好覆盖、参考配置和回归 |
| 有在线奖励，需要继续探索 | PPO 或适合任务的 RL | 奖励鲁棒性、采样预算与稳定性 |
| 可采样同题组且有区分奖励 | GRPO | 组内奖励分布、完整成本与验证器 |
| 只有单点反馈 | 先治理反馈，再评估 KTO 等 | 上下文、选择偏差和标签含义 |

不是“数学题一定 GRPO”“安全任务一定 PPO”。先判断信号是否可靠、已有基线是否足够，再选择训练机制。

### 评估怎么做

报告偏好胜率的样本、对手、模型设置、平局处理、评审和顺序随机化；不把一个 Judge 的偏好当作客观准确率。对相同问题交换候选位置，抽查长度偏差与评审分歧。

门禁分别看任务正确性、引用支持、格式、危险请求拒答、正常请求误拒、通用能力与成本。若同一个模型生成偏好又负责全部验收，就缺少独立的评估视角。

### 面试可复述版本

只描述真实做过的内容：任务与基线 → 为什么示范不足 → 偏好数据如何标注和划分 → 方法与参考设定 → 一个失败 → 独立评测与代价。未做训练可明确说是公式复算或方案设计，不套用“我们线上提升了多少”的话术。

<details>
<summary>L3 / L4 追问：在线方法一定比离线方法上限高吗？</summary>

在线采样提供探索机会，也带来奖励利用、采样与稳定性成本。比较时控制初始模型、数据、总 token/算力预算、奖励与评审，并报告多次运行的不确定性。没有这些条件，不能从“在线/离线”直接推导统一效果排序。

</details>

## 九、高频追问

以下为模拟追问，不声明企业真题出处。

**为什么 DPO 不显式训练 RM？** 特定 KL 正则目标下，最优策略与参考的 log-prob 比可表达奖励，同 prompt 奖励差消去归一化项，得到偏好分类式目标。

**PPO 的旧策略就是参考模型吗？** 不是。旧策略用于采样与更新比率；参考在经典对齐目标中用于约束偏离。

**DPO 必须加载两份完整模型吗？** 必须有正确的参考概率，但可按实现预计算或共享冻结基座，不能仅按“两个角色”估显存。

**chosen/rejected 能跨 prompt 配对吗？** 标准目标要求相同条件；上下文、证据和任务不同会破坏比较的含义。

**GRPO 就是 RLVR 吗？** 前者是组内相对策略优化机制，后者是奖励来源；可以组合但不是同义词。

**奖励变高但用户更不满意怎么办？** 查奖励捷径、分布变化、独立评测、误拒与长度偏差，不继续盲目加训练步数。

## 一手参考与验证边界

- [Ouyang 等：InstructGPT（2022）](https://arxiv.org/abs/2203.02155)：经典示范、偏好与 RL 链路，结果受其任务分布约束。
- [Rafailov 等：DPO（2023）](https://arxiv.org/abs/2305.18290)：KL 正则目标、隐式奖励与偏好损失推导。
- [Shao 等：DeepSeekMath（2024）](https://arxiv.org/abs/2402.03300)：GRPO 的组内相对优化与原始实验。
- [Bai 等：Constitutional AI（2022）](https://arxiv.org/abs/2212.08073)：监督自我修订与 AI 反馈 RL。
- [Hugging Face TRL：DPO Trainer 文档快照](https://github.com/huggingface/trl/blob/b40abd828000255d723fd2bb2e1984266e55865f/docs/source/dpo_trainer.md)：参考概率、PEFT 与预计算的实现条件；链接固定到本轮核对的提交，实际配置仍需按使用版本验证。

本页代码只复算构造样例的损失，不声称运行了 PPO、DPO 或 GRPO 训练，也不保证偏好优化后的业务收益。
