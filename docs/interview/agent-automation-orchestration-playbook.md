# Agent 自动化与后台编排生产设计：Claude Code / Codex / OpenClaw / Hermes

> 面试官说“给 Agent 加一个定时任务或多 Agent 并发”，真正想考的不是会不会写 cron 表达式，而是：一次运行是继承当前会话还是新建上下文？多个任务如何避免同时改同一份状态？任务失败、超时、重复触发和取消时，谁负责把结果可靠地送回？本页把四类运行时的公开自动化能力抽象成一套可落地的调度与编排模型。

> 任务在远程 Node、云端 sandbox 或本地机器执行时的网络和身份边界，见 [远程与云端 Agent 生产运行手册](/interview/remote-agent-operations-playbook)。变更如何走向 PR 与 CI，见 [智能编码 Agent 企业操作手册](/interview/coding-agent-production-playbook)。

> 当问题从“怎么并发跑”深入到控制权、责任、预算和审批如何从父任务转给子任务，以及如何处理孤儿任务与冲突收敛时，继续阅读 [多 Agent 委派与 Handoff 控制平面](/interview/multi-agent-delegation-handoff-playbook)。

## 怎么用这页

产品能力会随着版本变化，本页只引用公开文档中可观察的行为，不猜测闭源系统内部实现。面试时先讲任务语义，再讲状态、资源和副作用的控制，最后用具体产品举例。不要把“有后台按钮”误答成“具备生产级调度”。

## 30 秒总答法

> 我把 Agent 自动化分为前台同步 turn、子 Agent、后台 detached run、定时任务和事件触发五类。它们的差异必须体现在上下文继承、身份/权限、资源预算、结果投递与取消语义上。控制面持久化 job、run、session、lease 和 tool effect；执行器只领取有时限的任务。需要独立分析的工作使用 fresh session 和最小能力，需要连续工作的工作流才显式绑定 persistent session。调度器要有幂等触发、并发额度、分布式锁、超时、重试、死信和可靠投递。Claude Code 的子 Agent 与 Routines、Codex 的 worktree 和 Automations、OpenClaw 的 cron/heartbeat 会话模式、Hermes 的 background session/cron 都能映射到这个模型。最终交付不是一条“执行成功”消息，而是带证据、可审阅、可取消、可追溯的运行记录。

## 一、先给任务取对名字

同样叫“自动化”，语义可能完全不同。应先让产品和接口选择下表中的一种类型。

| 类型 | 触发者 | 上下文 | 是否阻塞请求方 | 典型用途 |
| --- | --- | --- | --- | --- |
| 前台 turn | 用户/同步 API | 当前会话 | 是 | 问答、短工具操作、澄清计划 |
| 子 Agent | 父 Agent | fresh、fork 或显式摘要 | 父任务可等待 | 检索、审阅、局部实现 |
| 后台 run | 用户/消息渠道 | 独立 session | 否 | 长分析、构建、批处理 |
| 定时 job | scheduler | fresh 或显式持久 session | 否 | 日报、巡检、清理、周期 review |
| 事件驱动 job | webhook/代码事件/队列 | 新任务契约 | 否 | PR 触发审阅、告警归因、工单分类 |

**核心原则：默认 fresh，连续性必须显式声明。** 背景工作若悄悄继承一段聊天历史、群聊路由、提权状态或临时文件句柄，既会污染结果，也可能把权限带到不该去的地方。

### 不要混淆 session、job 与 run

```text
Job: "每个工作日 09:00 检查失败 CI 并生成摘要"
  |
  +-- Run #101: 2026-07-14 09:00, session=sess_101, status=SUCCEEDED
  +-- Run #102: 2026-07-15 09:00, session=sess_102, status=FAILED

Session: 模型可见的对话/上下文容器
Run: 一次具体执行尝试，拥有执行器、lease、预算和结果
```

