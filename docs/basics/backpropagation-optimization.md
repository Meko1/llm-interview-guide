---
title: 反向传播、自动微分与参数更新
description: >-
  分清计算梯度与更新权重，检查冻结路径、梯度累积的归一化、AMP 跳步与完整训练状态。
level: L1
roles:
  - 在校生
  - 算法研究
  - 应用开发
classification: inferred
---
# 反向传播、自动微分与参数更新

Transformer 给出 logits，训练系统还必须把“预测错了多少”变成“每个参数该如何调整”。这一过程由计算图、链式法则、自动微分和优化器共同完成。理解它，才能解释为什么模型没学会、为什么冻结参数不更新、为什么恢复 checkpoint 不能只恢复权重。

优化器和学习率策略的深入讨论见 [训练内部机制与稳定性](/advanced/training-internals)；本页先建立从 loss 到参数更新的最小闭环。

## 一、链式法则如何穿过一个 Transformer

模型可写为 `logits = f_theta(x)`，损失为 `L(logits, y)`。反向传播计算：

$$\frac{\partial L}{\partial\theta}=\frac{\partial L}{\partial logits}\cdot\frac{\partial logits}{\partial h}\cdot\frac{\partial h}{\partial\theta}$$

深度网络不会显式构造巨大 Jacobian，而是从 loss 开始做向量-雅可比积，把上游梯度沿计算图反向传播。自动微分框架在前向记录必要的操作和中间值，调用 `backward()` 后按拓扑逆序累积 `.grad`。

“梯度”是当前 batch 上损失对参数的局部敏感度，不是参数应该直接变成的值。优化器还会加入动量、二阶矩、权重衰减和学习率，最终形成更新。

## 二、一个参数更新的五个不可省步骤

```text
batch -> forward -> loss -> backward -> gradient sync/accumulate -> optimizer.step
                 ^                                                |
                 +------------------- zero_grad -----------------+
```

1. `forward` 生成 logits 和中间激活。
2. `loss` 将预测与有效 labels 比较。
3. `backward` 计算并累积梯度。
4. 分布式场景在适当时机同步梯度；梯度累积场景跨多个 micro batch 相加。
5. `step` 根据 optimizer state 更新参数，随后清理或置空梯度。

梯度默认累积到叶子张量 `.grad`。有意累积时，只在更新窗口边界清理；按累积次数除 loss 仅适用于各 micro batch 权重相同。若有效 token 数不同，要用各批 token 损失和除以窗口总有效 token 数，否则短样本会被过度加权。

可复算反例：两批分别有 1 和 9 个有效 token，平均损失为 2 和 0。平均两个 batch 得 1，但全 token 平均为 0.2；两者定义了不同目标。分布式训练还需考虑默认梯度平均，不能在每卡独立归一化后假定全局 token 权重相同。

## 三、冻结、LoRA 与“为什么参数没有更新”

全参微调中大部分参数都参与梯度计算。PEFT/LoRA 通常冻结底座，仅让低秩矩阵可训练：前向仍会经过底座，反向只需要为可训练路径保留必要梯度。检查某个参数是否更新至少要看三件事：`requires_grad` 是否为真、是否被放入 optimizer 的参数组、其梯度是否非零且没有被 overflow/clip 处理掉。

若 optimizer 只收集了当时可训练参数，之后解冻的参数需加入参数组；若本来就包含全部参数，解冻本身不构成错误。还要排查包装前后的参数对象、误把 `eval()` 当冻结、以及恢复时丢失 optimizer state。

**最小观察实验。** 以下仅需安装 PyTorch，可在 CPU 运行；不是 LLM 训练。`w=0` 时梯度为 -6，`backward()` 后权重仍是 0，学习率 0.1 的 `step()` 才把它改为约 0.6。

```python
import torch

weight = torch.nn.Parameter(torch.tensor(0.0))
optimizer = torch.optim.SGD([weight], lr=0.1)
optimizer.zero_grad(set_to_none=True)
loss = (weight - 3).square()
loss.backward()
print(weight.item(), weight.grad.item())
optimizer.step()
print(weight.item())
```

## 四、为什么深层网络需要残差与归一化

若层层函数的导数连续相乘，范数可能指数级缩小或放大。Transformer 的残差连接提供恒等分支：`x_next = x + F(x)`，其 Jacobian 含有 `I + dF/dx`。这不意味着梯度永不衰减，但为深层网络提供了更短、更稳定的传播路径。Pre-Norm 在子层前归一化，使残差主干更接近恒等映射，是现代 LLM 易于堆深的重要原因。

### 梯度检查不是理论玩具

自定义算子或损失函数可在小尺寸上用有限差分检查：

$$\frac{\partial L}{\partial\theta_i}\approx\frac{L(\theta_i+\epsilon)-L(\theta_i-\epsilon)}{2\epsilon}$$

它很慢，不用于大模型训练，却能在上线前抓住符号错误、mask 错误和广播维度错误。

## 五、训练状态为什么是完整状态

可恢复训练需保存权重、optimizer 状态、scheduler 步数、随机数状态、数据游标，以及使用 GradScaler 时的 scaler 状态。FP16 通常需要 loss scaling，BF16 通常不需要；autocast 也不意味着所有算子和参数都改为低精度。AMP 累积窗口内应保持相同 scale，累积完后 unscale、裁剪、step，再 update；非有限梯度可导致跳步，此时 scheduler 不应冒充完成了一次正常更新。

## 六、面试高频问答

### Q1：`loss.backward()` 后参数已经变了吗？

没有。它只把梯度累积到参数的 `.grad`；真正改变参数的是 `optimizer.step()`。

### Q2：为什么不直接对每层单独求导？

链式法则允许反向模式自动微分从一个标量 loss 高效得到所有参数梯度，复杂度与一次前向同量级；逐参数数值求导会随参数数目爆炸。

### Q3：梯度为零一定说明参数冻结吗？

不一定。先区分 `.grad is None`、全零、非有限以及「梯度非零但权重未变」。路径未参与、mask、饱和、下溢可影响梯度；overflow 通常触发跳步，不等于把梯度自动变成零。冻结参数也可能保留冻结前残余 grad，改训练状态时要清理。

<details>
<summary>自测：为什么不应每个 micro batch 都调用 scaler.update()？</summary>

不同 scale 的梯度不能直接相加后统一 unscale。scale、溢出检查和更新要与有效 batch 对齐；窗口结束前也不应提前把已有 grad unscale 后继续累积缩放梯度。

</details>

### Q4：为什么要先检查单 batch 过拟合？

它把优化问题缩到最小：若连少量干净样本都记不住，优先怀疑前向、标签、反传或 step 的实现；若能过拟合而全量不行，再研究数据、正则和超参。

## 七、面试回答模板

> 我会把训练理解为计算图上的闭环：前向得到 logits，loss 定义误差，backward 用链式法则把误差传到可训练参数，optimizer 根据梯度和状态更新参数。排障时我不只看 loss，还检查参数是否在 optimizer 参数组、grad 是否有限、step 后权重差是否非零，并用单 batch 过拟合先验证标签和反传。恢复训练则必须恢复 optimizer、scheduler 和数据状态，而不是只加载模型权重。

实现边界参考：[PyTorch AMP 梯度累积](https://docs.pytorch.org/docs/stable/notes/amp_examples.html#gradient-accumulation)。具体 API 写法随版本变化，优先核对 scale 与 step 的语义。
