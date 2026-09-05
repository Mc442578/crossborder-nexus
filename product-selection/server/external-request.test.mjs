import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchExternal } from './external-request.mjs'

test('maps an external timeout to a 504 service error', async () => {
  await assert.rejects(
    fetchExternal('https://example.com', {}, {
      service: 'Tavily',
      fetchImpl: async () => {
        const error = new Error('timed out')
        error.name = 'TimeoutError'
        throw error
      },
    }),
    { status: 504, message: 'Tavily 请求超时' },
  )
})

test('maps another connection failure to a 502 service error', async () => {
  await assert.rejects(
    fetchExternal('https://example.com', {}, {
      service: 'SerpApi 商品',
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      },
    }),
    { status: 502, message: 'SerpApi 商品连接失败' },
  )
})
