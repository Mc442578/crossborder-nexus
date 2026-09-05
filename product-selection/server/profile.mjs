export class ProfileError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function createCategoryProfile(body) {
  const query = body?.query
  const keyword = typeof query?.keyword === 'string'
    ? query.keyword.trim().replace(/\s+/g, ' ')
    : ''
  if (!keyword) throw new ProfileError(400, 'keyword 不能为空')
  if (!/[A-Za-z]/.test(keyword)) {
    throw new ProfileError(400, '第一版请输入英文品类关键词')
  }
  if (query.market !== 'US') throw new ProfileError(400, '第一版仅支持 US 市场')
  const hits = Array.isArray(body.hits)
    ? body.hits.filter((hit) => (
      typeof hit?.title === 'string'
      && typeof hit?.url === 'string'
      && /^https?:\/\//.test(hit.url)
    ))
    : []

  if (!hits.length) throw new ProfileError(422, '没有可用的真实搜索来源')

  return {
    profile: {
      name: keyword,
      searchTerms: [keyword, `${keyword} outfit`, `${keyword} plus size`],
      relatedTerms: [`vintage ${keyword}`, `oversized ${keyword}`, `plus size ${keyword}`],
      summary: `${keyword}：已整理 ${hits.length} 条 ${query.market} 市场公开来源，供后续商品、趋势和评分环节使用。`,
      audiences: [],
      purchaseDrivers: [],
      validationQuestions: [
        '哪些商品属性在真实评论中最影响购买和退货？',
        '不同渠道的目标人群和可接受价格是否一致？',
      ],
    },
    citations: hits.slice(0, 3).map((hit) => ({
      label: hit.title,
      url: hit.url,
      source: 'discover',
    })),
  }
}
