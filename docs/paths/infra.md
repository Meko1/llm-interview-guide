---
title: 推理与 Infra 路线
description: 从显存账本到调度与性能实验，准备大模型推理工程面试。
level: L2
roles:
  - Infra
  - 后端转型
classification: reviewed
---
# 推理与 Infra 路线

目标是能基于工作负载做容量、成本和 SLO 决策。前置要求：Linux、GPU 基本概念、性能分析和服务部署。没有 GPU 也可以先完成公式复算，但不能把纸面结果称为压测结论。

<PathJourney />

| 阶段 | 阅读 | 可验证产出 | 面试检验 |
| --- | --- | --- | --- |
| 显存账本 | [KV Cache](/inference/kv-cache)、[GPU 硬件](/inference/gpu-hardware) | 权重、KV、运行时保留与碎片的预算 | GB 与 GiB 为什么不能混用？ |
| 算子与带宽 | [Attention](/basics/attention)、[FlashAttention](/advanced/flash-attention) | Prefill / Decode 的瓶颈假设 | IO 优化是否降低了注意力算术复杂度？ |
| 引擎与调度 | [推理框架](/inference/serving-frameworks)、[推理优化](/inference/inference-optimization) | 前缀缓存、并发、排队与公平性的设计记录 | 吞吐变高为什么 TTFT 可能变差？ |
| 性能实验 | [推理 Benchmark](/inference/inference-benchmark)、[量化](/inference/quantization) | 固定模型与长度分布的压测报告 | 如何排除缓存命中和请求分布的干扰？ |

建议四周完成。每周既保留结果也保留失败：OOM、队列积压、性能退化和量化误差都应有定位路径。

## 自测与卡点

能解释 TTFT、TPOT、吞吐和尾延迟各自衡量什么；能复算 GQA 的 KV 占用；能说明某个优化在哪类负载下会失效。没有同一负载的基线，不引用别人的倍数作为本服务收益。
