import test from 'node:test'
import assert from 'node:assert/strict'

import { trendStep } from './trend.ts'

test('reports seasonal peaks as calendar months', async () => {
  const periods = [
    '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
    '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02',
  ]
  const series = periods.map((period) => ({
    period,
    value: period === '2025-12' ? 100 : 50,
  }))
  const ctx = { query: { keyword: 'women yoga pants' }, profile: { searchTerms: ['women yoga pants'] } }
  const rt = {
    ds: { fetchTrend: async () => series },
    signal: new AbortController().signal,
    report: () => {},
  }

  await trendStep.run(ctx, rt)

  assert.deepEqual(ctx.trend.seasonalPeaks, [12])
})
