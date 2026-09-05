import test from 'node:test'
import assert from 'node:assert/strict'

import { scoreCategory } from './scoring.ts'

const baseMarket = {
  listings: [{
    id: 'item-1', title: 'Women Yoga Pants', channel: 'amazon',
    price: 40, currency: 'USD', reviewCount: 1000,
  }],
  priceBands: [],
  concentration: 0.21,
  brandCount: 67,
}

const risingTrend = {
  series: [],
  direction: 'rising',
  yoyChange: 58,
  seasonalPeaks: [3, 4, 5],
}

const costs = {
  purchaseCost: 12,
  firstMileCost: 4,
  advertisingRate: 0.1,
}

test('uses complete costs and a labelled review proxy for an explainable verdict', () => {
  const verdict = scoreCategory(baseMarket, {
    trend: risingTrend,
    costs,
    citations: [{ label: 'source', url: 'https://example.com', source: 'discover' }],
    analyzedAt: '2026-08-31T04:00:00.000Z',
  })
  const demand = verdict.dimensions.find((dimension) => dimension.key === 'demand')
  const margin = verdict.dimensions.find((dimension) => dimension.key === 'margin')

  assert.notEqual(verdict.decision, 'insufficient')
  assert.equal(verdict.unitEconomics.unitProfit, 13.2)
  assert.equal(verdict.unitEconomics.marginRate, 0.33)
  assert.equal(verdict.channelEconomics[0].channel, 'amazon')
  assert.match(demand.note, /评价数.*不等于销量/)
  assert.equal(margin.label, '估算毛利（按渠道保守值）')
  assert.equal(verdict.dataCompleteness, 'partial')
  assert.ok(verdict.confidence.score <= 79)
  assert.ok(verdict.risks.includes('当前使用评价数作为需求代理；评价数不等于销量'))
})

test('renormalizes remaining dimensions when trend data is missing', () => {
  const verdict = scoreCategory(baseMarket, { costs, citations: [] })
  assert.notEqual(verdict.decision, 'insufficient')
  assert.equal(verdict.dimensions.some((dimension) => dimension.key === 'trend'), false)
  assert.ok(verdict.risks.includes('趋势数据缺失，本结论已使用剩余维度降级计算'))
  assert.ok(verdict.confidence.missing.includes('趋势数据'))
})

test('blocks a positive recommendation when unit profit is not positive', () => {
  const verdict = scoreCategory(baseMarket, {
    trend: risingTrend,
    costs: {
      purchaseCost: 35,
      firstMileCost: 5,
      advertisingRate: 0.1,
    },
    citations: [{ label: 'source', url: 'https://example.com', source: 'discover' }],
  })

  assert.ok(verdict.unitEconomics.unitProfit <= 0)
  assert.equal(verdict.decision, 'pass')
  assert.ok(verdict.risks.includes('单件利润不为正，不建议进入该品类'))
})

test('keeps separate channel profits and scores from the conservative margin', () => {
  const market = {
    ...baseMarket,
    listings: ['amazon', 'walmart', 'tiktok'].map((channel) => ({
      id: `${channel}:1`, title: 'Yoga Pants', channel,
      price: 40, currency: 'USD', reviewCount: 100,
      ...(channel === 'tiktok' ? { affiliateCommissionRate: 0.12 } : {}),
    })),
  }
  const verdict = scoreCategory(market, { trend: risingTrend, costs })

  assert.deepEqual(verdict.channelEconomics.map((item) => ({
    channel: item.channel, profit: item.unitProfit,
  })), [
    { channel: 'amazon', profit: 13.2 },
    { channel: 'walmart', profit: 14 },
    { channel: 'tiktok', profit: 12.8 },
  ])
  assert.equal(verdict.unitEconomics.unitProfit, 12.8)
  assert.match(
    verdict.dimensions.find((dimension) => dimension.key === 'margin').note,
    /最低单件利润 \$12\.80/,
  )
})

