---
title: 算法与研究路线
description: 从模型机制、训练目标与实验设计进入可复现的论文研究。
level: L3
roles:
  - 算法研究
  - 在校生
classification: reviewed
---
# 算法与研究路线

目标是理解设计动机、推导与实验边界，而不是只记论文结论。前置要求：线性代数、概率、自动微分、PyTorch 和训练基本流程。缺口可从 [必备数学](/beginner/math-basics) 补起。

## 四个阶段，建议四至八周

| 阶段 | 读什么 | 研究产出 | 应能回答 |
| --- | --- | --- | --- |
| 原理复算 | [Transformer](/basics/transformer)、[Attention](/basics/attention)、[位置编码](/basics/position-encoding) | 张量形状、复杂度和数值稳定性的推导记录 | 等变性与不变性有什么区别？ |
| 训练闭环 | [预训练](/pretraining/pretrain)、[反向传播](/basics/backpropagation-optimization)、[训练内部机制](/advanced/training-internals) | 小模型训练曲线与异常实验 | loss 下降能证明泛化更好吗？ |
| 对齐实验 | [LoRA](/finetuning/lora)、[RLHF / DPO](/finetuning/rlhf)、[评估](/evaluation/evaluation) | 固定数据切分、随机种子和资源预算的对照 | 收益来自算法还是数据与算力？ |
| 前沿判断 | [FlashAttention](/advanced/flash-attention)、[Agentic RL](/advanced/agentic-rl)、[推理模型](/advanced/reasoning-models) | 论文卡：贡献、假设、消融、局限与开放问题 | 哪个实验能推翻论文最强的主张？ |

## 里程碑自测

- 从公式到代码逐项解释，不把工程近似当成理论等式。
- 对复现记录数据、实现差异、硬件和软件版本；不声称未做过的复现成功。
- 给出至少一个混杂因素和一项必要的消融实验。

## 常见卡点

算力不够时先做机制验证并声明规模边界；只报最好结果时补充不同种子与失败运行。L4 是阅读目标，不是「刚更新」标签，前沿页仍需对照原论文。
