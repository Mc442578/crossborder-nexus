import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateUnitEconomics } from './unit-economics.ts'

test('calculates unit profit and margin from the median selling price', () => {
  const result = calculateUnitEconomics([20, 40, 60], {
    purchaseCost: 12,
    firstMileCost: 4,
    platformFeeRate: 0.15,
    advertisingRate: 0.1,
  })

  assert.deepEqual(result, {
    sellingPrice: 40,
    purchaseCost: 12,
    firstMileCost: 4,
    platformFee: 6,
    advertisingCost: 4,
    unitProfit: 14,
    marginRate: 0.35,
  })
})

test('rejects invalid costs and rates', () => {
  assert.throws(() => calculateUnitEconomics([40], {
    purchaseCost: -1,
    firstMileCost: 4,
    platformFeeRate: 1.2,
    advertisingRate: 0.1,
  }), /成本参数无效/)
})
