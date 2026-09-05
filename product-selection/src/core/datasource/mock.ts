import type { DataSource, SearchHit } from './types'
import type {
  CategoryQuery, CompetitorListing, ImplementedChannel, ListingsFetchResult, TrendPoint,
} from '@/types/domain'

/** 让 mock 有点"在干活"的手感，同时给 UI 一个真实的 loading 时长 */
function nap(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new Error('aborted'))
    }, { once: true })
  })
}

/** 用关键字做种子，保证同一个词每次跑出来的假数据一致，方便调 UI */
function seeded(input: string) {
  let h = 2166136261
  for (const ch of input) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const BRANDS = ['Levi\'s', 'Wrangler', 'Uniqlo', 'SHEIN', 'Zara', 'Nobrand', 'Gap', 'H&M']

export class MockDataSource implements DataSource {
  readonly name = 'mock'

  async searchWeb(query: string, opts?: { signal?: AbortSignal }): Promise<SearchHit[]> {
    await nap(600, opts?.signal)
    return Array.from({ length: 5 }, (_, i) => ({
      title: `${query} market overview #${i + 1}`,
      url: `https://example.com/report/${encodeURIComponent(query)}/${i + 1}`,
      snippet: `关于「${query}」的市场概述占位文本，真实实现请接 Tavily。`,
    }))
  }

  async fetchListings(
    q: CategoryQuery, terms: string[], opts?: { signal?: AbortSignal },
  ): Promise<ListingsFetchResult> {
    await nap(900, opts?.signal)
    const rand = seeded(q.keyword + terms.join())
    const selected = q.channels.filter((channel): channel is ImplementedChannel =>
      channel === 'amazon' || channel === 'walmart' || channel === 'tiktok')
    const channels: ImplementedChannel[] = selected.length ? selected : ['amazon']
    const listings: CompetitorListing[] = Array.from({ length: 24 }, (_, i) => {
      const price = Math.round((18 + rand() * 90) * 100) / 100
      const channel = channels[i % channels.length]!
      const sequence = String(i + 1).padStart(7, '0')
      return {
        id: channel === 'amazon'
          ? `amazon:B0M${sequence}`
          : channel === 'walmart' ? `walmart:MOCK${i + 1}` : `tiktok:mock-${i + 1}`,
        title: `${terms[0] ?? q.keyword} - style ${i + 1}`,
        channel,
        ...(channel === 'walmart' ? { reviewProductId: `9000000${sequence}` } : {}),
        brand: BRANDS[Math.floor(rand() * BRANDS.length)],
        price,
        currency: 'USD',
        rating: Math.round((3.2 + rand() * 1.8) * 10) / 10,
        reviewCount: Math.floor(rand() * 4000),
        monthlySales: Math.floor(rand() * 2500),
        url: `https://example.com/item/${i}`,
      }
    })
    return {
      listings,
      channels: channels.map((channel) => ({
        channel,
        status: 'success',
        count: listings.filter((listing) => listing.channel === channel).length,
      })),
    }
  }

  async fetchTrend(term: string, opts?: { signal?: AbortSignal }): Promise<TrendPoint[]> {
    await nap(700, opts?.signal)
    const rand = seeded(term)
    const drift = rand() * 2 - 0.8
    return Array.from({ length: 24 }, (_, i) => {
      const season = Math.sin(((i % 12) / 12) * Math.PI * 2) * 12
      const value = 50 + drift * i + season + (rand() * 8 - 4)
      const d = new Date(Date.UTC(2024, i, 1))
      return {
        period: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        value: Math.max(1, Math.round(value)),
      }
    })
  }

  async fetchReviews(
    listings: CompetitorListing[], opts?: { signal?: AbortSignal },
  ) {
    await nap(500, opts?.signal)
    const fetchedAt = new Date().toISOString()
    const supported = listings.filter((listing) => listing.channel !== 'tiktok').slice(0, 2)
    const reviews = supported.map((listing, index) => ({
      id: `${listing.id}:review:1`,
      channel: listing.channel,
      productId: listing.id.split(':').slice(1).join(':'),
      productTitle: listing.title,
      title: index ? 'Fabric is too thin' : 'Runs small',
      text: index
        ? 'The material feels thin and the stitching came loose.'
        : 'The size runs small and the waist is too tight.',
      rating: 2,
      verifiedPurchase: true,
      url: listing.url,
      fetchedAt,
    }))
    return {
      reviews,
      channels: listings.map((listing) => ({
        channel: listing.channel,
        status: listing.channel === 'tiktok' ? 'unsupported' as const : 'success' as const,
        count: listing.channel === 'tiktok' ? 0 : 1,
        ...(listing.channel === 'tiktok'
          ? { error: 'TikTok 没有适合竞品消费者评论的开放接口' }
          : {}),
      })),
    }
  }

  async profileCategory(q: CategoryQuery, hits: SearchHit[], opts?: { signal?: AbortSignal }) {
    await nap(500, opts?.signal)
    return {
      profile: {
        name: q.keyword,
        searchTerms: [q.keyword, `${q.keyword} women`, `${q.keyword} men`],
        relatedTerms: ['vintage', 'oversized', 'plus size'],
        summary: `「${q.keyword}」在 ${q.market} 市场的占位画像。真实实现请把搜索结果交给 LLM 做结构化抽取。`,
        audiences: [{
          text: '关注服装风格与舒适度的美国消费者',
          citations: hits.slice(0, 1).map((h) => ({ label: h.title, url: h.url, source: 'discover' })),
        }],
        purchaseDrivers: ['版型', '面料', '尺码选择'].map((text) => ({
          text,
          citations: hits.slice(0, 1).map((h) => ({ label: h.title, url: h.url, source: 'discover' })),
        })),
        validationQuestions: ['真实评论中最常见的尺码和面料问题是什么？'],
      },
      citations: hits.slice(0, 3).map((h) => ({
        label: h.title, url: h.url, source: 'discover',
      })),
      generation: { mode: 'deterministic', degraded: false } as const,
    }
  }
}
