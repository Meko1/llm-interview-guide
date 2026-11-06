---
title: A2A 协议与 Agent 互操作
description: >-
  本页讲 Agent Card、Task、Message 和 Artifact
  的协议模型；需要回答可信发现、身份委托、异步任务、回调验签、跨租户审计和事故止血时，见 A2A 跨 Agent 互操作生产设计面试题。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# A2A 协议与 Agent 互操作

> 本页讲 Agent Card、Task、Message 和 Artifact 的协议模型；需要回答可信发现、身份委托、异步任务、回调验签、跨租户审计和事故止血时，见 [A2A 跨 Agent 互操作生产设计面试题](/interview/a2a-production-interoperability-qna)。

> 当一个 Agent 需要把任务委托给「别人家」的 Agent 时，就需要一套通用语言。**A2A（Agent2Agent）** 由 Google 在 2025 年发起、后捐给 Linux 基金会，目标是成为跨厂商、跨框架的 Agent 间协作标准。本文讲清 A2A 解决什么问题、核心对象（Agent Card / Task / Message / Artifact）、通信流程，以及面试最爱问的 **A2A vs MCP** 区别与互补。MCP 见 [MCP 协议深入](/agent/mcp) 与 [Function Calling 与 MCP](/agent/function-calling-mcp)，多 Agent 协作见 [多 Agent 与进阶范式](/agent/multi-agent)。

## 一、为什么需要 Agent 互操作标准

单个 Agent 接工具、接数据，已经有 MCP 解决。但真实企业里会有**多个独立 Agent**（不同团队、不同厂商、不同框架，甚至跑在不同公司）：

- HR Agent 要让「订票 Agent」帮新员工订机票；
- 客服 Agent 要把退款问题转给「财务 Agent」。

如果两两之间都自定义接口，会变成 $N^2$ 的私有集成噩梦。A2A 想做的就是给 Agent 之间一个**统一的发现、通信、协作协议**——就像 HTTP 之于网站。

**关键设计原则**：把对方 Agent 当成**不透明（opaque）的黑盒**——你不需要知道它内部用什么模型、什么工具、什么记忆，只通过协议交换任务和结果。这保护了各方的知识产权与内部实现。

## 二、A2A 是什么

- **发起与治理**：Google 2025 年 4 月发布，6 月将项目捐给 **Linux Foundation**，由社区中立治理，多家厂商参与。
- **定位**：Agent 与 Agent 之间的**横向**协作协议（agent-to-agent）。
- **技术底座**：下文使用 HTTP(S)/JSON-RPC、SSE 和通知的教学路径，不把它当所有版本唯一传输方式。上线须固定协议版本与 transport binding，再核对方法名、发现路径和状态枚举。

## 三、核心概念

### 3.1 角色

- **Client Agent（客户端 Agent）**：发起请求、委托任务的一方。
- **Remote / Server Agent（远端 Agent）**：接收并执行任务的一方。
- 同一个 Agent 在不同交互里可以既是客户端又是服务端。

### 3.2 Agent Card（能力名片）★

A2A 的**能力发现**机制。每个 Agent 暴露一份 JSON 描述文件，通常放在约定路径（如 `/.well-known/agent-card.json`）：

- **身份与地址**：名称、描述、服务 endpoint URL、版本。
- **技能（skills）**：它能干什么、输入输出示例。
- **能力（capabilities）**：是否支持流式（streaming）、推送通知（pushNotifications）等。
- **鉴权要求**：需要哪种认证（OAuth2、API Key、Bearer 等）和支持的输入/输出模态。

客户端 Agent 先读对方的 Agent Card，判断「该不该把这个任务交给它、怎么交」。

### 3.3 Task（任务）★

A2A 以**任务**为中心，任务是有状态、有生命周期的对象，带唯一 ID。典型状态流转：

```
submitted → working → input-required → completed
                    ↘ failed / canceled
```

`input-required` 是亮点：远端 Agent 执行到一半发现信息不全，可以**回头向客户端要补充输入**，支持真正的多轮协作，而不只是一问一答。

### 3.4 Message / Part / Artifact

- **Message（消息）**：一次交互的内容载体，分 `role`（user/agent）。
- **Part（部件）**：消息/产物的最小单元，支持多模态——`TextPart`（文本）、`FilePart`（文件）、`DataPart`（结构化 JSON）。一条消息可由多个 Part 组成。
- **Artifact（产物）**：任务的最终产出物（报告、图片、数据），同样由 Part 组成，可流式增量返回。

## 四、通信流程（典型一次委托）

1. **发现**：Client 拉取 Remote 的 Agent Card，确认技能与鉴权方式。
2. **发起**：Client 通过 JSON-RPC 调 `message/send`（或流式 `message/stream`）创建 Task。
3. **执行/流式**：Remote 处理任务；若支持流式，用 SSE 持续推送状态与中间产物（边做边返回）。
4. **要补充（可选）**：Remote 置任务为 `input-required`，Client 补发消息后继续。
5. **长任务推送**：耗时任务可注册 webhook，完成后由 Remote **主动推送通知**，无需客户端长轮询。
6. **完成**：任务转 `completed`，返回最终 Artifact。

