# 编码 Agent 测试策略与验证闭环：从补丁到可信交付

> 这页解决一个很容易被混为一谈的问题：**测试通过不等于 Agent 做对了，模型评测也不等于变更可以发布。** 面试时应当把代码行为、Agent 能力、变更审查和线上效果拆开，再用一条可追溯的证据链把它们连接起来。
>
> 先看 [智能编码 Agent 企业操作手册](/interview/coding-agent-production-playbook) 理解受控任务、工作区和 Git 交付；再看 [Agent 代码审查与变更交付证据链](/interview/agent-code-review-delivery-playbook) 处理独立审查。本页聚焦补丁生成后的验证闭环。

## 30 秒总答法

> 我不会让 Coding Agent 以“跑绿了”作为完成条件。任务进入时先冻结 base SHA、复现步骤和可机器执行的验收契约；生成补丁后，在一次性隔离环境中按影响面运行语法、类型、单测、集成、契约、安全和端到端验证。测试证明**这个版本的软件行为**，评测衡量**Agent 在任务集上的能力**，独立审查判断**变更是否遗漏语义和风险**，灰度与线上探针确认**真实依赖、流量和业务指标**。每一道门都保存输入版本、命令、环境、退出码、报告和决策人。失败不能由同一个 Agent 静默重试到“看起来成功”；它必须归因、限制重试预算，并把有效 bad case 回灌到回归集。

## 一、先分清四类证据，避免答题时概念打架

| 名称 | 要回答的问题 | 最小证据 | 常见误区 |
| --- | --- | --- | --- |
| 软件测试 | 修改后的程序是否满足明确行为？ | 可复现命令、固定依赖、断言和报告 | 把 lint 或编译成功当成功能正确 |
| Agent 评测 | Agent 面对任务集是否稳定、经济、合规？ | 任务集、成功判定、轨迹、成本和版本对比 | 用单次真实任务替代评测集 |
| 代码审查 | 这个 diff 是否引入语义、架构或安全风险？ | 独立 reviewer 结论、风险定位和复核 | 作者自评或只看“测试绿” |
| 部署验证 | 制品在目标运行环境与真实流量下是否可用？ | 环境版本、探针、SLO、观测和回滚结果 | 把 CI 环境当作生产环境 |

四类证据的依赖方向是：**测试和审查约束一个补丁，评测约束 Agent 的版本策略，部署验证约束一次发布决策。** 任何一类都不能替代另一类。

```text
任务/缺陷 -> 验收契约 -> Agent patch
                         -> 分层测试 ----------+
                         -> 独立审查 ----------+-> 合并门禁 -> 灰度/线上验证 -> 回灌
Agent/提示词/工具变更 -> 离线评测 ------------+
```

## 二、把自然语言需求变成可验证的验收契约

“修一下退款超时”并不是可交付的测试条件。接单服务应先把需求、现状和不变量冻结到任务快照，尤其不能让 Agent 在改完代码后再自行定义“成功”。

```yaml
change:
  id: ca-20260715-042
  repository: payments-api
  base_sha: 6f2d1be
  objective: "修复并发退款在支付渠道超时时的重复扣款"
  acceptance:
    reproduce:
      command: "./gradlew :refund:test --tests '*TimeoutDuplicateChargeTest'"
      expected_before: fail
    invariants:
      - "同一 idempotency_key 至多生成一笔扣款"
      - "渠道超时后可安全重试，最终状态可解释"
    required_checks:
      - "./gradlew check"
      - "./gradlew :refund:integrationTest"
      - "./scripts/contract-test payment-provider"
  boundaries:
    writable_paths: ["services/refund", "tests/refund"]
    prohibited_changes: ["db/migrations", "infra/production"]
  release:
    rollout: canary
    rollback_signal: "duplicate_charge_rate > 0"
```

验收契约至少有四个价值：锁定基线、让失败先发生、限制修改面、定义发布后的观察点。对没有稳定 oracle 的任务，必须明说验证强度下降，并增加人工验收或影子流量，不要伪造精确断言。

## 三、分层测试不是固定清单，而是风险模型

