import type {
  CategoryProfile, CategoryQuery, Citation, CompetitorListing, ListingsFetchResult,
  ProfileGeneration, ReviewFetchResult, TrendPoint,
} from '@/types/domain'

export interface SearchHit {
  title: string
  url: string
  snippet: string
}

/**
 * 数据源统一接口。
 *
 * Pipeline 只认这个接口，不认 Tavily / SerpApi / LLM。
 * 练习者要做的就是把 mock.ts 里的实现逐个换成真的，UI 一行都不用动。
 */
export interface DataSource {
  readonly name: string

  /** 联网搜品类背景，对应 Tavily */
  searchWeb(query: string, opts?: { signal?: AbortSignal }): Promise<SearchHit[]>

  /** 拉渠道商品，对应 SerpApi 的 Amazon / Walmart 引擎 */
  fetchListings(
    q: CategoryQuery,
    terms: string[],
    opts?: { signal?: AbortSignal },
  ): Promise<ListingsFetchResult>

  /** 拉趋势序列，Google Trends 或搜索热度替代指标 */
  fetchTrend(term: string, opts?: { signal?: AbortSignal }): Promise<TrendPoint[]>

  /** 拉少量真实商品评论；当前 live 支持 Amazon/Walmart。 */
  fetchReviews(
    listings: CompetitorListing[],
    opts?: { signal?: AbortSignal },
  ): Promise<ReviewFetchResult>

  /**
   * 把非结构化文本收敛成结构化品类画像。
   * 这是唯一需要"智能"的地方 —— 接 LLM 或规则引擎都行。
   */
  profileCategory(
    q: CategoryQuery,
    hits: SearchHit[],
    opts?: { signal?: AbortSignal },
  ): Promise<{
    profile: CategoryProfile
    citations: Citation[]
    generation?: ProfileGeneration
  }>
}
