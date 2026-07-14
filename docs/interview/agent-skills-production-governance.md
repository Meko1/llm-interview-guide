# 跨运行时 Agent 扩展生产治理：Skills、Plugins、MCP 与 Hooks

> Skill 不是“把一段 prompt 保存起来”。它是一个可发现的过程工件，通常同时改变模型的上下文、可调用工具、脚本依赖和外部系统接入方式。本文把 Claude Code、Codex、OpenClaw、Hermes 的公开能力抽象成一套企业可落地的 Skill 生命周期。Coding Agent 的完整交付链见 [智能编码 Agent 企业操作手册](/interview/coding-agent-production-playbook)，MCP 工具服务的生产治理见 [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)。

## 怎么用这页

面试时先区分 Skill、Plugin、MCP Server 与 Hook，再描述 Skill 从创建到撤销的控制面。落地时不要先建“技能市场”，先做私有注册表、最小权限、评测和一键撤销。

## 30 秒总答法

> 我把 Skill 看成 Agent 的程序记忆和操作手册：它提供何时触发、如何完成任务、需要哪些资源和如何验收的可版本化工件；Plugin 是安装与分发边界，MCP Server 是外部能力与资源访问边界，Hook 是确定性运行时策略边界。Claude Code 强调按需加载、项目/个人/企业作用域和 Skill 内的工具控制；Codex 将 Skill 用于可复用工作流并支持显式引用；OpenClaw 强调每 Agent 可见性、Skill gating 与提案式 Workshop；Hermes 强调渐进披露、从经验或资料学习 Skill、条件激活和受控配置。企业平台应统一登记、扫描、评测、签名、发布、观测和撤销，而不是把不同工具的目录直接共享。

## 一、先分清四种扩展工件

| 工件 | 主要改变什么 | 是否应有副作用 | 企业治理重点 |
| --- | --- | --- | --- |
| Skill | 指令、流程、模板、参考资料和可选脚本 | 取决于其调用的工具 | 触发条件、上下文成本、工具范围、版本 |
| Plugin | 可安装的功能包，可能含 Skills、命令、Agent、Hook、MCP | 常有 | 包签名、依赖、安装与升级 |
| MCP Server | 对外暴露工具、资源、提示或应用界面 | 常有 | 身份委派、schema、资源权限、审计 |
| Hook / Policy | 在生命周期事件上执行确定性校验 | 可以 | 不能被 prompt 覆盖、失效模式、日志 |

一个常见错误是把 Skill 当作权限机制。Skill 可以建议或限制模型使用工具，但真实授权必须由运行时、沙箱、Gateway 和资源服务共同执行；同样，Plugin 也不是“更大的 Skill”，它拥有独立安装和依赖供应链。

## 二、四个运行时的 Skill 模型比较

| 维度 | Claude Code | Codex | OpenClaw | Hermes |
| --- | --- | --- | --- | --- |
| 可移植核心 | Agent Skills 标准的 `SKILL.md` | 可复用工作流与 `$` Skill 引用 | AgentSkills 兼容 `SKILL.md` | AgentSkills 兼容 `SKILL.md` |
| 发现策略 | 描述常驻，正文按需加载；可随目录动态发现 | 显式或匹配任务使用 | 作用域加载后按 Agent allowlist 过滤 | `skills_list` 到 `skill_view` 的渐进披露 |
| 作用域 | 企业、个人、项目、Plugin、嵌套目录 | 用户/项目与 Codex 环境配置 | per-agent、workspace、personal、shared managed、node | `~/.hermes/skills` 与分类目录、Hub 状态 |
| 自动触发 | 可让模型自动调用，也可禁止自动调用 | 支持可复用工作流与显式引用 | 可禁止模型自动调用；可直接派发到工具 | slash、自然语言、bundle、条件激活 |
| 特有亮点 | Skill 可在 fork 子 Agent 中运行并绑定 Hook | 与项目指令、权限和任务工作流结合 | allowlist、加载 gating、Workshop 提案审批 | `/learn`、条件 fallback、安全的延迟配置 |

这张表只抽象公开能力，不能据此推断各产品内部实现相同。产品更新很快，真正可移植的是“核心描述 + 平台适配层 + 外部策略”三层设计。

## 三、推荐的跨运行时目录与边界

把可移植内容和平台专属内容分开，避免一个 Skill 同时承载业务流程、密钥、安装脚本和平台控制：

