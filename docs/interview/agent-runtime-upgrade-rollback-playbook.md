# Agent Runtime 升级、兼容性与回滚：Claude Code / Codex / OpenClaw / Hermes

> Agent Runtime 的升级绝不只是 `npm update` 或拉一个新镜像。它可能改变模型行为、指令加载、工具 schema、sandbox、网络、OAuth、Plugin ABI、memory/session 格式和审批默认值。生产面试要能解释：怎样在不丢身份、不放宽权限、不污染状态的前提下升级，以及出事后怎样回到一个已验证的运行闭包。

> 单次运行需要记录什么见 [Agent 可复现运行与配置溯源](/interview/agent-reproducibility-provenance-playbook)，扩展包供应链见 [跨运行时 Agent 扩展生产治理](/interview/agent-skills-production-governance)，任务中的授权变化与紧急撤权见 [长任务 Agent 持续授权与紧急撤权](/interview/agent-continuous-authorization-playbook)。

## 30 秒总答法

> 我把 Agent Runtime 升级当成带状态的数据迁移和安全发布，而非二进制替换。先把 core、model/endpoint、plugin/skill/MCP、config schema、policy、sandbox image、auth references、session/memory 和外部 connector 编成兼容矩阵；升级前生成加密状态快照和可恢复 manifest，执行 dry-run/schema/policy/依赖检查。然后在隔离 canary 上跑同一套 golden、权限、注入、sandbox、迁移和恢复用例，比较 effective config 与 capability diff。通过后按 agent、租户、节点或流量分批切换并观测 approval、deny、tool error、token、成本和副作用；失败就停止扩量，回滚 runtime/config/plugin 指针与可逆状态迁移，吊销新 credential。外部邮件、部署、数据库写入无法靠二进制回滚，所以还要以 effect ledger 做业务补偿和对账。

## 一、版本不是一个数字，而是一组兼容闭包

一个健康的发布对象至少需要以下维度。任何维度漂移都可能令“同一 prompt”产生不同权限或副作用。

| 维度 | 例子 | 风险 |
| --- | --- | --- |
| Runtime / Harness | Claude Code、Codex、OpenClaw Gateway、Hermes core | 事件、工具调用、默认行为改变 |
| 模型与 endpoint | model alias、provider、reasoning/工具格式 | 轨迹、成本、拒绝行为变化 |
| 扩展 | Plugin、Skill、MCP、Hook、二进制依赖 | tool surface 与供应链变化 |
| Config / policy | schema、managed settings、allow/deny、approval | 升级后权限被静默放宽或收紧 |
| 执行环境 | image digest、sandbox、网络、Node/uv 依赖 | 构建、文件和外联行为漂移 |
| 有状态数据 | auth reference、session、memory、cron、索引 | 丢登录、跨租户串数据、无法启动 |
| 外部 effect | PR、邮件、工单、部署、账单 | 不能用 rollback 假装不存在 |

可审计的 release manifest 示例：

```json
{
  "release_id": "agent-2026-07-14.3",
  "runtime": {"name": "openclaw", "from": "2026.6.9", "to": "2026.7.1"},
  "image_digest": "sha256:...",
  "config_schema": {"from": 18, "to": 19, "migration": "m-418"},
  "plugins": [{"id": "@company/crm", "from": "2.4.1", "to": "2.5.0", "abi": "v4"}],
  "policy_digest": "sha256:...",
  "snapshot_ref": "vault://agent-backup/2026-07-14T10:00Z",
  "rollback_target": "agent-2026-07-01.2",
  "test_suite": "runtime-release-v17"
}
```

## 二、发布前先做兼容性分级

| 变化 | 是否可原地升级 | 处理方式 |
| --- | --- | --- |
| patch runtime，接口/默认值不变 | 通常可 | canary + smoke + telemetry |
| 新增 config 字段 | 可，但必须有默认/迁移 | schema preflight + effective-config diff |
| 删除/改名配置、Plugin ABI | 不应盲目原地升级 | preview + staged migration + backout plan |
| auth/profile/session 存储布局 | 高风险 | 加密备份、双读/双写或隔离导入 |
| tool schema / approval 默认值 | 高风险 | capability regression，默认 fail closed |
| MCP/外部 API 行为 | 需隔离验证 | contract test、只读 canary、回退 connector |

一个好的规则是：**不认识的字段、失败的迁移、丢失的签名、无法确定兼容的 Plugin，都默认停在 admission 前，而不是带着旧状态强行启动。**

## 三、升级流程：从 check 到 effect reconciliation

```text
inventory -> backup/snapshot -> plan/dry-run -> isolated canary
  -> config + policy migration -> regression/security gates
  -> staged rollout -> observability -> promote or halt
  -> rollback runtime/state pointer + reconcile external effects
```

