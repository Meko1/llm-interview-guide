---
title: 找到你的学习路径
description: 以目标、基础和可用时间选择大模型面试学习路线。
level: L1
roles:
  - 在校生
  - 后端转型
  - 应用开发
  - 算法研究
  - Infra
classification: reviewed
aside: false
---
<script setup>
import PathFinder from '../.vitepress/theme/components/PathFinder.vue'
</script>

# 找到你的学习路径

路径不是课程进度条，也不是就业承诺。每个阶段都应留下一个可演示、可复述、可验证的产出。建议周次可以根据基础调整；不要用读完页面数代替学会。

不确定该从哪一步开始？先进入 [能力定位与情境自查](/capability-map)，查看前置关系、实践任务与证据清单。已有明确目标则继续选择下方路线。

<PathJourney />

<PathFinder :heading-level="2" />

## 按目标直接进入

| 目标 | 主线 | 阶段产出 |
| --- | --- | --- |
| [在校生 / 入门](/paths/student) | L0 → L1：直觉、原理、最小应用 | 能演示与解释的 RAG |
| [后端工程师转型](/paths/backend) | L1 → L2：服务、RAG、Agent、评测 | 有质量门禁的 AI 服务 |
| [AI 应用开发](/paths/application) | L1 → L2：选型、失败分析、系统设计 | 可复述的应用案例 |
| [算法与研究](/paths/research) | L1 → L3：推导、训练、复现 | 基线与消融报告 |
| [推理与 Infra](/paths/infra) | L2 → L3：显存、调度、性能实验 | 可复算的容量与压测报告 |
| [前沿贡献判断](/paths/frontier) | L4：贡献、基线、代价与开放问题 | 一手论文卡与实验设计 |

对分级含义有疑问，先读 [阅读与分级说明](/reading-guide)。已经有清楚的问题，直接用 [知识地图](/catalog)。
