import { fetchExternal } from './external-request.mjs'

export class ReviewsError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function normalizeReviewRequest(body) {
  if (!Array.isArray(body?.listings) || !body.listings.length) {
    throw new ReviewsError(400, '至少需要一个商品才能查询评论')
  }
  if (body.listings.length > 3) throw new ReviewsError(400, '每个渠道最多查询一个代表商品')

  const seenChannels = new Set()
  return body.listings.map((listing) => {
    const channel = listing?.channel
    if (!['amazon', 'walmart', 'tiktok'].includes(channel)) {
      throw new ReviewsError(400, `不支持的评论渠道：${channel ?? 'unknown'}`)
    }
    if (seenChannels.has(channel)) throw new ReviewsError(400, `渠道重复：${channel}`)
    seenChannels.add(channel)
    const productId = channel === 'walmart'
      ? normalizeWalmartReviewId(listing?.reviewProductId)
      : extractProductId(listing?.id, channel)
    const productTitle = typeof listing?.title === 'string' ? listing.title.trim() : ''
    if (!productId || !productTitle) throw new ReviewsError(400, `${channel} 商品标识无效`)
    const url = typeof listing?.url === 'string' && /^https?:\/\//.test(listing.url)
      ? listing.url
      : undefined
    return { channel, productId, productTitle: productTitle.slice(0, 200), url }
  })
}

export async function fetchReviewsForListings(body, options = {}) {
  const products = normalizeReviewRequest(body)
  if (products.some((product) => product.channel !== 'tiktok') && !options.apiKey) {
    throw new ReviewsError(500, '缺少环境变量 SERPAPI_API_KEY')
  }
  const request = options.fetchExternal ?? fetchExternal
  const fetchedAt = new Date(options.now?.() ?? Date.now()).toISOString()
  const settled = await Promise.allSettled(products.map(async (product) => {
    if (product.channel === 'tiktok') {
      return { product, status: 'unsupported', reviews: [] }
    }
    const params = new URLSearchParams({ api_key: options.apiKey })
    if (product.channel === 'amazon') {
      params.set('engine', 'amazon_product')
      params.set('asin', product.productId)
      params.set('amazon_domain', 'amazon.com')
    } else {
      params.set('engine', 'walmart_product_reviews')
      params.set('product_id', product.productId)
      params.set('sort', 'helpful')
    }
    const response = await request(
      `https://serpapi.com/search.json?${params}`,
      { signal: options.signal },
      { service: `SerpApi ${product.channel} 评论` },
    )
    if (!response.ok) throw new Error(`SerpApi ${product.channel} 评论请求失败：${response.status}`)
    const data = await response.json()
    if (typeof data?.error === 'string') throw new Error(data.error)
    const reviews = product.channel === 'amazon'
      ? mapAmazonReviews(data, product, fetchedAt)
      : mapWalmartReviews(data, product, fetchedAt)
    return { product, status: reviews.length ? 'success' : 'empty', reviews }
  }))

  if (options.signal?.aborted) {
    throw options.signal.reason ?? new DOMException('Aborted', 'AbortError')
  }

  const reviews = []
  const channels = settled.map((result, index) => {
    const channel = products[index].channel
    if (result.status === 'rejected') {
      return {
        channel, status: 'error', count: 0,
        error: result.reason instanceof Error ? result.reason.message : '评论请求失败',
      }
    }
    reviews.push(...result.value.reviews)
    return {
      channel,
      status: result.value.status,
      count: result.value.reviews.length,
      ...(result.value.status === 'unsupported'
        ? { error: 'TikTok 竞品消费者评论本阶段不接入' }
        : {}),
    }
  })
  return { reviews: reviews.slice(0, 20), channels }
}

export function mapAmazonReviews(data, product, fetchedAt) {
  const items = Array.isArray(data?.reviews_information?.authors_reviews)
    ? data.reviews_information.authors_reviews
    : []
  return mapReviewItems(items, product, fetchedAt, (item) => ({
    title: item?.title,
    text: item?.text,
    rating: item?.rating,
    date: item?.date,
    verifiedPurchase: item?.verified_purchase,
  }))
}

export function mapWalmartReviews(data, product, fetchedAt) {
  const items = Array.isArray(data?.reviews) ? data.reviews : []
  return mapReviewItems(items, product, fetchedAt, (item) => ({
    title: item?.title,
    text: item?.text,
    rating: item?.rating,
    date: item?.review_submission_time,
    verifiedPurchase: Array.isArray(item?.customer_type)
      ? item.customer_type.includes('VerifiedPurchaser')
      : undefined,
  }))
}

function mapReviewItems(items, product, fetchedAt, pick) {
  const seen = new Set()
  return items.flatMap((item, index) => {
    const raw = pick(item)
    const text = typeof raw.text === 'string' ? raw.text.trim() : ''
    const rating = Number(raw.rating)
    const key = text.replace(/\s+/g, ' ').toLowerCase()
    if (!text || !Number.isFinite(rating) || rating < 1 || rating > 5 || seen.has(key)) return []
    seen.add(key)
    const title = typeof raw.title === 'string' ? raw.title.trim() : ''
    const date = typeof raw.date === 'string' ? raw.date.trim() : ''
    return [{
      id: `${product.channel}:${product.productId}:review:${index + 1}`,
      channel: product.channel,
      productId: product.productId,
      productTitle: product.productTitle,
      ...(title ? { title } : {}),
      text: text.slice(0, 300),
      rating,
      ...(date ? { date } : {}),
      ...(typeof raw.verifiedPurchase === 'boolean'
        ? { verifiedPurchase: raw.verifiedPurchase }
        : {}),
      ...(product.url ? { url: product.url } : {}),
      fetchedAt,
    }]
  }).slice(0, 10)
}

function extractProductId(value, channel) {
  if (typeof value !== 'string') return ''
  const prefix = `${channel}:`
  if (!value.startsWith(prefix)) return ''
  const id = value.slice(prefix.length).trim()
  if (channel === 'amazon' && !/^[A-Z0-9]{10}$/i.test(id)) return ''
  return id
}

function normalizeWalmartReviewId(value) {
  return typeof value === 'string' && /^\d+$/.test(value) ? value : ''
}
