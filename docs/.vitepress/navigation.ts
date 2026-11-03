import type { DefaultTheme } from 'vitepress'
import pages from '../_data/pages.json'

export const nav: DefaultTheme.NavItem[] = [
  { text: '学习路径', link: '/paths/', activeMatch: '/paths/' },
  { text: '知识地图', link: '/catalog' },
  { text: '模型原理', items: [
    { text: '基础与数学', link: '/basics/overview' },
    { text: 'Transformer 与 Attention', link: '/basics/transformer' },
    { text: '预训练', link: '/pretraining/pretrain' },
    { text: '微调与对齐', link: '/finetuning/finetuning' },
    { text: '研究与前沿', link: '/advanced/reasoning-models' }
  ] },
  { text: '应用工程', items: [
    { text: 'Prompt 工程', link: '/prompt/prompt-engineering' },
    { text: 'RAG 检索', link: '/rag/rag-basics' },
    { text: 'Agent 工程', link: '/agent/agent-basics' },
    { text: '服务与系统设计', link: '/engineering/system-design' },
    { text: '评估与质量', link: '/evaluation/evaluation' }
  ] },
  { text: '推理与 Infra', link: '/paths/infra' },
  { text: '面试准备', link: '/interview/high-frequency', activeMatch: '/interview/' },
  { text: '关于', link: '/about' }
]

const interviewGroups = [
  ['求职与基础', /job-market|learning-path|foundation|high-frequency|application-practice|coding-problems|real-questions|resources|requirements/],
  ['应用系统设计', /application-system|troubleshooting|java-ai|spring-ai|rag-|search-|retrieval|knowledge/],
  ['LLMOps 与成本', /llmops|inference|cost|model-serving|gateway|evaluation-release|release|finetuning|routing/],
  ['Agent 运行与协作', /agent-runtime|workflow|orchestration|langgraph|dify|n8n|framework|a2a|multi-agent/],
  ['安全与治理', /safety|security|governance|authorization|identity|sandbox|injection|policy|audit|connector/],
  ['开发工具与验证', /coding-agent|code-review|testing|skills|tool-contract|provenance|reproducibility|observability|compensation|memory|context/],
  ['行业场景', /copilot|financial|fraud|hr-|legal|sales|marketing|supply|itsm|support|research|voice|document|computer-use/],
  ['专项深入', /.*/]
] as const

const chunkGroups = (title: string, records: typeof pages): DefaultTheme.SidebarItem[] => {
  const sorted = [...records].sort((first, second) => (first.level || '').localeCompare(second.level || '') || first.title.localeCompare(second.title, 'zh-CN'))
  const chunks = Array.from({ length: Math.ceil(sorted.length / 12) }, (_, index) => sorted.slice(index * 12, (index + 1) * 12))
  return chunks.map((chunk, index) => ({
    text: chunks.length === 1 ? title : `${title} · ${index + 1}`,
    collapsed: true,
    items: chunk.map(page => ({ text: `${page.level || ''} · ${page.title.replace(/（最新）/g, '')}`, link: page.url }))
  }))
}

export const sidebar: DefaultTheme.Sidebar = {}
for (const folder of [...new Set(pages.filter(page => page.article || page.folder === 'paths').map(page => page.folder))]) {
  const records = pages.filter(page => page.folder === folder)
  let groups: DefaultTheme.SidebarItem[]
  if (folder === 'interview') {
    const assigned = new Set<string>()
    groups = interviewGroups.flatMap(([title, pattern]) => {
      const matches = records.filter(page => !assigned.has(page.path) && pattern.test(page.path))
      matches.forEach(page => assigned.add(page.path))
      const chunks = chunkGroups(title, matches)
      return chunks.length > 1 ? [{ text: title, collapsed: true, items: chunks }] : chunks
    })
  } else groups = chunkGroups(records[0]?.section || '学习路径', records)
  sidebar[`/${folder}/`] = [
    { text: '选择适合你的内容', items: [{ text: '岗位学习路径', link: '/paths/' }, { text: '全部文章 · 分级筛选', link: '/catalog' }] },
    ...groups
  ]
}
sidebar['/catalog'] = [{ text: '知识地图', items: [{ text: '全部文章', link: '/catalog' }, { text: '学习路径', link: '/paths/' }, { text: '阅读与分级说明', link: '/reading-guide' }] }]
