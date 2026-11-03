import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, relative, posix } from 'node:path'
import MarkdownIt from 'markdown-it'

const root = resolve(import.meta.dirname, '..')
const docs = resolve(root, 'docs')
const dist = resolve(docs, '.vitepress/dist')
const base = '/llm-interview-guide/'
const markdown = new MarkdownIt()
const walk = (folder, extension) => readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(folder, entry.name)
  if (entry.isDirectory()) return ['.vitepress', 'public'].includes(entry.name) ? [] : walk(path, extension)
  return entry.name.endsWith(extension) ? [path] : []
})
const pages = new Map(walk(dist, '.html').map(path => {
  const html = readFileSync(path, 'utf8')
  return [path, {
    ids: new Set([...html.matchAll(/\bid="([^"]*)"/g)].map(match => markdown.utils.unescapeAll(match[1]))),
    links: [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(match => markdown.utils.unescapeAll(match[1]))
  }]
}))
const errors = []
for (const [path, page] of pages) {
  const sourceUrl = new URL(base + relative(dist, path).replaceAll('\\', '/'), 'https://local.invalid')
  for (const href of page.links) {
    const url = new URL(href, sourceUrl)
    if (url.origin !== sourceUrl.origin) continue
    if (!url.pathname.startsWith(base)) continue
    let target = decodeURIComponent(url.pathname.slice(base.length))
    target = target.endsWith('/') || !target ? posix.join(target, 'index.html') : /\.[^/]+$/.test(target) ? target : `${target}.html`
    const destination = resolve(dist, target)
    if (!existsSync(destination)) errors.push(`${relative(dist, path)}: 无效目标 ${href}`)
    else if (url.hash && pages.has(destination) && !pages.get(destination).ids.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${relative(dist, path)}: 无效锚点 ${href}`)
  }
}
const sources = walk(docs, '.md')
for (const source of sources) {
  const output = resolve(dist, relative(docs, source).replace(/\.md$/, '.html'))
  if (!existsSync(output)) errors.push(`缺少页面产物：${relative(docs, source)}`)
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log(`通过：${sources.length} 个源页面均有产物，${pages.size} 个 HTML 页面的站内目标与锚点有效。`)