编码 Agent 很擅长把“运行全部测试”当作万能答案；生产系统更需要按风险选择最小充分集合，再在高风险时扩大到全量。一个实用的选择器可以使用：`diff` 触及范围、依赖图、接口/迁移标记、历史 flaky 概率、变更风险等级和成本预算。

| 层级 | 验证对象 | 何时必须运行 | Agent 可否自主修复失败 |
| --- | --- | --- | --- |
| 格式、静态、类型 | 语法、类型、危险 API | 所有可合并变更 | 可以，限本地 diff 和重试次数 |
| 单元测试 | 纯逻辑、边界、错误处理 | 受影响模块 | 可以，但须保留失败和修复轨迹 |
| 集成测试 | 数据库、消息、缓存、服务组合 | 依赖、事务、并发、序列化改变 | 仅在隔离 fixture 中 |
| 契约测试 | API/事件/Schema 兼容性 | 公共接口或消费者受影响 | 不可通过删断言“修复” |
| 端到端测试 | 用户路径和异步链路 | 关键业务路径或 UI 行为 | 可定位和提出 patch，需独立复核 |
| 安全/供应链 | secret、依赖、权限、SAST | 新依赖、脚本、网络、鉴权触点 | 不能自行豁免 |
| 发布前验证 | 制品、配置、迁移、回滚 | 可部署变更 | 不可直连生产进行试错 |

### 影响面驱动的测试选择

1. 从 `base_sha..head_sha` 提取文件、符号、依赖锁和配置变更；不相信 Agent 自己总结的影响面。
2. 用构建系统、依赖图和测试映射提出候选测试；映射缺失时标记为低置信度，而不是假设“没有影响”。
3. 对接口、鉴权、迁移、并发、支付、删除和基础设施变更强制升级风险级别，追加契约、回滚或人工门禁。
4. 对 flaky 测试先隔离并记录，不把“重跑一次通过”写成修复成功；真正的门禁应区分产品失败、环境失败和不稳定测试。
5. 将最终选择、被跳过项与理由写入 manifest，供 reviewer 反问“为什么没有跑 X”。

```text
low:    changed unit tests + type/lint
medium: low + affected integration + dependency/security scan
high:   medium + contract/E2E + independent review + staged rollout
critical: high + change approval + rehearsal + explicit rollback owner
```

## 四、Verifier 不是 Author 的另一个名字

同一上下文里的 Agent 容易把自己写出的假设再确认一遍。因此要按职责而不是按产品名分离角色：Claude Code、Codex、OpenClaw 或 Hermes 都可以承担其中任意角色，但不应以“同一个 Agent 多想一次”冒充独立验证。

| 角色 | 输入 | 允许做什么 | 不能做什么 |
| --- | --- | --- | --- |
| Author | 任务契约、只读仓库、受限 worktree | 定位、写 patch、运行规定测试 | 修改验收条件、跳过门禁 |
| Verifier | base/head、测试计划、隔离环境 | 从干净环境重放、检查报告完整性 | 使用 Author 未声明的本地状态 |
| Reviewer | diff、设计约束、验证摘要 | 找语义回归、权限和边界遗漏 | 因“测试很慢”直接批准 |
| Release owner | 制品、门禁、线上信号 | 决定灰度、暂停和回滚 | 把 Agent 的文字结论视为授权 |

独立性至少包括三件事：**独立工作区、独立上下文、独立判定规则**。如果共享同一个缓存、fixture、测试数据库或“已知答案”，就要把这种相关性写入证据，不能宣称验证独立。

## 五、把 Agent 评测做成持续回归，而不是一次演示

软件测试的输入是某个代码版本；Agent 评测的输入还包括模型、提示词、工具版本、规则文件、权限、检索索引和运行镜像。任何一项变化都可能让 Agent 的行为改变。

建议将任务集拆成：

- **Golden tasks**：高频、可稳定断言的修复、重构、测试补全和代码问答；用于每次变更回归。
- **Regression tasks**：线上失败、人工拒绝的 PR、测试漏网和安全拦截；每一个都有根因标签。
- **Adversarial tasks**：恶意仓库指令、伪测试、路径穿越、危险命令、伪造日志和越权工具请求。
- **Holdout tasks**：不参与提示词调优，防止团队把评测答案背出来。

