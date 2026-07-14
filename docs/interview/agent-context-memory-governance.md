# Agent 上下文与记忆生产治理：Claude Code / Codex / OpenClaw / Hermes

> 长上下文不是“把更多聊天记录塞给模型”，记忆也不是“让 Agent 永远记住一切”。生产系统真正要解决的是：哪些信息每轮必须在场，哪些只可按需检索，哪些允许跨会话保存，哪些必须隔离、过期或删除；当上下文被压缩时，如何保留可验证的任务状态而不是让模型凭摘要猜测。本页将 Claude Code、Codex、OpenClaw、Hermes 的公开机制归纳为可实施的治理模型。

> 通用原理见 [上下文工程](/agent/context-engineering) 与 [Agent 记忆系统](/agent/agent-memory)。后台任务的 session 语义见 [Agent 自动化与后台编排生产设计](/interview/agent-automation-orchestration-playbook)，扩展与 Skill 的供应链边界见 [跨运行时 Agent 扩展生产治理](/interview/agent-skills-production-governance)。

## 30 秒总答法

> 我把 Agent 的信息分为五层：受版本控制的项目指令、当前任务状态、短期会话上下文、按需检索的外部事实、跨会话的精炼记忆。每一层都有来源、作用域、token 预算、访问控制、保留期和删除路径。压缩只改变下一轮模型看到的表示，不能替代任务状态和审计；检索结果也必须服从用户、租户、会话树和数据分类的可见性规则。Claude Code 的 CLAUDE.md/auto memory、Codex 的 AGENTS.md 层级、OpenClaw 的 session/memory/compaction、Hermes 的 MEMORY.md/USER.md/session search 都可以映射到这五层。生产上我会建立 Context Manifest、记忆写入门禁、摘要质量评测和回忆授权检查，而不是把所有内容混进一个无限增长的 Markdown 文件。

## 一、先分清四种“记住”

| 名称 | 存储位置 | 何时进入模型 | 能否跨会话 | 常见误区 |
| --- | --- | --- | --- | --- |
| 项目指令 | 代码库/受管配置 | 启动或路径命中时 | 是 | 以为它是不可绕过的安全策略 |
| 会话历史 | transcript/数据库 | 当前 turn 的上下文构建 | 通常可恢复 | 以为全部历史每轮都会重传 |
| 任务状态 | 控制面数据库/工件库 | 结构化注入或工具读取 | 是 | 以为自然语言摘要可以替代状态机 |
| 检索记忆 | 文件、向量库、FTS、知识库 | 根据查询按需注入 | 是 | 以为命中结果天然正确或有权限 |
| 长期偏好 | 小型 curated memory | 启动时固定预算注入 | 是 | 把日志、密钥和临时路径写进去 |

一个成熟的回答必须区分“模型看到了什么”和“系统持久化了什么”。模型上下文是有长度、会被压缩的输入；任务、权限、审计和资源副作用要由确定性系统保存。

```text
policy / project instructions
        + task state checkpoint
        + current session tail
        + authorized retrieved evidence
        + bounded durable memory
        + tool definitions and result handles
        ------------------------------------
                  Context Envelope
                          |
                          v
                       model turn
```

## 二、建立 Context Manifest，而不是拼字符串

每次模型调用前，context builder 应生成可审计的 manifest。它既帮助排障，也能证明敏感信息是从哪里进入模型的。

```json
{
  "turn_id": "turn_8a2",
  "task_id": "task_refund_timeout",
  "session_id": "sess_alice_014",
  "policy_revision": "ctx-policy-2026-07-14",
  "segments": [
    {"kind": "project_rule", "ref": "repo://AGENTS.md#test", "tokens": 220, "trust": "reviewed"},
    {"kind": "task_state", "ref": "task://checkpoint/7", "tokens": 180, "trust": "system"},
    {"kind": "memory", "ref": "memory://api-conventions#v3", "tokens": 90, "trust": "curated"},
    {"kind": "retrieval", "ref": "kb://runbook/42", "tokens": 340, "trust": "evidence"}
  ],
  "redaction_profile": "internal-engineering",
  "token_budget": 12000
}
```

### 每个 segment 至少要带六个标签

| 标签 | 作用 | 示例 |
| --- | --- | --- |
| `origin` | 来自谁/什么系统 | 用户、仓库、Git、CRM、模型推断 |
| `scope` | 哪些主体可见 | tenant、project、session tree、device |
| `trust` | 可如何使用 | system、reviewed、untrusted、inferred |
| `freshness` | 是否可能过时 | observed_at、TTL、revision、commit SHA |
| `sensitivity` | 是否需要脱敏/禁止持久化 | public、internal、confidential、secret |
| `budget` | 消耗多少上下文 | token、字符、最大片段数、优先级 |

