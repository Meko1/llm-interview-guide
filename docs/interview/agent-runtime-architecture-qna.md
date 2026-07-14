# 智能体运行时架构高频问答：Claude Code / Codex / OpenClaw / Hermes

> 面试问 Claude Code、Codex、OpenClaw 或 Hermes 时，最差的回答是复述产品功能。更有区分度的回答是：把它们视为不同取向的 **Agent Runtime**，比较任务循环、上下文、工具执行、隔离、记忆、调度和评测如何协作。编程 Agent 的通用机制见 [编程 Agent 底层架构与内部机制](/engineering/coding-agent-internals)，Claude Code 的分层见 [Claude Code 代码架构](/claude-code/architecture)，工具执行安全见 [企业 Tool Gateway 安全执行系统设计面试题](/interview/tool-gateway-security-design)。

> 需要把这些架构概念落到团队选型、最小权限、Skill 供应链、远程 Gateway、记忆发布与值班运行手册时，继续阅读 [智能编码 Agent 企业操作手册](/interview/coding-agent-production-playbook)。

> 题目涉及云端任务、本地执行器、Gateway/Node、设备配对、网络出口、会话恢复或远程 kill switch 时，继续阅读 [远程与云端 Agent 生产运行手册](/interview/remote-agent-operations-playbook)。

## 怎么用这页

本页不声称掌握任何闭源产品的内部实现细节。它基于公开文档与开源仓库，把可观察能力抽象为工程设计模式。回答时先讲**共同运行时骨架**，再说某一产品选择强调了哪条边界，最后落到自己会如何实现和验证。

## 30 秒总答法

> 我把 Claude Code、Codex、OpenClaw 和 Hermes 看成四种 Agent Runtime 的产品化取向。它们都需要任务状态机、上下文组装、模型调用、工具执行、结果观察和终止控制；差异主要在控制面放在哪里。Claude Code 的亮点是把专业子 Agent、独立上下文、worktree 隔离和 Hook 事件做成可配置的开发工作流；Codex 强调任务级权限、可写根目录和沙箱边界；OpenClaw 更像本地优先的消息 Gateway，把多渠道、会话、工具和事件收敛到一个控制点；Hermes 则把持久记忆、技能沉淀、定时调度和多后端执行放进长期运行的闭环。生产设计不应复制某个产品，而应明确控制面、执行面、身份与凭证、记忆生命周期、审批与可观测边界。

## 一、先建立统一的 Agent Runtime 心智模型

无论表面是 CLI、IDE、聊天机器人还是云端任务，底层都可拆为六层：

```text
Input / Channel
  -> Session & Task State
  -> Context Builder / Memory Retrieval
  -> Planner + Model Router
  -> Tool Policy + Executor / Sandbox
  -> Observation Normalizer + Evaluator
  -> Audit / Trace / Durable State / Scheduler
```

| 层 | 必须回答的问题 | 常见故障 |
| --- | --- | --- |
| 渠道与会话 | 一条消息进入哪个 session、哪个 agent、哪个工作区 | 多渠道串会话、租户混淆 |
| 任务状态 | 当前在规划、执行、等待审批还是已终止 | 无限循环、断点不可恢复 |
| 上下文 | 本轮真正带给模型哪些事实、规则和工具 | 上下文膨胀、旧信息污染 |
| 模型与计划 | 如何选模型、拆任务、设 token/步骤预算 | 高成本、低质量、计划漂移 |
| 工具执行 | 如何校验、授权、隔离、取消和回收 | 越权、命令注入、僵尸进程 |
| 记忆与观测 | 什么要持久化、如何回放和评测 | 记住错误、无法定位坏轨迹 |

面试关键句：**Agent 不是“模型加几个工具”，而是一个把不确定推理放进确定性状态、权限、资源与审计边界内的任务运行时。**

## 二、四类产品的架构亮点如何抽象

