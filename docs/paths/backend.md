---
title: 后端工程师转型路线
description: 用已有服务工程经验建立 RAG、Agent 与 AI 服务的生产判断能力。
level: L2
roles:
  - 后端转型
  - Infra
classification: reviewed
---
# 后端工程师转型路线

目标是将模型能力接入可观测、可回滚、权限明确的服务。前置要求：API、数据库、缓存、超时、重试和基本部署经验。先理解新的失败模式，而不是换一种框架重写已有工程知识。

## 四个阶段，建议四周

| 阶段 | 读什么 | 应留下的产出 | 面试检验 |
| --- | --- | --- | --- |
| 第 1 周：接口与模型边界 | [LLM 应用开发](/engineering/llm-app-dev)、[结构化输出](/engineering/structured-output)、[Transformer](/basics/transformer) | 请求契约、错误分类与 token 预算 | JSON 可解析等于业务正确吗？ |
| 第 2 周：知识服务 | [RAG](/rag/rag-basics)、[进阶检索](/rag/rag-advanced) | 文档版本、权限过滤、引用链与分段评测 | 为什么租户过滤不能只放在生成之后？ |
| 第 3 周：可靠执行 | [Agent](/agent/agent-basics)、[工具安全](/agent/tool-safety)、[持久工作流](/agent/durable-agent-workflows) | 超时、幂等、人工审批与失败恢复方案 | 工具超时后重试会不会重复写入？ |
| 第 4 周：上线判断 | [LLMOps](/engineering/llmops)、[系统设计](/engineering/system-design)、[KV Cache](/inference/kv-cache) | 质量门禁、容量假设、压测和回滚演练 | 提高并发为什么可能让尾延迟恶化？ |

## 里程碑自测

- 一次请求能串联身份、检索、模型与工具的日志和引用。
- 演示超时与重复请求，并解释幂等边界，不把请求 ID 当作完整解决方案。
- 对线上失败能够区分服务错误、模型错误、检索错误与业务错误。

## 常见卡点

只谈框架不谈约束时，先写明确的 SLO 与质量目标。把所有失败都交给重试时，先区分读操作和不可逆写操作。Java 技术栈可补读 [Spring AI](/engineering/spring-ai)，但能力主线不依赖特定语言。
