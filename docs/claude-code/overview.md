# Claude Code 功能总览

> Claude Code 是 Anthropic 推出的**终端原生编程 Agent**（terminal-native agentic coding system）：直接跑在你的项目目录里，能读写文件、执行命令、跑测试、提交 Git，把「让 AI 帮我改代码」从补全升级成「让 AI 自主完成一个工程任务」。本块系统介绍它的功能、代码架构与底层机制。通用编程 Agent 原理见 [编程 Agent 底层架构与机制](/engineering/coding-agent-internals)。

> 说明：本块内容综合自 Claude Code 官方文档与社区逆向分析白皮书（如 ccb.agent-aura.top）。核心机制（agentic loop、工具、上下文压缩、权限、MCP、Hooks、Skills、子 Agent 等）是公开可观察的行为；个别内部实现细节（具体文件名、内部 flag 等）来自社区逆向，可能随版本变化，仅供理解原理参考。

## 一、它是什么？一句话定位

| 维度 | Claude Code |
| --- | --- |
| 形态 | 终端 CLI（也有 IDE 扩展、SDK） |
| 本质 | 自主 agentic loop 驱动的编程 Agent |
| 权限 | 在本地进程运行，有真实文件系统和 shell 访问权 |
| 与补全的区别 | 不是「补下一行」，而是「自主完成多步任务」 |
| 与云端 Chat 的区别 | 直接操作你的真实代码库，不是隔离沙箱里的玩具 |

核心理念：**把强模型放进一个能真正动手的循环里**——看代码、改代码、跑测试、看结果、再改，直到任务完成。

## 二、核心功能清单

### 1. 自主编码（Agentic Coding）

给一个任务（「修复这个 bug」「加一个功能」「重构这个模块」），Claude Code 自己决定：读哪些文件、怎么改、跑什么命令验证——多轮自主推进，而非一问一答。机制见 [核心机制](/claude-code/mechanisms)。

### 2. 工具系统

内置一套文件/命令/搜索工具（社区统计 50+ 个），让模型能真正操作环境：

- **文件**：Read / Edit / Write（精确「旧文本→新文本」替换，而非整文件覆盖）
- **命令**：Bash（跑测试、git、构建、装依赖）
- **搜索**：Grep / Glob（基于 ripgrep 的快速代码检索）
- **任务**：TodoWrite / Task（待办与子任务管理）

### 3. 项目记忆（CLAUDE.md）

项目根目录的 `CLAUDE.md`（及用户级配置）存放项目约定、常用命令、代码风格，每次会话自动注入上下文，让 Claude「记得」你的项目规矩。详见 [核心机制 - 上下文](/claude-code/mechanisms)。

### 4. 计划模式（Plan Mode）

「先看后做」的安全机制：让 Claude 先调研、给出方案，**你确认后再动手改代码**，避免它一上来就乱改。适合复杂或高风险任务。

### 5. 子 Agent / 并行（Subagents）

复杂任务可派生子 Agent（Task 工具），各自维护独立上下文并行处理子任务、只回传结论——避免主上下文被塞爆（上下文隔离，见 [上下文工程](/agent/context-engineering)）。

### 6. 扩展能力：MCP / Hooks / Skills / Slash Commands

- **MCP**：通过 [MCP 协议](/agent/mcp) 接入外部工具和数据源（数据库、API、第三方系统）。
- **Hooks**：在工具执行前后挂自定义脚本（拦截、校验、通知），实现确定性的工程约束。
- **Skills**：把「提示即能力」打包成可复用的技能（带 Frontmatter 描述、按需加载）。
- **Slash Commands**：`/` 开头的自定义命令，封装常用工作流。

### 7. 多后端 / 多形态

- 模型后端可对接 Anthropic API、AWS Bedrock、Google Vertex 等。
- 形态：终端 CLI、IDE 扩展（VS Code/JetBrains）、Agent SDK（构建自定义 Agent）、CI 集成（`claude -p` 管道式调用）。

## 三、典型工作流

```
你：「给用户登录加上限流」
  ↓
Claude Code：
  grep 找到登录相关代码 → 读相关文件理解结构
  → （可选）Plan Mode 给出方案让你确认
  → Edit 修改代码 + 新增限流逻辑
  → Bash 跑测试验证
  → 测试失败则读报错、再改、再跑
  → 完成后总结改动（可帮你 git commit）
```

全程模型自主决策每一步，你在关键节点（权限、计划）介入。

## 四、和其他编程工具的关系

| 工具 | 定位 |
| --- | --- |
| **Claude Code** | 终端原生自主 Agent，跨文件大改/自动化/CI |
| Cursor / Windsurf | IDE 内嵌，编辑体验 + 索引 + Agent |
| Copilot 补全 | 编辑器内联、即时补全 |
| Codex CLI / Gemini CLI | 同类终端 Agent，范式趋同 |

横向对比与底层范式收敛见 [编程 Agent 底层架构与机制](/engineering/coding-agent-internals)。

## 高频追问

**Q：Claude Code 和 Copilot 有什么本质区别？**
Copilot 主要是「补全下一段代码」，低延迟、零摩擦但被动；Claude Code 是「自主 agentic loop」——能跨多文件读、改、跑测试、迭代，自主完成一个完整工程任务。一个是「副驾驶补字」，一个是「自主完成工单」。

**Q：它真的能跑命令、改我的文件吗？安全吗？**
能——它运行在本地进程、有真实 shell 和文件访问权，所以能跑测试、提交 Git。安全靠权限模型（Allow/Ask/Deny）、Plan Mode（先看后做）、沙箱等多层机制；高危操作会询问你（见 [核心机制 - 权限](/claude-code/mechanisms)）。

**Q：CLAUDE.md 是干什么的？**
项目级记忆文件，存放项目约定、命令、风格等，每次会话自动注入上下文，让 Claude 持续「记得」你的项目规矩，相当于给 Agent 的持久化项目说明书（持久记忆，见 [Agent 记忆](/agent/agent-memory)）。

**Q：为什么强调「终端原生」？**
终端意味着直接、可组合（Unix 管道 `echo ... | claude -p`）、易集成 CI/CD、无 IDE 绑定。它把 Agent 当成「命令行里的一等公民」，而非某个编辑器的插件，从而能自动化和脚本化。
