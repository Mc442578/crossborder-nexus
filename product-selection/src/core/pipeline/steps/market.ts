import type { PipelineStep } from '../types'
import type { CompetitorListing } from '@/types/domain'
import { buildQuantilePriceBands } from '../../analysis/price-bands.ts'

/** 环节二：谁在卖、卖多少钱 */
export const marketStep: PipelineStep = {
  id: 'market',
  title: '查市场竞争',
  description: '拉取各渠道在售商品，算价格带与头部集中度',
  dependsOn: ['discover'],

  async run(ctx, rt) {
    const terms = ctx.profile?.searchTerms ?? [ctx.query.keyword]

    rt.report('拉取渠道商品…', 0.3)
    const { listings, channels } = await rt.ds.fetchListings(
      ctx.query, terms, { signal: rt.signal },
    )

    rt.report('计算价格带与集中度…', 0.8)
    ctx.market = {
      listings,
      channelCoverage: channels,
      priceBands: buildQuantilePriceBands(listings),
      concentration: computeConcentration(listings),
      brandCount: new Set(listings.map((l) => l.brand).filter(Boolean)).size,
    }
    rt.report(`共 ${listings.length} 个在售 listing`, 1)
  },
}

/** 缺少销量时，以各品牌的 listing 数近似观察头部集中度 */
function computeConcentration(listings: CompetitorListing[]): number {
  const byBrand = new Map<string, number>()
  for (const l of listings) {
    const key = l.brand?.trim() || `unknown:${l.id}`
    byBrand.set(key, (byBrand.get(key) ?? 0) + (l.monthlySales ?? 1))
  }
  const sorted = [...byBrand.values()].sort((a, b) => b - a)
  const total = sorted.reduce((a, b) => a + b, 0)
  if (!total) return 0
  return sorted.slice(0, 4).reduce((a, b) => a + b, 0) / total
}
