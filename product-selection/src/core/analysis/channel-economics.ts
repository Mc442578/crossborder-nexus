import type {
  Channel, ChannelUnitEconomics, CompetitorListing, CostInputs,
} from '@/types/domain'
import { calculateUnitEconomics } from './unit-economics.ts'

/** 美国服装品类的平台推荐佣金；促销、履约和特殊类目费用不包含在内。 */
export function resolveUsApparelReferralRate(channel: Channel, sellingPrice: number): number {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) throw new Error('售价无效')
  if (channel === 'tiktok') return 0.06
  if (sellingPrice <= 15) return 0.05
  if (sellingPrice <= 20) return 0.1
  return channel === 'amazon' ? 0.17 : 0.15
}

export function calculateChannelEconomics(
  listings: CompetitorListing[], costs: CostInputs,
): ChannelUnitEconomics[] {
  const channels: Channel[] = ['amazon', 'walmart', 'tiktok']
  return channels.flatMap((channel) => {
    const channelListings = listings.filter((listing) => listing.channel === channel)
    if (!channelListings.length) return []

    const prices = channelListings.map((listing) => listing.price)
    const sortedPrices = prices
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((a, b) => a - b)
    if (!sortedPrices.length) return []
    const middle = Math.floor(sortedPrices.length / 2)
    const medianPrice = sortedPrices.length % 2
      ? sortedPrices[middle]!
      : (sortedPrices[middle - 1]! + sortedPrices[middle]!) / 2
    const affiliateRates = channelListings
      .map((listing) => listing.affiliateCommissionRate)
      .filter((rate): rate is number => Number.isFinite(rate) && rate! >= 0 && rate! <= 1)
      .sort((a, b) => a - b)
    if (channel === 'tiktok' && !affiliateRates.length) return []

    const platformFeeRate = resolveUsApparelReferralRate(channel, medianPrice)
    const base = calculateUnitEconomics(prices, { ...costs, platformFeeRate })
    const minimumPlatformFee = channel === 'amazon' ? 0.3 : 0
    const platformFee = Math.max(base.platformFee, minimumPlatformFee)
    const affiliateMiddle = Math.floor(affiliateRates.length / 2)
    const affiliateCommissionRate = channel === 'tiktok'
      ? affiliateRates.length % 2
        ? affiliateRates[affiliateMiddle]!
        : (affiliateRates[affiliateMiddle - 1]! + affiliateRates[affiliateMiddle]!) / 2
      : undefined
    const affiliateCommission = affiliateCommissionRate === undefined
      ? 0
      : medianPrice * affiliateCommissionRate
    const unitProfit = medianPrice
      - costs.purchaseCost
      - costs.firstMileCost
      - platformFee
      - base.advertisingCost
      - affiliateCommission

    return [{
      ...base,
      platformFee: money(platformFee),
      unitProfit: money(unitProfit),
      marginRate: rate(unitProfit / medianPrice),
      channel,
      currency: channelListings[0]?.currency ?? 'USD',
      platformFeeRate,
      ...(affiliateCommissionRate === undefined ? {} : {
        affiliateCommissionRate: rate(affiliateCommissionRate),
        affiliateCommission: money(affiliateCommission),
        affiliateCommissionSampleSize: affiliateRates.length,
      }),
      ...(channel === 'amazon' && platformFee > base.platformFee
        ? { platformFeeMinimumApplied: true }
        : {}),
      sampleSize: channelListings.length,
    }]
  })
}

const money = (value: number) => Math.round(value * 100) / 100
const rate = (value: number) => Math.round(value * 10_000) / 10_000
