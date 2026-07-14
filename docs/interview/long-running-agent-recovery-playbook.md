# 长运行 Agent 检查点、恢复与人工 Steer：Claude Code / Codex / OpenClaw / Hermes

> 长运行 Agent 的难点不在于把进程留在后台，而在于进程、客户端、Gateway 或机器中断之后，系统能否分辨“聊天可以恢复”“执行可以继续”和“外部副作用已经发生”这三件事。正确的生产答案不是重新运行最后一条 prompt，而是从持久状态、租约、幂等键和下游回执做恢复决策。

> 后台 job、lease 与取消传播见 [Agent 自动化与后台编排生产设计](/interview/agent-automation-orchestration-playbook)，持续授权/撤权见 [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)，证据与 effect 对账见 [Agent 观测、取证与事故响应手册](/interview/agent-observability-incident-response)。

## 30 秒总答法

> 我把长运行 Agent 分成逻辑 task、一次 execution attempt、交互 session 和外部 effect 四个对象。控制面在副作用前、工具返回后、人工等待前、worker 切换前写 checkpoint，持久化计划版本、run manifest、已验证 artifact、lease/fence、approval、intent digest、idempotency key 与 effect status。恢复时先获得新 lease，并重新检查身份、策略、配置、环境和审批；然后按 effect 对账结果决定 continue、wait、compensate、ask human 或从安全 step 重启。人工中途 steer 不是普通聊天追加，而是带 `expected_plan_revision` 的暂停/取消/重规划命令，先撤销未开始 step 的能力，再处理在途 effect。Claude Code 的 background session 可在 terminal 关闭后继续但休眠/关机后要 respawn；Codex 允许跨设备查看、批准与改方向而执行仍留在受信机器；OpenClaw 把 session/job/queue 放入持久存储并带恢复安全阀；Hermes 以 SQLite session、独立 background session 和 jobs API 支持恢复。所有 Runtime 的 transcript resume 都不能替代业务 effect 的查询与幂等控制。

## 一、四个对象与三种恢复

| 对象 | 负责什么 | 可持久化事实 |
| --- | --- | --- |
| Task | 业务目标与最终验收 | owner、DAG、预算、终态 |
| Attempt | 某次执行尝试 | worker、lease、plan revision、checkpoint |
| Session | 人机对话与上下文 | transcript、summary、system/config snapshot |
| Effect | 外部世界变化 | idempotency key、resource ID、receipt、对账状态 |

| 恢复层 | 能恢复 | 不能自动保证 |
| --- | --- | --- |
| Conversation resume | 消息、摘要、工具历史 | 外部调用未发生或仍可重试 |
| Execution resume | job、step、队列、worker 分配 | 下游资源的真实状态 |
| Business recovery | effect 状态、补偿路径 | 模型重新推理得到相同文本 |

**核心原则：** transcript 是线索，effect receipt 才是事实。生产系统不能因为“历史里说已部署”就跳过下游查询，也不能因为进程消失就默认部署失败。

## 二、检查点模型

```yaml
checkpoint:
  task_id: task_842
  attempt_id: att_104
  sequence: 19
  state: WAITING_FOR_APPROVAL
  plan_revision: 7
  manifest_digest: sha256:...
  lease: {id: lease_23, fence: 18, expires_at: ...}
  completed:
    - {step: reproduce, artifact: sha256:..., verified: true}
    - {step: patch, artifact: git:worktree@abc123, verified: true}
  pending:
    step: deploy_staging
    intent_digest: sha256:...
    idempotency_key: dep_task842_rev7
    approval_id: apr_390
  effects:
    - {id: ci:run/19, status: CONFIRMED}
    - {id: deploy:pending, status: UNKNOWN}
```

检查点应在 effect boundary、人工等待、DAG 节点完成和 context 压缩/迁移处写入，而不是每一个 token。要求如下：

