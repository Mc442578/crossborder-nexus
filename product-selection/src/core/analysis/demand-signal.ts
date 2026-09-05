import type { CompetitorListing, DemandSignal } from '@/types/domain'

export function calculateDemandSignal(listings: CompetitorListing[]): DemandSignal {
  const monthlySales = listings
    .map((listing) => listing.monthlySales)
    .filter((value): value is number => Number.isFinite(value) && value! >= 0)
  if (listings.length > 0 && monthlySales.length === listings.length) {
    const total = monthlySales.reduce((sum, value) => sum + value, 0)
    return {
      source: 'sales',
      value: total,
      score: clamp((total / 20000) * 100),
      label: `真实月销量合计 ${total}`,
      sampleSize: monthlySales.length,
    }
  }

  const reviews = listings
    .map((listing) => listing.reviewCount)
    .filter((value): value is number => Number.isFinite(value) && value! >= 0)
    .sort((a, b) => a - b)
  if (reviews.length) {
    const middle = Math.floor(reviews.length / 2)
    const median = reviews.length % 2
      ? reviews[middle]!
      : (reviews[middle - 1]! + reviews[middle]!) / 2
    return {
      source: 'reviews',
      value: median,
      score: clamp((Math.log10(median + 1) / 4) * 100),
      label: `需求代理：评价数中位数 ${median}；评价数不等于销量`,
      sampleSize: reviews.length,
    }
  }

  return {
    source: 'missing',
    value: null,
    score: 0,
    label: '缺少月销量和评价数，无法判断需求',
    sampleSize: 0,
  }
}

const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)))
