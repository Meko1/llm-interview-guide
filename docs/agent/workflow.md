# AI 工作流 vs Agent

> 「什么时候用 Workflow，什么时候用 Agent？」是 Anthropic《Building Effective Agents》提出、如今被反复问到的工程判断题。本文讲清两者区别、常见编排模式，以及务实的选型原则。

## 核心区别

Anthropic 给出的经典区分：

- **工作流（Workflow）**：LLM 和工具通过**预先定义好的代码路径**编排。流程是确定的、你写死的，LLM 只在固定的节点上发挥。
- **Agent（智能体）**：LLM **自主决定**流程和工具的使用方式，动态地规划下一步。流程是模型在运行时决定的。

> 一句话：**Workflow 的「剧本」是开发者写好的；Agent 的「剧本」是模型现编的。** 自主性是分界线。

## 为什么这个区分重要？

自主性越高越灵活，但也越不可控、越贵、越难调试。务实原则：

> **能用 Workflow 解决的，就别上 Agent。** 先用最简单的方案，只有当任务确实需要动态决策、无法预先编排时，才引入 Agent 的自主性。很多「Agent 产品」其实是 Workflow 就够了。

## 常见工作流模式

Anthropic 总结的几种可组合的 Workflow 模式：

| 模式 | 说明 | 适用 |
| --- | --- | --- |
| **Prompt Chaining（串联）** | 把任务拆成固定的几步，前一步输出喂下一步 | 任务能清晰分解为固定步骤 |
| **Routing（路由）** | 先分类，再把请求分发到对应的专门处理 | 输入类型多样、需分流（如客服分类） |
| **Parallelization（并行）** | 同时跑多个子任务再聚合（分片或投票） | 可拆分/需多视角 |
| **Orchestrator-Workers（编排者-工人）** | 中心 LLM 动态拆任务派给子 LLM 并汇总 | 子任务数量/内容不固定 |
| **Evaluator-Optimizer（评估-优化）** | 一个生成、一个评估打分，循环改进 | 有明确评价标准、需迭代 |

> 注意：Orchestrator-Workers 已经带一定自主性，是 Workflow 到 Agent 的过渡。

## Agent 模式

当任务**无法预先编排**（步数、路径取决于运行时的环境反馈）时，才用真正的 Agent——它在「行动 → 观察环境 → 决定下一步」的循环里自主推进，详见 [Agent 基础](/agent/agent-basics)。典型：让 Agent 自主探索修复一个代码 bug（要读哪些文件、跑哪些测试，事先无法确定）。

## 选型决策

```
任务流程能不能事先确定？
├── 能 ──▶ 用 Workflow（串联/路由/并行/编排…），更可控、便宜、好调试
└── 不能（步骤依赖运行时反馈）──▶ 才上 Agent，并加护栏：
                                  限步数、人工确认、可观测、错误处理
```

## 高频追问

**Q：Workflow 和 Agent 的本质区别？** 在于「流程由谁决定」：Workflow 的流程是开发者用代码预先编排好的（确定路径）；Agent 的流程由 LLM 在运行时自主决定（动态路径）。自主性是分水岭。

**Q：什么时候该用 Agent，什么时候用 Workflow？** 能事先把流程拆清楚、写成固定步骤的，用 Workflow（更可控、便宜、易调试）；只有当任务的步骤和路径取决于运行时环境反馈、无法预先编排时，才用 Agent。原则是「能简则简，别为了 Agent 而 Agent」。

**Q：有哪些常见的工作流编排模式？** Prompt Chaining（串联）、Routing（路由分发）、Parallelization（并行+聚合）、Orchestrator-Workers（编排者动态派活）、Evaluator-Optimizer（生成-评估循环）。它们可组合使用。

**Q：Agent 比 Workflow 强，为什么不全用 Agent？** Agent 自主性带来灵活，但也更不可控（易跑偏/死循环）、更贵（调用多、token 多）、更难调试和保证可靠性。大量场景 Workflow 就足够且更稳。生产中常以 Workflow 为骨架，在确需自主决策处局部引入 Agent。

**Q：Orchestrator-Workers 和多 Agent 有何关系？** Orchestrator-Workers 是一种「中心 LLM 动态拆解任务、分派给子 LLM 再汇总」的模式，本质就是一种多 Agent 协作的 Supervisor 形态，详见 [多 Agent](/agent/multi-agent)。
