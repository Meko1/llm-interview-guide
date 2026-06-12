# 归一化、激活函数与训练稳定性

> 「为什么大模型用 RMSNorm 而不是 LayerNorm」「Pre-Norm 和 Post-Norm 区别」「QK-Norm 是什么」——归一化看似小组件，实际是**训练稳定性**这条暗线的核心，从 2017 年的 Post-Norm 到 2025 年的 QK-Norm，每次演进都对应一次「模型更深更大后训崩了」的实战教训。

## 为什么深层网络离不开归一化

深层网络的激活值和梯度在逐层传播中会**指数级放大或缩小**（每层乘一个增益系数）。归一化把每层输入拉回稳定的数值范围，作用是：

- 防止激活值漂移导致的梯度消失/爆炸；
- 让损失面更平滑，可以用更大的学习率；
- 降低各层之间的耦合，深层堆叠成为可能。

**归一化 + 残差连接**是深层 Transformer 能训起来的两大支柱：残差保证信息和梯度有「直通路径」，归一化保证每层输入数值稳定。

## LayerNorm vs BatchNorm

| 维度 | BatchNorm | LayerNorm |
| --- | --- | --- |
| 归一化方向 | 跨样本（batch 维度统计） | 单样本内（特征维度统计） |
| 依赖 batch 大小 | 是（小 batch 统计不稳） | 否 |
| 训练/推理行为 | 不一致（推理用滑动平均统计量） | 一致 |
| 适合场景 | CNN / 图像 | Transformer / 变长序列 |

**为什么 NLP 用 LayerNorm？** 序列变长、batch 内样本长度参差，跨样本统计噪声大；自回归推理时 batch 组成动态变化，BatchNorm 的统计量根本没法算。LayerNorm 只看单个样本自己的特征维，与 batch 和序列长度彻底解耦。

LayerNorm 公式：

$$y = \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} \cdot \gamma + \beta$$

## RMSNorm：现代主流

LayerNorm 做两件事：减均值（re-centering）+ 除标准差（re-scaling）。**RMSNorm 去掉减均值和偏移 β，只保留均方根缩放**：

$$\text{RMSNorm}(x) = \frac{x}{\sqrt{\frac{1}{d}\sum_i x_i^2 + \epsilon}} \cdot \gamma$$

- 少一次均值计算与一组参数，速度更快；消融研究表明 LayerNorm 起作用的主要是 re-scaling，去掉 re-centering 几乎不掉点。
- LLaMA、Qwen、DeepSeek 等现代模型标配。实现细节（混合精度下先升 float32 再算）见 [手撕代码题解集](/interview/coding-problems)。

## Pre-Norm vs Post-Norm（必考）

Norm 放在残差子层的前还是后：

```
Post-Norm（原始 Transformer 2017）      Pre-Norm（现代主流）
x ──► Sublayer ──► (+x) ──► Norm       x ──► Norm ──► Sublayer ──► (+x)
      梯度必须穿过每层的 Norm                残差路径上无 Norm，梯度可"直通"
```

- **Post-Norm**：归一化作用在残差之后，表达能力强；但反向传播时梯度每层都要过 Norm 的缩放，深层时不稳定，必须配 warmup 小心伺候，层数一多就难训。
- **Pre-Norm**：残差主干上没有任何变换，梯度无衰减直达底层，**深层训练稳定**，是几乎所有现代 LLM 的选择。代价：研究发现 Pre-Norm 深层的增量贡献会被主干上不断增大的激活值「稀释」，存在一定**深度浪费**（等效深度低于名义深度）。

**折中与演进**：

| 方案 | 思路 |
| --- | --- |
| DeepNorm | Post-Norm 基础上放大残差权重，把千层模型训稳 |
| Sandwich-Norm | 子层前后都加 Norm |
| Peri-LN / 双 Norm | 子层输入输出各一个 Norm，兼顾稳定与表达（部分新模型采用） |
| **QK-Norm** | 在注意力内部对 Q、K 单独归一化（见下） |

## QK-Norm：注意力内部的归一化（新考点）

大规模训练中常见崩溃源：**注意力 logits 爆炸**——Q·K 点积数值随训练增大，softmax 饱和成 one-hot，梯度归零甚至 loss spike。

**QK-Norm** 在计算注意力前对 Q、K 各做一次 RMSNorm/LayerNorm，把点积量级锁死在可控范围。Qwen3、Gemma 等新一代模型采用，取代了 Qwen 早期「QKV 加 bias」的经验性做法——体现了「训练稳定性手段从补丁走向原理化」的趋势（关联演进见 [LLaMA 与 Qwen](/models/llama-qwen)，loss spike 全景见 [训练深入](/advanced/training-internals)）。

## 激活函数：从 ReLU 到 SwiGLU

激活函数为网络注入非线性，主要用在 FFN：

- **ReLU**：`max(0, x)`，简单高效，但负区间梯度恒为 0（神经元死亡）。
- **GELU**：按高斯累积分布平滑加权输入，BERT/GPT-2 时代主流。
- **SiLU/Swish**：`x · σ(x)`，平滑、非单调（负区间有小负值），优化性质好。

### GLU 家族与 SwiGLU

**GLU（门控线性单元）** 的思想：两路线性变换，一路过激活当**门**，逐元素调制另一路：

$$\text{GLU 家族}(x) = \text{Act}(xW_g) \otimes xW_u$$

按门的激活函数不同：ReGLU（ReLU 门）、GEGLU（GELU 门）、**SwiGLU（SiLU 门，效果最佳成为标配）**。完整 FFN：

$$\text{FFN}(x) = (\text{SiLU}(xW_g) \otimes xW_u)W_d$$

- 三个矩阵而非两个，为保持参数量不变，中间维度取 **8/3·d** 而非 4d（LLaMA、Qwen 均如此）。
- 门控让网络能**逐元素动态控制信息通过**，表达能力强于固定非线性；SwiGLU 论文作者 Shazeer 戏称效果好得「无法解释，归功于神之眷顾」——面试可以引用这个梗，但要补上「门控+平滑」的正经解释。

## 一张表串起训练稳定性暗线

| 年代 | 痛点 | 解法 |
| --- | --- | --- |
| 2017 | 深层 Post-Norm 训不动 | warmup + 小心调参 |
| 2019-20 | 模型加深，梯度不稳 | **Pre-Norm** 普及 |
| 2020-22 | 计算开销 + 简化 | **RMSNorm** 替代 LayerNorm |
| 2022-23 | FFN 效果瓶颈 | **SwiGLU** 替代 GELU |
| 2023-25 | 注意力 logits 爆炸 / loss spike | **QK-Norm**、logits 软上限等 |

## 高频追问

**Q：RMSNorm 相比 LayerNorm 省在哪？为什么还能 work？**
省掉「减均值」的计算和偏移参数 β。消融表明 LayerNorm 的收益主要来自 re-scaling（控制数值量级）而非 re-centering，所以只留缩放几乎无损，反而更快、参数更少。

**Q：为什么现代模型从 Post-Norm 转向 Pre-Norm？**
深度扩展的需要。Post-Norm 下梯度每层都被 Norm 重新缩放，层数一深就不稳、必须依赖 warmup；Pre-Norm 让残差主干保持「恒等直通」，梯度无衰减回传，几十上百层也能稳定训练——稳定性换一点表达力，规模时代这笔账划算。

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
