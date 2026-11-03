import { defineConfig } from 'vitepress'
import { nav, sidebar } from './navigation'

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
  ignoreDeadLinks: false,

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


    nav,
    sidebar,
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
    lastUpdatedText: '仓库更新于（非技术审校日期）',

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
