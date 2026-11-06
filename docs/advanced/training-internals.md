---
title: 训练深入：优化器、混合精度与稳定性
description: >-
  「Adam 和 AdamW 有什么区别？」「为什么要做学习率 warmup？」「训练 loss
  突然飙升怎么办？」这些是算法岗深挖训练细节的高频题。本文补齐大模型训练的工程内功。分布式并行见 分布式训练。
level: L3
roles:
  - 算法研究
  - Infra
classification: inferred
---
# 训练深入：优化器、混合精度与稳定性

训练稳定性不是一张超参数配方。应把**数据、loss 分母、数值路径、更新和恢复状态**串起来：同一个 loss spike 可以来自难样本，也可以来自溢出、恢复错误或分布式归一化。并行背景见 [分布式训练](/pretraining/distributed-training)。

## 优化器：从 SGD 到 AdamW

SGD 按梯度更新；Momentum 平滑方向；AdaGrad 累积平方梯度调节尺度；RMSProp 用移动平均；Adam 同时估计一阶与**未中心化二阶矩**，$v$ 不是严格的梯度方差。它们没有普遍的收敛速度排名。

令 $g_t$ 为 loss 梯度，Adam 的状态为：

$$m_t=\beta_1m_{t-1}+(1-\beta_1)g_t,\quad
v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2,$$
$$\hat m_t=m_t/(1-\beta_1^t),\qquad\hat v_t=v_t/(1-\beta_2^t).$$

bias correction 补偿零初始化，不保证初期尺度估计一定稳健。epsilon 的位置、fused 实现和状态 dtype 都应绑定框架版本。

### Adam vs AdamW（高频）