## 五、A2A vs MCP（面试核心）★

二者**不是竞争，而是互补**，常被概括为「MCP 接工具、A2A 接 Agent」：

| 维度 | MCP | A2A |
| --- | --- | --- |
| 连接对象 | Agent ↔ **工具/数据/资源** | Agent ↔ **Agent** |
| 方向 | 纵向（垂直集成能力） | 横向（同侪协作） |
| 对端是什么 | 提供工具/资源的服务，内部也可能是模型 | 可隐藏内部实现的 Agent 服务 |
| 交互特征 | 函数调用式，输入→输出 | 任务式，有状态、多轮、可流式、可异步 |
| 类比 | 给 Agent 装「手和眼」 | 让 Agent 之间「打电话开会」 |

**协同**：一个旅行 Agent 可能用 **MCP** 访问航班查询 API 和数据库（拿能力），同时用 **A2A** 把「订酒店」委托给专门的酒店 Agent（找同侪）。一次任务里两者同时存在很正常。

> 记忆法：**MCP = Model–Context（模型接上下文/工具）；A2A = Agent–Agent（智能体接智能体）**。

## 六、安全与企业落地

- **沿用 Web 安全栈**：HTTPS、标准 OAuth2 / OIDC / API Key，鉴权要求写在 Agent Card 里，可走现有 API 网关与 WAF。
- **不透明边界**：对端不暴露内部工具与数据，降低越权与信息泄露面，但也意味着你要信任对方的执行结果——需结合输出校验与审计。
- **风险点**：跨 Agent 的提示注入传播、任务伪造、能力名片被仿冒；要做来源校验、签名与最小授权。
- **可观测**：跨 Agent 调用要做分布式 tracing，否则出问题难定位（见 [Agent 评估与可靠性工程](/agent/agent-evaluation)）。

## 七、现状与取舍

- A2A 仍处于快速演进期，生态与各框架适配在持续完善，落地前确认版本与互操作性。
- **什么时候才用 A2A？** 只有**真的存在多个独立 Agent 需要跨边界协作**时才需要。单体应用内部的多个「子 Agent」，用框架内调用（LangGraph / AutoGen 等）通常更简单可控，别为了用协议而引入协议。

## 高频追问

### 委托不是授权：一次订票任务的状态与恢复

假设允许远端查询航班，但购票必须由本方用户确认。Agent Card 的技能描述只用于发现，不能证明服务身份、授权范围或购票质量。客户端验证可信 endpoint 与凭据后，仍只委托只读查询；确认购买应绑定旅客、班次、价格上限、有效期和资源版本。

远端 `completed` 表示协议任务完成，不必然表示机票已出票。Artifact 应包含可验证的业务凭据与限制，本方另查订单状态。网络超时后先按任务 ID 查询，不创建新任务重新购票；协议任务 ID 也不能代替业务服务的幂等键。

回调通知只是状态变化信号：验证来源、签名或约定认证、时间窗与重复事件，再读取授权任务状态。取消任务不证明已执行的外部付款被撤销。将任务状态、授权状态、业务副作用状态分开记录，未知结果进入对账或人工处理。

互操作验收应包含版本不匹配、重复消息、流断线、`input-required` 恢复、过期凭据、跨租户 Artifact 和完成后取消；多次试验从干净环境开始，统计最终业务完成率与重复副作用，不能只测握手成功。

依据：[A2A 官方仓库](https://github.com/a2aproject/A2A)，本轮读取 README 中不暴露内部状态、能力发现与协作定位，未核对完整版本规范；本文具体方法名、治理日期与所有状态/传输绑定仍待逐版本核查。

1. **A2A 解决什么问题？** 让不同厂商/框架的独立 Agent 之间能互相发现与协作，避免 $N^2$ 私有集成。
2. **A2A 和 MCP 什么关系？** 互补：MCP 让 Agent 连工具/数据（纵向），A2A 让 Agent 连 Agent（横向）；一次任务可同时用到。
3. **Agent Card 是什么？** Agent 的能力名片（JSON，放 well-known 路径），描述技能、能力、endpoint 与鉴权，是能力发现的基础。
4. **A2A 为什么把对方当「不透明黑盒」？** 保护各方内部实现与 IP，降低耦合与泄露面；只交换任务与产物，不共享内部状态/工具。
5. **A2A 用什么技术底座？** 按所选协议版本与传输绑定回答。本文以 JSON-RPC/SSE 路径说明交互，不宣称它是所有版本唯一实现。
6. **Task 的 `input-required` 状态有什么用？** 支持远端 Agent 执行中回头要补充信息，实现真正的多轮协作。
7. **多 Agent 协作一定要用 A2A 吗？** 不一定。单应用内部用框架内调用更简单；只有跨组织/跨框架的独立 Agent 协作才需要标准协议。