| 取向 | 公开可见的架构重点 | 可迁移的设计亮点 | 面试中不要误说成 |
| --- | --- | --- | --- |
| Claude Code | 子 Agent、项目指令、Hooks、MCP、worktree | 将探索输出隔离在独立上下文；工具调用前后可插入确定性策略 | “模型自己天生就会并行和安全” |
| Codex | 任务级权限、沙箱、可写根、项目指令、MCP/扩展 | 将执行环境和审批策略显式暴露为每次运行的配置 | “沙箱等于业务授权已经完成” |
| OpenClaw | 本地优先 Gateway、多渠道会话路由、节点/工具、定时任务 | 用一个控制面收敛渠道、会话、事件与远程节点 | “本地运行天然安全” |
| Hermes | 持久记忆、技能、会话检索、调度、多后端执行、子 Agent | 把经验沉淀设计为可检查的外部工件，而非只留在上下文 | “会自我学习就可以自动改生产策略” |

这些是架构侧的相对侧重点，不等于功能完整清单，也不表示四者实现细节相同。

## 三、Claude Code 的亮点：上下文隔离和事件化策略

Claude Code 的公开子 Agent 文档强调：子 Agent 有独立上下文窗口、专属 system prompt、工具访问和权限；也可以配置到独立 worktree。这个设计值得借鉴的不是“多开几个模型”，而是**把主线程稀缺的上下文留给决策，把大量检索、日志和局部修改放到隔离工作单元**。

### 子 Agent 的三种隔离维度

| 维度 | 目的 | 设计选择 |
| --- | --- | --- |
| 上下文隔离 | 防止搜索结果、长日志淹没主任务 | fresh context 或 summary handoff |
| 文件隔离 | 避免并发修改互相踩踏 | git worktree、临时分支、patch 合并 |
| 权限隔离 | 让审阅者不具备写入/出网/部署能力 | read-only toolset、独立 credential scope |

对比 `fork` 与 `fresh agent` 也是高频追问。fork 能复用父上下文和 prompt cache，适合必须理解完整会话的短任务；fresh agent 输入更少、更可控，适合检索、代码审阅或安全扫描。工程上要限制返回结果：返回**结论、证据位置、风险和 patch 摘要**，不要把完整过程日志再次塞回主上下文。

### Hooks 为什么比 prompt 更可靠

公开 Hook 机制可以在 `PreToolUse`、`PermissionRequest`、`PostToolUse` 等事件上 allow、deny、ask、defer 或改写输入。它体现了一个通用原则：

```text
model intent -> deterministic hook / policy -> tool executor -> normalized result -> model observation
```

例如“禁止删除生产数据”不能只放在 system prompt 中；应由执行前 Hook 或 Tool Gateway 解析命令、环境、资源标签，再给出拒绝或人工确认。Hook 负责运行时事件策略，业务系统仍要在资源层二次鉴权。

## 四、Codex 的亮点：把执行环境与权限变成任务契约

Codex 的可迁移思想不是某个具体 CLI 命令，而是把以下内容在任务开始前显式化：可读写根、网络能力、命令执行权限、审批模式、项目指令、MCP/扩展和运行环境。这样 Agent 运行不再只是“给模型一个 shell”，而是一个可复现的任务契约。

### 生产级任务契约示例

```yaml
task:
  id: fix-payment-timeout
  workspace: repo@commit:abc123
  writable_roots: [services/payment, tests/payment]
  network: deny
  tool_policy:
    read: allow
    edit: allow
    shell: ask_for_destructive
    deploy: deny
  budget:
    max_steps: 30
    max_tokens: 120000
    max_wall_time: 20m
  evidence:
    require_tests: true
    require_diff_review: true
```

**面试官：沙箱已经开了，为什么还要审批和工具策略？**

> 沙箱主要限制运行环境的文件、进程和网络能力；审批回答的是“这次副作用是否符合用户意图和业务风险”；工具策略决定动作本身是否允许。三者分别处理资源隔离、意图确认和行为约束，不能互相替代。

任务完成还应输出 diff、测试、命令摘要、依赖变更和未解决风险。可回放的证据比“模型说已完成”更可靠。

## 五、OpenClaw 的亮点：长驻 Gateway 与会话路由

OpenClaw 的公开资料将本地优先 Gateway 作为 sessions、channels、tools 和 events 的单一控制面，并支持把不同渠道/账号路由到隔离 agent 与工作区。这类架构适合理解“个人助理/消息 Agent”为什么不同于一次性 Coding Agent：它需要**长期在线、多个入口、异步事件、定时任务和设备节点**。

### Gateway 应承担的控制面职责