1. **Inventory。** 收集所有 agent/node/profile 的实际版本、effective config digest、plugin/MCP 清单、模型 provider、auth reference、sandbox image、session/memory 格式和正在运行任务。
2. **Snapshot。** 对 config、auth reference 元数据、session/memory、skills/plugins、cron、gateway pairing 做加密、可恢复快照。备份不等于把 secret 打进 CI artifact；保存 Vault reference 或加密归档，限制恢复权限。
3. **Plan。** 先运行只读更新检查和 migration dry-run，输出字段级 diff、需重启组件、不可逆步骤、冲突项与人工批准项。
4. **Canary。** 用复制或脱敏状态在独立 workspace/profile/node 上升级，禁止生产写工具。验证启动、身份、配置解析、插件发现、MCP handshake、sandbox/egress 与关键任务。
5. **Gate。** 除成功率外，检查 effective tool 集合、可写根、网络 allowlist、approval prompt、拒绝率、secret redaction、跨租户可见性、token/延迟/成本和 trace 字段。
6. **Rollout。** 按开发者或 agent profile、节点、内部租户、低风险只读任务、写工具分批；任一硬红线触发 stop-the-line。
7. **Reconcile。** 回滚二进制前先冻结新任务与新凭证；对已产生 PR/工单/消息/部署用 idempotency key、provider request ID 和 effect ledger 对账、撤销或补偿。

## 四、配置迁移的两条铁律

### 1. 永远先看“有效配置”，再看文件 diff

同一 YAML/TOML/JSON 在版本升级后可能由新的默认值、managed scope、环境变量或 Plugin 覆盖产生不同效果。迁移 gate 应比较：

```text
old effective config -> normalized policy/capability snapshot
new effective config -> normalized policy/capability snapshot
diff -> expected / reviewed / forbidden
```

禁止项例如：sandbox 从 enabled 变 off、network allowlist 变 `*`、只读 tool 变成写 tool、`ask=always` 变 off、agent 获得另一个租户的 credential reference。配置迁移必须原子写入，保留前像和 migration report；失败时回到上一个可启动快照。

### 2. runtime rollback 不等于 state rollback

对状态迁移采用 `expand -> dual-read -> backfill -> cutover -> contract`：旧新版本在一段窗口都能读，先添加新字段，验证回填，再切换读路径，最后才删除旧字段。若做不到双读，至少保留可恢复原始快照和明确的 downgrade 约束。不可逆 schema migration 必须有明确 change ticket 和手工恢复步骤。

## 五、四类 Runtime 的升级映射

### Claude Code：渠道、最低版本与受管策略

