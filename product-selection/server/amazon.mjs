function normalizeTitle(title) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}
function parsePrice(item) {
  if (Number.isFinite(item?.extracted_price) && item.extracted_price > 0) {
    return item.extracted_price
  }

  if (typeof item?.price !== 'string') return null
  const match = item.price.match(/\d[\d,]*(?:\.\d+)?/)
  if (!match) return null

  const price = Number(match[0].replaceAll(',', ''))
  return Number.isFinite(price) && price > 0 ? price : null
}

export function mapAmazonResults(data) {
  if (!Array.isArray(data?.organic_results)) return []

  const listings = []
  const seenAsins = new Set()
  const seenTitles = new Set()

  for (const item of data.organic_results) {
    const title = typeof item?.title === 'string' ? item.title.trim() : ''
    const asin = typeof item?.asin === 'string' ? item.asin.trim() : ''
    const price = parsePrice(item)
    if (!title || price === null) continue

    const asinKey = asin.toLowerCase()
    const titleKey = normalizeTitle(title)
    if ((asinKey && seenAsins.has(asinKey)) || seenTitles.has(titleKey)) continue

    if (asinKey) seenAsins.add(asinKey)
    seenTitles.add(titleKey)

    const listing = {
      id: asin ? `amazon:${asin}` : `amazon:title:${titleKey}`,
      title,
      channel: 'amazon',
      price,
      currency: 'USD',
    }

    if (typeof item.brand === 'string' && item.brand.trim()) listing.brand = item.brand.trim()
    if (Number.isFinite(item.rating)) listing.rating = item.rating
    if (Number.isFinite(item.reviews)) listing.reviewCount = item.reviews
    if (typeof (item.link_clean || item.link) === 'string') listing.url = item.link_clean || item.link

    listings.push(listing)
  }

  return listings
}