`job_id` 是定义，`run_id` 是一次尝试，`session_id` 是上下文容器，`execution_id` 是实际 runner 的实例。一个 job 可以有多个 run；一次 run 可以因 worker 失联而产生多个 execution；不能拿 session ID 作为去重键或权限凭证。

## 二、四类 Runtime 的公开能力如何映射

| Runtime | 子 Agent / 并行 | 定时与后台 | 面试中应抽象出的亮点 |
| --- | --- | --- | --- |
| Claude Code | 子 Agent 可有独立工具、权限、MCP、技能与 worktree；Hook 可观察其开始/结束 | Routines、桌面计划任务、GitHub Actions、CLI `/loop` 对应不同执行位置 | 任务运行位置、会话隔离和 Hook 策略应被分别设计 |
| Codex | 多个 Agent 独立 thread，worktree 隔离同一仓库的并发修改 | Automations 由指令、可选 Skills 与计划组成，结果进入 review queue | 后台不等于自动合并，结果必须回到人工审阅面 |
| OpenClaw | Gateway 可路由多 agent/任务；任务记录用于 detached work | cron 有 main、isolated、current、named session；heartbeat 是主会话周期 turn | 精确调度与近似检查要分开，任务会话模式必须可见 |
| Hermes | `/background` 启动隔离 agent session；终端后台进程另有 process 管理 | Gateway cron 在 fresh session 执行，支持暂停/恢复/立即运行与投递 | Agent session、OS 进程和 delivery 是三条不同生命周期 |

### Claude Code：子 Agent 与 Routines 不是一个机制

