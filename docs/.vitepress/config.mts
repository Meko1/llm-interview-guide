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

  head: [
    ['meta', { name: 'theme-color', content: '#3c8772' }],
    ['meta', { name: 'keywords', content: '大模型,LLM,面试,八股文,Transformer,RAG,Agent,微调,RLHF' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'LLMGuide',

    nav: [
      { text: '新手入门', link: '/beginner/getting-started', activeMatch: '/beginner/' },
      { text: '大模型基础', link: '/basics/overview', activeMatch: '/basics/' },
      { text: '训练与微调', link: '/pretraining/pretrain', activeMatch: '/(pretraining|finetuning)/' },
      { text: 'Prompt 工程', link: '/prompt/prompt-engineering', activeMatch: '/prompt/' },
      { text: 'RAG', link: '/rag/rag-basics', activeMatch: '/rag/' },
      { text: 'Agent', link: '/agent/agent-basics', activeMatch: '/agent/' },
      {
        text: '推理与部署',
        activeMatch: '/inference/',
        items: [
          { text: '推理优化与部署', link: '/inference/inference-optimization' }
        ]
      },
      { text: '工程实战', link: '/engineering/langchain', activeMatch: '/engineering/' },
      {
        text: '进阶',
        activeMatch: '/(evaluation|multimodal|models|advanced)/',
        items: [
          {
            text: '前沿专题',
            items: [
              { text: '推理模型与慢思考', link: '/advanced/reasoning-models' },
              { text: '大模型安全与对齐', link: '/advanced/safety' },
              { text: '状态空间模型与 Mamba', link: '/advanced/state-space-models' }
            ]
          },
          {
            text: '深入原理',
            items: [
              { text: 'FlashAttention 深入', link: '/advanced/flash-attention' },
              { text: '训练深入（优化器/混合精度）', link: '/advanced/training-internals' }
            ]
          },
          {
            text: '评估与模型',
            items: [
              { text: '模型评估与幻觉', link: '/evaluation/evaluation' },
              { text: '评测基准深入', link: '/evaluation/benchmarks' },
              { text: '多模态大模型', link: '/multimodal/multimodal' },
              { text: '经典模型盘点', link: '/models/classic-models' },
              { text: 'DeepSeek 专题', link: '/models/deepseek' }
            ]
          }
        ]
      },
      {
        text: '面试专题',
        activeMatch: '/interview/',
        items: [
          { text: '高频面试题速记', link: '/interview/high-frequency' },
          { text: '分岗位面试真题', link: '/interview/real-questions' },
          { text: '大模型学习路线', link: '/interview/learning-path' },
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
            { text: '位置编码（RoPE / ALiBi）', link: '/basics/position-encoding' },
            { text: '归一化与激活函数', link: '/basics/normalization' },
            { text: 'Tokenizer 与分词', link: '/basics/tokenizer' },
            { text: '解码与采样策略', link: '/basics/decoding' },
            { text: 'MoE 混合专家模型', link: '/basics/moe' },
            { text: '长上下文专题', link: '/basics/long-context' }
          ]
        }
      ],
      '/pretraining/': sidebarTraining(),
      '/finetuning/': sidebarTraining(),
      '/prompt/': [
        {
          text: 'Prompt 工程',
          items: [
            { text: 'Prompt Engineering 基础', link: '/prompt/prompt-engineering' }
          ]
        }
      ],
      '/rag/': [
        {
          text: 'RAG 检索增强生成',
          items: [
            { text: 'RAG 基础与流程', link: '/rag/rag-basics' },
            { text: 'Embedding 与向量数据库', link: '/rag/embedding-vectordb' },
            { text: 'RAG 进阶与优化', link: '/rag/rag-advanced' }
          ]
        }
      ],
      '/agent/': [
        {
          text: 'Agent 智能体',
          items: [
            { text: 'Agent 基础与框架', link: '/agent/agent-basics' },
            { text: 'Function Calling 与 MCP', link: '/agent/function-calling-mcp' },
            { text: '多 Agent 与进阶范式', link: '/agent/multi-agent' }
          ]
        }
      ],
      '/inference/': [
        {
          text: '推理优化与部署',
          items: [
            { text: '推理优化与部署', link: '/inference/inference-optimization' }
          ]
        }
      ],
      '/engineering/': [
        {
          text: '工程实战',
          items: [
            { text: 'LangChain 与应用框架', link: '/engineering/langchain' },
            { text: 'LLM 应用开发实战', link: '/engineering/llm-app-dev' },
            { text: 'AI 项目实战案例', link: '/engineering/projects' }
          ]
        }
      ],
      '/interview/': [
        {
          text: '面试专题',
          items: [
            { text: '高频面试题速记', link: '/interview/high-frequency' },
            { text: '分岗位面试真题', link: '/interview/real-questions' },
            { text: '大模型学习路线', link: '/interview/learning-path' },
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
          items: [{ text: '多模态大模型', link: '/multimodal/multimodal' }]
        }
      ],
      '/models/': [
        {
          text: '经典模型',
          items: [
            { text: '经典模型盘点', link: '/models/classic-models' },
            { text: 'DeepSeek 专题', link: '/models/deepseek' }
          ]
        }
      ],
      '/advanced/': [
        {
          text: '前沿专题',
          items: [
            { text: '推理模型与慢思考', link: '/advanced/reasoning-models' },
            { text: '大模型安全与对齐', link: '/advanced/safety' },
            { text: '状态空间模型与 Mamba', link: '/advanced/state-space-models' }
          ]
        },
        {
          text: '深入原理',
          items: [
            { text: 'FlashAttention 深入', link: '/advanced/flash-attention' },
            { text: '训练深入（优化器/混合精度）', link: '/advanced/training-internals' }
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
        { text: '缩放定律与涌现能力', link: '/pretraining/scaling-law' },
        { text: '分布式训练与显存优化', link: '/pretraining/distributed-training' }
      ]
    },
    {
      text: '微调与对齐',
      items: [
        { text: '微调范式（SFT / PEFT）', link: '/finetuning/finetuning' },
        { text: 'LoRA / QLoRA 详解', link: '/finetuning/lora' },
        { text: 'RLHF / DPO 对齐', link: '/finetuning/rlhf' }
      ]
    }
  ]
}
