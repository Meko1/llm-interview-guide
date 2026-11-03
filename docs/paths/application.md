---
title: AI 应用开发路线
description: 以 RAG、Agent、评测和系统设计形成可复述的应用项目证据。
level: L1
roles:
  - 应用开发
  - 后端转型
classification: reviewed
---
# AI 应用开发路线

目标是能搭建应用，也能解释为什么这样设计。前置要求：Python 或其他后端语言、模型 API 调用、简单的数据处理。核心产出是项目证据，不是框架清单。

## 四个阶段，建议四周

| 阶段 | 读什么 | 实践产出 | 应能回答 |
| --- | --- | --- | --- |
| 第 1 周：问题与基线 | [应用路线总纲](/interview/application-practice-roadmap)、[Prompt](/prompt/prompt-engineering) | 明确任务、不可接受错误与无检索基线 | 为什么这个任务需要 LLM？ |
| 第 2 周：RAG 闭环 | [RAG](/rag/rag-basics)、[Embedding](/rag/embedding-vectordb)、[进阶 RAG](/rag/rag-advanced) | 保存 query、候选、重排、上下文和最终引用 | 怎样判断该改切分还是检索？ |
| 第 3 周：Agent 边界 | [Agent](/agent/agent-basics)、[工作流对比](/agent/workflow)、[工具安全](/agent/tool-safety) | 有步数预算、审批和工具契约的控制循环 | 哪些步骤应该固定，而不是交给模型？ |
| 第 4 周：评测与表达 | [评估](/evaluation/evaluation)、[系统设计](/engineering/system-design) | 对照实验、失败分类、成本记录与演示脚本 | 增加一个组件带来什么可测量收益？ |

## 里程碑自测

- 保持评测集不变，比较至少两个方案，不用挑选成功演示替代实验。
- 分析一个「检索正确但回答错误」和一个「工具成功但业务错误」的例子。
- 对每个关键组件给出替代方案与采用条件。

## 常见卡点

追热点时先补齐基线；功能堆叠时先画请求链路；只看自动评分时抽查具体证据。需要准备项目口述时，进入 [应用系统设计](/interview/application-system-design)。
