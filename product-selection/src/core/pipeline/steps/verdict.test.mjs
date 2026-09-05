import test from 'node:test'
import assert from 'node:assert/strict'

import { verdictStep } from './verdict.ts'

test('marks the verdict partial when one selected channel fails', async () => {
  const ctx = {
    query: {
      keyword: 'women yoga pants',
      market: 'US',
      channels: ['amazon', 'walmart'],
      costs: { purchaseCost: 5, firstMileCost: 2, advertisingRate: 0.1 },
    },
    market: {
      listings: [{
        id: 'amazon:1', title: 'Yoga Pants', channel: 'amazon', brand: 'Brand A',
        price: 30, currency: 'USD', reviewCount: 100,
      }],
      channelCoverage: [
        { channel: 'amazon', status: 'success', count: 1 },
        { channel: 'walmart', status: 'error', count: 0, error: 'upstream failed' },
      ],
      priceBands: [{ min: 30, max: 30, count: 1 }],
      concentration: 1,
      brandCount: 1,
    },
    citations: [],
  }
  const rt = { report: () => {} }

  await verdictStep.run(ctx, rt)

  assert.equal(ctx.verdict.dataCompleteness, 'partial')
  assert.ok(ctx.verdict.risks.some((risk) => risk.includes('walmart 抓取失败')))
})
