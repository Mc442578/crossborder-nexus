import type { CompetitorListing, PriceBand } from '@/types/domain'

export function buildQuantilePriceBands(listings: CompetitorListing[]): PriceBand[] {
  const prices = listings
    .map((listing) => listing.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b)
  if (!prices.length) return []
  if (prices.length < 3) return [toBand(prices)]

  return Array.from({ length: 3 }, (_, index) => {
    const start = Math.floor((index * prices.length) / 3)
    const end = Math.floor(((index + 1) * prices.length) / 3)
    return prices.slice(start, end)
  }).filter((group) => group.length).map(toBand)
}

function toBand(prices: number[]): PriceBand {
  return {
    min: money(prices[0]!),
    max: money(prices[prices.length - 1]!),
    count: prices.length,
  }
}

const money = (value: number) => Math.round(value * 100) / 100
