# 多 Agent 共享工作区并发控制：Worktree、租约、产物与合并队列

> 多 Agent 并行写代码的难点不在于开几个会话，而在于如何避免文件覆盖、环境污染、重复修改同一业务规则，以及把在旧基线测试通过的变更错误合入主干。本页将问题拆成文件隔离、任务所有权、共享资源、变更整合和恢复五层。

> 委派与上下文契约见 [多 Agent 委派与 Handoff 控制平面](/interview/multi-agent-delegation-handoff-playbook)，工具/Hook/验收见 [智能编码 Agent 企业操作手册](/interview/coding-agent-production-playbook)，中断恢复见 [长运行 Agent 检查点、恢复与人工 Steer](/interview/long-running-agent-recovery-playbook)。

## 一、30 秒总答法

> 我不让多个 Agent 直接在同一 checkout 编辑。协调器先把任务拆成带输入基线、路径/模块所有权、资源声明、产物契约和验收标准的 work item；每个可写 work item 在独立 worktree 或容器中执行，并获得 TTL 与 fencing token 的 claim。Worktree 解决文件即时覆盖，claim 解决任务重复，资源锁解决 migration、lockfile、端口、共享 sandbox 和发布目标，artifact manifest 解决“改了什么、依赖什么、可否合并”。完成后 Agent 提交临时 branch，Merge Controller 在最新主干重放/合并、运行影响范围测试、安全检查和冲突决议；基线过期或 claim 失效的结果必须 rebase/revalidate，不能静默合入。

## 二、并行的四种冲突

| 冲突层 | 例子 | Worktree 能否单独解决 | 需要的控制 |
| --- | --- | --- | --- |
| 文件文本 | 两个 Agent 修改同一行或 lockfile | 可避免即时覆盖 | 路径所有权、三方合并、冲突队列 |
| 语义设计 | 分别实现两套鉴权/DTO/错误码 | 否 | 任务边界、接口 contract、设计 owner review |
| 共享资源 | 同时跑 migration、占端口、写同一测试租户 | 否 | resource lease、namespace、隔离 sandbox |
| 集成基线 | 都基于旧 main 通过测试 | 否 | merge queue、rebase/revalidate、顺序化发布 |

“每 Agent 一个 branch”只解决第一层的一部分。两个不同文件的改动仍可能共享数据库 schema、公开 API、feature flag 或 release manifest。

## 三、Work Item Contract：先声明，再并发

```yaml
work_item:
  id: wi_auth_17
  base_commit: a1b2c3d
  owner_agent: auth-implementer
  ownership:
    write_paths: ["services/auth/**", "tests/auth/**"]
    read_only_paths: ["packages/contracts/**"]
    forbidden_paths: ["infra/prod/**", "db/migrations/**"]
  resources:
    leases: ["test-tenant:auth-17", "port-range:4500-4510"]
  inputs: { contracts: ["auth-api@4.2.0"], decisions: ["adr-019"] }
  outputs: { artifacts: ["git-diff", "test-report", "security-scan"] }
  acceptance: { commands: ["pnpm test auth"], required_checks: ["api-contract"] }
  claim: { ttl_seconds: 1800, fence: 21 }
```

### 为什么路径所有权仍不够

- `packages/contracts/**` 是多个模块的依赖，应由专门 owner 串行修改。
- lockfile、全局配置、生成代码、schema migration、根 README、CI workflow 是高碰撞文件，应进入显式单写队列。
- “只改测试”也可能改共享 fixture、端口、测试数据库或 snapshot 基线。
- 路径匹配只能做 admission 的快速筛选；真实语义冲突仍要由 contract diff、集成测试和 merge queue 发现。

## 四、隔离执行：Worktree、容器与临时资源