1. 使用 sequence 或 compare-and-set 追加，旧 worker 不能覆盖新状态。
2. 保存 artifact/effect 的 digest 和受控引用，不将密钥/原始私有内容塞进 transcript。
3. 同一 effect 使用稳定 idempotency key；恢复先 query，再执行。
4. 未终态 effect 标记 `UNKNOWN`，不能被自动归类为成功或失败。
5. checkpoint 与 run manifest、policy revision、capability/approval 关联，恢复时可验证是否过期。

## 三、恢复状态机

```text
interrupted / disconnected
          |
          v
RECOVERY_CANDIDATE -> validate checkpoint -> acquire new lease
          |                                      |
          | invalid/stale                         v
          v                               reconcile effects
      NEEDS_HUMAN                    /       |       |       \
                                  continue  wait  compensate  restart-safe-step
```

恢复 admission 必须检查：task 是否取消、当前 owner/fence、policy 与 capability 是否有效、manifest/环境是否可用、资源锁是否仍持有、审批是否过期、checkpoint 是否完整。之后按下游查询结果决策：

| 对账结果 | 动作 |
| --- | --- |
| `NOT_STARTED` | 在当前 grant/lease 下继续该 intent |
| `CONFIRMED` | 写 checkpoint，进入下一 step，不重发 |
| `IN_PROGRESS` | 等待/轮询到上限，禁止并发重复提交 |
| `UNKNOWN` | 冻结分支，交给 reconciler 或人工 |
| `FAILED_COMPENSABLE` | 新建补偿 task 与审批，不在原 run 静默修复 |

取消仅表达意图；停止进程、撤销凭证和 effect 对账各自都必须完成。网络分区下旧 worker 可能继续运行，因此所有写网关还应检查 lease fence/owner revision，拒绝迟到写入。

## 四、人工 Steer 协议

人类说“先别部署，只生成报告”时，把文本追加到 session 不会可靠地停止已调度 worker。应写入版本化控制命令：

```json
{
  "command_id": "cmd_211",
  "task_id": "task_842",
  "expected_plan_revision": 7,
  "operation": "SUSPEND_AND_REPLAN",
  "scope": ["deploy_staging", "notify_release"],
  "issued_by": "user:alice"
}
```

控制面 CAS 更新 plan revision，撤销未开始 step 的 capability/lease，向在途 worker 发 cooperative cancel。对于已经跨过 effect boundary 的 step，先对账，再决定补偿；新计划可复用已验证 artifact，但不能复用已经失效的审批。

| 命令 | 对未开始 step | 对已发生 effect |
| --- | --- | --- |
| `PAUSE` | 不再领取，保留 checkpoint | 不回滚，等待决策 |
| `CANCEL` | revoke lease，终止 runner | 对账后按需补偿 |
| `REPLAN` | 建立新 DAG revision | 只复用验证过的 artifact |
| `ANSWER_QUESTION` | 解锁等待 step | 回答写入新 checkpoint/digest |
| `TAKE_OVER` | 人类/新 owner 获得控制权 | 旧 owner 因 fence 失效 |

前端 SSE/WebSocket 断开不等于任务取消。客户端用 event cursor 重连，控制面提供当前状态快照并允许重复投递幂等 command；最终交付仍以 durable task/effect 状态确认。

## 五、四类 Runtime 的公开恢复面

### Claude Code

