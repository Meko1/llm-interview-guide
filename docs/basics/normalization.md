# 归一化与激活函数

> 「为什么大模型用 RMSNorm 而不是 LayerNorm」「Pre-Norm 和 Post-Norm 区别」「SwiGLU 是什么」——这些是 Transformer 组件层面的高频细节题，能体现对现代架构的理解深度。

## 归一化（Normalization）

归一化通过把激活值拉回稳定的分布范围，缓解梯度消失/爆炸，让深层网络能稳定训练。

### LayerNorm vs BatchNorm

| 维度 | BatchNorm | LayerNorm |
| --- | --- | --- |
| 归一化方向 | 跨样本（batch 维） | 单样本内（特征维） |
| 对 batch 大小敏感 | 是（小 batch 不稳定） | 否 |
| 适合场景 | CNN / 图像 | Transformer / 变长序列 |

**为什么 NLP/Transformer 用 LayerNorm 不用 BatchNorm？** 序列长度可变、batch 内样本长度不齐，且自回归推理时 batch 统计不稳定；LayerNorm 在单个样本内部归一化，与 batch 和序列长度无关，更稳定。

### RMSNorm（现代主流）

LayerNorm 做两件事：减均值（center）+ 除标准差（scale），还有可学习的缩放 γ 和偏移 β。

**RMSNorm 去掉了「减均值」和偏移 β，只用均方根（RMS）做缩放**：

$$\text{RMSNorm}(x) = \frac{x}{\sqrt{\frac{1}{n}\sum_i x_i^2 + \epsilon}} \cdot \gamma$$

- 计算更省（少了求均值的步骤），实验证明效果与 LayerNorm 相当甚至更好。
- LLaMA、Qwen、DeepSeek 等现代模型基本都用 RMSNorm。

### Pre-Norm vs Post-Norm（高频）

指 LayerNorm 放在残差子层的**前**还是**后**：

- **Post-Norm**（原始 Transformer）：`x = Norm(x + Sublayer(x))`。表达能力强，但深层时梯度不稳定、难训练，往往需要 warmup。
- **Pre-Norm**（现代主流）：`x = x + Sublayer(Norm(x))`。梯度能通过残差「直通」，**训练更稳定、可堆更深**，代价是表达能力略弱。
- 折中方案：**DeepNorm**（放大残差，支持上千层）、**Sandwich-Norm**（前后都加）。

> 一句话记忆：**Pre-Norm 稳、好训深；Post-Norm 强、难训深。现代大模型几乎都用 Pre-Norm + RMSNorm。**

## 激活函数（Activation）

激活函数为网络注入非线性，主要用在 FFN 里。

- **ReLU**：`max(0, x)`，简单但「死亡神经元」问题（负区间梯度为 0）。
- **GELU**：用高斯累积分布做平滑门控，BERT/GPT-2 常用，比 ReLU 平滑。
- **Swish/SiLU**：`x · sigmoid(x)`，平滑且非单调。

### GLU 系列与 SwiGLU（现代主流）

**GLU（门控线性单元）** 引入一个「门」来控制信息流：用一路输出去逐元素调制另一路。

**SwiGLU** = 用 Swish 作为门的 GLU，是现代 LLM（LLaMA、Qwen、PaLM）FFN 的标配：

$$\text{SwiGLU}(x) = (\text{Swish}(xW_1)) \otimes (xW_2)，\quad \text{output} = \text{SwiGLU}(x) \cdot W_3$$

- 因为引入了门控，SwiGLU 的 FFN 用了**三个**权重矩阵而非两个，为保持总参数量不变，中间维度通常取 `8/3 d` 而非传统的 `4d`。
- 实验表明 SwiGLU 在同等参数下效果更好，已成事实标准（论文作者 Noam Shazeer 戏称效果好得「靠运气」）。

## 高频追问

**Q：RMSNorm 相比 LayerNorm 省在哪？为什么还能 work？** 省掉了「减均值」这步计算和偏移参数。研究发现 LayerNorm 起主要作用的是「缩放（re-scaling）」而非「中心化（re-centering）」，所以去掉减均值影响很小，反而更快。

**Q：为什么现代模型从 Post-Norm 转向 Pre-Norm？** 模型越堆越深，Post-Norm 的梯度要穿过每一层的 Norm，容易不稳定；Pre-Norm 让残差路径上有一条「无 Norm 直通」，梯度更平稳，能稳定训练几十上百层。

**Q：SwiGLU 为什么比 ReLU/GELU 好？** 门控机制让网络能动态地、逐元素地控制信息通过，表达能力更强；平滑性也利于优化。代价是多一个矩阵、实现略复杂。

**Q：归一化和残差连接的关系？** 二者配合稳定训练：残差保证信息和梯度能跨层流动，归一化保证每层输入分布稳定。现代结构 `x + Sublayer(Norm(x))` 就是两者的标准组合。