1. 渠道适配：把 Telegram、Slack、Web、语音等入口规范化为同一事件模型。
2. 会话绑定：用 `channel + account + peer + thread` 路由到正确 agent/session，避免跨用户串记忆。
3. 节点注册：浏览器、手机、桌面或远程执行器必须配对、心跳、声明能力和撤销。
4. 事件持久化：消息、任务、cron、工具结果和取消信号进入 durable log 或任务表。
5. 安全默认值：远程/群组会话使用更窄的工具集和沙箱，不能沿用主会话的全权能力。

一个容易加分的判断是：**Gateway 不是模型代理。** 它必须有连接治理、会话隔离、事件幂等、离线重试、速率限制和 kill switch；否则渠道一多，Agent 就会变成无法审计的长连接脚本。

## 六、Hermes 的亮点：把记忆与技能做成可演化外部状态

Hermes 的公开项目强调持久记忆、跨会话检索、技能创建/改进、定时自动化、隔离子 Agent 和多种终端后端。它启发的是长期运行 Agent 的另一面：模型上下文不是数据库，经验必须形成可管理的外部工件。

### 四层记忆，而不是一个无限 MEMORY.md

| 记忆层 | 内容 | 写入条件 | 读取策略 |
| --- | --- | --- | --- |
| 工作记忆 | 当前任务计划、临时观察、工具句柄 | 每个 turn | 本轮必带，受 token 预算约束 |
| 情节记忆 | 已完成任务、失败原因、时间线 | 任务结束后摘要 | 向量/关键词检索，带来源 |
| 语义记忆 | 用户偏好、项目事实、稳定约束 | 多次验证或人工确认 | 结构化字段优先，需过期策略 |
| 程序记忆 | 可复用 skill、runbook、工具配方 | 有可验证收益的任务后 | 版本化、评审、可回滚 |

“自我改进”最安全的实现不是让 Agent 随时改 system prompt 或权限，而是：从成功/失败轨迹提炼候选 skill，离线评估命中率、成本和安全性，审批后发布版本，灰度观察，再允许进入默认工具集。

## 七、真正的 Agentic Loop 要有状态机，而不是 while true

```text
RECEIVED
  -> CONTEXT_READY
  -> PLANNED
  -> TOOL_PENDING
  -> TOOL_RUNNING
  -> OBSERVED
  -> (PLANNED | APPROVAL_PENDING | COMPLETED | FAILED | CANCELLED)
```

每个转移要具备 `task_id`、attempt、budget、deadline、idempotency_key 和可恢复 checkpoint。以下终止条件必须由运行时强制，不由模型自行决定：最大步骤数、最大 token、最大成本、最大墙钟时间、连续相同工具调用、审批超时、策略拒绝和用户取消。

**面试官：为什么 Agent 总会重复读文件或重复调用工具？**

> 因为模型只有语言上下文，不天然拥有“已完成动作”的强一致状态。运行时要把工具调用归一化为事件，记录参数哈希、结果句柄和副作用状态；在下一轮注入简短的观察摘要，并用重复检测、预算和状态机阻止无效循环。

## 八、工具执行器、沙箱与工作区的设计亮点

工具执行面至少要分为三类：

| 执行类型 | 例子 | 推荐隔离 | 额外控制 |
| --- | --- | --- | --- |
| 只读检索 | `rg`、代码索引、issue 搜索 | 只读工作区 | 查询配额、敏感路径拒绝 |
| 可逆编辑 | 写代码、生成 patch、更新测试 | worktree / overlay FS | diff 审查、测试门禁 |
| 高风险副作用 | 部署、发邮件、删数据、付款 | 专用 runner / 工具网关 | approval、短期凭证、审计、补偿 |

worktree 解决的是并发文件冲突与可回收修改；容器/VM 解决的是进程、网络和文件系统暴露；Tool Gateway 解决的是业务身份、资源权限和审计。面试里把这三种隔离说清楚，通常比单纯说“Docker 沙箱”成熟得多。

## 九、子 Agent 与多 Agent：不要只追求并行

合理的分工应使每个 worker 有明确输入、工具边界、输出契约和完成条件：

| 角色 | 输入 | 权限 | 输出 |
| --- | --- | --- | --- |
| Explorer | 问题与仓库快照 | read-only | 证据、文件路径、风险 |
| Implementer | 已批准计划 | 受限写入 worktree | patch、测试结果 |
| Reviewer | diff 与验收标准 | read-only | 缺陷、优先级、复现方式 |
| Release Agent | 构建产物与发布策略 | 部署受审批 | 发布状态、回滚点 |

