import type { DataSource, SearchHit } from './types'
import type {
  CategoryQuery, CompetitorListing, ListingsFetchResult, ReviewFetchResult, TrendPoint,
} from '@/types/domain'

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`${path} 请求失败: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

/**
 * 真实数据源 —— 全部经 BFF 中转，前端不碰任何 key。
 *
 * 下面五个方法对应 server/index.mjs 的五个业务路由，
 * 前后端各补一半就能跑通真实链路。
 */
export class LiveDataSource implements DataSource {
  readonly name = 'live'

  searchWeb(query: string, opts?: { signal?: AbortSignal }) {
    // TODO: BFF 侧接 Tavily /search
    return post<SearchHit[]>('/search', { query }, opts?.signal)
  }

  fetchListings(q: CategoryQuery, terms: string[], opts?: { signal?: AbortSignal }) {
    // TODO: BFF 侧接 SerpApi engine=amazon / walmart，注意分页与限流
    return post<ListingsFetchResult>('/listings', { query: q, terms }, opts?.signal)
  }

  fetchTrend(term: string, opts?: { signal?: AbortSignal }) {
    // TODO: BFF 侧接 SerpApi engine=google_trends
    return post<TrendPoint[]>('/trend', { term }, opts?.signal)
  }

  fetchReviews(listings: CompetitorListing[], opts?: { signal?: AbortSignal }) {
    return post<ReviewFetchResult>('/reviews', { listings }, opts?.signal)
  }

  profileCategory(q: CategoryQuery, hits: SearchHit[], opts?: { signal?: AbortSignal }) {
    // TODO: BFF 侧调 LLM 把 hits 抽成 CategoryProfile
    return post<Awaited<ReturnType<DataSource['profileCategory']>>>(
      '/profile', { query: q, hits }, opts?.signal,
    )
  }
}