```text
skills/
  change-review/
    SKILL.md                 # 可移植任务目的、输入、步骤、验收
    references/
      review-rubric.md       # 按需加载的规则与示例
    templates/
      finding.md
    scripts/
      validate-output.sh     # 可被受控 runner 调用
    policy.yaml              # 内部平台元数据，不自动注入 prompt
    evals/
      cases.yaml
platform-adapters/
  claude-code/               # 前置元数据、Hook、受限工具映射
  codex/                     # 任务/权限与显式引用映射
  openclaw/                  # allowlist、gating、node 约束
  hermes/                    # toolset、条件激活、配置声明
```

### `SKILL.md` 应该写什么

1. **用途与触发边界**：何时适用、何时必须拒绝或转人工。
2. **输入契约**：需要的参数、文件、数据分类和前置状态。
3. **步骤与工具意图**：先读什么、如何验证、什么动作绝不能自动执行。
4. **输出契约**：格式、证据位置、失败时返回什么，而不是假装成功。
5. **引用导航**：将长文档、模板、示例和脚本放在 supporting files，正文保持短小。

不要在正文放真实 API key、长期 token、难以审计的 `curl | sh`，或让模型从不可信页面复制命令。引用资料本身也要被视为不可信输入。

## 四、统一 Capability Manifest：让目录外也能被审计

不同运行时可以有各自的 `SKILL.md` 前置元数据，但企业控制面还需要一份不直接注入模型的 Capability Manifest。它是发现、授权、审计和撤销的唯一事实来源：

```yaml
capability:
  id: change-review
  version: 1.4.0
  package_hash: sha256:...
  type: skill
  owner: platform-devex
  source:
    repository: github.example.com/ai/skills
    revision: 8f3c1a2
    signature: cosign:verified
  contents:
    scripts: [scripts/validate-output.sh]
    mcp_servers: [code-search]
    external_domains: []
  policy:
    data_classification: internal
    auto_invocation: allowed
    allowed_actions: [read_repo, run_lint]
    forbidden_actions: [push_git, deploy]
    approval_actions: []
  rollout:
    stage: canary
    eligible_agents: [reviewer, docs]
    expires_at: 2026-12-31T00:00:00Z
```

Manifest 与代码包必须一起签名并在运行时解析。模型看到的是适量的 Skill 说明；Runner 看到的是经过策略计算后的工具、网络和短期凭证；审计系统看到的是 `capability_id + version + package_hash`。三者不要互相代替。

### 来源证明与依赖锁定

- 记录源码仓库、不可变 revision、构建器身份、构建时间与包哈希。
- Plugin、脚本、二进制与 MCP Server 生成 SBOM，锁定传递依赖和安装器版本。
- 更新必须是“新版本包”而不是原地覆写；发布前做 diff 审查、签名校验和 sandbox 安装。
- 被撤销的 hash 写入 denylist，即使目录缓存或镜像尚未清理也不得被新任务解析。
- 运行 trace 附带来源证明，事故时才能回答“哪个 Agent 在什么时候使用了哪一份扩展”。

## 五、从编写到撤销的完整生命周期

```text
AUTHOR -> LINT -> STATIC_SCAN -> SANDBOX_EVAL -> REGISTER
  -> REVIEW -> SIGN -> CANARY -> PROMOTE -> OBSERVE
  -> DEPRECATE -> REVOKE -> FORENSICS
```

| 阶段 | 必须产物 | 失败处理 |
| --- | --- | --- |
| Author | Skill 源码、owner、用途、数据分级 | 未填写边界不可登记 |
| Lint | frontmatter、链接、路径、命令与模板校验 | 阻止发布 |
| Static scan | 脚本、依赖、外发域名、危险命令、secret pattern | 人工复核或拒绝 |
| Sandbox eval | 固定输入、mock 工具、预期输出、拒绝案例 | 不进入注册表 |
| Register | `skill_id`、版本、包哈希、依赖 SBOM、权限声明 | 校验冲突和过期 owner |
| Canary | 小范围 Agent/租户/只读任务 | 指标回退即禁用 |
| Promote | 批准、兼容矩阵、回滚版本 | 生产可见性受 allowlist 控制 |
| Revoke | 禁止新调用、失效短期 token、阻断版本 | 保留审计与现有任务处置 |

`skill_id` 必须稳定，版本与包哈希必须不可变。不要只以目录名做审计主键，因为重命名、覆盖和同名不同内容会让事故追溯失效。

## 六、触发策略：自动加载不等于自动执行

Skill 至少有三种状态，必须在注册表中分开管理：

