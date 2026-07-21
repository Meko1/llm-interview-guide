import { defineConfig } from 'vitepress'

// 站点基础地址：部署到 GitHub Pages 时通常为 /<仓库名>/
// 如果使用自定义域名或部署到根路径，将其改为 '/'
const BASE = '/llm-interview-guide/'

export default defineConfig({
  base: BASE,
  lang: 'zh-CN',
  title: 'LLMGuide',
  description:
    '大模型面试指南，覆盖大模型基础、Transformer、预训练、微调、RLHF、Prompt、RAG、Agent、推理优化与部署、评估与多模态',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

  // SEO：生成 sitemap.xml，便于搜索引擎收录
  sitemap: {
    hostname: 'https://meko1.github.io/llm-interview-guide/'
  },

  head: [
    ['meta', { name: 'theme-color', content: '#3c8772' }],
    ['meta', { name: 'keywords', content: '大模型,LLM,面试,八股文,Transformer,Attention,RAG,Agent,MCP,微调,LoRA,RLHF,DeepSeek,推理优化,多模态,大模型面试题' }],
    ['meta', { name: 'author', content: 'Meko1' }],
    // Open Graph（社交分享卡片）
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'LLMGuide · 大模型面试指南' }],
    ['meta', { property: 'og:description', content: '系统整理大模型/LLM 方向的八股文与高频面试题，覆盖从底层原理到工程落地的完整知识体系。' }],
    ['meta', { property: 'og:site_name', content: 'LLMGuide' }],
    ['meta', { property: 'og:url', content: 'https://meko1.github.io/llm-interview-guide/' }],
    ['meta', { property: 'og:image', content: 'https://meko1.github.io/llm-interview-guide/logo.svg' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    // Twitter Card
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'LLMGuide · 大模型面试指南' }],
    ['meta', { name: 'twitter:description', content: '系统整理大模型/LLM 八股文与高频面试题，覆盖原理到工程落地。' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'LLMGuide',

    nav: [
      { text: '新手入门', link: '/beginner/getting-started', activeMatch: '/beginner/' },
      { text: '大模型基础', link: '/basics/overview', activeMatch: '/basics/' },
      { text: '训练与微调', link: '/pretraining/pretrain', activeMatch: '/(pretraining|finetuning)/' },
      {
        text: 'Prompt 工程',
        activeMatch: '/prompt/',
        items: [
          { text: 'Prompt 工程总览', link: '/prompt/prompt-engineering' },
          { text: '推理类提示（CoT 全家桶）', link: '/prompt/cot-reasoning' },
          { text: '高级提示模式与技巧', link: '/prompt/advanced-patterns' },
          { text: '自动化优化与 Prompt Ops', link: '/prompt/prompt-optimization' },
          { text: 'Prompt 生命周期、实验与发布', link: '/prompt/prompt-lifecycle' },
          { text: '提示注入与越狱攻防', link: '/prompt/prompt-injection' },
          { text: '上下文/循环工程（最新）', link: '/prompt/agentic-prompting' }
        ]
      },
      { text: 'RAG', link: '/rag/rag-basics', activeMatch: '/rag/' },
      {
        text: 'Agent',
        activeMatch: '/agent/',
        items: [
          { text: 'Agent 基础与框架', link: '/agent/agent-basics' },
          { text: 'Function Calling 与 MCP', link: '/agent/function-calling-mcp' },
          { text: 'MCP 协议深入', link: '/agent/mcp' },
          { text: 'Agent 工具安全与权限边界', link: '/agent/tool-safety' },
          { text: 'A2A 协议与 Agent 互操作', link: '/agent/a2a-protocol' },
          { text: 'Agent 记忆系统', link: '/agent/agent-memory' },
          { text: '上下文工程', link: '/agent/context-engineering' },
          { text: 'AI 工作流 vs Agent', link: '/agent/workflow' },
          { text: '多 Agent 与进阶范式', link: '/agent/multi-agent' },
          { text: 'Computer Use 与浏览器 Agent', link: '/agent/computer-use' },
          { text: '深度研究 Agent', link: '/agent/deep-research' },
          { text: 'Agent 评估与可靠性工程', link: '/agent/agent-evaluation' }
        ]
      },
      {
        text: '推理与部署',
        activeMatch: '/inference/',
        items: [
          { text: '推理优化与部署', link: '/inference/inference-optimization' },
          { text: '推理时算力扩展', link: '/inference/test-time-scaling' },
          { text: '推理框架对比（vLLM/SGLang）', link: '/inference/serving-frameworks' },
          { text: '推理性能压测与指标', link: '/inference/inference-benchmark' },
          { text: 'KV Cache 深度专题', link: '/inference/kv-cache' },
          { text: '投机解码详解', link: '/inference/speculative-decoding' },
          { text: '量化实战深入', link: '/inference/quantization' },
          { text: '知识蒸馏与模型压缩', link: '/inference/model-compression' },
          { text: 'AI 编译器与图优化', link: '/inference/ai-compiler' },
          { text: 'GPU 与硬件基础', link: '/inference/gpu-hardware' },
          { text: '国产算力与国产化适配', link: '/inference/domestic-ai-stack' }
        ]
      },
      { text: '工程实战', link: '/engineering/langchain', activeMatch: '/engineering/' },
      {
        text: 'Claude Code',
        activeMatch: '/claude-code/',
        items: [
          { text: '功能总览', link: '/claude-code/overview' },
          { text: '代码架构', link: '/claude-code/architecture' },
          { text: '核心机制与扩展', link: '/claude-code/mechanisms' },
          { text: '工具系统详解', link: '/claude-code/tools' },
          { text: '扩展机制（Hooks/MCP/Skills）', link: '/claude-code/extensibility' },
          { text: '子 Agent 与多 Agent 编排', link: '/claude-code/subagents' },
          { text: '最佳实践与高效用法', link: '/claude-code/best-practices' }
        ]
      },
      {
        text: '进阶',
        activeMatch: '/(evaluation|multimodal|models|advanced)/',
        items: [
          {
            text: '前沿专题',
            items: [
              { text: '推理模型与慢思考', link: '/advanced/reasoning-models' },
              { text: '强化学习基础（面向 LLM）', link: '/advanced/rl-basics' },
              { text: 'Agentic RL（智能体强化学习）', link: '/advanced/agentic-rl' },
              { text: '状态空间模型与 Mamba', link: '/advanced/state-space-models' },
              { text: '扩散语言模型（Diffusion LLM）', link: '/advanced/diffusion-llm' },
              { text: '机制可解释性（SAE/Circuits）', link: '/advanced/interpretability' },
              { text: '具身智能与 VLA', link: '/advanced/embodied-ai' }
            ]
          },
          {
            text: '深入原理与安全',
            items: [
              { text: 'FlashAttention 深入', link: '/advanced/flash-attention' },
              { text: '训练深入（优化器/混合精度）', link: '/advanced/training-internals' },
              { text: '向量检索与 ANN 算法', link: '/advanced/vector-search' },
              { text: '大模型安全与对齐', link: '/advanced/safety' },
              { text: 'AI 安全合规与治理', link: '/advanced/governance' }
            ]
          },
          {
            text: '评估与模型',
            items: [
              { text: '模型评估与幻觉', link: '/evaluation/evaluation' },
              { text: '评测基准深入', link: '/evaluation/benchmarks' },
              { text: '经典模型盘点', link: '/models/classic-models' },
              { text: '2025-2026 前沿模型盘点', link: '/models/frontier-models-2025' },
              { text: 'LLaMA 与 Qwen 架构演进', link: '/models/llama-qwen' },
              { text: 'DeepSeek 专题', link: '/models/deepseek' },
              { text: '小语言模型与端侧（SLM）', link: '/models/slm' },
              { text: '中文大模型生态全景', link: '/models/chinese-llm-landscape' }
            ]
          },
          {
            text: '多模态',
            items: [
              { text: '多模态大模型', link: '/multimodal/multimodal' },
              { text: '扩散模型与图像生成', link: '/multimodal/diffusion' },
              { text: '语音大模型', link: '/multimodal/speech' },
              { text: '实时语音 Agent 生产化', link: '/engineering/voice-agent-production' }
            ]
          }
        ]
      },
      {
        text: '面试专题',
        activeMatch: '/interview/',
        items: [
          { text: '2026 岗位能力地图', link: '/interview/job-market-2026' },
          { text: '大模型应用实战知识体系', link: '/interview/application-practice-roadmap' },
          { text: '大模型应用实战高频追问', link: '/interview/application-practice-qna' },
          { text: '大模型应用实战场景题库', link: '/interview/application-practice-scenarios' },
          { text: '大模型应用系统设计面试题', link: '/interview/application-system-design' },
          { text: 'Text-to-SQL / ChatBI 生产系统设计', link: '/interview/text2sql-chatbi-production-playbook' },
          { text: '企业客服 Copilot 生产系统设计', link: '/interview/customer-support-copilot-production-playbook' },
          { text: '企业 HR Copilot 生产系统设计', link: '/interview/hr-copilot-production-playbook' },
          { text: '销售 / CRM Deal Copilot 生产系统设计', link: '/interview/sales-crm-copilot-production-playbook' },
          { text: '反欺诈 / 风险调查 Copilot 生产系统设计', link: '/interview/fraud-risk-investigation-copilot-playbook' },
          { text: '采购 / 供应商尽调 Copilot 生产系统设计', link: '/interview/procurement-vendor-due-diligence-copilot-playbook' },
          { text: '合同审阅 / 法务 Copilot 生产系统设计', link: '/interview/legal-contract-review-copilot-playbook' },
          { text: 'ITSM / SRE 事故响应 Copilot', link: '/interview/itsm-sre-incident-response-copilot-playbook' },
          { text: 'LLM 输出契约兼容与演进', link: '/interview/llm-output-contract-compatibility-playbook' },
          { text: 'LLM 流式输出与会话恢复设计', link: '/interview/llm-streaming-session-resilience-playbook' },
          { text: 'LLM 缓存正确性与语义缓存控制面', link: '/interview/llm-cache-correctness-semantic-cache-playbook' },
          { text: 'LLM Prompt/Prefix Cache 生产工程', link: '/interview/llm-prompt-prefix-cache-production-playbook' },
          { text: 'LLM 离线批处理与异步作业编排', link: '/interview/llm-offline-batch-job-orchestration-playbook' },
          { text: 'LLM 推理容量与弹性伸缩设计', link: '/interview/llm-inference-capacity-autoscaling-playbook' },
          { text: 'LLM 在线流量准入与过载保护', link: '/interview/llm-traffic-admission-overload-control-playbook' },
          { text: 'LLM 多供应商故障切换与一致性设计', link: '/interview/llm-multi-provider-failover-playbook' },
          { text: 'LLM 多地域灾备与状态连续性', link: '/interview/llm-multi-region-disaster-recovery-playbook' },
          { text: 'LLM FinOps：计量、归因与预算控制面', link: '/interview/llm-finops-metering-budget-control-plane' },
          { text: '大模型应用线上排障手册', link: '/interview/application-troubleshooting-playbook' },
          { text: 'LLM 评测与发布门禁实战', link: '/interview/evaluation-release-gates' },
          { text: 'LLM-as-a-Judge 校准与发布门禁', link: '/interview/llm-as-judge-calibration-playbook' },
          { text: 'PromptOps 模板治理与实验回滚', link: '/interview/promptops-production-governance-playbook' },
          { text: 'LoRA Adapter 服务化与回滚设计', link: '/interview/lora-adapter-serving-governance-playbook' },
          { text: 'Context Engineering 预算与记忆治理', link: '/interview/context-engineering-budget-memory-playbook' },
          { text: 'Test-time Compute 预算与动态路由', link: '/interview/test-time-compute-budget-routing-playbook' },
          { text: '模型量化生产验收与精度回滚', link: '/interview/model-quantization-production-validation-playbook' },
          { text: '合成数据质量与污染控制', link: '/interview/synthetic-data-quality-governance-playbook' },
          { text: 'LLM 线上评测与灰度实验', link: '/interview/online-evaluation-rollout-operations' },
          { text: 'LLM 人工审批与异常接管设计', link: '/interview/llm-human-approval-exception-handoff-playbook' },
          { text: 'LLM 数据标注与偏好数据运营', link: '/interview/llm-data-feedback-operations-playbook' },
          { text: '富文档与多模态 RAG 系统设计', link: '/interview/multimodal-rag-document-intelligence-playbook' },
          { text: '多租户 RAG 隔离与索引演进设计', link: '/interview/multi-tenant-rag-index-governance-playbook' },
          { text: 'LLM 数据分级与外发审计', link: '/interview/data-governance-egress-audit-qna' },
          { text: 'LLM 内容安全策略与审核系统设计', link: '/interview/llm-safety-policy-moderation-system-design' },
          { text: '企业 AI 治理控制面设计', link: '/interview/enterprise-ai-governance-audit-system-design' },
          { text: '基础篇岗位要求总纲', link: '/interview/foundation-requirements' },
          { text: '基础篇高频问答加厚版', link: '/interview/foundation-qna' },
          { text: '框架与智能工作流高频问答', link: '/interview/framework-workflow-qna' },
          { text: '结构化输出与 Schema 约束高频问答', link: '/interview/structured-output-qna' },
          { text: 'Spring AI / Java AI 生产化高频问答', link: '/interview/spring-ai-production-qna' },
          { text: 'Java / Spring AI 生产架构设计', link: '/interview/java-ai-production-architecture-system-design' },
          { text: '企业 Tool Gateway 安全执行设计', link: '/interview/tool-gateway-security-design' },
          { text: '智能体运行时架构：Claude Code / Codex / OpenClaw / Hermes', link: '/interview/agent-runtime-architecture-qna' },
          { text: '智能编码 Agent 企业操作手册', link: '/interview/coding-agent-production-playbook' },
          { text: '编码 Agent 测试策略与验证闭环', link: '/interview/coding-agent-testing-verification-playbook' },
          { text: '跨运行时 Agent 扩展生产治理', link: '/interview/agent-skills-production-governance' },
          { text: 'Agent 生命周期事件与 Policy Hook Fabric', link: '/interview/agent-lifecycle-policy-hook-fabric' },
          { text: 'Agent 外部副作用事务与补偿设计', link: '/interview/agent-effect-transaction-compensation-playbook' },
          { text: 'Agent Tool Contract 演进与兼容性', link: '/interview/agent-tool-contract-evolution-playbook' },
          { text: 'Agent Prompt Injection 与不可信上下文隔离', link: '/interview/agent-prompt-injection-provenance-playbook' },
          { text: '多 Agent 共享工作区并发控制', link: '/interview/multi-agent-workspace-concurrency-playbook' },
          { text: '远程与云端 Agent 生产运行手册', link: '/interview/remote-agent-operations-playbook' },
          { text: 'Agent 自动化与后台编排生产设计', link: '/interview/agent-automation-orchestration-playbook' },
          { text: '多 Agent 委派与 Handoff 控制平面', link: '/interview/multi-agent-delegation-handoff-playbook' },
          { text: '长任务 Agent 持续授权与紧急撤权', link: '/interview/agent-continuous-authorization-playbook' },
          { text: 'Agent 可复现运行与配置溯源', link: '/interview/agent-reproducibility-provenance-playbook' },
          { text: '长运行 Agent 检查点、恢复与人工 Steer', link: '/interview/long-running-agent-recovery-playbook' },
          { text: 'Agent 代码审查与变更交付证据链', link: '/interview/agent-code-review-delivery-playbook' },
          { text: 'Agent 外部连接与 OAuth 凭证生命周期', link: '/interview/agent-connector-identity-lifecycle-playbook' },
          { text: 'Agent 沙箱、执行准入与逃逸处置', link: '/interview/agent-sandbox-execution-boundaries-playbook' },
          { text: 'Agent Runtime 升级、兼容性与回滚', link: '/interview/agent-runtime-upgrade-rollback-playbook' },
          { text: 'Agent 模型路由、降级与能力契约', link: '/interview/agent-model-routing-capability-playbook' },
          { text: 'Agent 上下文与记忆生产治理', link: '/interview/agent-context-memory-governance' },
          { text: 'Agent 观测、取证与事故响应手册', link: '/interview/agent-observability-incident-response' },
          { text: 'Computer Use / 浏览器 Agent 生产设计', link: '/interview/computer-use-browser-agent-system-design' },
          { text: 'A2A 跨 Agent 互操作生产设计', link: '/interview/a2a-production-interoperability-qna' },
          { text: 'Dify 低代码工作流生产化高频问答', link: '/interview/dify-production-qna' },
          { text: 'LangGraph 状态图 Agent 生产化高频问答', link: '/interview/langgraph-production-qna' },
          { text: 'MCP Server 生产化与企业治理高频问答', link: '/interview/mcp-production-qna' },
          { text: 'Agent 评测与安全合规高频问答', link: '/interview/agent-evaluation-safety-qna' },
          { text: 'RAG、Memory 与评测安全高频问答', link: '/interview/rag-memory-eval-qna' },
          { text: '推理部署与成本治理高频问答', link: '/interview/inference-cost-qna' },
          { text: 'LLMOps 生产运营高频问答', link: '/interview/llmops-production-qna' },
          { text: 'MaaS 平台生产化高频问答', link: '/interview/maas-production-qna' },
          { text: '微调与模型平台高频问答', link: '/interview/finetuning-platform-qna' },
          { text: '高频面试题速记', link: '/interview/high-frequency' },
          { text: '手撕代码题解集', link: '/interview/coding-problems' },
          { text: '分岗位面试真题', link: '/interview/real-questions' },
          { text: '大模型学习路线', link: '/interview/learning-path' },
          { text: 'LLM Course 中文路线图', link: '/interview/llm-course-roadmap' },
          { text: '学习资源汇总', link: '/interview/resources' }
        ]
      },
      { text: '关于', link: '/about' }
    ],

    sidebar: {
      '/beginner/': [
        {
          text: '新手入门',
          items: [
            { text: '大模型零基础入门', link: '/beginner/getting-started' },
            { text: '从零到能做项目：LLM 实战手册', link: '/beginner/llm-first-practice-handbook' },
            { text: '大模型是怎么工作的（直觉版）', link: '/beginner/how-llm-works' },
            { text: '能做什么·不能做什么', link: '/beginner/llm-capabilities' },
            { text: '大模型发展简史', link: '/beginner/llm-history' },
            { text: '大模型术语速查表', link: '/beginner/glossary' },
            { text: '大模型必备数学基础', link: '/beginner/math-basics' }
          ]
        }
      ],
      '/basics/': [
        {
          text: '大模型基础',
          items: [
            { text: '总览：大模型核心概念', link: '/basics/overview' },
            { text: 'Transformer 架构详解', link: '/basics/transformer' },
            { text: 'Attention 与变体', link: '/basics/attention' },
            { text: '线性注意力与混合架构', link: '/basics/linear-attention' },
            { text: '位置编码（RoPE / ALiBi）', link: '/basics/position-encoding' },
            { text: '归一化与激活函数', link: '/basics/normalization' },
            { text: 'Tokenizer 与分词', link: '/basics/tokenizer' },
            { text: '嵌入层与表示学习', link: '/basics/embeddings' },
            { text: '解码与采样策略', link: '/basics/decoding' },
            { text: '从 Logits 到损失（Softmax/PPL）', link: '/basics/logits-loss' },
            { text: 'Mask 与 Padding（掩码/打包）', link: '/basics/masks-padding' },
            { text: 'MoE 混合专家模型', link: '/basics/moe' },
            { text: '长上下文专题', link: '/basics/long-context' },
            { text: '模型架构谱系与选型', link: '/basics/model-architecture-landscape' },
            { text: '从数据到回答：LLM 全链路', link: '/basics/llm-lifecycle-dataflow' },
            { text: '缩放规律、容量与能力边界', link: '/basics/scaling-capacity-boundaries' },
            { text: '自回归训练：Teacher Forcing 与标签构造', link: '/basics/autoregressive-training' },
            { text: '反向传播、自动微分与参数更新', link: '/basics/backpropagation-optimization' },
            { text: '分布式训练与显存账本', link: '/basics/distributed-training-memory' }
          ]
        }
      ],
      '/pretraining/': sidebarTraining(),
      '/finetuning/': sidebarTraining(),
      '/prompt/': [
        {
          text: 'Prompt 工程',
          items: [
            { text: 'Prompt 工程总览', link: '/prompt/prompt-engineering' },
            { text: '推理类提示（CoT 全家桶）', link: '/prompt/cot-reasoning' },
            { text: '高级提示模式与工程技巧', link: '/prompt/advanced-patterns' },
            { text: '自动化优化与 Prompt Ops', link: '/prompt/prompt-optimization' },
            { text: 'Prompt 生命周期、实验与发布', link: '/prompt/prompt-lifecycle' },
            { text: '提示注入与越狱攻防', link: '/prompt/prompt-injection' },
            { text: '上下文/循环工程（最新范式）', link: '/prompt/agentic-prompting' }
          ]
        }
      ],
      '/rag/': [
        {
          text: 'RAG 检索增强生成',
          items: [
            { text: 'RAG 基础与流程', link: '/rag/rag-basics' },
            { text: '切分与检索策略深挖', link: '/rag/chunking-retrieval' },
            { text: 'Embedding 与向量数据库', link: '/rag/embedding-vectordb' },
            { text: 'Embedding 与 Reranker 训练', link: '/rag/embedding-training' },
            { text: 'RAG 进阶与优化', link: '/rag/rag-advanced' },
            { text: 'RAG 生产化与系统设计', link: '/rag/rag-production' },
            { text: 'Agentic RAG 智能体检索', link: '/rag/agentic-rag' },
            { text: 'GraphRAG 与知识图谱', link: '/rag/graphrag' },
            { text: 'RAG 评估（RAGAS）', link: '/rag/rag-evaluation' },
            { text: '多模态 RAG（ColPali）', link: '/rag/multimodal-rag' },
            { text: 'RAG vs 长上下文 vs 微调', link: '/rag/rag-vs-long-context' }
          ]
        }
      ],
      '/agent/': [
        {
          text: 'Agent 智能体',
          items: [
            { text: 'Agent 基础与框架', link: '/agent/agent-basics' },
            { text: 'Function Calling 与 MCP', link: '/agent/function-calling-mcp' },
            { text: 'MCP 协议深入', link: '/agent/mcp' },
            { text: 'Agent 工具安全与权限边界', link: '/agent/tool-safety' },
            { text: 'A2A 协议与 Agent 互操作', link: '/agent/a2a-protocol' },
            { text: 'Agent 记忆系统', link: '/agent/agent-memory' },
            { text: '上下文工程', link: '/agent/context-engineering' },
            { text: 'AI 工作流 vs Agent', link: '/agent/workflow' },
            { text: '多 Agent 与进阶范式', link: '/agent/multi-agent' },
            { text: 'Computer Use 与浏览器 Agent', link: '/agent/computer-use' },
            { text: '深度研究 Agent', link: '/agent/deep-research' },
            { text: 'Agent 评估与可靠性工程', link: '/agent/agent-evaluation' }
          ]
        }
      ],
      '/inference/': [
        {
          text: '推理优化与部署',
          items: [
            { text: '推理优化与部署', link: '/inference/inference-optimization' },
            { text: '推理时算力扩展', link: '/inference/test-time-scaling' },
            { text: '推理框架对比（vLLM/SGLang）', link: '/inference/serving-frameworks' },
            { text: '推理性能压测与指标', link: '/inference/inference-benchmark' },
            { text: 'KV Cache 深度专题', link: '/inference/kv-cache' },
            { text: '投机解码详解', link: '/inference/speculative-decoding' },
            { text: '量化实战深入', link: '/inference/quantization' },
            { text: '知识蒸馏与模型压缩', link: '/inference/model-compression' },
            { text: 'AI 编译器与图优化', link: '/inference/ai-compiler' },
            { text: 'GPU 与硬件基础', link: '/inference/gpu-hardware' },
            { text: '国产算力与国产化适配', link: '/inference/domestic-ai-stack' }
          ]
        }
      ],
      '/claude-code/': [
        {
          text: 'Claude Code 深入',
          items: [
            { text: '功能总览', link: '/claude-code/overview' },
            { text: '代码架构', link: '/claude-code/architecture' },
            { text: '核心机制与扩展', link: '/claude-code/mechanisms' },
            { text: '工具系统详解', link: '/claude-code/tools' },
            { text: '扩展机制（Hooks/MCP/Skills）', link: '/claude-code/extensibility' },
            { text: '子 Agent 与多 Agent 编排', link: '/claude-code/subagents' },
            { text: '最佳实践与高效用法', link: '/claude-code/best-practices' }
          ]
        }
      ],
      '/engineering/': [
        {
          text: '工程实战',
          items: [
            { text: 'LangChain 与应用框架', link: '/engineering/langchain' },
            { text: 'Spring AI 基础与面试题', link: '/engineering/spring-ai' },
            { text: 'LangGraph 与状态图 Agent', link: '/engineering/langgraph' },
            { text: 'LangGraph 生产化与系统设计', link: '/engineering/langgraph-production' },
            { text: 'LLM 应用开发实战', link: '/engineering/llm-app-dev' },
            { text: 'Deep Research 生产化', link: '/engineering/deep-research-production' },
            { text: '企业 Connector 增量同步与撤权', link: '/engineering/connector-sync-data-plane' },
            { text: 'LLM 文档生成与审阅生产化', link: '/engineering/llm-document-generation-production' },
            { text: 'LLM 流式应用生产化', link: '/engineering/llm-streaming-production' },
            { text: '实时语音 Agent 生产化', link: '/engineering/voice-agent-production' },
            { text: '多模态输入接入与资产处理', link: '/engineering/multimodal-input-pipeline' },
            { text: 'Dify 与低代码工作流', link: '/engineering/dify-workflow' },
            { text: '模型网关与多模型路由', link: '/engineering/llm-gateway' },
            { text: 'MaaS 平台与模型服务治理', link: '/engineering/maas-platform' },
            { text: 'AI 编程工具实战', link: '/engineering/ai-coding-tools' },
            { text: 'AI 编程与 Coding Agent', link: '/engineering/coding-agent' },
            { text: '编程 Agent 底层架构与机制', link: '/engineering/coding-agent-internals' },
            { text: '结构化输出详解', link: '/engineering/structured-output' },
            { text: 'AI 系统设计专题', link: '/engineering/system-design' },
            { text: 'LLMOps 生产运营', link: '/engineering/llmops' },
            { text: 'AI 项目实战案例', link: '/engineering/projects' },
            { text: '商业落地与价值评估', link: '/engineering/llm-business' }
          ]
        }
      ],
      '/interview/': [
        {
          text: '面试专题',
          items: [
            { text: '2026 岗位能力地图', link: '/interview/job-market-2026' },
            { text: '大模型应用实战知识体系', link: '/interview/application-practice-roadmap' },
            { text: '大模型应用实战高频追问', link: '/interview/application-practice-qna' },
            { text: '大模型应用实战场景题库', link: '/interview/application-practice-scenarios' },
            { text: '大模型应用系统设计面试题', link: '/interview/application-system-design' },
            { text: 'Text-to-SQL / ChatBI 生产系统设计', link: '/interview/text2sql-chatbi-production-playbook' },
            { text: '企业客服 Copilot 生产系统设计', link: '/interview/customer-support-copilot-production-playbook' },
            { text: '企业 HR Copilot 生产系统设计', link: '/interview/hr-copilot-production-playbook' },
            { text: '销售 / CRM Deal Copilot 生产系统设计', link: '/interview/sales-crm-copilot-production-playbook' },
            { text: '反欺诈 / 风险调查 Copilot 生产系统设计', link: '/interview/fraud-risk-investigation-copilot-playbook' },
            { text: '采购 / 供应商尽调 Copilot 生产系统设计', link: '/interview/procurement-vendor-due-diligence-copilot-playbook' },
            { text: '合同审阅 / 法务 Copilot 生产系统设计', link: '/interview/legal-contract-review-copilot-playbook' },
            { text: 'ITSM / SRE 事故响应 Copilot', link: '/interview/itsm-sre-incident-response-copilot-playbook' },
            { text: 'LLM 输出契约兼容与演进', link: '/interview/llm-output-contract-compatibility-playbook' },
            { text: 'LLM 流式输出与会话恢复设计', link: '/interview/llm-streaming-session-resilience-playbook' },
            { text: 'LLM 缓存正确性与语义缓存控制面', link: '/interview/llm-cache-correctness-semantic-cache-playbook' },
            { text: 'LLM Prompt/Prefix Cache 生产工程', link: '/interview/llm-prompt-prefix-cache-production-playbook' },
            { text: 'LLM 离线批处理与异步作业编排', link: '/interview/llm-offline-batch-job-orchestration-playbook' },
            { text: 'LLM 推理容量与弹性伸缩设计', link: '/interview/llm-inference-capacity-autoscaling-playbook' },
            { text: 'LLM 在线流量准入与过载保护', link: '/interview/llm-traffic-admission-overload-control-playbook' },
            { text: 'LLM 多供应商故障切换与一致性设计', link: '/interview/llm-multi-provider-failover-playbook' },
            { text: 'LLM 多地域灾备与状态连续性', link: '/interview/llm-multi-region-disaster-recovery-playbook' },
            { text: 'LLM FinOps：计量、归因与预算控制面', link: '/interview/llm-finops-metering-budget-control-plane' },
            { text: '大模型应用线上排障手册', link: '/interview/application-troubleshooting-playbook' },
            { text: 'LLM 评测与发布门禁实战', link: '/interview/evaluation-release-gates' },
            { text: 'LLM-as-a-Judge 校准与发布门禁', link: '/interview/llm-as-judge-calibration-playbook' },
            { text: 'PromptOps 模板治理与实验回滚', link: '/interview/promptops-production-governance-playbook' },
            { text: 'LoRA Adapter 服务化与回滚设计', link: '/interview/lora-adapter-serving-governance-playbook' },
            { text: 'Context Engineering 预算与记忆治理', link: '/interview/context-engineering-budget-memory-playbook' },
            { text: 'Test-time Compute 预算与动态路由', link: '/interview/test-time-compute-budget-routing-playbook' },
            { text: '模型量化生产验收与精度回滚', link: '/interview/model-quantization-production-validation-playbook' },
            { text: '合成数据质量与污染控制', link: '/interview/synthetic-data-quality-governance-playbook' },
            { text: 'LLM 线上评测与灰度实验', link: '/interview/online-evaluation-rollout-operations' },
            { text: 'LLM 人工审批与异常接管设计', link: '/interview/llm-human-approval-exception-handoff-playbook' },
            { text: 'LLM 数据标注与偏好数据运营', link: '/interview/llm-data-feedback-operations-playbook' },
            { text: '富文档与多模态 RAG 系统设计', link: '/interview/multimodal-rag-document-intelligence-playbook' },
            { text: '多租户 RAG 隔离与索引演进设计', link: '/interview/multi-tenant-rag-index-governance-playbook' },
            { text: 'LLM 数据分级与外发审计', link: '/interview/data-governance-egress-audit-qna' },
            { text: 'LLM 内容安全策略与审核系统设计', link: '/interview/llm-safety-policy-moderation-system-design' },
            { text: '企业 AI 治理控制面设计', link: '/interview/enterprise-ai-governance-audit-system-design' },
            { text: '基础篇岗位要求总纲', link: '/interview/foundation-requirements' },
            { text: '基础篇高频问答加厚版', link: '/interview/foundation-qna' },
            { text: '框架与智能工作流高频问答', link: '/interview/framework-workflow-qna' },
            { text: '结构化输出与 Schema 约束高频问答', link: '/interview/structured-output-qna' },
            { text: 'Spring AI / Java AI 生产化高频问答', link: '/interview/spring-ai-production-qna' },
            { text: 'Java / Spring AI 生产架构设计', link: '/interview/java-ai-production-architecture-system-design' },
            { text: '企业 Tool Gateway 安全执行设计', link: '/interview/tool-gateway-security-design' },
            { text: '智能体运行时架构：Claude Code / Codex / OpenClaw / Hermes', link: '/interview/agent-runtime-architecture-qna' },
            { text: '智能编码 Agent 企业操作手册', link: '/interview/coding-agent-production-playbook' },
            { text: '编码 Agent 测试策略与验证闭环', link: '/interview/coding-agent-testing-verification-playbook' },
            { text: '跨运行时 Agent 扩展生产治理', link: '/interview/agent-skills-production-governance' },
            { text: 'Agent 生命周期事件与 Policy Hook Fabric', link: '/interview/agent-lifecycle-policy-hook-fabric' },
            { text: 'Agent 外部副作用事务与补偿设计', link: '/interview/agent-effect-transaction-compensation-playbook' },
            { text: 'Agent Tool Contract 演进与兼容性', link: '/interview/agent-tool-contract-evolution-playbook' },
            { text: 'Agent Prompt Injection 与不可信上下文隔离', link: '/interview/agent-prompt-injection-provenance-playbook' },
            { text: '多 Agent 共享工作区并发控制', link: '/interview/multi-agent-workspace-concurrency-playbook' },
            { text: '远程与云端 Agent 生产运行手册', link: '/interview/remote-agent-operations-playbook' },
            { text: 'Agent 自动化与后台编排生产设计', link: '/interview/agent-automation-orchestration-playbook' },
            { text: '多 Agent 委派与 Handoff 控制平面', link: '/interview/multi-agent-delegation-handoff-playbook' },
            { text: '长任务 Agent 持续授权与紧急撤权', link: '/interview/agent-continuous-authorization-playbook' },
            { text: 'Agent 可复现运行与配置溯源', link: '/interview/agent-reproducibility-provenance-playbook' },
            { text: '长运行 Agent 检查点、恢复与人工 Steer', link: '/interview/long-running-agent-recovery-playbook' },
            { text: 'Agent 代码审查与变更交付证据链', link: '/interview/agent-code-review-delivery-playbook' },
            { text: 'Agent 外部连接与 OAuth 凭证生命周期', link: '/interview/agent-connector-identity-lifecycle-playbook' },
            { text: 'Agent 沙箱、执行准入与逃逸处置', link: '/interview/agent-sandbox-execution-boundaries-playbook' },
            { text: 'Agent Runtime 升级、兼容性与回滚', link: '/interview/agent-runtime-upgrade-rollback-playbook' },
            { text: 'Agent 模型路由、降级与能力契约', link: '/interview/agent-model-routing-capability-playbook' },
            { text: 'Agent 上下文与记忆生产治理', link: '/interview/agent-context-memory-governance' },
            { text: 'Agent 观测、取证与事故响应手册', link: '/interview/agent-observability-incident-response' },
            { text: 'Computer Use / 浏览器 Agent 生产设计', link: '/interview/computer-use-browser-agent-system-design' },
            { text: 'A2A 跨 Agent 互操作生产设计', link: '/interview/a2a-production-interoperability-qna' },
            { text: 'Dify 低代码工作流生产化高频问答', link: '/interview/dify-production-qna' },
            { text: 'LangGraph 状态图 Agent 生产化高频问答', link: '/interview/langgraph-production-qna' },
            { text: 'MCP Server 生产化与企业治理高频问答', link: '/interview/mcp-production-qna' },
            { text: 'Agent 评测与安全合规高频问答', link: '/interview/agent-evaluation-safety-qna' },
            { text: 'RAG、Memory 与评测安全高频问答', link: '/interview/rag-memory-eval-qna' },
            { text: '推理部署与成本治理高频问答', link: '/interview/inference-cost-qna' },
            { text: 'LLMOps 生产运营高频问答', link: '/interview/llmops-production-qna' },
            { text: 'MaaS 平台生产化高频问答', link: '/interview/maas-production-qna' },
            { text: '微调与模型平台高频问答', link: '/interview/finetuning-platform-qna' },
            { text: '高频面试题速记', link: '/interview/high-frequency' },
            { text: '手撕代码题解集', link: '/interview/coding-problems' },
            { text: '分岗位面试真题', link: '/interview/real-questions' },
            { text: '大模型学习路线', link: '/interview/learning-path' },
            { text: 'LLM Course 中文路线图', link: '/interview/llm-course-roadmap' },
            { text: '学习资源汇总', link: '/interview/resources' }
          ]
        }
      ],
      '/evaluation/': [
        {
          text: '模型评估',
          items: [
            { text: '模型评估与幻觉', link: '/evaluation/evaluation' },
            { text: '评测基准深入', link: '/evaluation/benchmarks' }
          ]
        }
      ],
      '/multimodal/': [
        {
          text: '多模态',
          items: [
            { text: '多模态大模型', link: '/multimodal/multimodal' },
            { text: '多模态架构深挖（VLM）', link: '/multimodal/vlm-architecture' },
            { text: '扩散模型与图像生成', link: '/multimodal/diffusion' },
            { text: '视频生成', link: '/multimodal/video-generation' },
            { text: '语音大模型', link: '/multimodal/speech' },
            { text: '实时语音 Agent 生产化', link: '/engineering/voice-agent-production' },
            { text: '多模态输入接入与资产处理', link: '/engineering/multimodal-input-pipeline' }
          ]
        }
      ],
      '/models/': [
        {
          text: '经典模型',
          items: [
            { text: '经典模型盘点', link: '/models/classic-models' },
            { text: 'LLaMA 与 Qwen 架构演进', link: '/models/llama-qwen' },
            { text: 'DeepSeek 专题', link: '/models/deepseek' },
            { text: '小语言模型与端侧（SLM）', link: '/models/slm' },
            { text: '中文大模型生态全景', link: '/models/chinese-llm-landscape' }
          ]
        }
      ],
      '/advanced/': [
        {
          text: '前沿专题',
          items: [
            { text: '推理模型与慢思考', link: '/advanced/reasoning-models' },
            { text: '强化学习基础（面向 LLM）', link: '/advanced/rl-basics' },
            { text: 'Agentic RL（智能体强化学习）', link: '/advanced/agentic-rl' },
            { text: '状态空间模型与 Mamba', link: '/advanced/state-space-models' },
            { text: '扩散语言模型（Diffusion LLM）', link: '/advanced/diffusion-llm' },
            { text: '机制可解释性（SAE/Circuits）', link: '/advanced/interpretability' },
            { text: '具身智能与 VLA', link: '/advanced/embodied-ai' }
          ]
        },
        {
          text: '深入原理',
          items: [
            { text: 'FlashAttention 深入', link: '/advanced/flash-attention' },
            { text: '训练深入（优化器/混合精度）', link: '/advanced/training-internals' },
            { text: '向量检索与 ANN 算法', link: '/advanced/vector-search' }
          ]
        },
        {
          text: '安全与治理',
          items: [
            { text: '大模型安全与对齐', link: '/advanced/safety' },
            { text: 'AI 安全合规与治理', link: '/advanced/governance' }
          ]
        }
      ]
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/Meko1/llm-interview-guide' }],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    docFooter: { prev: '上一篇', next: '下一篇' },
    outline: { label: '本页目录', level: [2, 3] },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    lastUpdatedText: '最后更新于',

    editLink: {
      pattern: 'https://github.com/Meko1/llm-interview-guide/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2026 Meko1 · 大模型面试指南'
    }
  }
})

function sidebarTraining() {
  return [
    {
      text: '预训练',
      items: [
        { text: '预训练目标与数据', link: '/pretraining/pretrain' },
        { text: '数据工程与合成数据', link: '/pretraining/data-engineering' },
        { text: '缩放定律与涌现能力', link: '/pretraining/scaling-law' },
        { text: '分布式训练与显存优化', link: '/pretraining/distributed-training' },
        { text: 'AI 训练集群与网络通信', link: '/pretraining/ai-infra-networking' },
        { text: 'MoE 训练与专家并行', link: '/pretraining/moe-training' },
        { text: '大模型训练全流程（从0到1）', link: '/pretraining/llm-training-pipeline' }
      ]
    },
    {
      text: '微调与对齐',
      items: [
        { text: '微调范式（SFT / PEFT）', link: '/finetuning/finetuning' },
        { text: 'LoRA / QLoRA 详解', link: '/finetuning/lora' },
        { text: 'RLHF / DPO 对齐', link: '/finetuning/rlhf' },
        { text: '偏好优化方法全景（DPO 变体）', link: '/finetuning/preference-optimization' },
        { text: '前沿对齐技术（GRPO/DAPO/RLVR）', link: '/finetuning/frontier-alignment' },
        { text: '合成数据与自我改进', link: '/finetuning/synthetic-data' },
        { text: '模型融合与合并', link: '/finetuning/model-merging' },
        { text: '微调训练工具链实战', link: '/finetuning/training-frameworks' },
        { text: '垂直领域专家模型实战', link: '/finetuning/domain-expert-model' }
      ]
    }
  ]
}
