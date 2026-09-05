import type { CompetitorListing } from '@/types/domain'
import type { PipelineStep } from '../types'
import { classifyReviewPainPoints } from '../../analysis/review-pain-points.ts'

export const reviewsStep: PipelineStep = {
  id: 'reviews',
  title: '看真实评论',
  description: '抽取少量真实评论，归类消费者痛点并保留来源',
  dependsOn: ['market'],

  async run(ctx, rt) {
    if (!ctx.market) throw new Error('缺少市场商品，无法查询评论')
    const candidates = selectReviewCandidates(ctx.market.listings)
    if (!candidates.length) {
      ctx.reviews = emptyReviewSnapshot(
        ctx.query.channels, '没有带平台商品 ID 的评论候选商品',
      )
      rt.report('没有可查询评论的代表商品', 1)
      return
    }

    rt.report('拉取代表商品的真实评论…', 0.35)
    let result
    try {
      result = await rt.ds.fetchReviews(candidates, { signal: rt.signal })
    } catch (error) {
      if (rt.signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
      ctx.reviews = emptyReviewSnapshot(
        ctx.query.channels,
        error instanceof Error ? error.message : '评论请求失败',
      )
      rt.report('评论请求失败，已在报告中标注', 1)
      return
    }
    const channels = [...result.channels]
    if (ctx.query.channels.includes('tiktok')
      && !channels.some((item) => item.channel === 'tiktok')) {
      channels.push({
        channel: 'tiktok',
        status: 'unsupported',
        count: 0,
        error: 'TikTok 竞品消费者评论本阶段不接入',
      })
    }
    rt.report('按低评分证据归类消费者痛点…', 0.8)
    ctx.reviews = {
      ...result,
      channels,
      painPoints: classifyReviewPainPoints(result.reviews),
      analyzedAt: new Date().toISOString(),
    }
    rt.report(`取得 ${result.reviews.length} 条真实评论`, 1)
  },
}

function emptyReviewSnapshot(channels: CompetitorListing['channel'][], error: string) {
  return {
    reviews: [],
    channels: channels.map((channel) => ({
      channel,
      status: channel === 'tiktok' ? 'unsupported' as const : 'error' as const,
      count: 0,
      error: channel === 'tiktok' ? 'TikTok 竞品消费者评论本阶段不接入' : error,
    })),
    painPoints: [],
    analyzedAt: new Date().toISOString(),
  }
}

export function selectReviewCandidates(listings: CompetitorListing[]): CompetitorListing[] {
  return ['amazon', 'walmart', 'tiktok'].flatMap((channel) => {
    const candidate = listings
      .filter((listing) => listing.channel === channel && hasUsableProductId(listing))
      .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))[0]
    return candidate ? [candidate] : []
  })
}

function hasUsableProductId(listing: CompetitorListing) {
  if (listing.channel === 'amazon') return /^amazon:[A-Z0-9]{10}$/i.test(listing.id)
  if (listing.channel === 'walmart') return /^\d+$/.test(listing.reviewProductId ?? '')
  return listing.id.startsWith('tiktok:')
}
