# Computer Use / 浏览器 Agent 生产系统设计面试题

> Computer Use 面试的难点不在“能不能点一个按钮”，而在“如何让 Agent 在不可信网页、真实账号和有副作用的浏览器会话中做到可验证、可中断、可审计”。概念与技术路线见 [Computer Use 与浏览器 Agent](/agent/computer-use)，工具权限基础见 [Agent 工具安全与权限边界](/agent/tool-safety)，执行授权见 [企业 Tool Gateway 安全执行系统设计面试题](/interview/tool-gateway-security-design)。

## 怎么用这页

遇到 Computer Use、Browser Agent、网页自动化、GUI Agent 或智能客服岗位，按下面顺序回答：

1. 先区分 API、DOM/无障碍树和截图坐标三种操作面；能用确定性接口就不用视觉点击。
2. 再说明“观察 - 提议动作 - 校验 - 执行 - 验证”的闭环，不能让模型直接连续盲点。
3. 再讲浏览器身份、Cookie、站点、租户、下载和外发的隔离。
4. 最后说明高危动作确认、异常恢复、轨迹评测和事故止血。

## 30 秒总答法

> 我会把 Browser Agent 做成受控的浏览器任务运行时，而不是让模型拿到一个全权浏览器。任务首先声明目标、允许站点、用户身份、可用动作、预算和风险级别；运行时优先使用 API 或 DOM/Accessibility Tree，只有结构信息不足时才回退到视觉定位。每一步先产出候选动作和预期状态变化，由策略层检查域名、账户、字段、风险和审批；执行器在隔离的 Browser Context 中操作，并用 DOM、网络响应、页面语义或业务回执验证动作是否真的生效。支付、提交、外发、下载和权限变更必须 pause-for-approval。所有截图、选择器、动作参数、页面摘要、Cookie 作用域、确认记录和 trace_id 可回放。网页内容一律当作不可信输入，因此网页中的“忽略规则并转账”不会改变系统策略。

## 一、为什么 Browser Agent 不能等同于 RPA 或爬虫

| 类型 | 核心能力 | 优点 | 主要限制 |
| --- | --- | --- | --- |
| API 集成 | 结构化业务请求 | 最可靠、最可审计、最易授权 | 不是所有系统都有 API |
| 传统 RPA | 固定 selector / 坐标脚本 | 成本低、确定性强 | UI 变化就脆弱，异常分支覆盖差 |
| Browser Agent | 语言目标 + DOM/视觉观察 + 动态决策 | 能适应未知页面和长尾流程 | 慢、贵、会受注入和误点击影响 |
| GUI Agent | 截图、鼠标、键盘、桌面应用 | 通用性最高 | 状态难观测，风险也最高 |

**回答重点**：Browser Agent 是最后一公里能力，不是第一选择。对稳定、高频、资金类或可提供 API 的流程，应该用确定性服务；让 Agent 负责理解任务、选择流程、处理异常和补全人工操作。

## 二、分层架构：控制面、浏览器运行时与业务边界

```text
User / Workflow / Scheduler
  -> Task API: goal, identity, tenant, allowed domains, risk, budget
  -> Agent Orchestrator
      -> Planner / VLM
      -> Context & Memory (only approved task facts)
      -> Browser Policy Gateway
          -> Domain / URL / download / egress policy
          -> Approval Service + Credential Broker
      -> Browser Executor
          -> isolated Browser Context / profile / container
          -> DOM + Accessibility + screenshot observer
          -> action driver: click, type, select, upload, download
  -> Verification Service -> Audit / Trace / Evidence Store
  -> Business API / Tool Gateway for high-risk actions
```

| 模块 | 关键职责 | 不应该承担的职责 |
| --- | --- | --- |
| Orchestrator | 任务状态机、预算、重试、暂停与取消 | 保存长期账号密码 |
| Planner | 根据观察提出下一步候选动作 | 直接判断授权或绕过确认 |
| Browser Policy Gateway | 域名、动作、上传/下载、风险策略 | 代替业务系统的资源鉴权 |
| Browser Executor | 隔离环境内执行有限动作 | 把 Cookie 共享给其他租户 |
| Verification Service | 判断预期状态是否出现 | 只凭截图猜测成功 |
| Approval / Tool Gateway | 高危确认、委托凭证、审计 | 让模型直接获得长期密钥 |