| 指标 | 含义 | 不能单独使用的原因 |
| --- | --- | --- |
| 任务成功率 | 在任务 oracle 下完成比例 | 可能掩盖高成本或越权路径 |
| 可构建/测试通过率 | patch 的基本可执行性 | 可通过删测试或误改断言虚高 |
| 修复有效率 | 原始缺陷消失且不破坏关键不变量 | 需要强 oracle 或独立验证 |
| 审查拒绝率 | 进入 review 后被拒的比例 | 受 reviewer 标准和任务难度影响 |
| 轨迹合规率 | 是否遵守权限、路径、预算和工具策略 | 不代表功能一定正确 |
| 每成功任务成本 | token、工具、CPU 和人审时间 | 需同时看质量下限与长尾 |

`pass@1` 高并不代表适合自动合并。高风险代码应使用“成功率下限 + 越权率上限 + 人审覆盖率 + 成本上限”的联合门槛。

## 六、失败归因与重试：不能让 Agent 把红灯刷成绿灯

失败报告至少记录 `base_sha`、`head_sha`、镜像 digest、依赖锁、命令、环境、完整退出码、关键日志位置、测试重试次数和分类。推荐分类如下：

| 分类 | 例子 | 默认动作 |
| --- | --- | --- |
| 产品失败 | 断言失败、行为回归、契约不兼容 | 回到定位/patch，保留失败证据 |
| Agent 失败 | 修改范围失控、无效 patch、误读任务 | 停止同策略重试，转人工或调整任务上下文 |
| 环境失败 | 镜像拉取、依赖服务、磁盘/网络故障 | 重建干净环境后有限重放 |
| Flaky | 非确定时间、竞态、共享 fixture 污染 | 隔离、标记、建立稳定性专项，不自动放行 |
| 策略拦截 | 越权命令、secret、外联、预算超限 | fail closed，生成可审计升级请求 |

重试必须有预算和幂等边界。对于数据库迁移、外部支付、消息投递和部署，测试环境同样应使用隔离租户、临时凭证与可清理资源；“为了复现”连接生产数据库不是验证策略。

## 七、合并门禁要验证证据，而不只验证状态徽章

一个可审计的门禁记录可以长这样：

```json
{
  "change_id": "ca-20260715-042",
  "base_sha": "6f2d1be",
  "head_sha": "c41eafe",
  "artifact_digest": "sha256:...",
  "checks": [
    {"name": "unit", "exit_code": 0, "report": "artifact://..."},
    {"name": "contract", "exit_code": 0, "report": "artifact://..."}
  ],
  "review": {"independent": true, "decision": "approve"},
  "exceptions": [],
  "decision": "eligible_for_canary"
}
```

门禁服务需要校验：报告是否对应当前 `head_sha`，是否来自允许的 runner/image，必跑检查是否缺失，豁免是否有到期时间和责任人，合并队列重建基线后是否仍然有效。详细的工作区、旧基线和 merge queue 处理见 [多 Agent 共享工作区并发控制](/interview/multi-agent-workspace-concurrency-playbook)。

## 八、部署验证：CI 的最后一公里不是“发版成功”

对可部署改动，最终 gate 不是“部署 API 返回 200”，而是明确观察期内的行为证据：

1. **制品与配置一致性**：部署的是经过门禁的 digest，配置、Schema 和 feature flag 有版本和审计。
2. **预发布探针**：健康检查、关键读写、权限拒绝、迁移前后兼容和回滚演练在隔离环境可重放。
3. **渐进放量**：shadow、canary 或按租户/地域灰度；不要把 Agent 新策略直接给全量真实写操作。
4. **业务与技术 SLO**：错误率、延迟、资源、关键业务不变量、人工接管率和 Agent 拒绝率同时观察。
5. **回滚是动作，不是文档**：必须有明确触发阈值、制品/配置回退路径、负责人和验证步骤。
6. **bad case 回灌**：将线上异常脱敏、归因、复现并加入软件回归集或 Agent 评测集；只有能稳定复现的修复才算真正关闭。

## 九、系统设计追问：设计一个 Coding Agent 的验证控制面

