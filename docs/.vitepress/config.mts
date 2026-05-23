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
      { text: '大模型基础', link: '/basics/transformer', activeMatch: '/basics/' },
      { text: '训练与微调', link: '/pretraining/pretrain', activeMatch: '/(pretraining|finetuning)/' },
      { text: 'Prompt 工程', link: '/prompt/prompt-engineering', activeMatch: '/prompt/' },
      { text: 'RAG', link: '/rag/rag-basics', activeMatch: '/rag/' },
      { text: 'Agent', link: '/agent/agent-basics', activeMatch: '/agent/' },
      {
        text: '工程与落地',
        activeMatch: '/(inference|evaluation)/',
        items: [
          { text: '推理优化与部署', link: '/inference/inference-optimization' },
          { text: '模型评估', link: '/evaluation/evaluation' }
        ]
      },
      {
        text: '进阶',
        items: [
          { text: '多模态大模型', link: '/multimodal/multimodal' },
          { text: '经典模型盘点', link: '/models/classic-models' }
        ]
      },
      { text: '关于', link: '/about' }
    ],

    sidebar: {
      '/basics/': [
        {
          text: '大模型基础',
          items: [
            { text: '总览：大模型核心概念', link: '/basics/overview' },
            { text: 'Transformer 架构详解', link: '/basics/transformer' },
            { text: 'Attention 与变体', link: '/basics/attention' },
            { text: '位置编码（RoPE / ALiBi）', link: '/basics/position-encoding' },
            { text: 'Tokenizer 与分词', link: '/basics/tokenizer' }
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
            { text: 'RAG 进阶与优化', link: '/rag/rag-advanced' }
          ]
        }
      ],
      '/agent/': [
        {
          text: 'Agent 智能体',
          items: [
            { text: 'Agent 基础与框架', link: '/agent/agent-basics' },
            { text: 'Function Calling 与 MCP', link: '/agent/function-calling-mcp' }
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
      '/evaluation/': [
        {
          text: '模型评估',
          items: [{ text: '模型评估与幻觉', link: '/evaluation/evaluation' }]
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
          items: [{ text: '经典模型盘点', link: '/models/classic-models' }]
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
        { text: '缩放定律与涌现能力', link: '/pretraining/scaling-law' }
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
