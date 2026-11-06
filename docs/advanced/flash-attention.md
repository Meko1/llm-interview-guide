---
title: FlashAttention 深入
description: >-
  「FlashAttention 为什么能又快又省显存？它是近似算法吗？」是工程/算法岗的硬核进阶题。本文讲清它的核心思想、online
  softmax、反向重计算，以及 v1/v2/v3 的演进。基础概念见 Attention 与变体。
level: L3
roles:
  - 算法研究
  - Infra
classification: inferred
---
# FlashAttention 深入

> 「FlashAttention 为什么能又快又省显存？它是近似算法吗？」是工程/算法岗的硬核进阶题。本文讲清它的核心思想、online softmax、反向重计算，以及 v1/v2/v3 的演进。基础概念见 [Attention 与变体](/basics/attention)。

## 标准注意力的问题：不是算力，是访存

标准注意力计算 `O = softmax(QKᵀ/√d)·V`，朴素实现会显式地在显存里生成 N×N 的中间矩阵 `S = QKᵀ` 和 `P = softmax(S)`。

关键在于 GPU 的内存层级，而不是一组脱离设备的固定规格：

```
片上寄存器/共享内存：容量受限，供每个计算块复用数据
片外 HBM：容量较大，但重复读写中间矩阵有代价
```

朴素实现将 N×N 分数/概率写入再读出 HBM，产生可避免的 IO。实际是否 memory-bound 依形状、dtype、硬件和实现而定，不能一概说时间几乎全花在搬数据。

> 关键洞察：**减少 HBM 读写次数**，比减少计算量更能提速。FlashAttention 正是一个 **IO 感知（IO-aware）** 的算法。

## 核心思想：分块 + 在 SRAM 里融合计算

FlashAttention 把 Q、K、V 切成小块（tiling），把每一块加载进 SRAM，在 SRAM 内**一次性完成** QKᵀ、softmax、乘 V 的全过程（算子融合），**绝不把完整的 N×N 矩阵写回 HBM**。

难点在于：softmax 需要对一整行做归一化（要知道全行的最大值和求和），但分块时我们一次只看到一部分。解法是 **online softmax（在线 softmax）**。

### Online Softmax（增量式 softmax）

逐块处理时，维护「**当前的最大值 m**」和「**当前的指数和 l**」两个统计量，每来一个新块就：

1. 更新全局最大值 `m_new = max(m_old, 块内最大值)`；
2. 用新旧最大值的差，对已累积的结果做**重缩放（rescale）**校正；
3. 累加本块的贡献。

这样可以增量计算相同的密集注意力算子。**实数代数等价不等于浮点逐位一致**：归约顺序、低精度和内核差异仍可能产生数值误差。

> 密集 FlashAttention 不通过删边或核近似改变注意力定义；其 block-sparse 扩展或 FP8 计算应另外说明稀疏/量化误差。

### 可推导的在线合并

对一行分数分块，旧统计为最大值 m、指数和 l、**未归一化**加权和 u，新块统计为 m_b、l_b、u_b：

$$m'=\max(m,m_b),\quad l'=e^{m-m'}l+e^{m_b-m'}l_b,$$
$$u'=e^{m-m'}u+e^{m_b-m'}u_b,\qquad o=u'/l'.$$

必须同时 rescale 分母和加权和，只更新最大值是不够的。这里选择未归一化 u 表示，不能与保存已归一化输出的实现公式混用。

**构造算例**：两块各含一个 logit，分别为 0、log 2，value 为 1、3。合并后 m'=log 2，l'=0.5+1=1.5，u'=0.5×1+1×3=3.5，输出为 7/3。它等于权重 1/3、2/3 的加权和。因果/padding mask 应在分数中处理，全 mask 行要走实现定义的稳定路径，不能对空行直接除以零。

### 复杂度收益

- **中间显存**：固定 head dimension d 时从二次规模降为线性；包括输入/输出应写 O(Nd)，不是整个 Transformer 显存都变成 O(N)。
- **IO**：原论文 Theorem 2 在 d≤M≤Nd 下比较标准 Θ(Nd+N²) 与 FlashAttention Θ(N²d²/M) 的 HBM 元素访问，M 按元素容量计，不能省略 d² 或混用字节。
- **FLOPs 与速度**：密集注意力仍有二次计算量；IO 减少、融合和并行优化能提速，但具体倍数只能绑定测量配置。

## 反向传播：用重计算换显存

反向传播需要 softmax 矩阵 P，但前向没有保存它（正是为了省显存）。FlashAttention 在反向时**重新计算** P（利用前向保存的少量统计量 m、l），用计算换显存——这与 [梯度检查点](/pretraining/distributed-training) 是同一思路。

## v1 → v2 → v3 演进

| 版本 | 关键改进 |
| --- | --- |
| **v1** | 提出 tiling + online softmax + 重计算，奠定 IO 感知范式 |
| **v2** | 增加序列维并行，减少非 matmul 开销，优化 thread block/warp 分工；倍数依配置 |
| **v3** | 针对 Hopper（H100）：利用异步指令、**warp 专门化（warp specialization）**、TMA 异步搬数、支持 **FP8**，进一步压榨硬件 |

> 一句话演进：**v1 解决「省显存+精确」，v2 解决「并行效率」，v3 吃满「新硬件特性」。**

## 高频追问

**Q：FlashAttention 是近似注意力吗？** 密集形式不改变注意力定义，但浮点归约和 FP8 等低精度不保证逐位相同；稀疏扩展另论。

**Q：它到底快在哪？算力没变啊。** 关键不是减少计算量，而是减少对慢速 HBM 的读写。标准实现要把 N×N 中间矩阵反复读写显存（访存受限）；FlashAttention 分块后在高速 SRAM 内融合计算，几乎不落盘，访存大幅下降，于是变快。

**Q：online softmax 怎么保证数值稳定？** softmax 要减去最大值防止指数溢出。分块时维护「当前最大值」，每来新块就更新最大值并对已累积结果重缩放校正，等价于对全行减最大值，因此既正确又稳定。

**Q：前向不存注意力矩阵，反向怎么办？** 反向时用前向保存的统计量（m、l）和 Q、K、V **重新计算**注意力矩阵，用计算换显存，和梯度检查点思路一致。

**Q：v2 相比 v1 主要快在哪？** 改进序列维并行、非矩阵乘开销和 warp 工作划分；不承诺任意形状速度翻倍。

**Q：FlashAttention 和 PagedAttention 是一回事吗？** 不是。FlashAttention 优化**单次注意力计算**的访存（训练/推理都用）；PagedAttention 优化**推理时 KV Cache 的显存管理**（分页减碎片），二者解决不同问题，可同时使用。

## 实验边界

先固定形状、mask、dropout、dtype，比较参考输出和梯度的容差；再 warm-up、同步设备，分别测 kernel 和端到端时间、峰值显存。短序列、decode 单 query、不同 head dimension 不能共用长序列训练的加速结论。未支持的 mask 或 dtype 可能触发回退，需确认真正调用了目标内核。

- [FlashAttention Theorem 2](https://arxiv.org/html/2205.14135v2)：本轮读取 IO 定理和容量假设。
- [FlashAttention-2](https://arxiv.org/abs/2307.08691)、[FlashAttention-3](https://arxiv.org/abs/2407.08608)：本轮读取并行/Hopper 优化描述；未做内核或 GPU benchmark。
