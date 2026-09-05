import { fetchExternal } from './external-request.mjs'

export async function searchWebEvidence(query, options = {}) {
  const term = typeof query === 'string' ? query.trim().replace(/\s+/g, ' ') : ''
  if (!term) throw Object.assign(new Error('query 不能为空'), { status: 400 })
  if (!options.apiKey) throw Object.assign(new Error('缺少环境变量 TAVILY_API_KEY'), { status: 500 })
  const request = options.fetchExternal ?? fetchExternal
  const response = await request('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ query: term, max_results: 8, search_depth: 'advanced' }),
    signal: options.signal,
  }, { service: 'Tavily' })
  if (!response.ok) throw Object.assign(new Error(`Tavily 请求失败：${response.status}`), { status: response.status })
  return response.json()
}
