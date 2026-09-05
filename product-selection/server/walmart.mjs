/**
 * 学习者练习：把 SerpApi Walmart organic_results 映射为统一 CompetitorListing。
 * 核心边界：只接受非空标题和正数价格；seller_name 不是 brand；只在 Walmart 内去重。
 */
export function mapWalmartResults(data) {
  const products = Array.isArray(data?.organic_results)
    ? data.organic_results
    : []
  const seenIds = new Set()
  const seenTitles = new Set()

  return products
    .filter((product) => {
      const title = product.title?.trim()
      const price = product.primary_offer?.offer_price
      return title && Number.isFinite(price) && price > 0
    })
    .map((product) => {
      const title = product.title.trim()
      const titleKey = title.toLowerCase().replace(/\s+/g, ' ')
      const sourceId = product.product_id ?? product.us_item_id ?? `title:${titleKey}`
      const reviewProductId = typeof product.us_item_id === 'string'
        && /^\d+$/.test(product.us_item_id)
        ? product.us_item_id
        : undefined
      return {
        id: `walmart:${sourceId}`,
        title,
        channel: 'walmart',
        price: product.primary_offer.offer_price,
        currency: product.primary_offer.currency || 'USD',
        reviewCount: product.reviews,
        rating: product.rating,
        ...(reviewProductId ? { reviewProductId } : {}),
        url: product.product_page_url,
      }
    })
    .filter((listing) => {
      const titleKey = listing.title.toLowerCase().replace(/\s+/g, ' ')
      if (seenIds.has(listing.id) || seenTitles.has(titleKey)) return false
      seenIds.add(listing.id)
      seenTitles.add(titleKey)
      return true
    })
}