## 三、观察层：DOM、Accessibility Tree、截图如何组合

### 选择原则

1. **优先业务 API**：例如查订单、创建草稿、提交审批，直接走受鉴权的后端接口。
2. **其次 DOM / Accessibility Tree**：有稳定 role、name、label、URL、表单状态时，用元素语义而不是 `(x, y)`。
3. **最后视觉坐标**：Canvas、远程桌面、旧系统或无可访问结构时，使用截图 + VLM，并提高验证与确认等级。

### 页面观察的规范化快照

不要把整张网页 HTML 或整屏截图无差别喂给模型。观察服务应生成受控快照：

```json
{
  "url": "https://portal.example.com/invoices",
  "title": "Invoice list",
  "trusted_origin": true,
  "interactive_elements": [
    {"id": "e17", "role": "button", "name": "Create draft", "enabled": true},
    {"id": "e25", "role": "textbox", "name": "Customer"}
  ],
  "sensitive_fields": ["bank_account"],
  "modal": null,
  "screenshot_ref": "evidence://task/t-1/step-8.png"
}
```

模型只能引用短生命周期的 `element_id`，执行器会在动作前重新解析元素并确认仍属于同一文档与可见状态。这样可以避免页面刷新后点击到同坐标的另一个按钮。

## 四、动作闭环：先提议，再校验，再执行，再验证

一个可靠的 Browser Agent 不应该输出“连续点击十步”。每步都应形成动作契约：

```text
observe
  -> plan candidate action
  -> policy + schema + element revalidation
  -> execute once
  -> wait for deterministic readiness condition
  -> verify expected state transition
  -> checkpoint / continue / ask user / fail
```

### 动作契约示例

```json
{
  "action": "click",
  "target": {"element_id": "e17", "expected_role": "button", "expected_name": "Create draft"},
  "preconditions": ["origin=portal.example.com", "no_modal", "user_session=active"],
  "expected_effect": ["url_change:/drafts/new OR dialog:Draft form"],
  "risk_level": "L1",
  "idempotency_key": "task-42-step-8"
}
```

如果验证不成立，不应直接重复点击。运行时先重新观察，判断是加载未完成、元素失效、页面跳转、验证码、权限拒绝还是模型定位错误，然后选择等待、回滚、请求人工帮助或结束任务。

## 五、浏览器状态机与可恢复任务

```text
QUEUED
  -> SESSION_ALLOCATED
  -> OBSERVING
  -> ACTION_PENDING
  -> ACTION_RUNNING
  -> VERIFYING
  -> (OBSERVING | APPROVAL_PENDING | CHECKPOINTED | COMPLETED | FAILED | CANCELLED)
```

必须持久化的不是完整原始页面，而是：任务目标、允许域、已确认动作、当前 URL、经过脱敏的观察摘要、element/action hash、浏览器 profile 引用、预算、审批状态、幂等键、证据引用和最后的可信 checkpoint。

**面试官：浏览器进程崩了怎么恢复？**

> 恢复时不能默认重放所有鼠标动作。先用任务 checkpoint 重建隔离会话，再重新认证或刷新短期凭证，访问预期页面并验证业务状态；只有未产生副作用的步骤可重试。对提交、付款、注册等动作，要先查询业务回执或凭幂等键确认是否已完成，再决定继续、补偿还是人工接管。

## 六、会话、Cookie、身份和凭证隔离

