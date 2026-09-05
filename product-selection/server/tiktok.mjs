import { createHmac } from 'node:crypto'

const SEARCH_PATH = '/affiliate_seller/202405/open_collaborations/products/search'

export function generateTikTokSignature(path, params, bodyText, appSecret) {
  const paramString = Object.keys(params)
    .filter((key) => key !== 'sign' && key !== 'access_token')
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('')
  const message = `${appSecret}${path}${paramString}${bodyText}${appSecret}`
  return createHmac('sha256', appSecret).update(message).digest('hex')
}

export function buildTikTokProductRequest(term, credentials, now = Date.now()) {
  const bodyText = JSON.stringify({ title_keywords: [term] })
  const params = {
    app_key: credentials.appKey,
    page_size: '20',
    shop_cipher: credentials.shopCipher,
    sort_field: 'units_sold',
    sort_order: 'DESC',
    timestamp: String(Math.floor(now / 1000)),
  }
  params.sign = generateTikTokSignature(
    SEARCH_PATH, params, bodyText, credentials.appSecret,
  )
  return {
    url: `https://open-api.tiktokglobalshop.com${SEARCH_PATH}?${new URLSearchParams(params)}`,
    options: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tts-access-token': credentials.accessToken,
      },
      body: bodyText,
    },
  }
}

export function mapTikTokResults(data) {
  const products = Array.isArray(data?.data?.products) ? data.data.products : []
  const seenIds = new Set()
  const seenTitles = new Set()

  return products.flatMap((product) => {
    const title = typeof product?.title === 'string' ? product.title.trim() : ''
    const saleRegion = typeof product?.sale_region === 'string'
      ? product.sale_region.toUpperCase()
      : ''
    const currency = product?.sales_price?.currency
      ?? product?.original_price?.currency
      ?? 'USD'
    const price = Number(
      product?.sales_price?.minimum_amount
      ?? product?.original_price?.minimum_amount,
    )
    if (!title || !Number.isFinite(price) || price <= 0
      || (saleRegion && saleRegion !== 'US') || currency !== 'USD') return []

    const idPart = String(product?.id ?? '').trim()
    const normalizedTitle = title.replace(/\s+/g, ' ').toLowerCase()
    if ((idPart && seenIds.has(idPart)) || seenTitles.has(normalizedTitle)) return []
    if (idPart) seenIds.add(idPart)
    seenTitles.add(normalizedTitle)

    const lifetimeSales = Number(product?.units_sold)
    const affiliateCommissionBasisPoints = Number(
      product?.commission?.rate ?? product?.commission_rate,
    )
    return [{
      id: `tiktok:${idPart || normalizedTitle}`,
      title,
      channel: 'tiktok',
      price,
      currency,
      ...(Number.isFinite(lifetimeSales) && lifetimeSales >= 0 ? { lifetimeSales } : {}),
      ...(Number.isFinite(affiliateCommissionBasisPoints)
        && affiliateCommissionBasisPoints >= 0
        && affiliateCommissionBasisPoints <= 10_000
        ? { affiliateCommissionRate: affiliateCommissionBasisPoints / 10_000 }
        : {}),
      url: product?.detail_link,
    }]
  })
}
