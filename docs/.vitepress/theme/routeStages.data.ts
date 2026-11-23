import { createContentLoader } from 'vitepress'

interface Stage {
  title: string
  question: string
  output: string
  reading: string
  link: string
}

declare const data: Record<string, Stage[]>
export { data }

export default createContentLoader('paths/*.md', {
  includeSrc: true,
  transform(pages) {
    const routes: Record<string, Stage[]> = {}
    for (const page of pages) {
      const route = page.url.replace(/\.html$/, '').split('/').pop()
      if (!route || route === 'index') continue
      const stages: Stage[] = []
      for (const row of (page.src ?? '').split('\n')) {
        if (!row.startsWith('|')) continue
        const columns = row.slice(1, row.lastIndexOf('|')).split('|').map(cell => cell.trim())
        const frontier = route === 'frontier'
        const linkCell = frontier ? columns[0] : columns[1]
        const match = linkCell?.match(/\[([^\]]+)\]\((\/[^)]+)\)/)
        if (!match || columns.length !== (frontier ? 3 : 4)) continue
        stages.push({
          title: frontier ? match[1] : columns[0].replace(/^第\s*\d+\s*周：/, ''),
          question: frontier ? columns[1] : columns[3],
          output: columns[2],
          reading: match[1],
          link: match[2]
        })
      }
      if (!stages.length) throw new Error('学习路线缺少阅读条目：' + page.url)
      routes[route] = stages
    }
    return routes
  }
})
