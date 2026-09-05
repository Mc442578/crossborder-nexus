import { ExternalRequestError, fetchExternal } from './external-request.mjs'

export function buildGoogleTrendsParams(term, apiKey, now = new Date()) {
  const start = new Date(now)
  start.setUTCFullYear(start.getUTCFullYear() - 2)

  return new URLSearchParams({
    engine: 'google_trends',
    q: term,
    geo: 'US',
    date: `${start.toISOString().slice(0, 10)} ${now.toISOString().slice(0, 10)}`,
    data_type: 'TIMESERIES',
    api_key: apiKey,
  })
}

export async function fetchGoogleTrendsResponse(term, apiKey, options = {}) {
  const params = buildGoogleTrendsParams(term, apiKey)
  const request = options.fetchExternal ?? fetchExternal
  const url = 'https://serpapi.com/search.json?' + params.toString()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await request(
        url,
        { signal: options.signal },
        { service: 'SerpApi 趋势', timeoutMs: 15_000 },
      )
    } catch (error) {
      const retryable = error instanceof ExternalRequestError
        && (error.status === 502 || error.status === 504)
      if (!retryable || attempt === 1) throw error
    }
  }
}

export function mapGoogleTrendsResults(data) {
  const timeline = data?.interest_over_time?.timeline_data
  if (!Array.isArray(timeline)) return []

  const months = new Map()
  for (const item of timeline) {
    const timestamp = Number(item?.timestamp)
    const value = item?.values?.[0]?.extracted_value
    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) continue

    const date = new Date(timestamp * 1000)
    if (Number.isNaN(date.getTime())) continue

    const period = date.toISOString().slice(0, 7)
    const values = months.get(period) ?? []
    values.push(value)
    months.set(period, values)
  }

  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, values]) => ({
      period,
      value: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
    }))
}
