---
title: Claude Code 功能总览
description: 理解 Claude Code 的任务循环、运行形态、项目上下文与权限边界，并用可验证的小任务判断它是否适合你的工作流。
level: L1
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# Claude Code 功能总览

> Claude Code 是 Anthropic 推出的**终端原生编程 Agent**（terminal-native agentic coding system）：直接跑在你的项目目录里，能读写文件、执行命令、跑测试、提交 Git，把「让 AI 帮我改代码」从补全升级成「让 AI 自主完成一个工程任务」。本块系统介绍它的功能、代码架构与底层机制。通用编程 Agent 原理见 [编程 Agent 底层架构与机制](/engineering/coding-agent-internals)。

> 版本边界：本页依据 2026-11-05 读取的[官方总览](https://code.claude.com/docs/en/overview)与[运行原理](https://code.claude.com/docs/en/how-claude-code-works)整理，不代表已在本机验证每项能力。CLI、IDE、桌面和网页会话的环境与权限不应混为一谈；部署前记录 `claude --version`、运行形态、认证方式和生效配置。

## 一、它是什么？一句话定位

| 维度 | Claude Code |
| --- | --- |
| 形态 | 终端、IDE、桌面应用与浏览器；Agent SDK 用于自建应用 |
| 本质 | 自主 agentic loop 驱动的编程 Agent |
| 权限 | 取决于运行环境、权限模式、组织策略与可用工具 |
| 与补全的区别 | 不是「补下一行」，而是「自主完成多步任务」 |
| 与云端 Chat 的区别 | 可通过工具操作工作区；本地和云端工作区的隔离方式不同 |

核心理念：**把强模型放进一个能真正动手的循环里**——看代码、改代码、跑测试、看结果、再改，直到任务完成。

## 二、核心功能清单

### 1. 自主编码（Agentic Coding）

给一个任务（「修复这个 bug」「加一个功能」「重构这个模块」），Claude Code 自己决定：读哪些文件、怎么改、跑什么命令验证——多轮自主推进，而非一问一答。机制见 [核心机制](/claude-code/mechanisms)。

### 2. 工具系统

内置工具覆盖文件、命令、搜索与任务编排；工具数量和名称会变化，以[官方工具表](https://code.claude.com/docs/en/tools-reference)和会话实际暴露的能力为准：

- **文件**：Read / Edit / Write（精确「旧文本→新文本」替换，而非整文件覆盖）
- **命令**：Bash（跑测试、git、构建、装依赖）
- **搜索**：Grep / Glob（基于 ripgrep 的快速代码检索）
- **任务**：任务跟踪与 Agent 委派（不要将旧版 Task 名称当成固定接口）

### 3. 项目记忆（CLAUDE.md）

项目根目录的 `CLAUDE.md`（及用户级配置）存放项目约定、常用命令、代码风格，每次会话自动注入上下文，让 Claude「记得」你的项目规矩。详见 [核心机制 - 上下文](/claude-code/mechanisms)。

### 4. 计划模式（Plan Mode）

用于调研与方案审阅，限制源码编辑。它不是整个进程的只读沙箱，也不等于已完成技术评审；切到执行前应明确允许的路径、副作用和验收命令。

### 5. 子 Agent / 并行（Subagents）

复杂任务可委派给独立上下文的子 Agent，返回摘要与证据。上下文隔离不自动隔离文件系统，也不免除主任务的整合与验证责任，见[子 Agent](/claude-code/subagents)。

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
应比较具体模式而不是品牌：内联补全服务于局部编辑；Agent 模式执行多步工具循环。其他产品也可能提供 Agent 能力。选型应测同一个任务的正确性、审查成本、权限控制与费用，不能从名称推断谁能完成工单。

**Q：它真的能跑命令、改我的文件吗？安全吗？**
能，但是否询问取决于[权限配置](https://code.claude.com/docs/en/permissions)，不能承诺危险操作总会弹窗。初次使用先在无生产凭据的工作区执行一个小任务：限定文件、要求展示 diff、记录验证命令及退出码，并检查拒绝操作是否真的没有副作用。

**Q：CLAUDE.md 是干什么的？**
项目级记忆文件，存放项目约定、命令、风格等，每次会话自动注入上下文，让 Claude 持续「记得」你的项目规矩，相当于给 Agent 的持久化项目说明书（持久记忆，见 [Agent 记忆](/agent/agent-memory)）。

**Q：为什么强调「终端原生」？**
终端意味着直接、可组合（Unix 管道 `echo ... | claude -p`）、易集成 CI/CD、无 IDE 绑定。它把 Agent 当成「命令行里的一等公民」，而非某个编辑器的插件，从而能自动化和脚本化。