Claude Code 支持 `latest` 与 `stable` 自动更新渠道，后者通常延迟约一周以跳过重大回归；组织可用 managed settings 统一渠道。`minimumVersion` 只设下限，防止改到 stable 后降回更低版本；CLI 也支持 `claude install <version>`、`claude update`。这适合企业将“最新试验组”和“稳定生产组”分开，而不是让每台开发机自行漂移。[Claude Code Advanced setup](https://code.claude.com/docs/en/setup) [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)

升级 gate 不只测聊天质量：要重新核对 managed permission rules、sandbox/network、MCP/Hook、Skill 与 `CLAUDE.md` 的实际解析结果。若新版本修复安全问题可设 minimumVersion 强制下限；若出现回归，通过受管 release channel/特定版本安装回退，并保留每次 Agent run 的版本证据。

### Codex：托管 requirements、规则和 telemetry 一起演进

Codex 的生产控制面可把 `allowed_sandbox_modes`、网络 proxy、域名 allow/deny、keyring、forced login、规则与 OpenTelemetry 设为受管要求。升级 Codex 或模型并不应绕过这些 requirements；canary 要比较 sandbox boundary、approval decision、MCP 使用与网络代理 allow/deny 事件，而不只是看任务是否完成。[Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/)

对模型/agent loop 行为变更，固定 benchmark repo SHA、`AGENTS.md` 解析结果和 config/profile，使用同一任务集 replay。规则与 requirements 的版本也进 release manifest；回滚应先恢复受管配置和运行环境，再恢复客户端，避免旧 runtime 读取新格式的策略文件。

### OpenClaw：Doctor、状态目录与 Plugin 联动升级

[OpenClaw Updating](https://docs.openclaw.ai/install/updating) 的推荐后置动作是 `openclaw doctor`、gateway restart 与 health 检查；故障恢复可以 pin npm version 后运行 doctor/restart，并可用 `OPENCLAW_NO_AUTO_UPDATE=1` 阻止自动 apply。关键点是它的状态不只在 `openclaw.json`：per-agent auth profile、channel/provider credentials、sessions、workspace、skills 都在 state dir。迁机器或回退要完整迁移并保持 owner/权限，不能只复制一份 config。[OpenClaw Migration guide](https://docs.openclaw.ai/install/migrating)

Plugin 需与 core 的兼容版本一起检查。官方 troubleshooting 特别提醒 OpenClaw 自带 Plugin 往往随 core release 对齐；过度死锁旧版插件会让核心升级后插件 stale/disabled。安全安装策略应在可信升级窗口允许已审核的兼容候选，然后恢复严格规则；失败的 Plugin 先 inspect 再 enable。[OpenClaw troubleshooting](https://docs.openclaw.ai/help/troubleshooting)

### Hermes：预检、快照、配置迁移和自动回滚

[Hermes Updating](https://hermes-agent.nousresearch.com/docs/getting-started/updating/) 的 `hermes update --check` 可只读确认落后状态；更新会做轻量配对数据快照、拉取、关键文件语法验证、依赖更新、config migration 与 gateway restart。关键文件解析失败时其安装流会回到 pre-pull SHA；高价值 gateway 可使用 `--backup` 或 `updates.pre_update_backup` 备份完整 `HERMES_HOME`。生产上仍要在单独 profile/canary 验证，因为“进程能启动”不等于所有 MCP、Skill、OAuth 和 cron 语义都正确。

容器化更新还会对挂载配置做 schema migration 并写入时间戳备份；若需要审查再迁移，可用 `HERMES_SKIP_CONFIG_MIGRATION=1` 先停在人工检查点。升级后要核对持久 Docker sandbox 是否保留了错误 cache、任务文件或 token。[Hermes Docker upgrade](https://hermes-agent.nousresearch.com/docs/user-guide/docker/)

## 六、系统设计题：构建企业 Agent 发布控制面

**题目：公司运行多个 Coding/Operations Agent，怎样让一个新的 Runtime 和 Plugin 版本安全上线？**

```text
Release registry -> compatibility analyzer -> backup service -> migration planner
  -> canary scheduler -> sandbox regression / policy gate -> rollout controller
  -> telemetry + audit -> rollback controller -> effect reconciler
```

回答要点：

1. Release Registry 为 runtime、plugin、schema、image、policy、model、MCP 维护 provenance、兼容范围、签名和已知风险。
2. Compatibility Analyzer 根据每个 agent 的 effective config、状态 schema、auth/memory/session 版本和 extension ABI 计算可升级集合；未知依赖默认 block。
3. Backup Service 不导出明文 secret，创建加密 snapshot 与一个按权限恢复的 manifest；Migration Planner 先 dry-run，声明 expand/contract、重启和不可逆步骤。
4. Canary Scheduler 创建隔离 profile/workspace/node；只提供测试 connector、脱敏 memory、无生产写权限，运行 golden、对抗、迁移和恢复集。
5. Rollout Controller 以 capability diff 作为硬门：sandbox、network、tool、auth、approval 任何意外扩大都不能推进；按风险分批并保留可暂停开关。
6. Rollback Controller 恢复 runtime/config/plugin/state pointer，并通过 Effect Reconciler 对外部副作用做撤销、补偿或人工工单，而不是声称“回滚成功”就忽略已经发送的动作。

## 七、升级验收与故障演练

- [ ] 是否存在已验证的 runtime/config/plugin/image/model 组合，而不是单独的版本号？
- [ ] 更新前是否成功生成加密 snapshot，并能在隔离环境恢复、启动和读取必要状态？
- [ ] dry-run 是否输出 schema、policy、tool、network、credential reference 和 Plugin ABI diff？
- [ ] 失败/未知迁移、丢失密钥引用、无法加载 Plugin 是否 fail closed？
- [ ] canary 是否覆盖登录/OAuth、MCP handshake、cron、session/memory、sandbox、审批和红队任务？
- [ ] 是否比较了 effective capability，而非仅比 YAML/TOML 文件文本？
- [ ] rollback 是否演练过旧 runtime 读取 state、Plugin 降级、service restart 和健康探针？
- [ ] 是否为外部 effect 保留 idempotency/provider request/approval 证据与补偿流程？
- [ ] 紧急停止是否能冻结 auto-update、阻止新任务、吊销新 credential，并保留现场证据？

## 延伸阅读

- [Claude Code Advanced setup](https://code.claude.com/docs/en/setup)：release channel 与 minimumVersion。
- [Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/)：managed requirements、网络与 telemetry。
- [OpenClaw Updating](https://docs.openclaw.ai/install/updating)：Doctor、health、pin version 与 rollback。
- [OpenClaw Migration guide](https://docs.openclaw.ai/install/migrating)：完整状态目录、认证和迁移验证。
- [Hermes Updating](https://hermes-agent.nousresearch.com/docs/getting-started/updating/)：check、snapshot、config migration 与 pre-pull 回退。
