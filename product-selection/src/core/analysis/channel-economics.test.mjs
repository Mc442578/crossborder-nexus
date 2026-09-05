import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateChannelEconomics, resolveUsApparelReferralRate,
} from './channel-economics.ts'

test('uses the official US apparel price tiers for each channel', () => {
  assert.equal(resolveUsApparelReferralRate('amazon', 15), 0.05)
  assert.equal(resolveUsApparelReferralRate('amazon', 20), 0.1)
  assert.equal(resolveUsApparelReferralRate('amazon', 40), 0.17)
  assert.equal(resolveUsApparelReferralRate('walmart', 40), 0.15)
  assert.equal(resolveUsApparelReferralRate('tiktok', 40), 0.06)
})

test('calculates separate channel profits from the same cost assumptions', () => {
  const listings = ['amazon', 'walmart', 'tiktok'].map((channel) => ({
    id: `${channel}:1`, title: 'Yoga Pants', channel, price: 40, currency: 'USD',
    ...(channel === 'tiktok' ? { affiliateCommissionRate: 0.12 } : {}),
  }))
  const result = calculateChannelEconomics(listings, {
    purchaseCost: 12, firstMileCost: 4, advertisingRate: 0.1,
  })

  assert.deepEqual(result.map((item) => ({
    channel: item.channel,
    feeRate: item.platformFeeRate,
    fee: item.platformFee,
    profit: item.unitProfit,
    margin: item.marginRate,
  })), [
    { channel: 'amazon', feeRate: 0.17, fee: 6.8, profit: 13.2, margin: 0.33 },
    { channel: 'walmart', feeRate: 0.15, fee: 6, profit: 14, margin: 0.35 },
    { channel: 'tiktok', feeRate: 0.06, fee: 2.4, profit: 12.8, margin: 0.32 },
  ])
  assert.equal(result[2].affiliateCommissionRate, 0.12)
  assert.equal(result[2].affiliateCommission, 4.8)
})

test('does not emit comparable TikTok economics without affiliate commission data', () => {
  const result = calculateChannelEconomics([{
    id: 'tiktok:1', title: 'Yoga Pants', channel: 'tiktok', price: 40, currency: 'USD',
  }], { purchaseCost: 12, firstMileCost: 4, advertisingRate: 0.1 })

  assert.deepEqual(result, [])
})

test('uses the Amazon per-item minimum referral fee', () => {
  const [result] = calculateChannelEconomics([{
    id: 'amazon:1', title: 'Low Price Item', channel: 'amazon', price: 4, currency: 'USD',
  }], { purchaseCost: 1, firstMileCost: 0, advertisingRate: 0 })

  assert.equal(result.platformFeeRate, 0.05)
  assert.equal(result.platformFee, 0.3)
  assert.equal(result.platformFeeMinimumApplied, true)
  assert.equal(result.unitProfit, 2.7)
})