**题目：** 数千个仓库可以让 Agent 提 PR。如何防止不可信测试、错误基线和“本地绿、线上红”？

```text
Task admission -> immutable contract -> isolated runner -> evidence store
       |                  |                    |              |
       +-> policy engine  +-> test planner      +-> verifier ---+-> merge gate
                                                                  |
                                                       canary / rollback controller
                                                                  |
                                                          eval + bad-case pipeline
```

回答顺序：

1. Admission 绑定请求人、仓库、base SHA、数据级别和允许的执行等级；签发短期 task token。
2. Planner 仅提出测试计划，风险规则决定必跑项；关键领域的规则在服务端，不能由仓库内自然语言覆盖。
3. Runner 使用不可变镜像、临时 worktree、受限网络与最小凭证；测试数据按租户和任务隔离。
4. Evidence store 对日志、报告、制品 digest 和批准签名做防篡改关联；任何检查都必须能回指版本与环境。
5. Verifier 从干净环境重放必要检查；Reviewer 检查语义、权限和测试是否真的覆盖修复。
6. Merge gate 只接受完整且未过期的证据；队列换基线后重新验证。
7. Release controller 负责灰度、SLO、暂停和回滚；Agent 只能提出建议，不能绕过业务授权。

## 十、面试速问速答

**Q：为什么不让 Agent 直接“修到测试通过”为止？**

因为测试本身可能不完整、被误改、受污染或与真实行为脱节。必须冻结验收、不允许 Agent 随意删断言，并由独立环境重放。对于高风险变更还要增加契约、审查和灰度信号。

**Q：代码测试和 Agent 评测如何联动？**

把任务的业务 oracle 复用为 Agent 评测的一部分，但保留 Agent 专属维度，例如工具越权、路径范围、成本、轮数和失败归因。软件测试失败说明 patch 有问题；Agent 评测退化说明模型/提示词/工具策略版本可能不适合继续推广。

**Q：如何应对 flaky 测试？**

先把环境、随机种子、时间、并发和 fixture 隔离；将 flaky 单列为质量债，记录失败概率。它不能作为“重跑通过就放行”的通行证，关键链路应有稳定替代 oracle 或人工风险决策。

**Q：Agent 能自己批准自己的 PR 吗？**

低风险建议类任务可以自动生成和自动测试，但合并批准必须来自独立规则和受保护分支；高风险场景再加人审。自评可以帮助定位，不能构成独立的交付证据。

## 上线前清单

- [ ] 每个任务是否在修改前冻结了 base SHA、验收条件、可写路径和风险等级？
- [ ] 测试、评测、审查、部署验证是否有不同的 owner、输入和成功判定？
- [ ] 测试报告是否能回溯到命令、环境、镜像、依赖锁和 head SHA？
- [ ] 是否禁止 Agent 通过删除/放宽断言、跳过检查或修改验收条件来“修复”失败？
- [ ] 高风险接口、迁移、并发、权限和外部副作用是否追加了契约、演练和人工门禁？
- [ ] flaky、环境失败、策略拦截和产品失败是否会走不同的处理路径？
- [ ] 合并队列换基线后是否重新验证必跑证据？
- [ ] 灰度指标、暂停阈值、回滚负责人和 bad case 回灌是否已经可执行？

## 参考与延伸

- [Claude Code 如何工作](https://code.claude.com/docs/en/how-claude-code-works)：以“收集上下文、执行、验证”描述其 Agent 循环，并建议提供可验证的测试或期望输出。
- [Claude Code Commands](https://code.claude.com/docs/en/commands)：`/verify` 强调构建并实际观察改动，不只依赖类型检查；`/autofix-pr` 可监测 CI 失败，但仍应受仓库门禁约束。
- [OpenAI Codex use cases](https://developers.openai.com/codex/use-cases)：将测试与质量工程作为编码 Agent 的实际使用场景；企业接入仍需自行定义版本、证据和授权边界。
- [LLM 评测与发布门禁实战](/interview/evaluation-release-gates)
- [LLM 线上评测与灰度实验](/interview/online-evaluation-rollout-operations)
- [Agent Runtime 升级、兼容性与回滚](/interview/agent-runtime-upgrade-rollback-playbook)
