---
title: 归一化、激活函数与训练稳定性
description: >-
  按统计维度、残差路径和注意力分数尺度理解 LayerNorm、RMSNorm、Pre/Post-Norm 与 QK-Norm，复算门控 FFN 参数预算。
level: L1
roles:
  - 在校生
  - 算法研究
  - 应用开发
classification: inferred
---
# 归一化、激活函数与训练稳定性

> 前置是向量、均值/方差和残差连接。本页围绕三个问题：在哪些维度统计、归一化放在什么路径、它控制哪一种数值尺度。QK 归一化并非 2025 年才出现，也不能把模型采用某组件解释成已证实的训练崩溃史。

## 为什么深层网络离不开归一化

深层网络的激活值和梯度在逐层传播中会**指数级放大或缩小**（每层乘一个增益系数）。归一化把每层输入拉回稳定的数值范围，作用是：

- 防止激活值漂移导致的梯度消失/爆炸；
- 让损失面更平滑，可以用更大的学习率；
- 降低各层之间的耦合，深层堆叠成为可能。

归一化与残差是常用的稳定性设计，但不担保训练不崩。残差提供恒等分支，归一化约束局部尺度；学习率、初始化、低精度计算、数据与分布式同步仍会影响结果。

## LayerNorm vs BatchNorm

| 维度 | BatchNorm | LayerNorm |
| --- | --- | --- |
| 归一化方向 | 跨样本（batch 维度统计） | 单样本内（特征维度统计） |
| 依赖 batch 大小 | 是（小 batch 统计不稳） | 否 |
| 训练/推理行为 | 不一致（推理用滑动平均统计量） | 一致 |
| 适合场景 | CNN / 图像 | Transformer / 变长序列 |

**为什么常用 LayerNorm？** 对 `[B,T,D]` 输入，典型 LLM 逐 token 沿 D 统计，不混入其他样本或位置。这便于变长序列和动态 batch。BatchNorm 不是「根本不能推理」：默认推理可用运行统计，但其归纳偏置和训练/推理统计不如逐 token Norm 自然。LayerNorm 的实际统计轴由 `normalized_shape` 决定，不能只凭名字判断。

LayerNorm 公式：

$$y = \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} \cdot \gamma + \beta$$

## RMSNorm：现代主流

LayerNorm 做两件事：减均值（re-centering）+ 除标准差（re-scaling）。**RMSNorm 去掉减均值和偏移 β，只保留均方根缩放**：

$$\text{RMSNorm}(x) = \frac{x}{\sqrt{\frac{1}{d}\sum_i x_i^2 + \epsilon}} \cdot \gamma$$

