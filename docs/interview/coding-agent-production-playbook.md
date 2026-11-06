---
title: 智能编码 Agent 企业操作手册：Claude Code / Codex / OpenClaw / Hermes
description: 以参考架构设计企业编码 Agent 的受限工作区、工具权限、扩展治理与 PR 交付，明确产品导航和实测证据的区别。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 智能编码 Agent 企业操作手册：Claude Code / Codex / OpenClaw / Hermes

> 这是一份面向面试与真实落地的操作页。它不把 Claude Code、Codex、OpenClaw、Hermes 当成四个“哪个更强”的产品，而是把它们映射为四类运行时能力：开发任务执行、云端或本地工作区、长驻消息 Gateway、持久记忆与技能闭环。架构原理见 [智能体运行时架构高频问答](/interview/agent-runtime-architecture-qna)，工具边界见 [企业 Tool Gateway 安全执行系统设计](/interview/tool-gateway-security-design)。

> 需要深入设计跨 Claude Code、Codex、OpenClaw 与 Hermes 的 `SKILL.md` 作用域、自动触发、供应链、密钥、Plugin、MCP 与 Hook 撤销机制时，见 [跨运行时 Agent 扩展生产治理](/interview/agent-skills-production-governance)。

> 涉及子 Agent、后台任务、定时自动化、会话继承、并发额度、可靠投递与取消语义时，见 [Agent 自动化与后台编排生产设计](/interview/agent-automation-orchestration-playbook)。

## 怎么用这页

面试时按“任务性质 -> 运行时边界 -> 产品能力 -> 治理措施 -> 验收证据”作答。落地时先完成最小闭环，再逐步开放写入、网络、外部系统和自动发布；不要从“给 Agent 一个管理员 shell”开始。

## 30 秒总答法

> 以下是设计目标话术，未搭建或未验证时须明确说“拟设计”：我会用一致的身份与任务策略管理四类运行时，不必先建立一整套企业平台。Claude Code 适合用项目规则、Hooks、子 Agent 和 worktree 把开发动作事件化；Codex 适合把 `AGENTS.md`、权限模式、沙箱和任务证据做成可重复的交付闭环；OpenClaw 用于把多渠道和远程节点收敛到 Gateway，但必须按操作者边界拆 Gateway；Hermes 用于长期运行、可检索记忆、技能沉淀和定时自动化，但记忆与技能都要经过版本、评测和审批。共同底座是统一身份、任务契约、受限执行器、审计轨迹、预算和发布门禁。

> 如果面试官继续追问“沙箱能管什么、什么时候会逃逸、网络和密钥如何不被带出去”，可直接转到 [Agent 沙箱、执行准入与逃逸处置](/interview/agent-sandbox-execution-boundaries-playbook)。

## 一、先做能力盘点，而不是产品盘点

| 能力面 | Claude Code | Codex | OpenClaw | Hermes | 企业要补的控制 |
| --- | --- | --- | --- | --- | --- |
| 任务入口 | CLI、IDE、Web 等 | CLI、IDE、云端任务 | 消息渠道、Web、节点 | CLI、Gateway、桌面、消息渠道 | 统一身份、渠道准入、任务编号 |
| 项目指令 | `CLAUDE.md`、规则文件 | `AGENTS.md` | Agent/workspace 配置与 Skills | `AGENTS.md`、`.hermes.md`、人格与上下文文件 | 指令版本、评审、作用域 |
| 工具边界 | 权限规则、Hooks、MCP | 权限模式、沙箱、可写工作区 | Gateway 策略、节点配对、工具策略 | Toolsets、命令审批、容器后端 | 最小权限、短期凭证、二次鉴权 |
| 并行 | 子 Agent、团队、worktree | 任务、worktree、子 Agent | 多 Agent 路由与远程节点 | delegates、隔离子 Agent | 资源配额、冲突合并、取消 |
| 长期状态 | 会话和项目规则 | 任务与项目说明 | 会话路由、cron、Gateway 状态 | 记忆、会话检索、技能 | 生命周期、清理、可审计读写 |

