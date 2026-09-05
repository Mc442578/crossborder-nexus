import { mapSearchResults } from './tavily.mjs'
import { searchWebEvidence } from './search-service.mjs'
import { createProfileResponse } from './profile-service.mjs'
import { fetchListingsByChannel } from './listings.mjs'
import { fetchTrendPoints } from './trend-service.mjs'
import { fetchReviewsForListings } from './reviews.mjs'
import { stableCacheKey } from './ttl-cache.mjs'

const MINUTE = 60_000

export class ServerDataSource {
  constructor(options) {
    this.name = 'server-live'
    this.cache = options.cache
    this.keys = options.keys
    this.tiktokCredentials = options.tiktokCredentials
    this.onCache = options.onCache ?? (() => {})
    this.services = {
      searchWebEvidence, createProfileResponse, fetchListingsByChannel,
      fetchTrendPoints, fetchReviewsForListings,
      ...options.services,
    }
    this.credentialScope = stableCacheKey('tiktok-scope:v1', {
      appKey: this.tiktokCredentials?.appKey ?? '',
      shopCipher: this.tiktokCredentials?.shopCipher ?? '',
    })
  }

  async searchWeb(query, opts = {}) {
    return this.cached('公开网页', stableCacheKey('search:v1', normalizeText(query)), 30 * MINUTE,
      () => this.services.searchWebEvidence(
        query, { apiKey: this.keys.tavily, signal: opts.signal },
      ).then(mapSearchResults),
      (results) => results.length > 0)
  }

  async profileCategory(query, hits, opts = {}) {
    const profileQuery = { keyword: query.keyword, market: query.market }
    return this.cached('DeepSeek 品类画像', stableCacheKey('profile:v3', {
      keyword: normalizeText(profileQuery.keyword), market: profileQuery.market, hits,
    }), 12 * 60 * MINUTE,
      () => this.services.createProfileResponse(
        { query: profileQuery, hits }, { apiKey: this.keys.deepseek, signal: opts.signal },
      ),
      (result) => result.generation?.mode === 'deepseek' && result.generation.degraded === false)
  }

  async fetchListings(query, terms, opts = {}) {
    return this.cached('渠道商品', stableCacheKey('listings:v3', {
      market: query.market, channels: query.channels, terms, credentialScope: this.credentialScope,
    }), 15 * MINUTE,
      () => this.services.fetchListingsByChannel({ query, terms }, {
        apiKey: this.keys.serpapi,
        tiktokCredentials: this.tiktokCredentials,
        signal: opts.signal,
      }),
      (result) => result.channels.every((channel) => channel.status === 'success'))
  }

  async fetchTrend(term, opts = {}) {
    return this.cached('Google Trends', stableCacheKey('trend:v1', {
      term: normalizeText(term), day: new Date().toISOString().slice(0, 10),
    }), 6 * 60 * MINUTE,
    () => this.services.fetchTrendPoints(
      term, { apiKey: this.keys.serpapi, signal: opts.signal },
    ))
  }

  async fetchReviews(listings, opts = {}) {
    return this.cached('商品评论', stableCacheKey('reviews:v2', listings.map((item) => ({
      channel: item.channel, id: item.id, reviewProductId: item.reviewProductId,
      title: item.title, url: item.url,
    }))), 30 * MINUTE,
    () => this.services.fetchReviewsForListings(
      { listings }, { apiKey: this.keys.serpapi, signal: opts.signal },
    ),
    (result) => result.channels.every(
      (channel) => channel.status === 'success' || channel.status === 'unsupported',
    ))
  }

  async cached(label, key, ttlMs, loader, shouldCache) {
    const result = await this.cache.getOrLoad(key, loader, { ttlMs, shouldCache })
    this.onCache({ label, status: result.cache, stored: result.stored })
    return result.value
  }
}

function normalizeText(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase()
}
