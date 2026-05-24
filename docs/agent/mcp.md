# MCP 协议深入

> MCP（Model Context Protocol）是 2024 年以来最受关注的 AI 工程标准之一，几乎成了 Agent 方向的必考题。本文在 [Function Calling 与 MCP](/agent/function-calling-mcp) 的基础上，深入讲清它的架构、原语、传输方式、生命周期与安全风险。

## MCP 要解决什么问题？

在 MCP 之前，每个 AI 应用要接入每个外部工具/数据源都得写一套定制集成——M 个应用 × N 个工具 = **M×N 的组合爆炸**，重复造轮子、难复用。

MCP 由 Anthropic 提出并开源，是一个**开放标准协议**，把这件事标准化：工具方只需实现一个 **MCP Server**，应用方只需做一个 **MCP Client**，于是 M×N 降为 **M+N**。它常被比喻为「**AI 应用的 USB-C 接口**」——一个统一插口，接上即用。

## 架构：Host / Client / Server

```
┌─────────────────────────────────────┐
│  Host（AI 应用：Claude Desktop/IDE）  │
│   ┌──────────┐   ┌──────────┐         │
│   │ Client A │   │ Client B │  (一对一连接)
│   └────┬─────┘   └────┬─────┘         │
└────────┼──────────────┼───────────────┘
         │ MCP 协议      │
   ┌─────▼─────┐   ┌────▼──────┐
   │ Server 1  │   │ Server 2  │
   │ (文件系统) │   │ (数据库)   │
   └───────────┘   └───────────┘
```

- **Host**：运行 LLM 的宿主应用（Claude Desktop、Cursor、各类 IDE 等），负责协调。
- **Client**：由 Host 创建，与某个 Server 建立**一对一**连接，做协议层的收发。
- **Server**：轻量程序，向外暴露具体能力（访问文件、查数据库、调 API 等）。

> 一个 Host 可以连多个 Server（每个配一个 Client）。Server 既可以是本地进程，也可以是远程服务。

## 三大核心原语（Primitives）

MCP Server 可向外提供三类能力，这是高频考点：

| 原语 | 说明 | 由谁控制 |
| --- | --- | --- |
| **Tools（工具）** | 可被模型调用的函数（有副作用，如写数据库、发请求） | 模型驱动（model-controlled） |
| **Resources（资源）** | 可读取的数据/文件（如文档、日志），类似 GET，无副作用 | 应用驱动（app-controlled） |
| **Prompts（提示模板）** | 预定义的提示词/工作流模板，供用户主动选用 | 用户驱动（user-controlled） |

此外还有两个反向能力（Server 调用 Client）：

- **Sampling**：Server 反过来请求 Host 的 LLM 帮它做一次补全（让 Server 也能「借用」模型能力）。
- **Roots**：Client 告知 Server 可操作的文件系统根目录范围（边界约束）。

## 传输方式（Transport）

MCP 基于 **JSON-RPC 2.0** 通信，常见两种传输：

- **stdio**：本地进程间通过标准输入输出通信，适合本地工具（如本地文件系统 Server）。
- **Streamable HTTP（含 SSE）**：基于 HTTP 的远程传输，适合云端/远程 Server，支持流式。早期用 HTTP+SSE，新规范统一为 Streamable HTTP。

## 连接生命周期

1. **初始化（initialize）**：Client 与 Server 握手，协商协议版本与能力（capabilities）。
2. **能力发现**：Client 查询 Server 提供了哪些 tools / resources / prompts（`tools/list` 等）。
3. **调用**：模型决定用某工具 → Client 发 `tools/call` → Server 执行并返回结果。
4. **通知与关闭**：支持能力变更通知、心跳，最终优雅关闭连接。

## MCP vs Function Calling

这是最高频的对比题：

| 维度 | Function Calling | MCP |
| --- | --- | --- |
| 是什么 | 模型「表达想调用工具」的能力 | 工具「被标准化提供和发现」的协议 |
| 层次 | 模型能力层 | 应用集成层 |
| 复用 | 每个应用各自定义工具 | Server 一次实现，处处可用 |
| 关系 | MCP 的工具调用底层仍依赖模型的 FC 能力 | 在 FC 之上提供标准化的接入与生态 |

> 一句话：**Function Calling 解决「模型怎么说要调工具」，MCP 解决「工具怎么被统一接入和复用」。** 二者互补，不是替代。

## 安全风险（务必了解）

MCP 让模型能连接真实系统，安全边界很关键：

- **间接 Prompt 注入**：Server 返回的内容里可能藏恶意指令，劫持 Agent，详见 [大模型安全](/advanced/safety)。
- **过度授权**：Server 权限过大（如可删库），一旦被诱导后果严重 → 最小权限、敏感操作人工确认。
- **不可信 Server**：第三方 Server 可能恶意或被投毒 → 只接入可信来源、做沙箱隔离。
- **凭证管理**：Server 持有的 API key / token 要妥善保管，避免泄露。

## 高频追问

**Q：MCP 和 Function Calling 是一回事吗？** 不是。Function Calling 是模型层能力（输出调用意图）；MCP 是应用集成层协议（统一工具的提供、发现、调用方式）。MCP 内部仍借助模型的 Function Calling 来发起工具调用，二者是不同层次、互补的。

**Q：MCP 的三大原语？分别由谁控制？** Tools（模型驱动，有副作用的函数）、Resources（应用驱动，可读数据，无副作用）、Prompts（用户驱动，预定义模板）。区分「谁控制」是理解 MCP 设计的关键。

**Q：MCP 用什么协议和传输？** 消息格式是 JSON-RPC 2.0；传输有 stdio（本地进程）和 Streamable HTTP/SSE（远程）。

**Q：为什么说 MCP 把 M×N 变成 M+N？** 没有标准时每个应用对接每个工具都要定制（M×N）；有了 MCP，工具方实现一次 Server、应用方实现一次 Client，新增工具或应用都只是「+1」，集成成本大幅下降并形成生态。

**Q：MCP 的主要安全风险？** 间接 Prompt 注入（Server 返回内容夹带恶意指令）、过度授权、不可信第三方 Server、凭证泄露。对策是最小权限、人工确认敏感操作、只接可信 Server、沙箱隔离。

**Q：Sampling 能力是干嘛的？** 允许 Server 反向请求 Host 的 LLM 做补全，让 Server 自身也能利用模型能力（如让一个工具内部调用模型做总结），同时把模型调用权和成本留在 Host 侧、便于管控。