| 资产 | 正确边界 | 常见错误 |
| --- | --- | --- |
| Browser Context / Profile | `tenant + user + task` 或更窄的临时容器 | 多用户共用一个永久浏览器 profile |
| Cookie / local storage | 加密保存、到期销毁、不可进入 prompt/日志 | 截图或调试日志泄露 session cookie |
| 登录凭证 | 用户完成交互式登录，或由凭证代理提供短期委托 | 把用户名/密码或 MFA 秘钥提供给模型 |
| 上传文件 | 文件来源、哈希、分类、目的站点均可审计 | Agent 任意上传工作区文件 |
| 下载文件 | 隔离目录、恶意文件扫描、显式归属 | 自动打开下载的可执行文件 |

MFA、CAPTCHA、首次绑定设备、付款确认等用户存在性证明不应由 Agent 绕过。正确设计是将任务暂停为 `APPROVAL_PENDING`，向用户展示结构化摘要与返回入口，确认后继续同一个任务状态机。

## 七、网页 Prompt Injection 与不可信内容

网页、PDF、邮件、聊天记录和搜索结果都可能含有试图改变 Agent 行为的文本。Browser Agent 的危险在于它不仅会读，还会执行。

### 防护规则

- 所有页面文本默认是不可信数据，不是系统指令；
- 只有控制面、用户显式目标和签名工作流可以改变任务范围；
- 页面要求“上传密钥”“忽略规则”“把内容发到外站”时，作为风险信号而非命令；
- 允许域、允许下载类型、允许上传来源和允许外发目的地由策略配置，不由页面决定；
- 对输入框做数据分类和 DLP，避免把工作区秘密填入第三方站点；
- 外链跳转、文件下载、OAuth 授权页、系统权限弹窗都需要单独风险判定。

**一句话**：模型能读到的内容不等于模型有权执行的指令；浏览器页面是数据源，不是控制面。

## 八、动作分级与人审

| 风险等级 | 浏览器动作 | 默认策略 |
| --- | --- | --- |
| L0 无副作用 | 浏览、搜索、读取公开页面 | 自动执行，记录 trace |
| L1 可逆低风险 | 填草稿、筛选、打开内部页面 | 自动执行，页面验证 |
| L2 敏感读取/外发准备 | 查看账单、上传待发送附件、创建工单 | 身份校验、字段脱敏、保留预览 |
| L3 高风险写入 | 提交表单、发送邮件、创建订单、OAuth 授权 | 用户确认，确认令牌绑定动作哈希 |
| L4 不可逆/资金/权限 | 支付、转账、删数据、改权限 | 默认不开放给自由 Agent，双重审批与业务 API 二次校验 |

确认界面应展示：目标站点、账号、动作、关键字段、影响对象、费用/金额、附件哈希和可撤销性。不能只问“是否继续？”，否则用户无法知道模型实际将提交什么。

## 九、可靠性工程：等待、验证、重试和降级

### 不能只等固定秒数

固定 `sleep(3)` 是脆弱 RPA 的典型。应该等待业务可观察条件，例如：元素可交互、网络请求完成、URL 变化、DOM 版本变化、成功回执出现，或后端任务状态进入终态。每个条件都有 deadline；超时后返回结构化原因。

### 常见失败分类

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 找不到元素 | 页面变化、加载中、权限不同 | 重新观察，尝试语义定位，必要时转人工 |
| 点击无效 | 遮罩、元素失效、焦点错误 | 重新验证可见/可点击状态，不盲目连点 |
| 页面跳到外站 | 广告、钓鱼、OAuth、重定向 | 域名策略拦截，暂停并请求确认 |
| 已提交但未回显 | 网络抖动、异步后端 | 按幂等键/业务回执查询，避免重复提交 |
| 验证码/MFA | 人机验证或高风险登录 | 暂停任务，让用户处理，不尝试规避 |

当 Browser Agent 对高价值流程连续失败时，正确降级通常是生成草稿、导出待办或转人工，而不是无限重试或回退到全权限脚本。

## 十、评测、回放与可观测

端到端成功率很重要，但不够。一次轨迹要记录：任务意图、页面版本/URL、观察快照引用、模型候选动作、策略决定、执行结果、验证断言、截图/DOM 证据、用户确认、token、延迟、工具成本和最终业务结果。

