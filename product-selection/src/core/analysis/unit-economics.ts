import type { CostInputs, UnitEconomics } from '@/types/domain'

export function calculateUnitEconomics(
  prices: number[], costs: CostInputs & { platformFeeRate: number },
): UnitEconomics {
  const numericValues = [
    costs.purchaseCost,
    costs.firstMileCost,
    costs.platformFeeRate,
    costs.advertisingRate,
  ]
  const invalidCosts = numericValues.some((value) => !Number.isFinite(value))
    || costs.purchaseCost < 0
    || costs.firstMileCost < 0
    || costs.platformFeeRate < 0
    || costs.platformFeeRate > 1
    || costs.advertisingRate < 0
    || costs.advertisingRate > 1
  if (invalidCosts) throw new Error('成本参数无效')

  const validPrices = prices
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b)
  if (!validPrices.length) throw new Error('没有可用售价')

  const middle = Math.floor(validPrices.length / 2)
  const sellingPrice = validPrices.length % 2
    ? validPrices[middle]!
    : (validPrices[middle - 1]! + validPrices[middle]!) / 2
  const platformFee = sellingPrice * costs.platformFeeRate
  const advertisingCost = sellingPrice * costs.advertisingRate
  const unitProfit = sellingPrice
    - costs.purchaseCost
    - costs.firstMileCost
    - platformFee
    - advertisingCost

  return {
    sellingPrice: money(sellingPrice),
    purchaseCost: money(costs.purchaseCost),
    firstMileCost: money(costs.firstMileCost),
    platformFee: money(platformFee),
    advertisingCost: money(advertisingCost),
    unitProfit: money(unitProfit),
    marginRate: rate(unitProfit / sellingPrice),
  }
}

const money = (value: number) => Math.round(value * 100) / 100
const rate = (value: number) => Math.round(value * 10000) / 10000