表格是产品候选能力索引，不是逐版本认证；本轮 Claude Code、OpenClaw、Hermes 相关官方正文均未取得，具体事件名、配置和功能应按固定安装版本复核。开源结构也不是长期 API 承诺。下文 YAML、状态图与控制清单均为企业参考设计，不能直接复制成四种产品通用配置。

## 二、所有产品先接入同一份任务契约

每次可写操作都应产生一个不可变的任务快照。不要只记录自然语言 prompt，因为同一 prompt 在不同分支、工具版本和权限下会产生不同副作用。

```yaml
task:
  id: ca_20260714_001
  requester: user:alice
  repository: payments-api
  revision: 9f8e7d6
  objective: "修复退款超时并补回归测试"
  workspace:
    mode: worktree
    writable_roots: ["services/refund", "tests/refund"]
  execution:
    network: deny
    shell: allowlisted
    package_install: deny
    secrets: ephemeral
  budget:
    max_steps: 35
    max_wall_time: 25m
    max_cost_usd: 8
  gates:
    require_diff_review: true
    require_tests: true
    require_human_approval_for: ["git push", "create_pr"]
```

这个契约应由控制面签发，runner 只接收已验证的任务 ID 和最小凭证。`session_id` 用于对话路由，不可被误当成授权主体；同样，Git 分支不是权限边界。

## 三、从任务到可合并 PR：把 Git 作为受控交付面

企业 Coding Agent 的终点不应是“工作区里多了几处修改”，而是一个能被人和 CI 理解的变更提案。建议将 PR 生命周期显式建模：

```text
INTAKE -> PLANNED -> BRANCH_READY -> PATCHED -> VERIFIED
  -> REVIEW_PENDING -> PR_OPEN -> MERGE_QUEUE -> MERGED | REJECTED | EXPIRED
```

| 阶段 | 运行时职责 | 强制证据 |
| --- | --- | --- |
| Intake | 绑定请求人、仓库、基线 commit、数据分类 | 授权主体、任务契约 |
| Branch ready | 创建短命分支/worktree，签发最小 Git 凭证 | commit SHA、工作区 ID |
| Patched | 限制可写路径和最大文件数，记录 patch 生成轨迹 | diff、工具调用摘要 |
| Verified | 运行确定的 lint、单测、集成测试与安全扫描 | 退出码、报告、耗时 |
| Review pending | 独立 Agent 与人工审阅，处理基线漂移 | 审阅意见、重放结果 |
| Merge queue | 重新 rebase/合并测试，执行分支保护 | 受保护分支状态、合并结论 |

### Git 身份委派原则

不要把个人 PAT、长期 deploy key 或管理员凭证交给 Agent。用 GitHub App 安装令牌时，提供方主要按仓库与权限限制；分支前缀、task ID、指定 patch 等细粒度约束应由企业代理和 Git 平台规则另行强制，不能假称令牌原生具备这些字段。[GitHub 安装认证](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)本轮检索摘录确认令牌有仓库/权限范围并在一小时后过期。若要真正限制动作，Agent 不接触真实 token，只提出带任务 ID 的交付请求，代理验证 revision、路径、diff 与审批后执行。

**面试官：为什么 Agent 推送成功后还要进入 merge queue？**

> 因为 patch 是基于某个旧基线生成的。并行开发期间，主干依赖、测试和接口都可能变化。merge queue 会在最新基线上重新验证，并让分支保护、必需 review 与发布策略仍然生效，避免“Agent 的本地测试通过”被误当成“当前主干可安全合并”。

## 四、仓库理解与 Runner 池：大规模工程不能只靠 grep

Agentic search 适合精确定位，但在大型 monorepo 中还需要受控的工程辅助信息：构建目标、依赖图、代码所有者、测试映射和最近变更。它们只能缩小搜索空间，最终修改前仍要读取当前 revision 的原始文件。

