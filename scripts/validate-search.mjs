import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import MiniSearch from 'minisearch'

const root = resolve(import.meta.dirname, '..')
const measureCompression = process.argv.includes('--measure')
const folder = resolve(root, 'docs/.vitepress/dist/assets/chunks')
const chunks = readdirSync(folder).filter(name => name.startsWith('@localSearchIndex'))
assert.ok(chunks.length > 0)
assert.equal(chunks.filter(name => name.startsWith('@localSearchIndexroot.')).length, 1, 'Expected exactly one root search index')
const inventory = JSON.parse(readFileSync(resolve(root, 'audit/editorial-20261105/inventory.json'), 'utf8'))
for (const name of chunks) {
  const path = resolve(folder, name)
  const json = (await import(pathToFileURL(path))).default
  assert.equal(typeof json, 'string')
  const data = JSON.parse(json)
  const index = MiniSearch.loadJSON(json, { fields: ['title', 'titles', 'text'], storeFields: ['title', 'titles'] })
  const searchOptions = { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 } }
  assert.ok(index.documentCount > 0)
  if (name.startsWith('@localSearchIndexroot.')) {
    const routes = new Set(Object.values(data.documentIds).map(id => id.split('#')[0]))
    for (const article of inventory.articles) {
      const route = '/llm-interview-guide/' + article.path.replace(/^docs\//, '').replace(/\.md$/, '')
      assert.ok(routes.has(route), `Missing article in search index: ${article.path}`)
    }
    assert.equal(data.fieldIds.text, 2)
    for (const [query, route] of [
      ['LoRA', '/finetuning/lora#'],
      ['投机', '/inference/speculative-decoding#'],
      ['KV Cache', '/inference/'],
      ['工具调用', '/agent/'],
      ['连续批处理', '/inference/serving-frameworks#'],
      ['量化', '/inference/'],
      ['RLHF', '/finetuning/rlhf#']
    ]) {
      const results = index.search(query, searchOptions)
      assert.ok(results.slice(0, 16).some(result => result.id.includes(route)), `Missing relevant result for ${query}`)
      console.log(`${query}: ${results.length} 个匹配，相关页面在前 16 项。`)
    }
    assert.equal(index.search('zzzzatlasnomatchzzzz', searchOptions).length, 0)
    for (const query of ['idempotency', 'multinomial']) {
      assert.ok(index.search(query, { fields: ['text'], fuzzy: false, prefix: false }).length > 0, `Missing body-only search result for ${query}`)
      console.log(`${query}: 仅搜索正文字段也有匹配。`)
    }
  }
  const compression = measureCompression ? {
    gzipBytes: gzipSync(json, { level: 9 }).length,
    brotliBytes: brotliCompressSync(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length
  } : {}
  console.log(JSON.stringify({ chunk: name, documents: index.documentCount, terms: index.termCount, chunkBytes: readFileSync(path).length, jsonBytes: Buffer.byteLength(json), ...compression, sha256: createHash('sha256').update(json).digest('hex') }))
}
