<div align="center">

# 🧠 LLMGuide · 大模型面试指南

**系统整理大模型 / LLM 方向的「八股文」与高频面试题，覆盖从底层原理到工程落地的完整知识体系。**

[![Pages](https://img.shields.io/badge/在线阅读-meko1.github.io-3c8772?logo=github)](https://meko1.github.io/llm-interview-guide/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![VitePress](https://img.shields.io/badge/Built%20with-VitePress-646cff?logo=vite&logoColor=white)](https://vitepress.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-参与贡献)
[![Stars](https://img.shields.io/github/stars/Meko1/llm-interview-guide?style=social)](https://github.com/Meko1/llm-interview-guide)

🔗 **在线阅读 → [meko1.github.io/llm-interview-guide](https://meko1.github.io/llm-interview-guide/)**

</div>

---

## 📖 这是什么？

LLMGuide 是一份开源的**大模型面试知识库**，把大模型方向零散的知识点整理成体系化、问答式的文档，帮你在面试前快速建立全局认知、查漏补缺。

- 🎯 **面试导向**：每篇文章末尾都附「高频追问」，模拟面试官的连环追问。
- 🧩 **体系完整**：从 Transformer 原理到 RAG / Agent / 推理部署 / 工程落地，一站式覆盖。
- 🆓 **完全免费 & 开源**：内容持续更新，欢迎一起完善。
- 🌏 **中文友好**：面向中文读者，兼顾通用受众与后端工程师转型视角。

> 适合：准备大模型 / AI 算法、AI 应用开发、AIGC 工程等岗位面试的同学，以及想系统入门大模型的开发者。

## 🗂️ 内容导航

> 点击直达在线文档对应章节。

### 🌱 新手入门
- [大模型零基础入门](https://meko1.github.io/llm-interview-guide/beginner/getting-started) — 完全没接触 AI 也能开始
- [大模型是怎么工作的（直觉版）](https://meko1.github.io/llm-interview-guide/beginner/how-llm-works)（零公式建立正确直觉）
- [能做什么·不能做什么](https://meko1.github.io/llm-interview-guide/beginner/llm-capabilities)（能力边界 / 幻觉 / 新手误区）
- [大模型发展简史](https://meko1.github.io/llm-interview-guide/beginner/llm-history)（word2vec → Transformer → ChatGPT → R1）
- [大模型术语速查表](https://meko1.github.io/llm-interview-guide/beginner/glossary)
- [大模型必备数学基础](https://meko1.github.io/llm-interview-guide/beginner/math-basics)

### 大模型基础
- [核心概念总览](https://meko1.github.io/llm-interview-guide/basics/overview) — 一文建立全局认知
- [Transformer 架构详解](https://meko1.github.io/llm-interview-guide/basics/transformer)
- [Attention 与变体](https://meko1.github.io/llm-interview-guide/basics/attention)（MHA / MQA / GQA / MLA / FlashAttention）
- [位置编码](https://meko1.github.io/llm-interview-guide/basics/position-encoding)（RoPE / ALiBi / 长上下文扩展）
- [归一化与激活函数](https://meko1.github.io/llm-interview-guide/basics/normalization)（RMSNorm / Pre-Norm / SwiGLU）
- [Tokenizer 与分词](https://meko1.github.io/llm-interview-guide/basics/tokenizer)（BPE / WordPiece / SentencePiece）
- [解码与采样策略](https://meko1.github.io/llm-interview-guide/basics/decoding)（greedy / beam / temperature / top-p）
- [MoE 混合专家模型](https://meko1.github.io/llm-interview-guide/basics/moe)
- [长上下文专题](https://meko1.github.io/llm-interview-guide/basics/long-context)（位置外推 / 滑窗 / KV 压缩 / vs RAG）

### 训练与微调
- [预训练目标与数据](https://meko1.github.io/llm-interview-guide/pretraining/pretrain)
- [数据工程与合成数据](https://meko1.github.io/llm-interview-guide/pretraining/data-engineering)（清洗 / MinHash 去重 / 配比 / 合成数据）
- [缩放定律与涌现能力](https://meko1.github.io/llm-interview-guide/pretraining/scaling-law)
- [分布式训练与显存优化](https://meko1.github.io/llm-interview-guide/pretraining/distributed-training)（DP / TP / PP / ZeRO）
- [AI 训练集群与网络通信](https://meko1.github.io/llm-interview-guide/pretraining/ai-infra-networking)（NVLink / IB / RoCE / NCCL / 故障恢复）
- [MoE 训练与专家并行](https://meko1.github.io/llm-interview-guide/pretraining/moe-training)（负载均衡 / AllToAll / DeepSeekMoE）
- [大模型训练全流程（从0到1）](https://meko1.github.io/llm-interview-guide/pretraining/llm-training-pipeline)（数据→预训练→SFT→对齐→部署 端到端地图）
- [微调范式（SFT / PEFT）](https://meko1.github.io/llm-interview-guide/finetuning/finetuning)
- [LoRA / QLoRA 详解](https://meko1.github.io/llm-interview-guide/finetuning/lora)
- [RLHF / DPO 对齐](https://meko1.github.io/llm-interview-guide/finetuning/rlhf)
- [偏好优化方法全景](https://meko1.github.io/llm-interview-guide/finetuning/preference-optimization)（DPO / IPO / KTO / ORPO / SimPO）
- [合成数据与自我改进](https://meko1.github.io/llm-interview-guide/finetuning/synthetic-data)（Self-Instruct / Evol-Instruct / 拒绝采样 / STaR / rStar / 模型崩溃）
- [模型融合与合并](https://meko1.github.io/llm-interview-guide/finetuning/model-merging)（任务向量 / SLERP / TIES / DARE）
- [微调训练工具链实战](https://meko1.github.io/llm-interview-guide/finetuning/training-frameworks)（LLaMA-Factory / 显存估算 / 踩坑清单）

### 应用开发
- [Prompt 工程](https://meko1.github.io/llm-interview-guide/prompt/prompt-engineering)（Few-shot / CoT / ReAct / 注入防护）
- [RAG 基础与流程](https://meko1.github.io/llm-interview-guide/rag/rag-basics)
- [Embedding 与向量数据库](https://meko1.github.io/llm-interview-guide/rag/embedding-vectordb)（HNSW / IVF / 选型）
- [Embedding 与 Reranker 训练](https://meko1.github.io/llm-interview-guide/rag/embedding-training)（对比学习 / 难负例 / 双塔 vs 交叉编码器）
- [RAG 进阶与优化](https://meko1.github.io/llm-interview-guide/rag/rag-advanced)
- [RAG 生产化与系统设计](https://meko1.github.io/llm-interview-guide/rag/rag-production)（架构分层 / 增量更新 / 缓存 / 高可用）
- [RAG vs 长上下文 vs 微调](https://meko1.github.io/llm-interview-guide/rag/rag-vs-long-context)（选型决策）
- [Agent 基础与框架](https://meko1.github.io/llm-interview-guide/agent/agent-basics)
- [Function Calling 与 MCP](https://meko1.github.io/llm-interview-guide/agent/function-calling-mcp)
- [MCP 协议深入](https://meko1.github.io/llm-interview-guide/agent/mcp)（架构 / 原语 / 传输 / 安全）
- [A2A 协议与 Agent 互操作](https://meko1.github.io/llm-interview-guide/agent/a2a-protocol)（Agent Card / Task / vs MCP）
- [Agent 记忆系统](https://meko1.github.io/llm-interview-guide/agent/agent-memory)
- [上下文工程](https://meko1.github.io/llm-interview-guide/agent/context-engineering)（Context Engineering）
- [AI 工作流 vs Agent](https://meko1.github.io/llm-interview-guide/agent/workflow)
- [多 Agent 与进阶范式](https://meko1.github.io/llm-interview-guide/agent/multi-agent)
- [Agent 评估与可靠性工程](https://meko1.github.io/llm-interview-guide/agent/agent-evaluation)（轨迹评估 / 失败模式 / 护栏 / 可观测）

### 推理 · 部署 · 工程实战
- [推理优化与部署](https://meko1.github.io/llm-interview-guide/inference/inference-optimization)（KV Cache / 量化 / vLLM / 投机解码）
- [KV Cache 深度专题](https://meko1.github.io/llm-interview-guide/inference/kv-cache)（显存公式 / GQA-MLA / PagedAttention / Prefix Cache / 量化 / 驱逐）
- [推理性能压测与指标](https://meko1.github.io/llm-interview-guide/inference/inference-benchmark)（TTFT / TPOT / 吞吐 / goodput）
- [量化实战深入](https://meko1.github.io/llm-interview-guide/inference/quantization)（GPTQ / AWQ / SmoothQuant / KV 量化）
- [AI 编译器与图优化](https://meko1.github.io/llm-interview-guide/inference/ai-compiler)（算子融合 / IR / torch.compile / TVM）
- [GPU 与硬件基础](https://meko1.github.io/llm-interview-guide/inference/gpu-hardware)（显存估算 / 算力 / 通信 / 选型）
- [国产算力与国产化适配](https://meko1.github.io/llm-interview-guide/inference/domestic-ai-stack)（昇腾 / CANN / MindIE / 迁移）
- [LangChain 与应用框架](https://meko1.github.io/llm-interview-guide/engineering/langchain)
- [LLM 应用开发实战](https://meko1.github.io/llm-interview-guide/engineering/llm-app-dev)（流式 / Function Calling / 服务化 / 成本控制）
- [AI 编程与 Coding Agent](https://meko1.github.io/llm-interview-guide/engineering/coding-agent)（补全 / SWE-bench / 代码 RAG）
- [编程 Agent 底层架构与机制](https://meko1.github.io/llm-interview-guide/engineering/coding-agent-internals)（Claude Code / Codex：agentic loop / agentic search / 权限）
- [结构化输出详解](https://meko1.github.io/llm-interview-guide/engineering/structured-output)（JSON Mode / 约束解码）
- [AI 系统设计专题](https://meko1.github.io/llm-interview-guide/engineering/system-design)（高并发 / 私有化 / RAG 系统）
- [LLMOps 生产运营](https://meko1.github.io/llm-interview-guide/engineering/llmops)（监控 / 成本治理 / 数据飞轮）
- [AI 项目实战案例](https://meko1.github.io/llm-interview-guide/engineering/projects)（企业 RAG / 代码助手 / Text2SQL / 多 Agent）

### 评估 · 多模态 · 经典模型
- [模型评估与幻觉](https://meko1.github.io/llm-interview-guide/evaluation/evaluation)
- [评测基准深入](https://meko1.github.io/llm-interview-guide/evaluation/benchmarks)（MMLU / GPQA / Arena / Pass@k / 数据污染）
- [多模态大模型](https://meko1.github.io/llm-interview-guide/multimodal/multimodal)（CLIP / ViT / LLaVA）
- [多模态架构深挖 VLM](https://meko1.github.io/llm-interview-guide/multimodal/vlm-architecture)（视觉编码器 / 连接器 / 原生多模态）
- [扩散模型与图像生成](https://meko1.github.io/llm-interview-guide/multimodal/diffusion)（Diffusion / Stable Diffusion / DiT）
- [视频生成](https://meko1.github.io/llm-interview-guide/multimodal/video-generation)（Sora / 时空 patch / 世界模型）
- [语音大模型](https://meko1.github.io/llm-interview-guide/multimodal/speech)（ASR / TTS / 实时语音对话）
- [经典模型盘点](https://meko1.github.io/llm-interview-guide/models/classic-models)
- [LLaMA 与 Qwen 架构演进](https://meko1.github.io/llm-interview-guide/models/llama-qwen)（标准配方 / GQA / 大词表 / QK-Norm）
- [DeepSeek 专题](https://meko1.github.io/llm-interview-guide/models/deepseek)（MLA / DeepSeekMoE / GRPO / R1）
- [小语言模型与端侧（SLM）](https://meko1.github.io/llm-interview-guide/models/slm)（Phi / Qwen-small / 端侧部署）
- [中文大模型生态全景](https://meko1.github.io/llm-interview-guide/models/chinese-llm-landscape)（国产厂商 / 垂直模型 / 中文数据集与评测）

### 🤖 Claude Code 深入
- [功能总览](https://meko1.github.io/llm-interview-guide/claude-code/overview)（终端原生 Agent / 工具 / Plan Mode / 子 Agent）
- [代码架构](https://meko1.github.io/llm-interview-guide/claude-code/architecture)（分层架构 / QueryEngine / 工具层 / 通信层）
- [核心机制与扩展](https://meko1.github.io/llm-interview-guide/claude-code/mechanisms)（agentic loop / 上下文压缩 / 权限模型 / MCP·Hooks·Skills）
- [工具系统详解](https://meko1.github.io/llm-interview-guide/claude-code/tools)（Read·Edit·Bash·Grep / TodoWrite vs Task）
- [扩展机制（Hooks/MCP/Skills）](https://meko1.github.io/llm-interview-guide/claude-code/extensibility)（确定性约束 vs 能力扩展）
- [子 Agent 与多 Agent 编排](https://meko1.github.io/llm-interview-guide/claude-code/subagents)（上下文隔离 / 协调者蜂群 / Worktree）
- [最佳实践与高效用法](https://meko1.github.io/llm-interview-guide/claude-code/best-practices)（CLAUDE.md / 成本控制 / 避坑）

### 🔬 前沿专题 & 资深深入
- [推理模型与慢思考](https://meko1.github.io/llm-interview-guide/advanced/reasoning-models)（o1 / R1 / test-time compute）
- [强化学习基础（面向 LLM）](https://meko1.github.io/llm-interview-guide/advanced/rl-basics)（MDP / 策略梯度 / PPO / GRPO）
- [Agentic RL（智能体强化学习）](https://meko1.github.io/llm-interview-guide/advanced/agentic-rl)（多步任务 / 可验证奖励）
- [状态空间模型与 Mamba](https://meko1.github.io/llm-interview-guide/advanced/state-space-models)（SSM / 选择性扫描 / 混合架构）
- [扩散语言模型（Diffusion LLM）](https://meko1.github.io/llm-interview-guide/advanced/diffusion-llm)（LLaDA / Mercury / SEDD / 并行解码）
- [具身智能与 VLA](https://meko1.github.io/llm-interview-guide/advanced/embodied-ai)（Vision-Language-Action / 机器人基础模型）
- [FlashAttention 深入](https://meko1.github.io/llm-interview-guide/advanced/flash-attention)（IO 感知 / online softmax / v1-v3）
- [训练深入](https://meko1.github.io/llm-interview-guide/advanced/training-internals)（优化器 / 混合精度 / loss spike）
- [向量检索与 ANN 算法](https://meko1.github.io/llm-interview-guide/advanced/vector-search)（HNSW / IVF / PQ）
- [大模型安全与对齐](https://meko1.github.io/llm-interview-guide/advanced/safety)（越狱 / Prompt 注入 / 红队 / 护栏）
- [AI 安全合规与治理](https://meko1.github.io/llm-interview-guide/advanced/governance)（数据合规 / 内容安全 / 监管备案）

### 🎯 面试专题
- [**高频面试题速记**](https://meko1.github.io/llm-interview-guide/interview/high-frequency) — 全站考点浓缩速查卡
- [**手撕代码题解集**](https://meko1.github.io/llm-interview-guide/interview/coding-problems) — MHA / RoPE / LoRA / DPO 等 10 道高频手撕题可运行题解
- [分岗位面试真题](https://meko1.github.io/llm-interview-guide/interview/real-questions)（算法 / 应用 / 工程 / 场景 / 手撕）
- [大模型学习路线](https://meko1.github.io/llm-interview-guide/interview/learning-path)
- [LLM Course 中文路线图](https://meko1.github.io/llm-interview-guide/interview/llm-course-roadmap)（Maxime Labonne 经典路线图译本）
- [学习资源汇总](https://meko1.github.io/llm-interview-guide/interview/resources)

## 🚀 本地运行

需要 Node.js 18+。

```bash
npm install        # 安装依赖
npm run dev        # 本地开发，默认 http://localhost:5173
npm run build      # 构建静态站点，输出到 docs/.vitepress/dist
npm run preview    # 预览构建产物
```

## ☁️ 部署到 GitHub Pages

本仓库已内置 GitHub Actions 工作流（`.github/workflows/`），推送到 `main` 分支会自动构建并部署。

1. 仓库 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**。
2. 推送到 `main`，Actions 自动构建发布。
3. 站点地址：`https://<用户名>.github.io/llm-interview-guide/`。

> `docs/.vitepress/config.mts` 的 `base` 已设为 `/llm-interview-guide/`，与仓库名一致。若改了仓库名或用自定义域名/根路径部署，请相应修改 `base`。

## 🤝 参与贡献

非常欢迎任何形式的贡献！

- 🐛 发现错误 / 表述不清 → 提 [Issue](https://github.com/Meko1/llm-interview-guide/issues)
- ✍️ 补充内容 / 新增主题 / 修正错别字 → 提 [Pull Request](https://github.com/Meko1/llm-interview-guide/pulls)
- 📚 推荐优质学习资源 → 直接 PR 到 [学习资源汇总](https://meko1.github.io/llm-interview-guide/interview/resources)

贡献前请阅读 [贡献指南 CONTRIBUTING.md](./CONTRIBUTING.md)，了解写作规范与本地开发流程。

如果这个项目对你有帮助，欢迎点一个 ⭐ **Star** 支持一下，这是对维护者最大的鼓励！

## ⚠️ 免责声明

本项目内容仅用于学习与交流，由社区整理，可能存在疏漏或随技术发展而过时之处，请结合权威资料与官方文档辩证参考。

## 📄 许可

[MIT](./LICENSE) © Meko1