[Agent View](https://code.claude.com/docs/en/agent-view) 使用独立 supervisor 托管后台 session，terminal 关闭后仍可 `attach`、`reply`、`stop` 或 `respawn`，并将 session state 留在本地磁盘。官方同时明确背景 session 不穿越机器休眠/关机，醒来后要重启；worktree 随 session 删除还可能丢失未合并改动。实践上将它当 conversation/execution 的便利层，不让它单独决定发布、付款或外发的恢复。

### Codex

[Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/) 允许从授权设备查看 active thread、输出、diff、测试与批准、改变方向；文件、凭证、权限和本地配置仍留在实际执行机，relay 不直接暴露设备。远程 steer 应写入企业控制面并经身份/权限检查，而不是把手机 UI 状态当作 effect ledger。

### OpenClaw

[Restart Recovery](https://docs.openclaw.ai/gateway/restart-recovery) 将 session、job、subagent、background record、outbound queue 与 cron state 持久化，Gateway 重启后可恢复中断工作；同时不会盲目重跑不安全 transcript tail、过久中断的 child 或反复失败的 session。[Cron](https://docs.openclaw.ai/cli/cron) 的 job/run history 也保存在共享 SQLite。这是很好的 runtime 防护，但业务系统仍须幂等与对账。

### Hermes

[Hermes Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/) 在 SQLite 保存模型配置、system prompt snapshot、消息、工具结果和 lineage，可按 ID/名称恢复；[CLI](https://hermes-agent.nousresearch.com/docs/user-guide/cli) 的 `/background` 则创建独立 conversation，只继承当前配置不继承当前历史。生产工作流应使用 session ID 关联证据，却不能因为有完整消息历史就自动重发工具调用。

## 六、系统设计题

> Agent 用 90 分钟分析告警、生成修复 PR，等待 staging 审批时 laptop 休眠、Gateway 重启。用户从手机说“停止部署，只保留报告”。如何保证安全？

1. Research、patch、test、approval、deploy 是独立 step；已完成 step 有 artifact/evidence checkpoint，deploy 仅有冻结 intent，尚未产生 effect。
2. 进程中断后 lease 过期。恢复 worker 重新校验 manifest、policy、审批、owner/fence，再从 checkpoint 发现任务等待审批。
3. 手机提交 `SUSPEND_AND_REPLAN(expected_revision=7)`；控制面撤销 deploy capability，runner 停止领取后续 step。
4. 如果 deploy request 已发出，用 idempotency key 查询 provider。`UNKNOWN` 时不重试，创建 reconciliation/human task。
5. 仅基于已验证 incident artifact、PR 和 test evidence 生成报告；对话恢复绝不会自动部署。

### 高频追问

**Q：为什么不每次 tool call 都 checkpoint？** 高频日志缺少业务语义。应在 effect、人工等待、DAG 节点和可验证 artifact 边界保存；trace 负责细节排障。

**Q：怎样保证人类插话优先于 Agent 下一步？** control command 使用 plan revision 与 fence，网关每次 effect 前校验当前版本。若已经写入下游，只能对账/补偿，不能假装取消成功。

**Q：恢复后模型给出不同方案怎么办？** 模型可能不确定。用 pinned manifest、artifact 和测试约束恢复；允许重新规划，但所有写 effect 都重新走当前 policy/approval。

## 七、上线检查表

- [ ] 有 durable task/attempt/step/checkpoint/lease/effect，而不仅有聊天 transcript。
- [ ] checkpoint 包含 plan revision、manifest、artifact、intent digest、idempotency key、approval 与 reconciliation 状态。
- [ ] resume 前重新检查 owner/fence、policy、grant、环境与 checkpoint integrity。
- [ ] `UNKNOWN` effect 自动进入对账，不自动重试高风险写操作。
- [ ] pause/cancel/replan/take-over 是带身份和 revision 的控制命令。
- [ ] 演练休眠、crash、Gateway restart、网络分区、重复恢复、过期审批和旧 worker 迟到写入。
- [ ] worktree/container/token/lock 在完成、取消和 orphan recovery 后显式回收。

## 延伸阅读

- [Claude Code Agent View](https://code.claude.com/docs/en/agent-view)：background session、supervisor、respawn 与休眠限制。
- [Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)：跨设备 thread、relay、远程审批与 steer。
- [OpenClaw Restart Recovery](https://docs.openclaw.ai/gateway/restart-recovery) 与 [Cron](https://docs.openclaw.ai/cli/cron)：持久状态、恢复安全阀和 job history。
- [Hermes Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/) 与 [CLI Background Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/cli)：SQLite session、独立后台会话与恢复语义。