[Claude Code 子 Agent 文档](https://code.claude.com/docs/en/sub-agents) 允许角色拥有不同的工具、权限模式、MCP、技能、最大轮数和 worktree 隔离；[Hooks 文档](https://code.claude.com/docs/en/hooks) 提供 `SubagentStart` 与 `SubagentStop` 等事件。工程上应利用这些能力给子任务设置最小权限与结果契约，而不是把主会话的所有工具和密钥原样传下去。

[Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows) 将计划运行分成 Anthropic 托管 Routines、本机桌面计划任务、GitHub Actions 和当前 CLI session 的 `/loop`：它们分别适合机器关机后仍需运行、本地未提交改动、仓库事件和短期轮询。Routines 的运行绿色状态只代表基础设施正常退出，不证明任务目标已达成；必须查看运行记录、证据和最终变更。这个细节非常适合回答“成功率怎么算”的追问。

### Codex：并行 worktree 与 Automation review queue

[Codex App 发布说明](https://openai.com/index/introducing-the-codex-app/) 描述多个 Agent 使用独立 thread 和内建 worktree 并行处理同一仓库，避免直接污染本地 Git 状态；Automations 可将指令和可选 Skills 按计划运行，完成后进入 review queue。其 [Automations 指南](https://openai.com/academy/codex-automations/) 还说明本地运行的自动化依赖设备和应用保持可用。

这提醒我们：worktree 解决的是文件写入冲突，不解决业务副作用冲突；review queue 解决的是人工接手，不等于 CI、分支保护和发布审批可以省略。自动化任务应输出可验证的候选结论、patch 或 PR，而不是拥有默认分支或生产部署的长期权限。

### OpenClaw：Cron、Heartbeat 与 detached task 的边界

[OpenClaw Automation](https://docs.openclaw.ai/automation) 区分精确定时的 cron 与近似周期检查的 heartbeat。cron 可以用新 session 或共享 session 运行，并保留任务记录；heartbeat 是主会话上的周期 turn，不应被误认为 detached background job。其 [Scheduled Tasks 文档](https://docs.openclaw.ai/cron) 提供 `main`、`isolated`、`current`、`session:<id>` 四种 session 模式：isolated 每次运行新建 transcript，不继承环境对话路由、提权、来源和 ACP 绑定；而 current/named session 才是显式的连续工作流。

生产设计可直接借鉴这一分法：报告、巡检和批处理用 isolated；只在“每日迭代同一份计划、且明确需要历史”时使用 persistent session；通知型检查用 heartbeat。不要让一个全天候 heartbeat 顺便承担所有精确任务，它会在忙碌时延后，也缺少独立 run 记录。

### Hermes：后台 Agent、cron 与终端进程应三层管理

[Hermes CLI 文档](https://hermes-agent.nousresearch.com/docs/user-guide/cli) 中 `/background` 会新建独立 Agent session：继承当前模型、provider、toolset 等配置，但不继承当前会话历史，并将完成结果送回发起位置。[Hermes Cron 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron) 说明 Gateway 每个调度 tick 会为到期任务创建 fresh session，使用锁避免调度 tick 重叠；其 [API Server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/) 支持 job 的暂停、恢复、立即运行和删除，删除会取消在途运行。

另外，Hermes 工具层的 `terminal(background=true)` 是 OS 进程管理问题，而非另一个 Agent session。它需要独立的 PID/process handle、日志、等待和 kill 语义。把这两者混在一起会造成“聊天任务完成了但子进程还在跑”或“取消 job 却没有停止构建进程”的事故。

## 三、统一的控制面架构

```text
Trigger: user / schedule / webhook / event
                 |
                 v
      +--------------------------+
      | Automation control plane |
      | job store, policy,       |
      | dedupe, queue, audit     |
      +------+-------------------+
             | admission + lease
             v
      +--------------------------+
      | Orchestrator             |
      | session policy, DAG,     |
      | budgets, cancellation    |
      +----+----------------+----+
           |                |
           v                v
   Agent runner pool    Tool/process runner
   fresh/fork session   sandbox / Node / CI
           |                |
           +-------+--------+
                   v
      result store -> delivery outbox -> chat / PR / webhook
```

控制面必须是事实来源。UI、聊天渠道、模型输出和工作进程都只能提交命令或事件，不能自行宣布最终状态。至少要存储：

| 表/流 | 必需字段 | 目的 |
| --- | --- | --- |
| `job` | owner、trigger、schedule、session policy、delivery policy、revision | 定义一个长期自动化 |
| `run` | scheduled time、dedupe key、status、budget、attempt | 描述一次应发生的工作 |
| `execution` | runner、lease、snapshot、started/ended、exit reason | 区分重试与真正运行 |
| `task_edge` | parent run、child run、dependency、join policy | 让子 Agent/DAG 可追踪 |
| `tool_effect` | idempotency key、resource、effect state、evidence ref | 防止副作用重复发生 |
| `outbox` | destination、payload hash、delivery attempt、ack | 支持可靠通知与重试 |

## 四、任务状态机、租约与重试

一个生产级 run 建议使用以下状态，而不是只有 `running/done`：

```text
PLANNED -> ADMITTED -> QUEUED -> CLAIMED -> RUNNING -> WAITING_APPROVAL
                                         |              |
                                         v              v
                                      RETRY_WAIT <--- PAUSED
                                         |
                                         v
                    SUCCEEDED / FAILED / CANCELLED / EXPIRED / DEAD_LETTER
```

### Claim 要带租约，不靠“worker 还活着”的猜测

```json
{
  "run_id": "run_20260714_0930",
  "execution_id": "exe_02",
  "worker_id": "runner-ap-sg-04",
  "lease_id": "lease_9f1",
  "lease_expires_at": "2026-07-14T09:45:00Z",
  "budget": {"wall_time_seconds": 900, "max_tool_calls": 30}
}
```

worker 仅在 lease 有效时调用工具；控制面在心跳丢失后等待租约失效，再决定是否重试。这样旧 worker 即使网络稍后恢复，也没有资格继续写入。对外部写操作必须以 `tool_effect.idempotency_key` 查询结果，不能因为 lease 过期就盲目再执行。

### 重试策略应按失败分类

| 失败类型 | 样例 | 是否自动重试 | 处理 |
| --- | --- | --- | --- |
| 瞬时基础设施 | runner 被抢占、DNS 超时 | 有界指数退避 | 新 execution，保留同一 run |
| 可恢复依赖 | package registry 限流 | 有界退避 + 熔断 | 切换镜像/等待窗口 |
| 模型/上下文 | 输出不合 schema、预算耗尽 | 不直接原样重试 | 缩小任务或进入人工 review |
| 策略拒绝 | 没有写入权限、审批过期 | 否 | 重新授权或结束 |
| 副作用未知 | 部署请求已发送但未收到回执 | 否 | 查询外部系统，人工仲裁 |

永久失败进入 dead-letter 不是“丢弃”；应保留输入快照、最后 checkpoint、错误分类、未确认 effect 和下一步责任人。对同一错误连续重试只会放大成本与下游压力。

## 五、会话继承策略：何时 fresh，何时 fork，何时持久

| 策略 | 输入 | 优点 | 风险 | 适用场景 |
| --- | --- | --- | --- | --- |
| `fresh` | 任务契约 + 最小事实 | 可审计、隔离、低污染 | 需要显式提供上下文 | 巡检、审阅、报告、批处理 |
| `fork` | 父 session 的受控快照 | 保留局部推理线索 | token 成本高、可能带入不可信内容 | 同一问题的备选方案 |
| `summary handoff` | 结论、证据、假设、未决项 | 上下文小且可检查 | 摘要可能遗漏 | 父子 Agent 协作默认选择 |
| `persistent` | 同一 named session | 适合连续计划和长期跟踪 | 污染、权限漂移、信息过期 | 明确要求跨次记忆的工作流 |

推荐给子 Agent 的输出协议：

```yaml
result:
  conclusion: "退款超时来自 client retry 配置不一致"
  evidence:
    - path: services/refund/src/RetryConfig.java
      lines: "42-61"
  assumptions:
    - "只检查了 main@9f8e7d6"
  effects: []
  suggested_next_step: "由实现 Agent 在独立 worktree 修复并执行 RefundIT"
```

只回传结构化结果与证据，不回传完整思维过程、全量日志或未过滤的网页文本。父 Agent 把这些作为证据候选，而不是自动相信。

## 六、并发编排：先做依赖图，再谈多 Agent

多 Agent 编排的最小单元应是一个带输入/输出契约的 task，而不是“再开一个聊天窗口”。

```text
                    +-- Explorer (read-only) --+
Request -> Planner -+                           +-> Integrator -> Review
                    +-- Test selector ---------+
                              |
                         Implementer
```

### 并发准入的四个闸门

1. **依赖闸门**：同一文件、lockfile、接口契约、发布资源或数据库迁移默认串行。
2. **资源闸门**：按团队、仓库、模型、runner、网络与成本分别限流，不使用单一全局并发数。
3. **权限闸门**：子任务获得 capability subset；read-only explorer 不能继承 deploy 或 secret scope。
4. **证据闸门**：下游只消费已验证的上游产物，如 commit SHA、测试报告、结构化结果，而不是聊天声称。

可使用租约表达文件/资源所有权：`(workspace_id, path_prefix, purpose, owner_run, expires_at)`。出现冲突时，主编排器选择等待、拆分、合并到独立 integrator，或将冲突升级给人；绝不让最后写入者静默覆盖。

### Budget 也要分层

```text
parent task budget
  -> child budget pool
      -> per child max tokens / wall time / tool calls / egress bytes
```

父任务应能随时停止未开始的子任务，并在自身预算耗尽时传播 cancellation。不要允许每个子 Agent 自行创建无限后代；设置最大深度、最大 fan-out、最大并发和剩余预算下限。这样可以防止“一个审阅任务递归派出几十个探索任务”的成本失控。

## 七、可靠投递：结果生成不等于用户已收到

聊天、邮件、Webhook、PR comment 都可能失败或被重复送达。把 delivery 设计成 outbox，而不是在 runner 完成后直接 `send()`：

```text
run reaches terminal state
  -> transaction writes result ref + outbox row
  -> delivery worker sends with idempotency key
  -> provider ack stored
  -> retry or dead-letter delivery independently of run
```

| 结果类型 | 推荐投递 | 必要保护 |
| --- | --- | --- |
| 成功摘要 | chat/notification | payload hash，避免重复刷屏 |
| 代码变更 | PR/diff review queue | commit SHA、CI 状态、review owner |
| 高风险告警 | 指定 on-call + incident system | 升级路径、确认回执、重复抑制 |
| 静默巡检 | 内部 result store | 仅在有变化/越阈值时外发 |

对于 scheduled run，`scheduled_at + job_revision + target` 可构成稳定 dedupe key。修改 schedule、prompt、能力或投递目标时递增 job revision，避免旧配置的延迟 run 在新配置下继续执行。

## 八、取消、暂停与超时：三者语义不同

| 动作 | 意义 | 运行中工作如何处理 |
| --- | --- | --- |
| Pause job | 停止未来触发 | 可选等待当前 run；不等同于 kill |
| Cancel run | 请求停止这一次工作 | 取消子任务、撤销 lease、清理工具句柄 |
| Timeout | 预算/时限耗尽 | 强制进入终止流程并核对 effect |
| Delete job | 删除定义 | 同时取消 in-flight run，并保留审计记录 |

取消要从根向叶传播：阻止新的 claim，向运行中的子 Agent 和工具发送 cooperative cancel，超时后强制终止进程或容器，撤销凭证和 network proxy session，最后冻结 trace。若某个外部 effect 状态未知，终态应为 `CANCELLED_WITH_UNKNOWN_EFFECT`，而不是伪装成正常取消。

### 子进程不能成为取消黑洞

工具执行器必须返回 process handle，支持 `poll/wait/log/kill`。如果一个 Agent 启动了测试服务器或长构建，即使父 session 已结束，控制面也必须能回收它。把 PID、容器 ID、启动命令摘要、资源上限和 owning run 写入执行记录；不要依赖模型文本说“我已经停止”。

## 九、四类产品的落地运行手册

### Claude Code

1. 将 Explore、Reviewer、Security Scan 配成只读子 Agent，实施者只写独立 worktree。
2. 在 `SubagentStart` 记录任务角色、worktree、预算和能力；在 `SubagentStop` 校验结果契约并保存证据索引。
3. 选择 Routines、桌面任务、GitHub Actions 或 `/loop` 前先决定执行地点和可用资源，不能以同一提示词假设四处行为相同。
4. 每个例行任务都要求输出“目标、已验证证据、未完成项”，并在成功状态之外审阅实际 transcript/diff。

### Codex

1. 将彼此独立的修改放到独立 thread/worktree；同一核心文件只保留一个写入 owner。
2. Automation 的指令必须固定输入范围、最大副作用、产物类型和 review owner；默认产出 review queue 项，而不是合并或部署。
3. 本机 Automation 需要设备存活假设，关键任务改放托管/CI 执行器并监控 missed run。
4. 用技能时绑定版本和评测结果；自动化周期性自修改技能时，候选 Skill 先进入隔离验证和人工 review。

### OpenClaw

1. 精确定时报告使用 isolated cron；长期连续规划才用 current/named session；将选择写在 job 定义中。
2. heartbeat 只处理“检查后有事才通知”的近似周期工作，避免承担精确 SLA、重任务或不可逆副作用。
3. 配置失败 destination、run retention 与 session retention，保证失败不会只留在本机日志。
4. 监控 skipped、pre-model stall、delivery failure、重复 run 和 job backlog；不要只看模型是否产出一句话。

### Hermes

1. `/background` 的 prompt 自包含，因其不带前台 session 历史；需要事实时传入受控摘要或文件引用。
2. cron job 指定 delivery target、超时、技能和 model/provider，定期检查 run metadata 与 lock/queue 健康。
3. 将 Agent background session 与 `terminal(background=true)` process 分别登记、限额与回收。
4. 通过 API 的 pause/resume/delete 操作纳入企业审批与审计；删除必须确认在途 run 与进程都已经收敛。

## 十、系统设计高频追问

### Q1：如何保证一个每小时任务不重跑两次？

> 先以 `(job_id, job_revision, scheduled_at)` 创建唯一 run，再由数据库唯一索引或事务锁保证只写入一次。worker 通过带 TTL 的 lease claim run；执行前为每个外部工具调用生成 idempotency key。调度器层的分布式锁只防止同一 tick 被多个 scheduler 重复处理，不能替代 run 去重和副作用去重。

### Q2：为什么隔离 session 还要做权限隔离？

> session 隔离解决上下文不串线，不会阻止 Agent 调用已经配置好的工具。权限隔离还要在 capability grant、工具网关、执行器 sandbox 和资源服务 ACL 上完成。反过来，有工具权限也不应允许读取另一个用户 session 的历史。

### Q3：子 Agent 成功但父任务失败，怎样保留价值？

> 子 Agent 的输出先作为不可变 artifact 存储，父任务仅引用 artifact ID。父任务失败不会删除已经验证的证据、测试报告或候选 patch；重新规划时可以复用它们，但必须检查输入 commit、策略版本和有效期。不要把结果只塞在父对话上下文，因其可能被压缩或过期。

### Q4：定时任务的“成功率”应该怎么算？

> 至少拆成四层：按时创建 run 的 trigger success、runner 正常结束的 execution success、任务验收条件满足的 outcome success、目标渠道已确认收到的 delivery success。Claude Code Routines 的基础设施成功不等于任务目标成功正是这个区分的现实例子。报警应看每层的失败率和 P95 延迟，而非一个绿灯。

### Q5：如何给多 Agent 设置成本上限？

> 预算在 admission 时由父任务切分，子任务不能凭空扩容。每层都有最大 fan-out、depth、token、wall time、tool calls、egress bytes 和并发数；预算耗尽会阻止新的 child claim，并取消尚未开始的低优先级工作。最终花费按 run、模型、工具和工作区归因，才能发现递归派工或异常重试。

## 十一、上线检查表

### 语义与数据

- [ ] 每个自动化明确是 fresh、fork、summary handoff 还是 persistent session。
- [ ] `job/run/execution/session/tool effect/outbox` 有独立 ID、终态和保留策略。
- [ ] schedule、prompt、技能、权限、投递目标的变更都产生 revision。

### 调度与可靠性

- [ ] 同一调度窗口使用稳定 dedupe key，worker claim 使用 TTL lease。
- [ ] 重试按失败类别处理，未知副作用绝不自动重放。
- [ ] 结果与 delivery 分离，支持外发确认、重试、dead-letter 和去重。
- [ ] 延迟、backlog、missed run、pre-model failure、delivery failure、成本和无效循环都可观测。

### 安全与运维

- [ ] 子 Agent 默认获得最小 capability subset，默认没有生产写入和长期密钥。
- [ ] 每个后台 OS process 可列举、查看日志、等待、kill 和自动回收。
- [ ] pause、cancel、delete、timeout 都有明确差异和级联行为。
- [ ] 高风险任务进入 review/approval，而非因 schedule 存在就自动获得执行权。

## 延伸阅读

- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)：Routines、桌面计划任务、GitHub Actions 和 `/loop` 的执行位置选择。
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents) 与 [Hooks](https://code.claude.com/docs/en/hooks)：子 Agent 隔离与生命周期策略插槽。
- [Codex App](https://openai.com/index/introducing-the-codex-app/) 与 [Codex Automations](https://openai.com/academy/codex-automations/)：多 Agent worktree、后台 Automation 和 review queue。
- [OpenClaw Automation](https://docs.openclaw.ai/automation)、[Scheduled Tasks](https://docs.openclaw.ai/cron)、[Heartbeat](https://docs.openclaw.ai/gateway/heartbeat)：cron、心跳和 session 模式。
- [Hermes Background Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/cli)、[Cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron) 与 [Jobs API](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/)：后台运行、调度、投递和管理 API。