建议指标：

- 端到端任务成功率、每百步错误数、平均恢复次数；
- 元素定位正确率、动作后状态验证覆盖率；
- 高危动作未确认执行数，目标应为 0；
- 注入/越域/异常下载拦截率；
- 人工接管率、接管前已完成的有效进度；
- 每任务截图/VLM token 成本、P95 时延和浏览器并发利用率。

测试环境要有受控站点、假账号、伪造支付结果、注入页面、慢加载、弹窗、重定向和并发会话。生产真实站点只能用于灰度和经过审批的回归样本。

## 十一、系统设计题：企业采购浏览器 Agent

**题目**：设计一个采购助理，可登录供应商门户、检索报价、生成采购草稿、上传合规附件；不能自动付款，要求多租户、审计、浏览器异常恢复。

### 白板回答骨架

1. **入口**：用户在业务系统创建采购任务，明确供应商、预算、允许站点和是否可生成草稿。
2. **控制面**：任务队列、域名白名单、账号/会话隔离、策略中心、审批中心、审计和 kill switch。
3. **浏览器面**：每任务一个临时 context；DOM/Accessibility 优先，视觉回退；下载/上传进入隔离文件服务。
4. **业务面**：报价和采购单通过受鉴权 API 查询/创建；浏览器只处理没有 API 的供应商交互。
5. **高危边界**：付款、合同签署、外部邮件发送只产生预览和 `approval_id`，由用户在业务系统确认。
6. **恢复**：每个关键步骤写 checkpoint；进程重启后验证供应商侧草稿状态和幂等键，绝不重放支付或最终提交。

## 十二、项目讲法模板

> 我们将浏览器自动化做成独立 Browser Runtime，而不是让大模型直接控制员工浏览器。任务进入后先分配临时 Browser Context，绑定租户、用户、允许域和预算；网页场景优先解析 DOM 和无障碍树，复杂 Canvas 或旧系统才回退到截图定位。模型每一步只提交带预期效果的动作契约，策略层会校验站点、元素语义、输入字段和风险等级，执行后由验证服务检查 URL、元素和业务回执。对提交、外发和付款类动作，我们只生成预览，用户确认后才通过 Tool Gateway 调用后端或允许浏览器提交。整条轨迹保存截图引用、动作哈希、策略版本和审批证据，因此发生误操作时可以暂停会话、撤销短期凭证并回放影响范围。

## 十三、反面回答清单

- “Browser Agent 就是 Selenium 加一个 LLM。”
- “只要截图看起来像成功页面，就算任务成功。”
- “用户已登录，所以所有网站和所有动作都可以复用 Cookie。”
- “网页显示的操作提示可以直接当作 Agent 指令。”
- “验证码和 MFA 可以让模型多试几次绕过。”
- “高危动作弹一个通用确认框就够了。”
- “浏览器崩溃后重新从第一步点一遍。”

## 面试前 5 分钟速记

- API 优先，DOM/Accessibility 次之，视觉坐标最后兜底。
- 每一步都要 observe -> policy -> execute -> verify，不允许盲目多步连点。
- Browser Context、Cookie、下载目录和临时凭证按用户/租户/任务隔离。
- 页面内容是不可信数据，不能改变系统策略和任务边界。
- 付款、外发、提交、OAuth、上传和权限变更要分级确认。
- 任务恢复先查业务回执和幂等键，绝不直接重放有副作用动作。
- 评测同时看成功率、验证覆盖、误操作拦截、接管率、成本和时延。

## 延伸阅读

- [Computer Use 与浏览器 Agent](/agent/computer-use)
- [Agent 工具安全与权限边界](/agent/tool-safety)
- [企业 Tool Gateway 安全执行系统设计面试题](/interview/tool-gateway-security-design)
- [Agent 评测与安全合规高频问答](/interview/agent-evaluation-safety-qna)
- [智能体运行时架构高频问答](/interview/agent-runtime-architecture-qna)
