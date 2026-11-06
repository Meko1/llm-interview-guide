---
title: 强化学习基础（面向 LLM）
description: >-
  从有限时域策略梯度推导 baseline、GAE 与 PPO clip，复算组内优势；区分旧策略、参考策略、反馈来源和 GRPO 的采样资源边界。
level: L3
roles:
  - 算法研究
  - Infra
classification: inferred
---
# 强化学习基础（面向 LLM）

先分清四件事：**优化的回报、数据来自谁、优势怎样估计、更新如何约束**。PPO/GRPO 是优化方法，RLHF/RLVR 是反馈来源，DPO 是基于偏好与正则化最优策略关系的目标；它们不全是同一个维度的算法名。

## 一、把 LLM 生成对应到强化学习

有限回答可以视为有限时域决策问题：

| 概念 | 纯文本生成 | 工具交互的扩展 |
| --- | --- | --- |
| 状态 | prompt + 已生成前缀 | 观测历史；真实环境状态未必完全可见 |
| 动作 | 策略采样的 token | 工具调用由生成 token 表达，执行后获得观测 |
| 转移 | 拼接 token，可确定 | 工具/用户/外部系统可能随机或变化 |
| 奖励 | 终局分数，可加逐 token KL | 终局成功、过程反馈、违规/成本项 |
| 终止 | EOS、长度/时间上限 | 环境成功/失败或预算耗尽 |

只有纯文本拼接场景才能说转移确定；[Agentic RL](/advanced/agentic-rl) 需另外处理工具观测，不把环境提供的 token 当策略动作。终局奖励稀疏并不意味着必须有 critic，REINFORCE 也能训练，只是方差通常更难控制。

有限时域可取 $\gamma=1$，避免早期动作被人为折扣；这是一种目标选择，不是所有 LLM 任务的规则。若要控制长响应成本，应明确长度/资源惩罚，而不是悄悄改变回报口径。

## 二、两大流派：基于价值 vs 基于策略

| 方法族 | 学什么 | LLM 中的取舍 |
| --- | --- | --- |
| Value-based | $Q(s,a)$ 与动作选择 | 巨大动作空间和长序列使直接优化有挑战，不是数学上不能用 |
| Policy-based | $\pi_\theta(a\mid s)$ | 自回归模型天然输出策略概率 |
| Actor-Critic | 策略 + 价值估计 | 减方差但增加估计误差和训练资源 |

比较时要问价值网络是否共享骨干、是否另占设备、rollout 是否主导开销，不由名字推算显存比例。

## 三、策略梯度：从 REINFORCE 到优势函数

### 策略梯度定理

以下推导用有限时域、$\gamma=1$、环境与奖励不显式依赖 $\theta$ 的设定：

$$p_\theta(\tau)=p(s_0)\prod_t\pi_\theta(a_t\mid s_t)P(s_{t+1}\mid s_t,a_t),$$
$$\nabla J=\sum_\tau R(\tau)\nabla p_\theta(\tau)
=\mathbb E\left[R(\tau)\sum_t\nabla\log\pi_\theta(a_t\mid s_t)\right].$$

动作无法影响此前奖励，因此可用未来回报 $G_t=\sum_{u\ge t}r_u$ 替换整轨迹回报。这是 likelihood-ratio 估计，不需要对离散采样动作求导。若回报包含可微参数化正则项，须另说明直接梯度或 surrogate 的处理，不能把上述固定奖励推导照搬。

### 问题：方差太大

状态 baseline 在策略梯度权重中视为固定（stop-gradient），且不能依赖所采样动作：

$$\mathbb E_{a\sim\pi}[b(s)\nabla\log\pi(a\mid s)]
=b(s)\sum_a\nabla\pi(a\mid s)=0.$$

baseline 不改变期望不等于任意 baseline 都降低方差；估计质量、尺度和相关性重要。$A(s,a)=Q(s,a)-V(s)$ 表示相对状态平均的收益。

构造一状态、两动作，令 $\pi(A)=p=\sigma(\theta)$，$R(A)=1,R(B)=0$，在 $p=0.5$ 处：$\partial_\theta\log\pi(A)=0.5$、$\partial_\theta\log\pi(B)=-0.5$。无 baseline 的梯度样本是 0.5 或 0，均值 0.25；减 $b=0.5$ 后两个梯度样本均为 0.25，期望不变且本例方差为零。**单条奖励为正不意味着比 baseline 好**。

GAE 用 TD 残差折中偏差/方差：

$$\delta_t=r_t+\gamma(1-d_t)V(s_{t+1})-V(s_t),\qquad
\hat A_t=\delta_t+\gamma\lambda(1-d_t)\hat A_{t+1}.$$

$d_t$ 表示该步真正终止，$\lambda$ 控制传播。终止和仅被时间上限截断是否 bootstrap，需要按任务约定，错 mask 会把下一段价值污染本段回报。

## 四、PPO：让策略更新不要太猛

### 动机

[PPO 原论文](https://arxiv.org/abs/1707.06347) 使用交互采样和 surrogate 多轮 minibatch 更新。令旧策略采样 token 的概率已保存：

$$r_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}{\pi_{old}(a_t\mid s_t)},$$
$$L^{clip}=\mathbb E_t\min\big[r_t\hat A_t,\mathrm{clip}(r_t,1-\epsilon,1+\epsilon)\hat A_t\big].$$