| 信息 | 价值 | 失效风险 | 治理方式 |
| --- | --- | --- | --- |
| 代码搜索/索引 | 快速粗筛相关模块 | 索引落后于分支 | 绑定 commit，增量更新 |
| 依赖与调用图 | 限定影响面、挑选测试 | 动态反射或生成代码遗漏 | 标注置信度，回退到源码验证 |
| CODEOWNERS/服务目录 | 找到 review owner 与风险域 | 组织变更后过期 | 由仓库规则同步 |
| 测试映射 | 降低验证成本 | 漏测或 flaky | 分层测试加全量回归门禁 |

Runner 不应无限制地按请求创建。控制面应根据仓库、语言、敏感等级和预算选择预热镜像、缓存和隔离等级；数据面只运行已封装的任务。每个 runner 至少限制 CPU、内存、磁盘、进程数、并发、墙钟时间和网络 egress。缓存可以加速依赖安装和构建，但不得跨租户泄漏源码、令牌或受污染的构建产物。

### 多 Agent 的文件所有权

并发不是默认收益。任务切片应有明确“模块/目录/文件所有者”，写入前申请租约；遇到交叉修改，由主编排器选择串行化、生成候选 patch 后人工仲裁，或将共用文件单独交给集成 Agent。不要让多个 Agent 对同一 lockfile、接口定义或核心配置自由编辑。

当面试官追问多 Agent 的 worktree、路径 ownership、资源租约、artifact contract、merge queue、旧基线和迟到 worker 如何处理时，见 [多 Agent 共享工作区并发控制](/interview/multi-agent-workspace-concurrency-playbook)。

当追问变更后的测试如何选、作者与验证者是否独立、Agent 评测和代码测试有什么区别、CI 绿灯是否足以合并以及灰度如何回滚时，见 [编码 Agent 测试策略与验证闭环](/interview/coding-agent-testing-verification-playbook)。

## 五、Claude Code：把 Hook 看成确定性策略插槽