[解耦权重衰减论文](https://arxiv.org/abs/1711.05101) 区分：L2 正则梯度 $g+\lambda\theta$ 会进入自适应矩；AdamW 将衰减与该矩更新分开：

$$\theta_t=(1-\eta_t\lambda)\theta_{t-1}
-\eta_t\frac{\hat m_t}{\sqrt{\hat v_t}+\epsilon}.$$

普通 SGD 在合适系数约定下两者等价，自适应缩放下通常不等价。不能因此说 AdamW 正则化“绝对正确”或所有任务泛化更好；论文实验证据有自己的任务范围。

构造 $\theta=2,\eta=0.01,\lambda=0.1$，自适应更新项为 0.3，则新参数 $2(1-0.001)-0.003=1.995$。衰减量随学习率变，冻结参数、bias/norm 是否进入 decay 组由配置决定。

两个 FP32 矩状态载荷是 $8P$ 字节；构造 $P=10^9$，为 8 GB（约 7.45 GiB），不包括参数、梯度、master weight、激活和工作区。ZeRO、分片、量化状态或 CPU 卸载会改变设备载荷，不能按“参数两倍”直接估算总显存。

## 学习率调度（LR Schedule）

```
学习率
  │        ╱‾‾‾‾‾╲___
  │      ╱           ╲___
  │    ╱   (cosine 余弦衰减)  ╲___
  │  ╱                            ╲
  └─┴────────────────────────────────▶ 训练步数
   warmup      平滑下降
```

保留直觉图，不把曲线当统一最佳方案。Warmup 限制初期更新尺度，适用于从头训练也可能适用于继续训练；“参数随机”不是唯一动机。衰减与总预算、batch 和数据分布共同选择。

线性 warmup + cosine 的构造实现可用：$t<w$ 时 $\eta_t=\eta_{max}t/w$；之后令 $u=(t-w)/(T-w)$，$\eta_t=\eta_{min}+\frac12(\eta_{max}-\eta_{min})(1+\cos\pi u)$。$t=w$ 连续接峰值，$t=T$ 到最小值。明确 $t$ 是**成功优化器更新次数**还是处理的 token；梯度累积、跳过溢出 step 和恢复 checkpoint 时口径必须一致。

## 混合精度训练

| 格式/机制 | 动机 | 不能保证的事 |
| --- | --- | --- |
| FP16 | 低存储和计算开销；指数范围较窄 | 仅靠放大 loss 就能修复前向溢出 |
| BF16 | 指数范围接近 FP32，常无需梯度缩放 | 不会 Inf/NaN；尾数精度与 FP32 相同 |
| autocast | 按算子选 dtype | 所有张量自动变低精度、所有 optimizer 状态变 FP32 |
| FP8 | 更低精度的特定算子路径 | 任意设备/算子可直接切换且不损质量 |

FP16 的 loss scaling 主要处理小梯度下溢；如果前向已产生 Inf、标签非法或 softmax 不稳定，放大并不能补救。BF16 也需要稳定归一化/归约。设备支持以实际运行环境和算子覆盖为准，不从 GPU 名字承诺速度。

[PyTorch v2.5.1 AMP 示例](https://github.com/pytorch/pytorch/blob/v2.5.1/docs/source/notes/amp_examples.rst) 明确：同一个有效 batch 内保持 scale 不变、累计完成后再 unscale，且一次 optimizer step 前只 unscale 一次。顺序应是：

**清梯度 → 各 microbatch forward/scaled backward → 累积完成 → unscale → 检查/裁剪 → scaler.step → scaler.update → 按约定推进 scheduler。**

这是阅读旧版本文档得到的语义参照，不是本仓库已运行的训练脚本；新版本 API/分布式策略需再核对。

## 梯度处理技巧

- **累积的分母**：若每个 microbatch 的有效 token 数不同，不能平均各自 mean loss 后就认为等于全局 token mean。
- **裁剪的时机**：先 unscale，完成累积/同步后再按全局范数裁剪；分片参数要使用框架支持的跨分片范数。
- **重计算**：用额外计算换激活存储；随机数状态、dropout 和副作用要与重算协议一致。

构造两批分别有 2、6 个有效 token，loss 总和为 4、6。全局 token mean 为 $(4+6)/(2+6)=1.25$；两个 batch mean 的平均为 $(2+1)/2=1.5$。若目标是 token mean，应按有效 token 权重累计并核查 DDP 的平均语义，不混入 padding/无监督 token。

梯度 $(3,4)$ 范数为 5，阈值 2 时变为 $(1.2,1.6)$。但 Adam 还有历史矩和权重衰减，**梯度范数受限不代表参数更新范数严格受限**。

## 训练稳定性：Loss Spike 怎么办？

不要先自动跳数据。先保存出错前后的数据 ID、有效 token、rank、loss/logits 范围、梯度范数、学习率、scale、step 是否跳过、吞吐与显存，然后做可回放对照。

| 观测 | 分辨实验 | 再决定 |
| --- | --- | --- |
| 仅某批出现 spike，数值有限 | 原批 FP32/小学习率重跑，检查标签与 mask | 修正数据或承认是困难样本 |
| forward 已 NaN/Inf | 定位首个非有限算子，检查输入/归一化 | 修数值路径；不是只调 scaler |
| backward 非有限、forward 有限 | 比较 dtype、scale 与梯度范围 | unscale/溢出策略和计算稳定性 |
| 多 rank 指标突变 | 查有效 token 分母、同步与全局 norm | 修并行归约/采样 |
| 只在恢复后异常 | 对比 optimizer/scheduler/scaler/RNG/数据游标 | 修恢复完整性 |

z-loss 等正则项要说明施加于哪种 logits 和目标，不能作为所有异常的通用补丁。重启必须恢复参数、优化器矩、scheduler、scaler、随机数与数据进度；只加载权重会改变训练轨迹。跳过样本还会改变数据分布，需记录原因与影响。

## 高频追问

**累积等于大 batch 吗？** 在目标归一化、参数不提前更新、同步和随机机制等条件匹配下可对齐；数值归约次序、token 分母和跨样本层会造成差异，LayerNorm 不自动消除所有差异。

**warmup 越长越稳吗？** 不保证。它改变有效训练预算和学习率轨迹，应比较固定 token/计算预算的质量与稳定性。

**BF16 还有溢出吗？** 有，范围有限，非法数值也会传播；不使用 loss scaling 不等于不需要数值检查。

<details>
<summary>自测：为什么对 scaled gradient 直接裁剪可能错？</summary>

scale 为 1024 时，真实梯度范数 1 变为 1024，直接按阈值 2 裁剪再 unscale，会把真实范数变到约 0.00195。应先累计完成并 unscale，再按真实范数裁剪。

</details>

证据范围：已读 AdamW 原论文摘要、PyTorch AdamW 公式/解耦标志与 v2.5.1 AMP 的裁剪/累积完整段落。主分支 AMP 源文件 404、在线 stable 文档 403，均未重试或绕过；未运行训练/GPU检查，构造数值只用于理解口径。