模型输出无法替代这些标签。把未经验证的网页、Issue 评论或工具输出标为 `untrusted`，意味着它只能作为数据，不得覆盖项目策略、改变授权或触发自动执行。

## 三、项目指令的层级、作用域和冲突

项目指令是“应在许多任务中重复使用的稳定事实”，不是日志仓库，也不应存放秘密。四类 Runtime 均有类似机制，但加载顺序与默认作用域不同。

### Claude Code：CLAUDE.md 与 auto memory 分开治理

[Claude Code Memory 文档](https://code.claude.com/docs/en/memory) 将人写的 `CLAUDE.md` 与 Agent 写入的 auto memory 分为两套机制：前者携带项目规则，后者积累构建命令、调试经验和偏好。二者进入模型上下文，而不是强制执行的配置。官方还给出受管、用户、项目和本地指令等作用域，以及路径规则的按需加载方式。

| 内容 | 应放位置 | 应如何治理 |
| --- | --- | --- |
| 公司安全与合规底线 | managed policy + 真实工具策略 | 由管理员变更，资源层二次鉴权 |
| 仓库构建/测试/架构事实 | 项目 `CLAUDE.md` | 版本控制、代码审阅、保持简短 |
| 某目录的技术约束 | path-scoped rules | 只在命中路径时加载，减少噪声 |
| 个人沙箱 URL/偏好 | `CLAUDE.local.md` | 忽略提交，禁止放共享秘密 |
| 可复用流程 | Skill/runbook | 显式或自动调用，独立版本与评测 |

Claude Code 的 auto memory 是本机、按仓库共享的记忆目录，入口 `MEMORY.md` 以有限行数/字节加载，其余主题文件按需读取。团队不能把它当作唯一知识源：它不会自动跨机器或云环境同步，且内容需要可检查、可删除。

### Codex：AGENTS.md 是上下文来源，不是超级权限

[OpenAI 对 Codex Agent Loop 的说明](https://openai.com/index/unrolling-the-codex-agent-loop/) 描述了 Codex 从不同层级聚合用户指令：全局 `AGENTS.md`/`AGENTS.override.md`，以及从项目根到当前目录的规则文件，且更具体的目录指令靠后进入上下文。它还明确区分 instructions、tools 与 input；目录可写范围、网络和审批属于权限/工具环境的一部分，而非 `AGENTS.md` 文本本身。

因此，`AGENTS.md` 应只表达可验证的项目事实：目录边界、构建命令、测试要求、代码风格、数据分类与交付证据。以下内容不应只写在其中：

- “禁止删除生产数据”：必须由数据库权限、工具网关和审批实现。
- “只能访问公司 API”：必须由 sandbox/network allowlist 实现。
- “不得上传密钥”：必须由 secret scanner、DLP 和凭证注入策略实现。
- 大段架构文档、完整日志和临时任务对话：它们污染每个 turn，应改为按需检索。

### OpenClaw 与 Hermes：工作区文件更要分离共享与私有

[OpenClaw Memory Overview](https://docs.openclaw.ai/concepts/memory) 使用工作区中的 `MEMORY.md` 和日记型 `memory/YYYY-MM-DD.md` 形成持久层与工作层，并特别提醒长期记忆应是精炼事实而非完整日志。[Hermes Context Files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files) 则按优先级发现 `.hermes.md`、`AGENTS.md`、`CLAUDE.md` 或 `.cursorrules`，每个 session 只选定一种项目 context 类型。

这类文件可能被注入聊天渠道的上下文，因此必须明确：团队共享规则、个人偏好、用户档案和密钥文件不可混放。OpenClaw 的 `AGENTS.md` 模板也建议不要在共享 Discord/群聊上下文加载含个人信息的长期记忆。

## 四、压缩、pruning 与归档是三件事

长会话通常会混入大段工具结果、重复重试、旧计划和无关对话。以下三个动作不可互相替代：

| 动作 | 改变模型下轮输入 | 改变持久化历史 | 目标 |
| --- | --- | --- | --- |
| Compaction | 是，旧内容变为摘要 | 通常保留摘要/原记录 | 让对话在窗口内继续 |
| Pruning | 是，裁剪部分工具结果 | 否，原始记录仍在 | 降低短期 token 与缓存成本 |
| Archive/Delete | 不一定 | 是，迁移或删除数据 | 保留、合规与用户删除请求 |

### 正确的压缩检查点

压缩前不要只让模型写一段散文摘要。至少要将以下工件落盘：

```yaml
checkpoint:
  task_goal: "修复退款超时并补回归测试"
  accepted_decisions:
    - "使用指数退避，不改变公共 API"
  verified_evidence:
    - "commit: 9f8e7d6"
    - "test: RefundIT passed at 2026-07-14T10:12Z"
  open_questions:
    - "生产 retry 上限待 SRE 确认"
  tool_effects:
    - "pr_draft: 4821"
  next_safe_action: "只修改 RetryConfig 并重跑 RefundIT"
```

其中 `tool_effects` 和 `next_safe_action` 比“聊天总结”更重要：后续模型可以据此查询事实、避免重复创建 PR、避免重复部署，并识别仍需审批的动作。

### 四个 Runtime 的可观察差异

| Runtime | 上下文收缩行为 | 可借鉴的运营结论 |
| --- | --- | --- |
| Claude Code | 接近上限时优先清理旧工具输出，再总结对话；根 `CLAUDE.md` 可在 compaction 后重新注入 | 重要规则写入受管/项目文件；对话中临时约定必须落到 checkpoint |
| Codex | Agent loop 的输入由 instructions、tools、input 组成，项目指令按目录收集 | 观察 instruction footprint、工具 schema 和输入预算，而非只看聊天长度 |
| OpenClaw | 自动 compaction 保存摘要与最近 tail；pruning 仅对请求内工具结果生效，历史仍在磁盘 | 对工具重输出优先 pruning，对会话语义使用 compaction，二者分别监控 |
| Hermes | Session 会为压缩形成 lineage；context engine 可替换，持久 memory 是启动时冻结快照 | 压缩与 memory promotion 分开评测，避免摘要直接升级为长期事实 |

[Claude Code 如何工作](https://code.claude.com/docs/en/how-claude-code-works) 指出规则应放入 `CLAUDE.md`，不能依赖早期聊天指令在压缩后仍被完整保留。[OpenClaw Compaction](https://docs.openclaw.ai/concepts/compaction) 说明完整历史仍留在磁盘、工具调用与结果成对保留，并将 compaction 与 pruning 明确区分。[Hermes Context Compression](https://hermes-agent.nousresearch.com/docs/developer-guide/context-compression-and-caching/) 将压缩实现抽象为可替换 context engine。

## 五、跨会话记忆：先授权，再召回

跨会话检索是最容易引起隐私泄露的部分。命中相似内容不等于有权展示，更不等于应该写回长期记忆。

```text
query -> candidate retrieval
      -> visibility / tenant / purpose policy
      -> redaction and token budget
      -> evidence injection with source + freshness
      -> model may cite, never silently elevate to fact
```

| 检查 | 典型问题 | 失败后行为 |
| --- | --- | --- |
| 主体与租户 | 是同一用户/团队吗 | 直接拒绝候选 |
| session 可见性 | 父子 session、同 Agent、跨 Agent 是否允许 | 过滤，不提示存在性 |
| 数据等级 | 能否进入当前模型/provider | 脱敏、摘要或阻断 |
| 用途限制 | 仅支持、分析，还是允许执行 | 不将检索内容变成工具参数 |
| 新鲜度 | 是否已过期、已被撤销 | 降权或标记需验证 |

OpenClaw 的 [Session Search](https://docs.openclaw.ai/concepts/session-search) 与 [Memory Search](https://docs.openclaw.ai/concepts/memory-search) 是很好的例子：精确 transcript 搜索和语义 memory 搜索分开，session 命中还受 session tree 可见性限制；扩大到同 Agent 或跨 Agent 都是显式配置。企业系统应默认采用这种 fail-closed 思路。

Hermes 的 [Persistent Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/) 也展示了另一种可借鉴的分层：小型 `MEMORY.md` 与 `USER.md` 启动时注入，具体历史通过 session search 按需查找。前者适合稳定偏好和环境事实，后者适合“上周是否讨论过某个故障”，不要互相替代。

## 六、长期记忆写入门禁

模型“认为值得记住”不是可靠写入条件。建议将候选记忆走下面的 pipeline：

```text
observation
  -> classify origin / sensitivity / confidence
  -> dedupe and contradiction check
  -> evaluate usefulness and scope
  -> approval or policy gate
  -> versioned memory record with TTL
  -> recall audit and eventual expiry/delete
```

### 记忆记录应结构化

```json
{
  "memory_id": "mem_902",
  "statement": "退款服务集成测试依赖本地 Redis 7",
  "origin": "verified_tool_result",
  "evidence_ref": "ci://run/234/log#redis",
  "scope": {"tenant": "acme", "project": "payments"},
  "confidence": 0.96,
  "sensitivity": "internal",
  "observed_at": "2026-07-14T10:12:00Z",
  "expires_at": "2026-10-14T00:00:00Z",
  "status": "active",
  "supersedes": null
}
```

| 候选内容 | 默认动作 | 原因 |
| --- | --- | --- |
| 用户明确、稳定的格式偏好 | 可写入用户 scoped memory | 高复用、低风险 |
| CI 成功的依赖事实 | 写入项目 memory，带证据和 TTL | 可验证但可能随版本变化 |
| 模型对故障原因的推断 | 仅保留为 hypothesis/任务工件 | 不能作为长期事实 |
| token、密码、身份证号、完整聊天原文 | 拒绝持久化或转入受控 vault | 高敏感且通常无必要 |
| 临时路径、一次性调试输出 | 不写长期记忆 | 容易过期且污染 recall |

写入时还要检测矛盾。如已有“Redis 6”且新证据为“Redis 7”，不要覆盖旧文本而不留来源；应标记 supersedes、更新时间和证据。记忆更新本质是小型知识治理，不是 append-only 聊天摘要。

## 七、检索质量与安全的评测

只评估“是否搜索到正确文本”不够。生产评测至少包含：

| 指标 | 要回答的问题 |
| --- | --- |
| Recall@k / MRR | 正确事实能否被找回 |
| Citation precision | 注入的引用是否真的支持结论 |
| Freshness error | 过期记忆被错误使用的比例 |
| Privacy leakage rate | 不可见 session/租户内容是否被召回 |
| Context usefulness | 加入该片段是否提高任务成功率 |
| Noise ratio | 无关片段占用的 token 占比 |
| Compaction fidelity | 压缩后关键目标、决策、effect 是否仍正确 |
| Memory write precision | 长期记忆中真正可复用且未过期的比例 |

建议构建三组回归集：事实集、隔离集、压缩集。前者验证项目规则和历史决策能被找回；隔离集用多租户、用户、父子 session 的样本验证不会泄露；压缩集检查长工具输出、多项决策、已创建外部工单和待审批状态是否仍被正确保留。更换 embedding、reranker、context engine、规则文件或 prompt cache 策略时都要跑三组。

## 八、四类 Runtime 的生产操作手册

### Claude Code

1. 用 `/memory` 查看本次会话加载的 `CLAUDE.md`、rules 和 auto memory，不靠猜测排查“为什么没遵守规则”。
2. 根 `CLAUDE.md` 保持短小且版本化；目录专属规则放入 path-scoped rules，多步骤流程放入 Skills。
3. auto memory 仅保留可复用的项目经验，定期审阅 `MEMORY.md` 索引和主题文件；不要把它作为跨机器共享知识库。
4. 为关键任务维护 Compact Instructions，要求保留 task goal、已验证证据、外部 effect 与待审批项。
5. 必须强制的动作使用 Hook 或工具策略，不把文本指令当作安全控制。

### Codex

1. 对每次任务记录实际命中的 `AGENTS.md`/`AGENTS.override.md`、可写目录、network/approval 模式和 commit SHA。
2. 按目录拆 `AGENTS.md`，让更具体规则只影响相应文件树；避免根文件塞进每个子系统的全文文档。
3. 将 Issue、网页、日志和截图视为不可信数据；从中提炼任务事实后再放入结构化 task state。
4. 将 `AGENTS.md` 变更当策略变更走 review，尤其是修改测试、Git、网络和生成 PR 的说明。
5. 对长任务使用工件、diff、测试报告和 checkpoint 保持连续性，不依赖聊天 transcript 的无限保留。

### OpenClaw

1. 多用户入口启用合适的 DM/session scope；不要因方便而让不同人共享一个 main session。
2. `MEMORY.md` 只存持久精华，日记文件保存工作线索，详细内容通过 memory search 按需读取。
3. 开启 transcript 语义检索前，确认 visibility、agent scope、保留期、filesystem trust boundary 和索引延迟可接受。
4. 对 tool-heavy 会话先启用 pruning，再评估 compaction 频率和 summary 质量；压缩后仍保留 effect checkpoint。
5. 对外部 memory provider 做数据出境、embedding 供应商、索引重建和删除请求的单独审查。

### Hermes

1. 小型 `MEMORY.md`/`USER.md` 只写稳定事实和偏好；大历史交给 SQLite session search 或受控 external memory provider。
2. 默认每位用户在群聊中隔离 session；若切换为共享 room brain，明确评估历史可见性、成本和 interrupt 互相影响。
3. 设置 session reset/prune 策略前，先规定 reset 前允许写入哪些记忆和技能，避免自动把未验证内容升级。
4. context compression、prompt cache 和 external memory provider 分别观测命中、token、延迟和错误，不使用一个“上下文成功”指标掩盖问题。
5. 对 session 数据库、备份、删除、FTS 索引和外部 provider 制定相同的数据生命周期策略。

## 九、系统设计高频追问

### Q1：为什么不直接把整个 Git 仓库和全部聊天记录放进 400K context？

> 窗口变大不等于注意力和事实质量无限提高。全量注入会增加 token、延迟和噪声，旧版本文件、无关日志和不可信文本还会干扰决策。正确做法是把仓库快照、任务状态、目录规则、按需检索和工具句柄分层；每个片段有预算、来源和 freshness。模型需要时再读取原文件并绑定 commit SHA。

### Q2：compaction 后如何保证不会重复发工单或重复部署？

> 外部副作用不能只存在摘要里。工具调用要生成稳定 idempotency key 和 `tool_effect` 记录，checkpoint 保存外部引用和状态。恢复时先查询资源系统，已成功则复用结果，状态未知则人工仲裁。摘要只帮助模型理解下一步，不能承担幂等性保证。

### Q3：用户说“忘记我”，系统需要删除什么？

> 先枚举所有层：当前 session、长期 memory、用户 profile、向量/FTS 索引、自动摘要、备份、审计与派生知识库。不同层可能有不同保留要求，但必须有 deletion request ID、适用 scope、异步擦除状态和可验证收据。删除原文后还要处理 embedding、缓存和从原文推导出的长期结论，不能只删一份 Markdown。

### Q4：为什么项目规则与 memory 要分开？

> 项目规则是团队审阅、版本控制且明确要求遵守的规范；memory 是 Agent 或用户积累的经验，可能过期、局部或不确定。混在一起会导致模型把“上次偶然成功的操作”误解为硬规范，也让审计者无法判断谁批准了什么。规则变更要走代码评审，memory 变更要有来源、置信度和到期策略。

### Q5：检索结果被 prompt injection 污染怎么办？

> 将外部文本标记为 data/untrusted，不允许它改变 system policy、工具授权或任务目标；只抽取与问题相关的事实和引用。工具网关仍验证每个动作。对高风险检索源使用内容扫描、HTML/脚本剥离、敏感数据过滤、来源 allowlist 和人工批准，且追踪哪段内容影响了最终动作。

## 十、上线检查表

### Context Build

- [ ] 每轮生成 Context Manifest，记录来源、作用域、敏感度、版本、token 和 redaction。
- [ ] 项目规则、任务状态、会话历史、检索记忆和工具结果分层装配。
- [ ] 不可信网页、Issue、文档和工具输出都不能覆盖策略或获得权限。

### Memory and Privacy

- [ ] 长期记忆有 owner、evidence、scope、TTL、版本、矛盾处理和删除路径。
- [ ] recall 在召回前进行 tenant/session visibility/purpose 检查，默认 fail closed。
- [ ] user profile、团队项目事实、个人本地偏好和 secret vault 不共用同一存储层。
- [ ] 对 embeddings、向量库、SQLite、备份和外部 memory provider 统一执行保留与删除策略。

### Compression and Operations

- [ ] compaction checkpoint 保存目标、决策、证据、effect、待审批项和 next safe action。
- [ ] pruning、compaction、archive/delete 有不同指标和运行手册。
- [ ] 规则、embedding、reranker、context engine 的变更经过事实、隔离和压缩回归集。
- [ ] 监控 context tokens、cache hit、noise ratio、recall quality、泄露率、压缩 fidelity 和 memory write precision。

## 延伸阅读

- [Claude Code Memory](https://code.claude.com/docs/en/memory) 与 [How Claude Code Works](https://code.claude.com/docs/en/how-claude-code-works)：CLAUDE.md、auto memory、规则加载和 compaction。
- [OpenAI: Unrolling the Codex Agent Loop](https://openai.com/index/unrolling-the-codex-agent-loop/)：Codex 的 instructions、tools、input 与 AGENTS.md 聚合路径。
- [OpenClaw Memory Overview](https://docs.openclaw.ai/concepts/memory)、[Compaction](https://docs.openclaw.ai/concepts/compaction)、[Memory Search](https://docs.openclaw.ai/concepts/memory-search)：记忆文件、检索、压缩、可见性和索引边界。
- [Hermes Persistent Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/)、[Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/)、[Context Compression](https://hermes-agent.nousresearch.com/docs/developer-guide/context-compression-and-caching/)：小型启动记忆、会话隔离、压缩与可插拔 context engine。
