---
title: 在校生与初次入门路线
description: 从 Python 与模型直觉走到可演示、可解释的最小 RAG 项目。
level: L0
roles:
  - 在校生
classification: reviewed
---
# 在校生与初次入门路线

目标是获得实习或初级应用岗位所需的基本表达与实践能力，而不是先背完全部模型名。前置要求：Python 函数、列表、文件读写与基本 HTTP 概念。

<PathJourney />

## 四个阶段，建议四周

| 阶段 | 读什么 | 写什么 / 做什么 | 应能回答 |
| --- | --- | --- | --- |
| 第 1 周：图景 | [入门](/beginner/getting-started)、[直觉版](/beginner/how-llm-works)、[术语](/beginner/glossary) | 记录一次调用的输入、输出、token 与错误 | 模型与搜索引擎有什么区别？ |
| 第 2 周：原理 | [Transformer](/basics/transformer)、[Attention](/basics/attention)、[Tokenizer](/basics/tokenizer) | 用纸笔追踪三个 token 的形状与因果掩码 | 为什么训练能并行而生成仍串行？ |
| 第 3 周：应用 | [RAG](/rag/rag-basics)、[Prompt](/prompt/prompt-engineering) | 对自己的课程资料建立小知识库，保存引用 | RAG 为什么不能保证不产生幻觉？ |
| 第 4 周：表达 | [评估](/evaluation/evaluation)、[高频题](/interview/high-frequency) | 构建覆盖正确、未知、歧义问题的小评测集，复述失败案例 | 答错是检索失败还是生成失败？ |

## 里程碑自测

- 不看笔记解释 Q、K、V 的角色，并画出张量维度。
- 演示一次有引用的回答和一次应当拒答的问题。
- 用三个失败样本说明为什么「多塞文档」不是万能优化。

## 常见卡点

数学跟不上时先回到 [必备数学](/beginner/math-basics)，不要直接跳进训练集群。项目跑通但解释不清时，保留一个请求的完整数据流。只会背概念时，先改变一个参数并记录结果，再读更多页面。

完成后进入 [应用开发路线](/paths/application)。