Claude Code 文档说明，git worktree 为并行 session 提供独立目录和 branch，subagent 可通过 `isolation: worktree` 获得临时隔离。它同时提醒 worktree 是新 checkout，gitignored 配置复制需要显式规则，未提交变更的清理会丢失内容。[Claude Code Worktrees](https://code.claude.com/docs/en/worktrees)

Codex App 也以 built-in worktree 支持让多个 Agent 在同一 repo 并行工作而不触碰彼此的本地 git 状态。[Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)

| 隔离面 | 推荐实现 | 常见遗漏 |
| --- | --- | --- |
| 源码 | 每 work item 一份 worktree + 临时 branch | 在主 checkout 写文件 |
| 依赖 | 容器/缓存 key 按 lockfile digest；只读共享缓存 | 多 Agent 同写 `node_modules` 或语言缓存 |
| 进程 | namespace、端口租约、PID cgroup | 测试 server 占默认端口、遗留后台进程 |
| 数据 | 每 Agent ephemeral database / test tenant | 清空共享数据库或污染 fixture |
| 凭证 | task scoped 短期 token | 将个人/生产密钥复制到 worktree |
| 网络 | allowlist、代理审计、默认无生产 egress | 测试脚本意外调用真实第三方 |

不要用复制脚本把所有 ignored files 带进每个 worktree。只复制无敏感的本地开发配置；密钥由凭证代理按 task/workspace 发行并审计。

## 五、Claim、Lease 与 Fencing

任务列表的 `claimed` 不足以应对崩溃、网络分区或被重启的 Agent。使用可过期 claim：

```text
READY --claim(fence=21, ttl)--> RUNNING --heartbeat--> RUNNING
  ^                                  |                    |
  | lease expired / release           | complete           | stale completion
  +-----------------------------------+--------------------+--> reject
```

1. claim 原子分配单调递增 `fence`，环境、artifact registry 和 Merge Controller 都保存它。
2. 写 artifact、提交状态、上传报告、申请 merge 都携带 fence；旧 fence 即使 token 尚在也被拒绝。
3. 心跳只能续当前 owner 的 claim；协调器回收超时 worker 的 worktree、容器、端口和 token。
4. 不可中断测试/构建标记 `CANCELLING`，最大运行时间后隔离，不能让新 worker 复用同一资源。

lease 只是“可以尝试工作”，fence 才能让下游拒绝旧 owner 的迟到写入。

## 六、Artifact Contract：Handoff 不靠聊天摘要

```json
{
  "work_item_id": "wi_auth_17",
  "fence": 21,
  "base_commit": "a1b2c3d",
  "head_commit": "d4e5f6a",
  "changed_paths": ["services/auth/login.ts", "tests/auth/login.test.ts"],
  "contracts_changed": [],
  "commands": [{"name": "pnpm test auth", "exit_code": 0}],
  "artifacts": [{"kind": "test-report", "digest": "sha256:..."}],
  "known_limits": ["integration test requires staging secret"]
}
```

Merge Controller 验证 base commit、claim/fence、ownership、可信 build、测试对当前目标分支是否仍有效。聊天结论只能作为备注，不能成为合并证据。

| 产物 | 正确写入模式 |
| --- | --- |
| 代码 diff | Agent 私有 branch；Merge Controller 顺序整合 |
| API/schema contract | 专门 owner 串行修改，消费者随后并行适配 |
| 测试报告/coverage | immutable content-addressed blob，append-only index |
| 构建缓存 | 按 digest 只读共享，写入使用原子 publish |
| 发布 manifest | 单 writer + prepare/approval/commit |

## 七、Merge Queue：隔离不等于可合并

```text
candidate branch + artifact bundle
  -> ownership/fence/base validation
  -> rebase or merge onto current queue head
  -> impacted tests + contract/security checks
  -> human review when required
  -> atomic merge / publish receipt
```

若 candidate 的 `base_commit` 落后于 queue head：

1. 计算路径、接口、lockfile、migration 和 feature flag 的影响。
2. 自动三方合并后仍在合并 tree 重新运行受影响测试。
3. 语义冲突、API contract 变化、测试基线漂移和高风险文件重叠进入 `NEEDS_REPLAN`，由原 Agent 或 owner/human 处理。
4. Controller 不得为“提高通过率”静默丢弃 Agent diff。

合并顺序可以 dependency-first（contract/schema 先）、risk-first（低风险测试先）或 critical-path-first（先解除阻塞）。无论采用哪种，单次 task 都要固定到单一 contract digest，避免队列中途热更新工具/配置让同一变更失去可复现性。

## 八、Runtime 映射与不可假设的行为

| Runtime | 可借用的并发能力 | 控制面仍需补齐 |
| --- | --- | --- |
| Claude Code | worktree session、隔离 subagent、共享 task list/消息 | ownership、环境租约、artifact/merge policy |
| Codex | 并行线程与 built-in worktree | task contract、共享资源隔离、主干 merge gate |
| OpenClaw | Gateway/session/job/subagent 编排与持久状态 | git worktree 策略、repo ownership、CI merge queue |
| Hermes | 多 session、background job、terminal policy | 工作区 clone、资源 namespace、artifact/merge controller |

Claude Code 的 Agent Teams 文档指出，teammate 共享 task list 和消息，但默认不以 worktree 隔离；任务触及同一文件时应先 partition ownership 或显式隔离。能协作不等于可以并发写同一目录。[Claude Code Parallel Agents](https://code.claude.com/docs/en/agents)

## 九、系统设计题：十个 Coding Agent 并行修复 monorepo

**题目**：十个 Agent 同时修复支付、鉴权、前端、文档、测试和 CI。要求一小时内出 PR，不影响开发者本地工作，不能污染测试租户、重复 migration 或错误合并。如何设计？

1. **Planner**：从 issue/依赖图生成 work items，指定模块/路径 ownership、contract owner、资源、验收和 base commit；migration 独占。
2. **Scheduler**：按依赖、风险、预算和资源 claim；提供 TTL/fence，失败后安全转交。
3. **Workspace Manager**：每项建立 worktree + 容器；临时数据库、端口、缓存与 token namespace 化。
4. **Agent Runner**：只能写 own paths，最小网络/secret；持续写 checkpoint 和 artifact manifest。
5. **Merge Controller**：按依赖入队，在 queue head rebase/revalidate；冲突进入 replan/human，验证后才原子合入。
6. **Cleanup**：claim 到期回收资源，拒绝 stale fence，保留 commit、日志和证据供接管。

### 高频追问

**Q：为什么不让所有 Agent 在同一分支随时 pull/rebase？**

> 共享目录会引入未保存编辑覆盖、依赖安装竞争、测试端口冲突和不可复现中间状态；频繁 rebase 还让模型不断重规划。worktree 隔离编写，Merge Controller 串行整合，才把并行限制在可控边界。

**Q：两个 Agent 只改不同文件，为什么仍要协调？**

> 它们可能共享 API、schema、feature flag、lockfile、fixture 或同一业务假设。路径无交集只是低成本信号；Contract diff、依赖图、集成测试和 merge queue 才验证语义可组合。

**Q：旧 Agent 的提交还能用吗？**

> 只能作为 candidate artifact。新 owner 用当前 fence、主干和 policy 重新验证 diff、测试和资源影响；旧 Agent 的状态写入和自动 merge 都因 stale fence 被拒绝。

## 十、上线检查表

- [ ] work item 有 base commit、ownership、资源 lease、验收、artifact 和 TTL/fence。
- [ ] worktree、容器、端口、数据库、缓存、网络、凭证按 Agent/work item 隔离；不复制 ignored secrets。
- [ ] lockfile、migration、CI、生成代码、公开 contract、根配置和 release manifest 有单写或专门 owner。
- [ ] artifact bundle 可验证 commit、变更路径、测试、扫描、contract diff 与已知限制。
- [ ] Merge Controller 在当前 queue head 重新验证；语义冲突进入 replan/human，不静默合并。
- [ ] claim 过期、取消、环境失败和 worker 崩溃会回收资源、拒绝 stale fence 并保留证据。
- [ ] 演练重叠编辑、并发 migration、端口冲突、旧基线、半完成 worktree、重复完成和 merge 后测试失败。

## 延伸阅读

- [Claude Code Worktrees](https://code.claude.com/docs/en/worktrees)、[Parallel Agents](https://code.claude.com/docs/en/agents)：并行 session、worktree、subagent 和团队边界。
- [OpenAI: Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)：并行 Agent、内建 worktree 和本地 git 状态隔离。
- [多 Agent 委派与 Handoff 控制平面](/interview/multi-agent-delegation-handoff-playbook)、[智能编码 Agent 企业操作手册](/interview/coding-agent-production-playbook)：委派、工具策略、验收证据和交付流程。
