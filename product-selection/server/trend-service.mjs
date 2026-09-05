import { fetchGoogleTrendsResponse, mapGoogleTrendsResults } from './trend.mjs'

export async function fetchTrendPoints(term, options = {}) {
  const keyword = typeof term === 'string' ? term.trim() : ''
  if (!keyword) throw Object.assign(new Error('term 不能为空'), { status: 400 })
  if (!options.apiKey) throw Object.assign(new Error('缺少环境变量 SERPAPI_API_KEY'), { status: 500 })
  const response = await fetchGoogleTrendsResponse(keyword, options.apiKey, {
    signal: options.signal,
    fetchExternal: options.fetchExternal,
  })
  if (!response.ok) throw Object.assign(
    new Error(`SerpApi 趋势请求失败：${response.status}`), { status: response.status },
  )
  const data = await response.json()
  if (typeof data?.error === 'string') throw Object.assign(
    new Error(`SerpApi 趋势请求失败：${data.error}`), { status: 502 },
  )
  const series = mapGoogleTrendsResults(data)
  if (!series.length) throw Object.assign(new Error('没有可用的 Google Trends 数据'), { status: 422 })
  return series
}