Hook 的参考用法是在模型意图与真实副作用之间插入可测试策略。本轮 [Claude Code Hooks](https://code.claude.com/docs/en/hooks)未取得正文；下表事件名和具体阻断/异步语义须按安装版本确认，不把不可读页面当作已证实合约。尤其执行后的检查不能撤销已经外发的密钥或邮件。

### 推荐的 Hook 分层

| 事件 | 只做什么 | 不要做什么 |
| --- | --- | --- |
| `SessionStart` | 注入构建信息、检查工作区可信度 | 读取并自动执行仓库脚本 |
| `InstructionsLoaded` | 记录指令来源和版本 | 把仓库内文字直接当高权限命令 |
| `PreToolUse` | 参数校验、命令阻断、审批路由 | 用正则替代资源层鉴权 |
| `PostToolUse` | 采集证据、运行轻量 lint、更新 trace | 静默修改更多业务文件 |
| `SubagentStart/Stop` | 分配预算、记录角色和工作区 | 让子 Agent 继承主会话全部密钥 |
| `PreCompact/PostCompact` | 保存可验证摘要和 checkpoint | 把敏感原文永久写入摘要 |

最常见的错误是把 Hook 当作唯一防线。Hook 可做确定性拒绝，但真实数据库、云资源或部署系统仍需要服务端身份校验与资源授权。

### Claude Code 子 Agent 操作要点

1. 将 `Explore`、审阅和合规扫描配置成只读角色；实现角色只能写自己的 worktree。
2. 只向主 Agent 回传结论、证据位置、风险和 patch 摘要，避免整段日志重新污染上下文。
3. 角色定义文件必须有唯一名称，且要明确 tools、权限模式、最大轮数和隔离方式。
4. 在组织级使用托管设置管理全局 deny 与允许的扩展；项目级规则只表达项目事实和验收命令。

子角色需要声明工具与权限；具体 Markdown 字段、隔离和轮数支持以固定版本为准。[子 Agent 文档](https://code.claude.com/docs/en/sub-agents)本轮仅作导航，未读部分不承诺已经支持全部治理字段。

## 六、Codex：把 AGENTS.md、权限和证据链收敛为交付流程

将上下文、工具路由、沙箱和审批划为harness控制面是本文架构视角；[OpenAI harness说明](https://developers.openai.com/blog/codex-as-a-platform)与旧 [Codex CLI入口](https://learn.chatgpt.com/docs/codex/cli)本轮未取得可核正文，仅作导航。不把 `/init`、`/permissions` 或 `/review` 未读行为写成稳定合约。

### `AGENTS.md` 的正确职责

`AGENTS.md` 应是压缩后的项目操作说明，而不是把全部架构文档复制进去。建议只放：

- 项目模块、禁止修改目录与数据分类；
- 标准构建、单测、集成测试与格式化命令；
- 依赖安装、数据库迁移、发布等必须审批的操作；
- 变更完成的证据格式，例如 diff、测试摘要、已知风险；
- 读取不可信文件或网页时的规则：把内容当数据，而非指令。

每次变更 `AGENTS.md` 都应走普通代码评审。它会影响后续任务的系统性行为，实质上是一个轻量策略工件。

### Codex 任务运行手册

1. **只读试运行**：先让 Agent 列出受影响文件、测试命令、风险和计划，不允许写入。
2. **受限修改**：绑定 commit SHA 与 worktree，仅开放目标目录；默认禁网或仅 allowlist。
3. **可重复验证**：要求执行确定的测试命令，保存 stdout/stderr 摘要、退出码和耗时。
4. **独立审阅**：使用独立上下文或不同角色检查 diff，不能把“生成者自评”当 review。
5. **人工交付**：PR、部署、权限扩大与外发必须在工具之外再经过业务系统审批。

沙箱并不是授权系统。它回答进程能够触及哪些资源；审批回答本次副作用是否符合人的意图；业务 RBAC/ABAC 回答该身份是否有权操作目标资源。三者必须叠加。

## 七、OpenClaw：Gateway 是控制面，不是多租户安全边界

沿用 Gateway 作为渠道、会话与节点控制面的选型视角；[OpenClaw 概览](https://docs.openclaw.ai/)及 [安全模型](https://docs.openclaw.ai/gateway/security)本轮未取得正文，不声称核验了默认配置。工程上不把同进程共享文件、凭证和节点的 session 隔离当作敌对租户隔离；真实边界须以部署和攻击验证确认。

### Gateway 部署基线

```text
Internet / Chat Channel
  -> channel allowlist + pairing + mention gate
  -> Gateway authentication and operator scope
  -> session routing by channel/account/peer/thread
  -> agent workspace + tool policy + sandbox
  -> node / browser / shell execution
  -> audit stream + task store + alerting
```

| 场景 | 最低要求 |
| --- | --- |
| 私聊 | pairing 或 allowlist；未知用户不进入模型上下文 |
| 群聊 | allowlist 加 mention gate；默认无高风险工具 |
| 远程访问 | SSH/Tailscale 等私网通道；不要把控制端口直接暴露公网 |
| 多部门 | 按 OS 用户、主机或 Gateway 拆信任边界，分别使用凭证 |
| 设备节点 | 显式配对、能力声明、心跳、可撤销 token 和节点级审计 |

`sessionKey` 只能用于会话选择，不能被当成调用者身份。操作员 scope 也只是同一可信 Gateway 内的控制面 guardrail；要抵抗不可信团队成员或租户，必须拆主机、凭证和 Gateway。

### OpenClaw Skills 供应链

第三方Skill可能携带说明、脚本、依赖和工具路径，应按可触发能力审计，不是普通提示词。[OpenClaw Skills文档](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md)本轮未读，不将参考清单冒充产品默认防护。

建议设置四道门：

1. 入口登记：来源、维护者、版本、哈希、权限、外部域名与依赖清单。
2. 静态检查：危险命令、凭证读取、网络外发、动态下载、路径逃逸与混淆内容。
3. 隔离验证：无真实密钥的临时工作区，回放固定输入并收集网络和文件副作用。
4. 分级发布：实验、受限、生产三级；生产 Skill 需要 owner、回滚版本和到期复审。

## 八、Hermes：把“自我改进”设计成受控的学习发布链

将长期运行、记忆和技能作为 Hermes 的待核候选控制面；[Hermes 架构文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md)本轮未读，不据此确认 ACP、API 或各子系统的具体实现。

这类“长期运行且会沉淀经验”的 Agent 最容易出现两个误区：把记忆当数据库，把自动生成 Skill 当自动获得生产权限。正确做法是把学习闭环拆开：

```text
trajectory -> candidate memory / candidate skill
  -> offline evaluation + security scan
  -> human or policy approval
  -> versioned release + canary scope
  -> monitor outcome -> promote or rollback
```

### Hermes 的记忆治理清单

| 项目 | 推荐策略 |
| --- | --- |
| 写入来源 | 区分用户确认、工具事实、模型推断；推断不得直接升为长期事实 |
| 内容边界 | 不写入原始密钥、访问令牌、敏感业务全文或不可信页面指令 |
| 容量 | 有限、可解释、到期清理；满时必须显式整合而非静默丢弃 |
| 读取 | 基于任务与来源检索，返回引用和置信度；跨用户和跨项目默认隔离 |
| 变更 | 记忆与 Skill 都保留版本、提交者、评测集、回滚点 |

用户授权、命令审批、容器隔离、凭证代理和输入净化是不同控制层，不因产品宣称支持而省略验收。[Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security/)本轮不可访问，保留为 linked_only，不能证明上述能力已经在目标版本启用。

## 九、统一的 Skill、MCP 与插件治理

四类产品都在向可复用 Skill、MCP 和插件扩展发展。要避免每套工具各自失控，企业至少需要一个能力注册表：

```text
capability_id -> owner -> version -> package hash -> required secrets
              -> allowed agents -> tool scopes -> data classes
              -> evaluation suite -> rollout stage -> expiry -> revoke action
```

### 关键策略

- Skill 指令与工具 schema 分开审查：自然语言指令会改变模型决策，schema 会改变真实副作用。
- 任何 MCP Server 只获得本次任务需要的环境变量，不继承宿主全部 secrets。
- 对外网、支付、邮件、代码推送等不可逆动作使用短期 delegation token，token 必须包含受众、资源、动作、过期时间和任务 ID。
- 出现 prompt injection、数据外发、越权工具调用或异常成本时，一键撤销 capability，而不是只结束当前对话。
- Capability 变更走评测门禁：成功率、误用率、拒绝率、P95 时延、成本、敏感操作拦截率都要比较基线。

## 十、验证、评测与运营：不只看测试有没有通过

Coding Agent 的质量至少分为四层：

| 层次 | 关键问题 | 可量化指标 |
| --- | --- | --- |
| 补丁正确性 | 目标缺陷是否修复 | 目标测试通过率、静态检查结果 |
| 可合并性 | 是否符合当前仓库和主干状态 | PR 合并率、rebase 后通过率、冲突率 |
| 交付可信度 | 测试和证据是否足够 | 测试覆盖变化、flaky 率、独立 review 命中率 |
| 运行安全性 | 是否在预算和权限内完成 | 越权拦截率、egress 拒绝率、P95 成本/时延 |

建立回放集时要包含成功样本、失败样本、被拒绝的高风险请求、基线漂移、恶意 Issue/README、损坏测试、依赖安装失败和超时任务。每次改模型、提示、Skill、工具 schema、sandbox 或索引时，都在同一集合上对比；不要只用“这次 demo 看起来更快”作为升级依据。

对于测试充分性，Agent 不能自己声明“测试都通过了”就结束。至少要记录测试选择理由、命令、版本、日志摘要和未覆盖风险；高风险模块要有独立 reviewer 或 CI gate 复核。出现 flaky test 时应标记为不确定证据，不能把偶然绿灯计入成功率。

## 十一、值班与事故操作手册

### 事故分级

| 等级 | 例子 | 首个动作 | 后续动作 |
| --- | --- | --- | --- |
| P0 | 密钥外发、生产删除、未授权部署 | 全局 kill switch、撤销凭证、冻结 Gateway | 保存证据、隔离主机、通知安全团队 |
| P1 | 高风险命令多次尝试、跨会话泄漏迹象 | 停止该 agent/task，关闭对应 capability | 回放轨迹、修策略、扩展检测 |
| P2 | 无限循环、成本突增、任务大量超时 | 降低并发和预算，切换只读模式 | 修复工具结果归一化或状态机 |
| P3 | 单次任务失败、构建错误 | 保留 worktree 与 trace，允许人工接管 | 形成回归案例 |

### 一个正确的 kill switch

kill switch 不能只是 UI 上的“停止”按钮。至少分为：

1. **调度级**：不再接受新任务和 cron 触发。
2. **会话级**：取消未开始和可取消的运行，拒绝续租 token。
3. **执行级**：终止 runner、撤销容器/节点网络与短期凭证。
4. **能力级**：禁用某个 Skill、MCP Server、插件或高风险工具。
5. **审计级**：锁定 trace、命令、网络摘要、diff、审批与记忆变更，供复盘。

## 十二、面试高频追问

**问：为什么不让所有工程师共享一个 OpenClaw Gateway，省机器和维护成本？**

> 因为 Gateway 的 session、operator scope 和执行能力属于一个可信操作者域，并不是敌对多租户边界。多个互不信任的人共享时，配置、会话、凭证、节点和宿主机都会成为横向影响面。正确方案是至少按团队或信任域拆 Gateway、OS 用户和凭证；高敏场景进一步拆主机与网络。

**问：Claude Code Hook 和 Tool Gateway 都能拒绝命令，为什么两套都要？**

> Hook 靠近 Agent 生命周期，适合策略提示、早期阻断、证据收集和开发体验；Tool Gateway 靠近业务资源，适合统一身份、资源权限、短期凭证和不可抵赖审计。Hook 能被配置绕过或覆盖时，业务侧仍必须自证授权，因此两层是纵深防御。

**问：Hermes 能积累记忆和技能，怎样证明它越用越好？**

> 不用主观感受证明。先把新记忆或 Skill 当候选版本，在固定任务集上比较成功率、工具误用、成本、时延与安全拒绝率；通过后仅给小范围任务灰度，再监控回归和人工接受率。出现异常可按版本回滚，不能直接允许它改默认权限或全局 prompt。

**问：Codex 或 Claude Code 已经有权限模式，为什么还要任务契约？**

> 权限模式解决交互时的工具放行方式；任务契约补足工作区 revision、可写根、网络、预算、必需证据、审批动作和责任主体。它让一次 Agent 运行可以重放、审计和跨产品迁移，是控制面与执行面的共同语言。

**问：第三方 Skill 只有 Markdown，为什么也要供应链审查？**

> Skill 的自然语言会影响模型何时调用什么工具，还常伴随脚本、依赖、环境变量和外部服务。它可以诱导读取密钥、执行命令或外发数据。Markdown 不降低权限，应按能触发的真实能力和依赖链做分级审计。

**问：如何评价一个 Coding Agent 平台，而不是评价某个模型？**

> 我会同时看补丁正确性、可合并性、交付可信度和运行安全性。指标包括目标测试通过率、独立 review 缺陷率、PR 合并率、rebase 后通过率、flaky 率、人工接受率、P95 成本和越权拦截率。评测集还要覆盖恶意仓库内容、基线漂移、依赖失败和超时，不只跑干净的 benchmark。

## 十三、上线验收清单

- [ ] 每个任务绑定请求人、仓库 revision、工作区、预算、权限与审批链。
- [ ] Git 凭证是按任务签发的短期委派，创建 PR 与合并受到平台分支保护控制。
- [ ] Agent 任务在当前基线上可重放；进入 merge queue 后会重新验证最新主干。
- [ ] monorepo 索引、依赖图、测试映射均绑定 revision，runner 缓存不跨信任域泄漏数据。
- [ ] 读、写、部署、外发和凭证访问使用不同工具能力与审计事件。
- [ ] 子 Agent、worktree、runner、节点和 Gateway 都有独立的取消与回收机制。
- [ ] 记忆、Skill、插件和 MCP Server 都有 owner、版本、评测、到期和撤销动作。
- [ ] 不可信渠道消息、仓库文本、网页、Issue 和工具输出不被当作高权限指令。
- [ ] 远程 Gateway 默认私网访问，陌生私聊需 pairing，群聊需 allowlist/mention gate。
- [ ] 任务产出包含 diff、测试、工具轨迹、策略决定、成本和未解决风险。
- [ ] P0 演练记录检测、停止调度、撤销凭证和禁用 capability 的各自延迟及未取消副作用；按组织事先约定目标验收，不假定分钟级必然可达。

worktree 只隔离检出文件，仍可能共享 Git 对象、配置、hook 和宿主资源。恶意仓库的构建脚本、测试或包安装都能执行代码；“只运行测试”并非只读。先在无生产密钥、受控网络和资源限额的 runner 验证，缓存按信任域与依赖哈希划分，执行器校验真实路径并拦截符号链接逃逸。

交付证据应由 runner 产生并绑定 patch digest、base SHA、镜像与命令，而不是让模型自行编一个“tests passed”。构造 10 个子任务，每个上限 8 美元，若无父任务原子预留，总上限可能是 80 美元而非 8 美元；并发时间能下降但总成本仍相加，终止后在途调用也可能继续计费。

<details>
<summary>L1–L3：Agent 修改了测试把缺陷藏起来，怎样发现？</summary>

**L1**：检查 diff 是否删断言、跳过测试或改验收配置；不只看绿灯。**L2**：独立验证者从可信基线取得验收任务，给目标 patch 出不可由作者修改的证据；主干漂移后证据失效需重验。**L3**：构造恶意 README、包脚本和测试投毒集合，分别计模型诱导提案、执行器拦截和实际损害，研究边界而非把多模型一致当独立证明。

</details>

kill switch 只能阻止尚未发生或仍可取消的动作。已经发送的邮件、推送的 commit 与泄露的凭证需分别对账、回退或轮换；进程结束不证明资源已撤权。没有部署这些控制面时，面试应说“方案/演练计划”，不能套用上面的第一人称话术冒充履历。

## 面试前 5 分钟速记

- 统一四类产品的关键不是 API，而是统一任务契约和能力注册表。
- Claude Code 的 Hook 是事件策略插槽，不能替代资源层鉴权。
- Codex 的项目指令和权限应进入可复现的交付证据链。
- OpenClaw Gateway 是长驻控制面，不是敌对多租户安全边界。
- Hermes 的长期记忆与 Skill 必须走候选、评测、灰度、回滚的学习发布链。
- Agent 的交付终点是可验证、可合并 PR，不是工作区里的一次修改。
- 大型仓库的索引和调用图只用于缩小范围，最终事实仍是绑定 revision 的源代码。
- Skill、MCP 和插件都属于能力供应链，按真实副作用审查。
- kill switch 要同时覆盖调度、会话、执行、能力和审计。

## 公开资料与延伸阅读

- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code 子 Agent](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [OpenClaw Docs](https://docs.openclaw.ai/)
- [OpenClaw 安全模型](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Skills](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md)
- [Hermes Agent 架构](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md)
- [Hermes Agent 安全](https://hermes-agent.nousresearch.com/docs/user-guide/security/)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [Agent 评测与安全合规高频问答](/interview/agent-evaluation-safety-qna)
