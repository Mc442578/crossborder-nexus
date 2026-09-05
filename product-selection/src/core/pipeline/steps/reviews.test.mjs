import test from 'node:test'
import assert from 'node:assert/strict'

import { reviewsStep, selectReviewCandidates } from './reviews.ts'

test('selects one highest-review-count product per channel', () => {
  const result = selectReviewCandidates([
    { id: 'amazon:B0LOW00001', channel: 'amazon', title: 'Low', reviewCount: 10 },
    { id: 'amazon:B0HIGH0001', channel: 'amazon', title: 'High', reviewCount: 100 },
    {
      id: 'walmart:PRODUCT1', reviewProductId: '12345',
      channel: 'walmart', title: 'Walmart', reviewCount: 20,
    },
  ])
  assert.deepEqual(result.map((item) => item.id), ['amazon:B0HIGH0001', 'walmart:PRODUCT1'])
})

test('stores reviews, channel coverage and evidence-backed pain points', async () => {
  const ctx = {
    query: { keyword: 'yoga pants', market: 'US', channels: ['amazon', 'tiktok'] },
    market: {
      listings: [{
        id: 'amazon:B0TEST1234', channel: 'amazon', title: 'Yoga Pants', reviewCount: 100,
      }],
    },
  }
  const rt = {
    signal: new AbortController().signal,
    report: () => {},
    ds: {
      fetchReviews: async () => ({
        reviews: [{
          id: 'amazon:B0TEST1234:review:1', channel: 'amazon', productId: 'B0TEST1234',
          productTitle: 'Yoga Pants', text: 'The size runs small.', rating: 2,
          fetchedAt: '2026-09-01T08:00:00.000Z',
        }],
        channels: [{ channel: 'amazon', status: 'success', count: 1 }],
      }),
    },
  }

  await reviewsStep.run(ctx, rt)

  assert.equal(ctx.reviews.reviews.length, 1)
  assert.equal(ctx.reviews.painPoints[0].key, 'size_fit')
  assert.deepEqual(ctx.reviews.painPoints[0].evidenceIds, ['amazon:B0TEST1234:review:1'])
  assert.ok(ctx.reviews.channels.some(
    (item) => item.channel === 'tiktok' && item.status === 'unsupported',
  ))
})

test('keeps an honest review snapshot when the upstream request fails', async () => {
  const ctx = {
    query: { keyword: 'yoga pants', market: 'US', channels: ['amazon', 'tiktok'] },
    market: { listings: [{ id: 'amazon:B0TEST1234', channel: 'amazon', title: 'Pants' }] },
  }
  await reviewsStep.run(ctx, {
    signal: new AbortController().signal,
    report: () => {},
    ds: { fetchReviews: async () => { throw new Error('SerpApi quota exceeded') } },
  })

  assert.deepEqual(ctx.reviews.reviews, [])
  assert.equal(ctx.reviews.channels[0].status, 'error')
  assert.match(ctx.reviews.channels[0].error, /quota/)
  assert.equal(ctx.reviews.channels[1].status, 'unsupported')
})
