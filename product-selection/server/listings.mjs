import { mapAmazonResults } from './amazon.mjs'
import { fetchExternal } from './external-request.mjs'
import { mapWalmartResults } from './walmart.mjs'
import { buildTikTokProductRequest, mapTikTokResults } from './tiktok.mjs'

const IMPLEMENTED_CHANNELS = ['amazon', 'walmart', 'tiktok']

export class ListingsError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function normalizeListingRequest(body) {
  const channels = [...new Set(
    (Array.isArray(body?.query?.channels) ? body.query.channels : [])
      .filter((channel) => typeof channel === 'string'),
  )]
  const unsupported = channels.filter((channel) => !IMPLEMENTED_CHANNELS.includes(channel))
  if (unsupported.length) throw new ListingsError(400, `不支持的渠道：${unsupported.join('、')}`)
  if (!channels.length) throw new ListingsError(400, '至少选择一个商品渠道')

  const terms = [...new Set(
    (Array.isArray(body?.terms) ? body.terms : [])
      .filter((term) => typeof term === 'string')
      .map((term) => term.trim())
      .filter(Boolean),
  )]
  if (!terms.length) throw new ListingsError(400, 'terms 不能为空')
  if (terms.length > 5) throw new ListingsError(400, '检索词最多 5 个')
  if (terms.some((term) => term.length > 80)) {
    throw new ListingsError(400, '单个检索词最多 80 个字符')
  }
  return { channels, terms }
}

function buildSearchParams(channel, term, apiKey) {
  const params = new URLSearchParams({ engine: channel, api_key: apiKey })
  if (channel === 'amazon') {
    params.set('amazon_domain', 'amazon.com')
    params.set('k', term)
  } else {
    params.set('query', term)
    params.set('walmart_domain', 'walmart.com')
  }
  return params
}

async function fetchChannel(channel, terms, apiKey, request, signal) {
  const rawProducts = []
  const errors = []
  for (let index = 0; index < terms.length; index += 3) {
    const batch = terms.slice(index, index + 3)
    const results = await Promise.allSettled(batch.map(async (term) => {
      if (channel === 'tiktok') {
        const tiktokRequest = buildTikTokProductRequest(term, apiKey)
        const response = await request(
          tiktokRequest.url,
          { ...tiktokRequest.options, signal },
          { service: 'TikTok Shop 商品' },
        )
        if (!response.ok) throw new Error(`TikTok Shop 请求失败：${response.status}`)
        const data = await response.json()
        if (data?.code !== 0) throw new Error(data?.message || `TikTok Shop 错误码：${data?.code}`)
        return Array.isArray(data?.data?.products) ? data.data.products : []
      }
      const params = buildSearchParams(channel, term, apiKey)
      const response = await request(
        `https://serpapi.com/search.json?${params.toString()}`,
        { signal },
        { service: `SerpApi ${channel}` },
      )
      if (!response.ok) throw new Error(`SerpApi ${channel} 请求失败：${response.status}`)
      const data = await response.json()
      if (typeof data?.error === 'string') throw new Error(data.error)
      return Array.isArray(data?.organic_results) ? data.organic_results : []
    }))
    results.forEach((result, resultIndex) => {
      if (result.status === 'fulfilled') {
        rawProducts.push(...result.value)
      } else {
        const message = result.reason instanceof Error ? result.reason.message : '未知检索词错误'
        errors.push(`${batch[resultIndex]}：${message}`)
      }
    })
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  }

  if (errors.length === terms.length) throw new Error(errors.join('；'))

  const listings = channel === 'tiktok'
    ? mapTikTokResults({ data: { products: rawProducts } })
    : (channel === 'amazon' ? mapAmazonResults : mapWalmartResults)({ organic_results: rawProducts })
  return { listings, errors }
}

export async function fetchListingsByChannel(body, options = {}) {
  const { channels, terms } = normalizeListingRequest(body)
  const apiKey = options.apiKey
  const serpChannels = channels.filter((channel) => channel !== 'tiktok')
  if (serpChannels.length && !apiKey) {
    throw new ListingsError(500, '缺少环境变量 SERPAPI_API_KEY')
  }
  const tiktokCredentials = options.tiktokCredentials
  const hasTikTokCredentials = tiktokCredentials
    && ['appKey', 'appSecret', 'accessToken', 'shopCipher']
      .every((key) => typeof tiktokCredentials[key] === 'string' && tiktokCredentials[key])
  if (channels.length === 1 && channels[0] === 'tiktok' && !hasTikTokCredentials) {
    throw new ListingsError(503, 'TikTok Shop 尚未完成 Seller 授权，请配置四项 TikTok 凭据')
  }
  const request = options.fetchExternal ?? fetchExternal
  const settled = await Promise.allSettled(
    channels.map((channel) => channel === 'tiktok' && !hasTikTokCredentials
      ? Promise.reject(new Error('TikTok Shop 尚未完成 Seller 授权'))
      : fetchChannel(
        channel, terms, channel === 'tiktok' ? tiktokCredentials : apiKey,
        request, options.signal,
      )),
  )
  if (options.signal?.aborted) {
    throw options.signal.reason ?? new DOMException('Aborted', 'AbortError')
  }

  const listings = []
  const channelResults = settled.map((result, index) => {
    const channel = channels[index]
    if (result.status === 'rejected') {
      return {
        channel,
        status: 'error',
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : '未知渠道错误',
      }
    }
    listings.push(...result.value.listings)
    const partial = result.value.errors.length > 0
    return {
      channel,
      status: partial ? 'partial' : result.value.listings.length ? 'success' : 'empty',
      count: result.value.listings.length,
      ...(partial ? { error: result.value.errors.join('；') } : {}),
    }
  })

  if (channelResults.every((result) => result.status === 'error')) {
    throw new ListingsError(502, '所有商品渠道请求均失败')
  }
  if (!listings.length) throw new ListingsError(422, '没有可用的商品结果')
  return { listings, channels: channelResults }
}