优势和旧 log-prob 固定，最大化此目标；代码最小化时取负号。ratio 修正该状态上的动作分布，并不完整修正长序列的状态访问分布，PPO 仍是近同策略更新，不是可任意复用陈旧数据的无偏算法。

| 构造：$\epsilon=0.2$ | 未裁剪项 | 裁剪项 | 取 min |
| --- | ---: | ---: | ---: |
| $\hat A=2,r=1.5$ | 3 | 2.4 | 2.4 |
| $\hat A=-2,r=0.5$ | -1 | -1.6 | -1.6 |
| $\hat A=-2,r=1.5$ | -3 | -2.4 | -3 |

clip 在有利方向过度变化时让该项饱和，但**不是把所有概率更新硬夹在区间，也不保证全局 KL 上界**。其他样本/参数共享仍可改变该动作概率。需监控实际 KL、clip fraction、熵与回报。

### PPO 在 RLHF 中的完整形态

一种常见目标为：

$$J=\mathbb E_{y\sim\pi_\theta}[R(x,y)]-\beta\,D_{KL}(\pi_\theta(\cdot\mid x)\|\pi_{ref}(\cdot\mid x)).$$

旧策略 $\pi_{old}$ 是当前 rollout 快照；参考策略 $\pi_{ref}$ 是正则化参照，可能固定或按训练设计刷新。KL 估计还要分清逐 token、序列、求和或平均，单样本 log-ratio 可以为负，期望 KL 才非负。

Actor 更新策略，critic 估计价值；RM 可被规则 verifier 替代；reference 可使用共享/卸载等实现。所谓“四个模型”是逻辑角色示例，不是四份等大权重的硬性规定。KL 能约束偏移，但不修复奖励漏洞、不保证安全。

## 五、GRPO：用"组内对比"干掉 Critic

[DeepSeekMath 第 4.1 节](https://arxiv.org/html/2402.03300v3) 从同问题的组内奖励估计优势，无需单独 critic。终局监督常写为：

$$\hat A_i=\frac{r_i-\bar r}{\mathrm{std}(\mathbf r)+\varepsilon},$$

并广播到该回答的 token；原论文还讨论过程监督，不应把 GRPO 定义成只能接终局奖励。

构造组奖励 $(0,0,1,1)$，使用**总体**标准差为 0.5，得到 $(-1,-1,1,1)$；若框架用样本标准差，幅度不同，必须记录 `correction/ddof`。全 1 组的 std 为零，安全处理后奖励优势为零，**KL/其他 loss 仍可能有梯度**，不能说整个训练完全没有更新。

GRPO 以多样本生成换基线估计，省去 critic 未必省总算力；组大小、长响应、rollout 并发与权重管理决定总账。程序奖励也有解析漏洞、测试覆盖不足和噪声，不是“可验证所以无噪声”。

## 六、高频概念辨析

- **on-policy/off-policy**：看行为策略与目标策略关系，以及算法是否支持这种偏差；PPO 的少量旧数据更新不等于一般 off-policy。
- **DPO 与 RL**：常见 DPO 在离线偏好对上直接优化分类目标，避免 PPO 式在线 rollout；数据也可由外部循环刷新，不能说永远无法获得新回答。
- **探索**：温度和组大小影响候选多样性，也影响采样策略与训练 log-prob 的一致性。top-p/截断后概率口径必须明确。
- **reward hacking**：优化代理而不是真实目标。应保留独立隐藏测试、安全失败集与人工抽检，不由奖励上升自证正确。

## 七、GRPO 变体家族（2025 RL 前沿）

保留旧标题作为索引，不作“当前最前沿”排名。详细已核机制见 [对齐算法谱系](/finetuning/frontier-alignment)。

| 名称 | 应追问的机制 | 勿混淆 |
| --- | --- | --- |
| DAPO | 非对称 clip、有效组采样、token 分母、超长奖励整形 | token 分母不等于步骤级奖励 |
| Dr.GRPO | 长度分母与奖励 std 缩放的偏差 | 不是“标准化 per-token 优势” |
| VAPO | 价值辅助优势及对应训练设计 | 不是无 critic 的同义词 |
| GSPO | 序列级重要性比率的定义 | 不是随便把逐 token ratio 平均 |

这些变体的全文与框架版本本页未逐一重核；表是复查问题，不是性能比较。verl、TRL、OpenRLHF、Open-R1 等仅为实现入口，复现需固定提交、采样参数和 loss 口径。

## 高频追问

**baseline 能对动作求梯度吗？** 在该策略梯度估计器中 baseline/优势应 stop-gradient；训练 critic 用另一项 loss。否则新增梯度不再由零期望论证覆盖。

**clip 和 KL 重复吗？** 参照与目的不同，但二者都不是质量保证。前者优化 surrogate 的局部稳定，后者约束相对 reference 的偏移。

**GRPO 的平均回报上涨为什么不代表推理变好？** 可能数据过滤更容易、长度偏好、解析器被利用或测试泄漏。固定验证题、总采样预算和独立 verifier 后再比较。

<details>
<summary>自测：所有组都全对，GRPO 必然什么都不更新吗？</summary>

奖励优势为零不等于总梯度为零：KL、熵或其他辅助项仍可能更新。还应检查 std 零值处理是否产生 NaN；动态采样会继续生成并增加成本。

</details>

证据范围：实际读取 PPO/GAE 摘要和 DeepSeekMath v3 的 PPO、终局/过程监督、GRPO 附录公式摘录。本文推导与算例是教学构造，未运行策略训练；变体索引未全部重核。
