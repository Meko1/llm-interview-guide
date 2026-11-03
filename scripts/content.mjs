import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, relative, posix } from 'node:path'
import { execFileSync } from 'node:child_process'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'

const root = resolve(import.meta.dirname, '..')
const docs = resolve(root, 'docs')
const args = new Set(process.argv.slice(2))
const markdown = new MarkdownIt()
const sections = {
  beginner: ['入门与数学', 'L0', ['在校生', '后端转型']],
  basics: ['模型原理', 'L1', ['在校生', '算法研究', '应用开发']],
  pretraining: ['预训练', 'L3', ['算法研究', 'Infra']],
  finetuning: ['微调与对齐', 'L2', ['算法研究', '应用开发']],
  prompt: ['Prompt 工程', 'L1', ['应用开发', '后端转型']],
  rag: ['RAG 检索', 'L1', ['应用开发', '后端转型']],
  agent: ['Agent 工程', 'L2', ['应用开发', '后端转型']],
  inference: ['推理与部署', 'L2', ['Infra', '后端转型']],
  evaluation: ['评估与安全', 'L2', ['应用开发', '算法研究']],
  engineering: ['工程实战', 'L2', ['后端转型', '应用开发', 'Infra']],
  interview: ['面试专题', 'L2', ['应用开发', '后端转型']],
  advanced: ['研究与前沿', 'L3', ['算法研究', 'Infra']],
  models: ['模型专题', 'L2', ['算法研究', '应用开发']],
  multimodal: ['多模态', 'L2', ['算法研究', '应用开发']],
  'claude-code': ['开发工具', 'L1', ['应用开发', '后端转型']],
  paths: ['学习路径', 'L1', ['在校生', '后端转型', '应用开发', '算法研究', 'Infra']]
}
const allowedRoles = new Set(['在校生', '后端转型', '应用开发', '算法研究', 'Infra'])
const levels = new Set(['L0', 'L1', 'L2', 'L3', 'L4'])
const normalize = value => value.replaceAll('\\', '/')
const walk = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(folder, entry.name)
  if (entry.isDirectory()) return ['.vitepress', 'public', '_data', 'superpowers'].includes(entry.name) ? [] : walk(path)
  return entry.name.endsWith('.md') ? [path] : []
})
const gitDates = new Map()
try {
  const history = execFileSync('git', ['-c', 'core.quotepath=false', 'log', '--format=DATE:%cs', '--name-only', '--', 'docs'], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  let date = ''
  for (const line of history.split('\n')) {
    if (line.startsWith('DATE:')) date = line.slice(5)
    else if (line.startsWith('docs/') && !gitDates.has(line.trim())) gitDates.set(line.trim(), date)
  }
} catch {}
const pages = []
const errors = []
const links = []
for (const path of walk(docs).sort()) {
  const parsed = matter(readFileSync(path, 'utf8'))
  const relativePath = normalize(relative(docs, path))
  const folder = relativePath.split('/')[0]
  const section = sections[folder]
  if (args.has('--write-metadata') && section) {
    const title = parsed.content.match(/^#\s+(.+)$/m)?.[1] || relativePath
    const description = parsed.content.split('\n').find(line => line.startsWith('> '))?.replace(/^>\s*/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '').slice(0, 150) || `${title}：原理、设计取舍与面试准备。`
    parsed.data = { title, description, level: section[1], roles: section[2], classification: 'inferred', ...parsed.data }
    parsed.data.description = parsed.data.description.replace(/\r/g, '').trim()
    writeFileSync(path, matter.stringify(parsed.content, parsed.data), 'utf8')
  }
  const plain = parsed.content.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '')
  const tokens = markdown.parse(parsed.content, {})
  const collect = items => {
    for (const token of items) {
      if (token.type === 'link_open') links.push({ from: relativePath, href: token.attrGet('href') })
      if (token.type === 'image') links.push({ from: relativePath, href: token.attrGet('src') })
      if (token.children) collect(token.children)
    }
  }
  collect(tokens)
  if (section && args.has('--check')) {
    const data = parsed.data
    if (!data.title || !data.description || !levels.has(data.level) || !Array.isArray(data.roles) || !data.roles.length || data.roles.some(role => !allowedRoles.has(role))) errors.push(`${relativePath}: 非法的 title / description / level / roles`)
    if (!['inferred', 'reviewed'].includes(data.classification)) errors.push(`${relativePath}: 非法 classification`)
    if (data.reviewedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedAt) || Number.isNaN(Date.parse(data.reviewedAt)) || new Date(data.reviewedAt).toISOString().slice(0, 10) !== data.reviewedAt)) errors.push(`${relativePath}: 非法审校日期`)
  }
  pages.push({
    path: relativePath, url: '/' + relativePath.replace(/(?:^|\/)index\.md$/, match => match.startsWith('/') ? '/' : '').replace(/\.md$/, ''),
    title: parsed.data.title || parsed.content.match(/^#\s+(.+)$/m)?.[1] || relativePath,
    description: parsed.data.description || '', section: section?.[0] || '站点页面', folder,
    level: parsed.data.level || null, roles: parsed.data.roles || [], classification: parsed.data.classification || null,
    article: Boolean(section) && folder !== 'paths',
    readingMinutes: Math.max(1, Math.ceil((plain.match(/[\u3400-\u9fff]/g) || []).length / 400 + (plain.match(/[a-zA-Z]+/g) || []).length / 200)),
    characters: plain.replace(/\s/g, '').length, codeBlocks: tokens.filter(token => token.type === 'fence').length,
    formulas: (plain.match(/\$\$/g) || []).length / 2, diagrams: tokens.filter(token => token.type === 'fence' && token.info.trim() === 'mermaid').length,
    externalLinks: links.filter(link => link.from === relativePath && /^https?:/.test(link.href)).length,
    hasFrontmatter: Object.keys(parsed.data).length > 0, gitModifiedAt: gitDates.get('docs/' + relativePath) || null, reviewedAt: parsed.data.reviewedAt || null
  })
}
const broken = []
for (const link of links) {
  if (!link.href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(link.href)) continue
  const raw = decodeURIComponent(link.href.split(/[?#]/)[0])
  if (!raw) continue
  const target = raw.startsWith('/') ? raw.slice(1).replace(/^llm-interview-guide\//, '') : posix.normalize(posix.join(posix.dirname(link.from), raw))
  if (![target, `${target}.md`, `${target}/index.md`, target.replace(/\.html$/, '.md')].some(candidate => existsSync(resolve(docs, candidate)) || existsSync(resolve(docs, 'public', candidate)))) broken.push(link)
}
for (const link of broken) errors.push(`${link.from}: 无效链接 ${link.href}`)
const articles = pages.filter(page => page.article)
if (!args.has('--check')) {
  mkdirSync(resolve(docs, '_data'), { recursive: true })
  mkdirSync(resolve(root, 'audit'), { recursive: true })
  writeFileSync(resolve(docs, '_data/pages.json'), JSON.stringify(pages, null, 2) + '\n')
  const fields = ['path', 'title', 'article', 'level', 'classification', 'hasFrontmatter', 'characters', 'readingMinutes', 'codeBlocks', 'formulas', 'diagrams', 'externalLinks', 'gitModifiedAt', 'reviewedAt']
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`
  writeFileSync(resolve(root, 'audit/inventory.csv'), '\ufeff' + [fields.join(','), ...pages.map(page => fields.map(field => quote(page[field])).join(','))].join('\n') + '\n')
  const counts = Object.entries(sections).filter(([key]) => articles.some(page => page.folder === key)).map(([key, value]) => `| ${value[0]} | ${articles.filter(page => page.folder === key).length} |`).join('\n')
  const short = [...articles].sort((first, second) => first.characters - second.characters).slice(0, 20)
  const repeated = articles.filter(page => /Copilot|Playbook|生产系统设计/.test(page.title))
  writeFileSync(resolve(root, 'audit/report.md'), `# 全站机械体检\n\n由 npm run catalog 重建；数字可从 inventory.csv 复算。知识文章不含首页、路径页、目录页与 docs/superpowers 设计文档。保留旧 URL。\n\n- 知识文章：${articles.length}\n- 清单 Markdown 页面：${pages.length}\n- 缺少 frontmatter 的知识文章：${articles.filter(page => !page.hasFrontmatter).length}\n- 无外部引用链接的知识文章：${articles.filter(page => page.externalLinks === 0).length}\n- 初次自动分级、待人工核实：${articles.filter(page => page.classification === 'inferred').length}\n- 无效站内路径或资源链接：${broken.length}（不含锚点语义）\n\n## 板块\n\n| 板块 | 知识文章 |\n| --- | --- |\n${counts}\n\n## 优先精读候选（短文粗筛，不是深度评分）\n\n${short.map(page => `- ${page.path}：机械字符数 ${page.characters}，是否扩写需人工判断。`).join('\n')}\n\n## 同构标题组\n\n${repeated.map(page => `- ${page.path}：${page.title}`).join('\n')}\n\n标题相似不证明正文重复，需对照业务约束、数据流、评测与失败案例。暂不删除或合并，收入主题导航和全量目录。\n\n## 无效路径\n\n${broken.map(link => `- ${link.from} → ${link.href}`).join('\n') || '未发现。'}\n\n## 审校边界\n\n不生成五维伪评分，不把图表数量当作技术深度。五篇核心页仅完成本轮局部审校；其他文章的论文、模型参数、版本、成本与招聘断言仍需逐篇核实。自动分类不等于人工定级，L4 仅对明确前沿专题人工授予。Git 修改时间不是技术审校日期。\n`)
  if (args.has('--baseline')) writeFileSync(resolve(root, 'audit/baseline.json'), JSON.stringify({ articles: articles.length, pages: pages.length, missingFrontmatter: articles.filter(page => !page.hasFrontmatter).length, broken, originalUrls: pages.map(page => page.url) }, null, 2) + '\n')
}
if (args.has('--check')) {
  const baseline = resolve(root, 'audit/baseline.json')
  if (existsSync(baseline)) {
    const urls = new Set(pages.map(page => page.url))
    for (const url of JSON.parse(readFileSync(baseline, 'utf8')).originalUrls) if (!urls.has(url)) errors.push(`旧 URL 丢失：${url}`)
  }
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log(`通过：${pages.length} 个页面的元数据、站内路径与旧 URL 检查。`)
} else console.log(`生成目录与报告：${articles.length} 篇知识文章，${pages.length} 个页面，${broken.length} 个无效路径。`)
