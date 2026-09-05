import test from 'node:test'
import assert from 'node:assert/strict'

import { createProfileResponse } from './profile-service.mjs'
import { DeepSeekError } from './deepseek.mjs'

const body = {
  query: { keyword: 'women yoga pants', market: 'US', channels: ['amazon', 'walmart'] },
  hits: [
    { title: 'Market overview', url: 'https://example.com/market', snippet: 'US yoga pants market' },
    { title: 'Product trends', url: 'https://example.com/trends', snippet: 'Women shoppers seek high-waist support' },
  ],
}

test('uses a validated DeepSeek profile and maps evidence ids to server-owned citations', async () => {
  const result = await createProfileResponse(body, {
    apiKey: 'test-key',
    requestProfile: async ({ input, validate }) => {
      assert.equal('url' in input.evidence[0], false)
      return validate({
        name: 'Women Yoga Pants',
        searchTerms: ['women yoga pants'],
        relatedTerms: ['high waisted yoga pants'],
        summary: '该品类包含高腰等细分方向。',
        audiences: [{ text: '关注高腰支撑的女性消费者', evidenceIds: ['evidence-2'] }],
        purchaseDrivers: [{ text: '高腰设计', evidenceIds: ['evidence-2'] }],
        validationQuestions: ['真实评论是否支持高腰舒适性？'],
        evidenceIds: ['evidence-2'],
      })
    },
  })

  assert.equal(result.generation.mode, 'deepseek')
  assert.equal(result.generation.degraded, false)
  assert.deepEqual(result.citations, [{
    label: 'Product trends',
    url: 'https://example.com/trends',
    source: 'discover',
  }])
  assert.equal('evidenceIds' in result.profile, false)
  assert.deepEqual(result.profile.purchaseDrivers, [{
    text: '高腰设计',
    citations: [{
      label: 'Product trends', url: 'https://example.com/trends', source: 'discover',
    }],
  }])
})

test('falls back honestly when the DeepSeek key is missing', async () => {
  const result = await createProfileResponse(body)

  assert.equal(result.generation.mode, 'deterministic')
  assert.equal(result.generation.degraded, true)
  assert.equal(result.generation.reason, 'missing_key')
  assert.equal(result.profile.name, 'women yoga pants')
})

test('falls back when the model cites an unknown evidence id', async () => {
  const result = await createProfileResponse(body, {
    apiKey: 'test-key',
    requestProfile: async ({ validate }) => validate({
      name: 'Women Yoga Pants',
      searchTerms: ['women yoga pants'],
      relatedTerms: [],
      summary: '无法验证的摘要。',
      audiences: [],
      purchaseDrivers: [],
      validationQuestions: ['需要验证什么？'],
      evidenceIds: ['fake-999'],
    }),
  })

  assert.equal(result.generation.mode, 'deterministic')
  assert.equal(result.generation.reason, 'invalid_output')
})

test('reports a rejected DeepSeek request without violating the frontend contract', async () => {
  const result = await createProfileResponse(body, {
    apiKey: 'test-key',
    requestProfile: async () => {
      throw new DeepSeekError(401, 'request_rejected', 'DeepSeek 请求失败：401')
    },
  })

  assert.equal(result.generation.reason, 'request_rejected')
})

test('does not turn a user abort into a deterministic fallback', async () => {
  await assert.rejects(
    createProfileResponse(body, {
      apiKey: 'test-key',
      requestProfile: async () => { throw new DOMException('Aborted', 'AbortError') },
    }),
    (error) => error.name === 'AbortError',
  )
})