- 减少中心化与偏移计算。[RMSNorm 论文](https://arxiv.org/abs/1910.07467)在指定任务上得到接近 LayerNorm 的表现与运行时间收益，不能外推为任何模型都无损或更快。
- 多个 LLaMA、Qwen、DeepSeek 配置采用 RMSNorm，仍应核对 checkpoint。统计量常升到 FP32，但不能据此把整个模型称为 FP32 计算。

构造辨析：设 `x=[1,1]`、缩放为 1、偏移为 0，LayerNorm 输出 `[0,0]`；RMSNorm 输出接近 `[1,1]`。RMSNorm 不减均值，所以不具备 LayerNorm 对整体平移的同样不变性。极小输入处 epsilon 也会影响缩放，不能当作可忽略常数。

## Pre-Norm vs Post-Norm（必考）

Norm 放在残差子层的前还是后：

```
Post-Norm（原始 Transformer 2017）      Pre-Norm（现代主流）
x ──► Sublayer ──► (+x) ──► Norm       x ──► Norm ──► Sublayer ──► (+x)
      梯度必须穿过每层的 Norm                残差路径上无 Norm，梯度可"直通"
```

- **Post-Norm**：`Norm(x + F(x))`，残差输出还经过 Norm。[Pre/Post-LN 分析](https://arxiv.org/abs/2002.04745)指出特定初始化假设下 Post-LN 输出侧梯度偏大，warmup 有助稳定；不等于所有深层 Post-Norm 都不能训练。
- **Pre-Norm**：`x + F(Norm(x))`，Jacobian 含恒等项，改善传播路径，但其他分支可放大或抵消梯度，不能保证「无衰减」。深层贡献相对主干变小是需测的现象，不应把每个 Pre-Norm 都判为深度浪费。

**折中与演进**：

| 方案 | 思路 |
| --- | --- |
| DeepNorm | Post-Norm 基础上放大残差权重，把千层模型训稳 |
| Sandwich-Norm | 子层前后都加 Norm |
| Peri-LN / 双 Norm | 子层输入输出各一个 Norm，兼顾稳定与表达（部分新模型采用） |
| **QK-Norm** | 在注意力内部对 Q、K 单独归一化（见下） |

## QK-Norm：注意力内部的归一化（新考点）

大规模训练中常见崩溃源：**注意力 logits 爆炸**——Q·K 点积数值随训练增大，softmax 饱和成 one-hot，梯度归零甚至 loss spike。

**QK-Norm** 在点积前归一化 Q/K，降低范数漂移的影响。[2020 年 QKNorm](https://arxiv.org/abs/2010.04245)使用头维 L2 归一化和可学习尺度；现代配置也可采用 RMSNorm 等，不是同一个固定公式。可学习缩放仍会改变分数量级，不能说被「锁死」；采用 QK-Norm 和是否使用 QKV bias 也是两个独立选择。详见 [LLaMA 与 Qwen](/models/llama-qwen)及[训练深入](/advanced/training-internals)。

## 激活函数：从 ReLU 到 SwiGLU

激活函数为网络注入非线性，主要用在 FFN：

- **ReLU**：`max(0, x)`，简单高效，但负区间梯度恒为 0（神经元死亡）。
- **GELU**：按高斯累积分布平滑加权输入，BERT/GPT-2 时代主流。
- **SiLU/Swish**：`x · σ(x)`，平滑、非单调（负区间有小负值），优化性质好。

### GLU 家族与 SwiGLU

**GLU（门控线性单元）** 的思想：两路线性变换，一路过激活当**门**，逐元素调制另一路：

$$\mathrm{GLU}(x)=\mathrm{Act}(xW_g)\odot(xW_u)$$

按门的激活函数不同：ReGLU、GEGLU、SwiGLU；哪一种更好需要比较训练预算和任务。这里 $\odot$ 表示逐元素乘法，不是 Kronecker 积。完整 SwiGLU FFN：

$$\mathrm{FFN}(x)=(\mathrm{SiLU}(xW_g)\odot(xW_u))W_d$$

- 忽略 bias，普通 4d FFN 参数为 $8d^2$，门控 FFN 中间宽度 m 的参数为 $3dm$；等预算得到 $m=8d/3$。实际模型可能采用不同扩张倍数和硬件取整，不是所有 LLaMA/Qwen 都严格相同。
- 门控提供输入相关的逐元素调制。[GLU 变体论文](https://arxiv.org/abs/2002.05202)报告的是特定 seq2seq 实验收益，不以作者玩笑代替因果解释。

## 一张表串起训练稳定性暗线

| 讨论线索（非严格年表） | 痛点 | 解法 |
| --- | --- | --- |
| 2017 | 深层 Post-Norm 训不动 | warmup + 小心调参 |
| 2019-20 | 模型加深，梯度不稳 | **Pre-Norm** 普及 |
| 2020-22 | 计算开销 + 简化 | **RMSNorm** 替代 LayerNorm |
| 2022-23 | FFN 效果瓶颈 | **SwiGLU** 替代 GELU |
| 2020 起的相关研究 | 注意力饱和与分数尺度 | **QK-Norm**、logits 软上限等不同设计 |

## 高频追问

**Q：RMSNorm 相比 LayerNorm 省在哪？为什么还能 work？**
通常省掉中心化和偏移；论文在指定任务上支持其有效性，但实测速度受融合内核、形状与硬件影响，质量也需任务评测。

**Q：为什么现代模型从 Post-Norm 转向 Pre-Norm？**
Pre-Norm 提供更直接的残差路径，并在特定初始化分析与实验中有稳定性优势；但不保证无衰减，也不证明表达力必然更差。选择时同时看初始化、残差缩放、学习率和验证损失。

**Q：Pre-Norm 有什么代价？**
主干激活范数逐层增大，深层子层的输出相对主干越来越小，增量贡献被稀释（「深而不深」）。这是 Sandwich/Peri-LN 等双 Norm 方案以及各种残差缩放技巧出现的动机。

**Q：QK-Norm 解决什么问题？和 softmax 的 √d 缩放重复吗？**
不重复。√d 缩放处理的是「初始化时点积方差随维度增长」的静态问题；QK-Norm 处理的是**训练过程中** Q/K 范数漂移导致的 logits 爆炸（√d 是常数，挡不住权重自己长大）。一个管出生，一个管成长。

**Q：FFN 中间维度为什么是 8/3·d 这种怪数字？**
标准 FFN 两个矩阵参数量为 2×d×4d=8d²；SwiGLU 有三个矩阵，要保持 8d² 总参数，每个矩阵就是 8d²/3，即中间维度 8/3·d。实际实现还会取整到硬件友好的倍数（如 256 的倍数）。

**Q：Norm 里的 ε 有什么讲究？**
防止全零/极小输入除零，通常 1e-5~1e-6。混合精度下过小的 ε 在 FP16 里可能下溢，所以实现上先把输入升 float32 再算统计量——这是 LLaMA 官方实现的细节，手撕时写出来是加分项。

**Q：归一化和残差连接是什么关系？**
互补的两大支柱：残差保证信息/梯度跨层流动（解决「传得到」），归一化保证数值范围稳定（解决「不爆炸」）。现代标准结构 `x + Sublayer(Norm(x))` 就是两者的组合。

这里的「保证」应理解为设计动机，而不是数学或训练验收保证。

<details>
<summary>自测：逐 token LayerNorm 能否代替 padding mask？</summary>

不能。它只归一化该 token 的特征，不决定其他位置能否读这个 token；pad 向量即使被归一化，仍需 attention/loss 的位置有效性处理。排查训练时分别记录激活范数、QK 分数、梯度范数和有效 token 数，避免把所有异常都归因于 Norm。

</details>