test('does not treat TikTok profit as comparable when affiliate commission is missing', () => {
  const market = {
    ...baseMarket,
    listings: [{
      id: 'tiktok:1', title: 'Yoga Pants', channel: 'tiktok',
      price: 40, currency: 'USD', reviewCount: 100,
    }],
  }
  const verdict = scoreCategory(market, { trend: risingTrend, costs })

  assert.deepEqual(verdict.channelEconomics, [])
  assert.equal(verdict.unitEconomics, undefined)
  assert.equal(verdict.decision, 'insufficient')
  assert.ok(verdict.confidence.missing.includes('tiktok 渠道利润'))
  assert.ok(verdict.risks.some((risk) => risk.includes('未生成该渠道可比较利润')))
})

test('keeps the verdict insufficient when costs and demand signals are missing', () => {
  const market = {
    listings: [{
      id: 'item-1', title: 'Women Yoga Pants', channel: 'amazon',
      price: 19.99, currency: 'USD',
    }],
    priceBands: [],
    concentration: 0.21,
    brandCount: 67,
  }
  const verdict = scoreCategory(market, { trend: risingTrend })
  const demand = verdict.dimensions.find((dimension) => dimension.key === 'demand')
  const competition = verdict.dimensions.find((dimension) => dimension.key === 'competition')
  const margin = verdict.dimensions.find((dimension) => dimension.key === 'margin')

  assert.equal(demand.note, '缺少月销量和评价数，无法判断需求')
  assert.equal(verdict.decision, 'insufficient')
  assert.equal(verdict.score, null)
  assert.ok(verdict.reasons.includes('检测到季节性高峰月份：3、4、5 月'))
  assert.ok(verdict.reasons.every((reason) => !reason.includes('备货')))
  assert.equal(competition.note, '头部 4 品牌 listing 占比 21%，67 个已识别品牌')
  assert.equal(margin.label, '估算毛利（缺少成本假设）')
  assert.match(margin.note, /缺少成本假设/)
  assert.ok(verdict.risks.includes('缺少月销量和评价数，需求维度不可用于商业判断'))
  assert.ok(verdict.risks.includes('缺少完整成本，无法计算估算毛利'))
})

test('keeps the verdict insufficient when demand is missing despite valid costs', () => {
  const market = {
    ...baseMarket,
    listings: baseMarket.listings.map(({ reviewCount, ...listing }) => listing),
  }
  const verdict = scoreCategory(market, { trend: risingTrend, costs })
  assert.equal(verdict.decision, 'insufficient')
  assert.equal(verdict.score, null)
})

test('keeps completeness partial when evidence is not linked to market and trend', () => {
  const market = {
    ...baseMarket,
    listings: baseMarket.listings.map((listing) => ({ ...listing, monthlySales: 1000 })),
  }
  const verdict = scoreCategory(market, {
    trend: risingTrend,
    costs,
    citations: [{ label: 'profile', url: 'https://example.com/profile', source: 'discover' }],
  })
  assert.equal(verdict.dataCompleteness, 'partial')
  assert.ok(verdict.confidence.missing.includes('市场数据来源关联'))
  assert.ok(verdict.confidence.missing.includes('趋势数据来源关联'))
})

test('marks complete data only when sales, costs, trend and evidence are all present', () => {
  const market = {
    ...baseMarket,
    listings: baseMarket.listings.map((listing) => ({ ...listing, monthlySales: 1000 })),
  }
  const verdict = scoreCategory(market, {
    trend: risingTrend,
    costs,
    citations: [
      { label: 'market', url: 'https://example.com/market', source: 'market' },
      { label: 'trend', url: 'https://example.com/trend', source: 'trend' },
    ],
  })
  assert.equal(verdict.dataCompleteness, 'complete')
  assert.deepEqual(verdict.confidence.missing, [])
})
