import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const repository = process.argv[2] || resolve(import.meta.dirname, '../../..')
const require = createRequire(resolve(repository, 'package.json'))
const { ssrRenderAttrs } = require('@vue/server-renderer')
const input = { 'data-safe\ronfocus': 'alert(1)', title: 'safe' }
const actual = ssrRenderAttrs(input)
const expected = ' title="safe"'
console.log(JSON.stringify({
  repository,
  serverRenderer: require('@vue/server-renderer/package.json').version,
  shared: require('@vue/shared/package.json').version,
  advisory: 'GHSA-g2v6-rqmx-r4w6',
  input,
  expected,
  actual,
  emitsRawCarriageReturn: actual.includes('\r'),
  attributeRejected: actual === expected
}, null, 2))
process.exitCode = actual === expected ? 0 : 1