并行前要检查依赖图。多个 Agent 同时改一个核心文件，通常比串行更慢；应该按模块、worktree 或变更类型切分。主 Agent 的职责不是“最后再汇总”，而是合并冲突、复核证据、控制预算并承担最终决策。

## 十、可观测、回放和评测

一次 Agent 任务的 trace 至少需要：`session_id`、`task_id`、模型/版本、上下文来源、工具定义版本、每步工具参数摘要、策略决定、执行环境、耗时、token、成本、测试和最终 diff。对长期运行 Agent，还要记录 cron 触发源、消息渠道、记忆读写、技能版本与审批事件。

评测不能只看最终答案。建议同时度量：

- 任务成功率、测试通过率、人工接受率；
- 工具选择准确率、参数合法率、无效循环率；
- 沙箱逃逸/越权尝试拦截率、未确认副作用数；
- P50/P95 时延、token、工具成本、并发队列时间；
- 记忆命中后的收益与错误记忆导致的回归率。

改 prompt、模型、skill、工具 schema 或 sandbox 策略后，都应在固定轨迹集上回放，并把事故样本变成回归用例。

## 十一、系统设计题：实现一个企业级 Coding Agent 平台

**题目**：设计一个给研发团队使用的 Coding Agent，支持 IDE/CLI/Slack 入口、并行子 Agent、修改代码、跑测试、创建 PR；要求项目隔离、审计、成本控制和可回滚。

### 建议答题结构

1. **控制面**：身份、组织/仓库策略、Agent 模板、模型路由、工具注册、预算、审计和发布审批。
2. **数据面**：Gateway 接收任务，Session Service 生成状态机，Context Service 读取仓库和记忆，Orchestrator 调度子 Agent，Runner 在 worktree/容器中执行。
3. **任务隔离**：每个任务绑定 commit SHA、worktree、临时凭证和资源配额；不直接写默认分支。
4. **证据链**：每个 patch 必须关联任务、工具轨迹、测试、review 和 PR；外部命令与网络请求进入审计。
5. **失败处理**：runner 宕机可从 checkpoint 恢复；模型失败可降级或人工接管；策略/审计不可用时禁止高风险写操作。

### 面试收口

> 我会把 Coding Agent 做成“受限的软件交付流水线”，而不是让模型直接拥有开发机。模型负责不确定的计划和代码生成；运行时负责确定的状态、权限、工作区、测试、审计和回滚。这样既能吸收 Claude Code、Codex 的任务隔离思想，也能吸收 OpenClaw 的 Gateway 事件模型和 Hermes 的长期记忆/技能闭环。

## 十二、反面回答清单

- “只要模型足够强，Agent Runtime 就不重要。”
- “所有子 Agent 共用完整上下文，沟通最省事。”
- “Docker 沙箱开了，就不需要业务权限和审批。”
- “把历史对话全塞进 prompt，就算有记忆。”
- “让 Agent 自动修改 skill、工具权限和生产配置，迭代更快。”
- “任务成功只看模型最后说完成了。”
- “消息渠道、cron 和后台任务不用 idempotency，因为它们是内部系统。”

## 十三、面试前 5 分钟速记

- 四类产品都可归到：session/task、context、model/planner、tool executor、memory、observability。
- Claude Code 的可迁移亮点：独立上下文、worktree、Hook 事件策略。
- Codex 的可迁移亮点：任务权限、可写根、沙箱和项目指令显式化。
- OpenClaw 的可迁移亮点：长驻 Gateway、多渠道路由、会话与事件控制面。
- Hermes 的可迁移亮点：持久记忆、技能工件、调度和受控学习闭环。
- 模型永远不应是权限或状态的唯一事实来源。
- 工作区隔离、运行环境隔离和业务权限隔离解决的是不同问题。

## 公开资料与延伸阅读

- [Claude Code 子 Agent 文档](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Hooks 文档](https://code.claude.com/docs/en/hooks)
- [Codex CLI 文档](https://learn.chatgpt.com/docs/codex/cli)
- [OpenClaw 开源仓库](https://github.com/openclaw/openclaw)
- [Hermes Agent 开源仓库](https://github.com/NousResearch/hermes-agent)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [Agent 评测与安全合规高频问答](/interview/agent-evaluation-safety-qna)