| 状态 | 适合的内容 | 运行时要求 |
| --- | --- | --- |
| Context only | 风格、领域事实、只读检查表 | 模型可匹配自动加载；无副作用工具 |
| Assisted workflow | 代码审阅、文档生成、测试建议 | 模型可调用，但工具保持最小权限 |
| User-only action | 部署、推送、发送消息、支付 | 禁止模型自动调用，显式用户确认加资源审批 |

Claude Code 公开文档明确支持 `disable-model-invocation` 来阻止模型自行运行有副作用的 Skill，并支持 `allowed-tools`、`disallowed-tools`、fork 子 Agent 等约束。正文在真正调用前不会加载，可控制上下文成本。[Claude Code Skills](https://code.claude.com/docs/en/skills)

OpenClaw 也支持禁止模型自动调用，并可将 slash 命令直接派发到注册工具；但 direct dispatch 只会缩短模型路径，不会自动完成业务授权。该平台还将 Skill 的“从何处加载”和“哪个 Agent 能看到”区分为两个控制面。[OpenClaw Skills](https://docs.openclaw.ai/tools/skills)

## 七、作用域与可见性：解决错误能力暴露

同一台机器有多个 Agent 时，目录优先级、可见性与运行权限是三个不同问题：

```text
loaded skill sources -> precedence resolution -> agent allowlist
  -> prompt visibility -> tool policy -> resource authorization
```

以 OpenClaw 为例，per-agent 与 shared managed 目录决定初始可见性，而 Agent allowlist 决定有效 Skill 集；官方文档特别指出 allowlist 不是 host shell 授权边界。[OpenClaw Skills](https://docs.openclaw.ai/tools/skills)

企业建议采用以下默认值：

- 业务 Agent 默认只看白名单 Skill；新 Skill 先只允许给测试 Agent。
- 生产写入类 Skill 永不放进全局共享目录；按团队、环境和任务委派。
- 子 Agent 不自动继承主 Agent 的敏感 Skill、MCP 连接和环境变量。
- 在 monorepo 中，嵌套目录 Skill 只处理本包约束；根目录 Skill 只放跨包规则。
- 本地安装的个人 Skill 与组织托管 Skill 需要在 trace 中标明来源和哈希。

## 八、密钥、依赖和动态上下文

Skill 常通过 supporting files、脚本、环境变量和动态上下文获得能力，这正是最容易产生供应链风险的地方。

### 密钥原则

1. Skill 声明“需要哪一种凭证”，但不存储凭证值。
2. 运行时为当前 `task_id + skill_id + audience + action` 签发短期 token。
3. MCP 子进程、脚本和容器只收到所需最小环境变量；默认不继承宿主全部环境。
4. prompt、日志、错误消息、trace 和学习样本中都要脱敏。
5. 读取外部网页、Issue、README、工具输出时，将它们标记为数据，不允许改写系统策略。

Hermes 官方文档支持把所需环境变量声明为 Skill 配置，并在本地按加载时机请求设置；消息渠道不会在聊天中索要密钥。它还区分工具/工具集可用性与 fallback Skill 的条件激活。[Hermes Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)

### 动态上下文的防线

动态注入命令、Git diff、网页摘要或数据库结果要经过：长度上限、内容标记、来源记录、脱敏、结构化解析和 prompt-injection 检测。动态内容只能成为模型的观察，不能成为“允许执行”的证据。真正的 allow/deny 决策仍由确定性策略和资源服务完成。

## 九、Hooks：确定性策略同样需要供应链和失败语义

Hook 常被误解为“多写一段脚本就更安全”。实际上 Hook 是可执行策略代码，必须定义它的事件、优先级、超时、输入、失败语义与紧急禁用方式。

| Hook 类型 | 例子 | 推荐失败语义 | 原因 |
| --- | --- | --- | --- |
| 证据采集 | 记录 tool call、格式化 trace | fail-open 加告警 | 不应因日志短暂故障阻断只读任务 |
| 质量检查 | 编辑后 lint、schema 校验 | 阻止任务完成，允许修复 | 防止把不合格证据标为成功 |
| 高风险策略 | 推送、部署、删数据、外发 | fail-closed | 策略不可用时不能扩大副作用 |
| 审批路由 | 命令或资源需要人工批准 | fail-closed + 超时取消 | 避免超时自动放行 |

### Hook 的运行规范

1. 明确事件顺序：输入解析、策略、审批、执行、后置验证、审计；不得让 post-hook “补救”已经发生的高风险副作用。
2. 设定独立的 CPU、内存、网络和超时预算，防止 Hook 自身阻塞 Agentic Loop。
3. 用 `task_id`、`tool_call_id` 和幂等键避免重试时重复写审计或重复派发审批。
4. 禁止 Hook 通过修改 prompt、配置或自身代码来提升权限；Hook 包也走签名、SBOM、灰度和撤销流程。
5. 提供中央 kill switch：立即跳过低风险采集 Hook，或对高风险动作强制拒绝，不依赖各个客户端更新。

Claude Code 的 Hook 体系覆盖工具调用、权限请求、子 Agent、worktree、压缩等生命周期事件，适合作为产品层的实现参考；企业平台仍应在资源服务侧保留最终判定。[Claude Code Hooks](https://code.claude.com/docs/en/hooks)

> 本页讨论 Hook、Plugin、Skill 的发布与供应链治理。要设计跨 Claude Code、Codex、OpenClaw、Hermes 的事件信封、同步 Policy Gate、webhook ingress、outbox、DLQ 与运行时适配边界，见 [Agent 生命周期事件与 Policy Hook Fabric](/interview/agent-lifecycle-policy-hook-fabric)。

## 十、Plugin 与 Skill 供应链

Plugin 可能一次引入 Skills、Hooks、MCP Server、二进制依赖和安装器，应按软件包而不是 Markdown 文件治理：

| 检查项 | Skill | Plugin | MCP Server |
| --- | --- | --- | --- |
| 内容与描述评审 | 必需 | 必需 | 必需 |
| 脚本/依赖扫描 | 有脚本时必需 | 必需 | 必需 |
| 包哈希与签名 | 推荐 | 必需 | 必需 |
| 网络 egress allowlist | 有外部工具时必需 | 必需 | 必需 |
| 最小凭证 | 必需 | 必需 | 必需 |
| 沙箱回放 | 推荐 | 必需 | 必需 |
| 运行时撤销 | 必需 | 必需 | 必需 |

OpenClaw 的公开资料将 Plugin 自带 Skill 纳入插件启用时的加载模型，也提供 Skill Workshop：Agent 先提交候选修改提案，由人审阅和应用，而非直接覆盖 `SKILL.md`。这是“自我改进”应采用的产品形态。[OpenClaw Skills](https://docs.openclaw.ai/tools/skills)

Hermes 也支持从本地资料、网页或既有操作中生成候选 Skill；这类生成能力应接入同一条审核、评测和灰度发布管线，而不应自动变成全局可用的生产操作手册。[Hermes Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)

## 十一、评测：要测触发、过程和副作用

| 维度 | 例子 | 指标 |
| --- | --- | --- |
| 发现 | 合适任务是否找到正确 Skill | precision、recall、误触发率 |
| 指令遵循 | 输出是否符合模板和步骤 | rubric 得分、结构校验率 |
| 工具使用 | 是否选对工具、参数与顺序 | schema 合法率、无效调用率 |
| 安全 | 是否拒绝危险自动操作与注入 | 拒绝率、越权拦截率、泄露数 |
| 成本 | 上下文和工具是否可控 | token、时延、外部 API 成本 |
| 演进 | 新版本是否损害旧任务 | 回归率、canary 失败率、回滚耗时 |

测试集必须同时有：正常任务、同名但不适用的任务、缺少参数、恶意输入、断网/依赖缺失、权限不足、版本冲突、过长上下文和高风险副作用。只测“调用 Skill 后答案看起来不错”没有任何生产说服力。

## 十二、迁移矩阵：一份 Skill 如何跨运行时发布

| 能力 | Claude Code | Codex | OpenClaw | Hermes | 控制面要求 |
| --- | --- | --- | --- | --- | --- |
| 核心流程 | `.claude/skills/.../SKILL.md` | Codex Skill/workflow 引用 | workspace 或 managed Skill | `~/.hermes/skills` | 保持核心 `SKILL.md` 与测试不变 |
| 自动触发 | description + invocation setting | 显式或产品匹配 | `disable-model-invocation` + allowlist | slash、自然语言、条件激活 | 迁移时默认收紧为显式触发 |
| 扩展资源 | supporting files、Hook、MCP | Skill/Plugin/App 资源 | Plugin、node、tool dispatch | references、scripts、toolsets | 进入平台 adapter，不混入核心流程 |
| 权限 | allowed/disallowed tools 与产品策略 | 任务权限与 sandbox | allowlist、sandbox、exec 策略 | toolsets、审批、terminal backend | 用 Manifest 计算最终最小权限 |
| 上线方式 | 项目/个人/企业/Plugin scope | 用户或项目环境 | Agent/workspace/shared scope | 本地目录/Hub | 使用受控发布渠道与版本 pin |

迁移不能简单复制目录。先移植只读 Skill，接着映射输入/输出与 evals，最后才逐项开启脚本、MCP、Hook 和副作用。每个平台的“描述如何被加载、环境变量怎么传递、命令如何执行”都应经过 adapter 测试。

## 十三、系统设计题：建设企业 Agent Skills 平台

**题目**：公司同时使用 Claude Code、Codex、OpenClaw 和 Hermes，希望内部团队编写、分享、审计和复用 Skills，并阻止技能投毒、跨租户泄漏和未经批准的高风险自动化。如何设计？

### 答题骨架

1. **Control Plane**：Skill Registry、版本/签名、owner、审批、策略、评测、灰度、撤销、审计查询。
2. **Package Service**：保存不可变 tarball、SBOM、脚本扫描报告、依赖锁定和恶意内容标签。
3. **Adapter Layer**：把核心 Skill 映射为 Claude Code、Codex、OpenClaw、Hermes 各自的目录、前置元数据、作用域与工具策略；不把业务流程复制四份。
4. **Runtime Resolver**：依据用户、Agent、仓库、环境、任务和数据分类计算可见 Skills、短期凭证和工具集合。
5. **Execution Gateway**：所有写入、网络和外部系统调用经过 policy check、approval、sandbox、DLP 与审计。
6. **Evaluation Service**：触发正确性、任务质量、安全拒绝、成本和回归集；发布前阻断不达标版本。
7. **Incident Plane**：按 `skill_id/version/hash` 禁用、撤销 token、终止任务、冻结审计并回放影响范围。

### 追问：Skill 修改后如何不影响正在跑的任务？

> 每个任务在启动时绑定 `skill_id + version + package_hash`，运行中只使用该不可变快照；新版本先进入 canary。紧急撤销时，控制面可阻断新任务和短期 token 续租，已运行任务按风险级别取消、降级为只读或允许在受限时间内完成。这样既能复现历史行为，也能快速止血。

### 追问：Agent 自动发现了一个好流程，如何上线？

> 先作为 candidate proposal 保存来源轨迹、差异、依赖、声明权限和评测建议；静态扫描后在无真实密钥的 sandbox 回放；owner 批准后用测试 Agent 灰度。只有质量、安全与成本都优于基线，才将其提升为某个受限作用域的可见 Skill。永远不允许它直接修改全局 Skill、Hook 或生产权限。

## 十四、反面回答清单

- “Skill 是 Markdown，所以不需要安全审查。”
- “只要限制模型不能自动调用，就不需要资源鉴权。”
- “共享目录和 Agent allowlist 是同一个权限控制。”
- “新 Skill 直接覆盖旧文件，目录名就是版本。”
- “Plugin 里带的 MCP、Hook 和安装器可以跳过审计。”
- “动态注入的网页或 Git diff 是可信上下文。”
- “自我学习就是允许 Agent 自动改变默认策略。”
- “Hook 是安全代码，所以不用签名、超时和 fail-closed 设计。”
- “把 `SKILL.md` 复制到另一个运行时，就等于完成安全迁移。”

## 十五、面试前 5 分钟速记

- Skill 管知识和流程，Plugin 管分发，MCP 管外部能力，Hook 管确定性策略。
- 可移植核心是 `SKILL.md`；平台特性必须通过 adapter 层隔离。
- 自动加载、自动调用、工具权限和资源授权是四个不同层次。
- 一次任务绑定 Skill 的 ID、版本和包哈希，才可回放和审计。
- 作用域、可见性和 shell/资源权限必须分开设计。
- Capability Manifest 记录来源、hash、依赖、权限、灰度和到期，且不直接注入 prompt。
- 高风险 Hook 要 fail-closed；Hook 自身也是要审查和撤销的可执行供应链。
- 生成或学习 Skill 要走候选、扫描、评测、灰度、回滚，而不是直接写生产目录。
- 撤销能力要同时停止新发现、取消 token、禁用工具和保全审计。

## 公开资料与延伸阅读

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Codex Skills & Plugins](https://learn.chatgpt.com/docs/skills-and-plugins)
- [OpenClaw Skills](https://docs.openclaw.ai/tools/skills)
- [Hermes Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [MCP Server 生产化与企业治理高频问答](/interview/mcp-production-qna)
- [Agent 工具安全与权限边界](/agent/tool-safety)
