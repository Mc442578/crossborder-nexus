/**
 * 领域模型 —— 全工程唯一的"事实定义"。
 * 数据源、Pipeline、UI 都只依赖这里，任何一方替换都不影响另外两方。
 */

/** 一次调研的输入：用户嘴里说的"一个潜在品类" */
export interface CategoryQuery {
  /** 原始输入，如 "美式复古水洗牛仔外套" */
  keyword: string
  /** 目标市场 */
  market: Market
  /** 关注的渠道 */
  channels: Channel[]
  costs?: CostInputs
}

export interface CostInputs {
  purchaseCost: number
  firstMileCost: number
  /** 兼容早期固定费率调用；正式报告按渠道和售价自动选择费率。 */
  platformFeeRate?: number
  advertisingRate: number
}

export interface UnitEconomics {
  sellingPrice: number
  purchaseCost: number
  firstMileCost: number
  platformFee: number
  advertisingCost: number
  unitProfit: number
  marginRate: number
}

export interface DemandSignal {
  source: 'sales' | 'reviews' | 'missing'
  value: number | null
  score: number
  label: string
  sampleSize: number
}

export interface ConfidenceSummary {
  score: number
  level: 'high' | 'medium' | 'low'
  sampleSize: number
  sourceCount: number
  analyzedAt: string
  missing: string[]
}

export type Market = 'US'
export type Channel = 'amazon' | 'walmart' | 'tiktok'
export type ImplementedChannel = Channel

export interface ChannelFetchStatus {
  channel: ImplementedChannel
  status: 'success' | 'partial' | 'empty' | 'error'
  count: number
  error?: string
}

export interface ChannelUnitEconomics extends UnitEconomics {
  channel: Channel
  currency: string
  platformFeeRate: number
  /** TikTok Affiliate 商品按 API 返回费率计算；其他渠道不使用。 */
  affiliateCommissionRate?: number
  affiliateCommission?: number
  affiliateCommissionSampleSize?: number
  platformFeeMinimumApplied?: boolean
  sampleSize: number
}

export interface ListingsFetchResult {
  listings: CompetitorListing[]
  channels: ChannelFetchStatus[]
}

export interface CustomerReview {
  id: string
  channel: Channel
  productId: string
  productTitle: string
  title?: string
  text: string
  rating: number
  date?: string
  verifiedPurchase?: boolean
  url?: string
  fetchedAt: string
}

export interface ReviewChannelStatus {
  channel: Channel
  status: 'success' | 'empty' | 'error' | 'unsupported'
  count: number
  error?: string
}

export interface ReviewFetchResult {
  reviews: CustomerReview[]
  channels: ReviewChannelStatus[]
}

export interface ReviewPainPoint {
  key: 'size_fit' | 'material' | 'workmanship' | 'comfort' | 'appearance'
  label: string
  reviewCount: number
  evidenceIds: string[]
}

export interface ReviewSnapshot extends ReviewFetchResult {
  painPoints: ReviewPainPoint[]
  analyzedAt: string
}

export interface ProfileGeneration {
  mode: 'deepseek' | 'deterministic'
  degraded: boolean
  reason?: 'missing_key' | 'timeout' | 'rate_limit' | 'upstream_error' | 'request_rejected' | 'empty' | 'invalid_output'
}

/** 环节一产出：把模糊输入收敛成结构化品类 */
export interface CategoryProfile {
  name: string
  /** 归一化后的英文检索词，喂给搜索引擎 */
  searchTerms: string[]
  /** 同义/长尾词，用于扩面 */
  relatedTerms: string[]
  /** 一句话品类定义，给人看的 */
  summary: string
  /** 大模型只能从公开证据中提取；确定性降级时可以为空。 */
  audiences: ProfileInsight[]
  purchaseDrivers: ProfileInsight[]
  /** 尚需由商品、评论或供应链数据回答，不能当成事实。 */
  validationQuestions: string[]
}

export interface ProfileInsight {
  text: string
  citations: Citation[]
}

/** 环节二产出：谁在卖、卖多少钱 */
export interface CompetitorListing {
  id: string
  title: string
  channel: Channel
  brand?: string
  price: number
  currency: string
  rating?: number
  reviewCount?: number
  /** 评论接口专用商品标识；例如 Walmart 必须使用真实 us_item_id，不能从 product_id 猜测。 */
  reviewProductId?: string
  /** 月销量，多数渠道拿不到精确值，允许估算 */
  monthlySales?: number
  /** 上架以来累计销量，不等于月销量；TikTok 联盟商品可返回 */
  lifetimeSales?: number
  /** TikTok Affiliate API 的 commission.rate，由基点换算成 0~1 比率。 */
  affiliateCommissionRate?: number
  url?: string
}

export interface MarketSnapshot {
  listings: CompetitorListing[]
  channelCoverage?: ChannelFetchStatus[]
  priceBands: PriceBand[]
  /** 头部集中度 0~1，越高越像寡头市场 */
  concentration: number
  /** 参与竞争的品牌数 */
  brandCount: number
}

export interface PriceBand {
  min: number
  max: number
  /** 落在该价格带的 listing 数量 */
  count: number
}

/** 环节三产出：趋势在升还是在衰 */
export interface TrendPoint {
  /** ISO 日期，如 2026-07 */
  period: string
  value: number
}

export interface TrendSnapshot {
  series: TrendPoint[]
  direction: 'rising' | 'flat' | 'declining'
  /** 同比变化百分比 */
  yoyChange: number
  /** 季节性峰值月份，1~12 */
  seasonalPeaks: number[]
}

/** 环节四产出：做不做 */
export type Decision = 'go' | 'watch' | 'pass' | 'insufficient'

export interface Verdict {
  decision: Decision
  /** 0~100 综合分；关键数据不足时为 null */
  score: number | null
  /** 拆解到维度的打分，UI 直接渲染雷达/条形图 */
  dimensions: VerdictDimension[]
  reasons: string[]
  risks: string[]
  unitEconomics?: UnitEconomics
  channelEconomics?: ChannelUnitEconomics[]
  confidence?: ConfidenceSummary
  dataCompleteness?: 'complete' | 'partial'
}

export interface VerdictDimension {
  key: 'demand' | 'competition' | 'margin' | 'trend' | 'operability'
  label: string
  score: number
  note?: string
}

/** 最终沉淀物：一次调研的完整结论，可存库、可复盘 */
export interface SelectionReport {
  id: string
  query: CategoryQuery
  profile: CategoryProfile
  profileGeneration?: ProfileGeneration
  market: MarketSnapshot
  trend?: TrendSnapshot
  verdict: Verdict
  reviews?: ReviewSnapshot
  createdAt: string
  /** 每条数据的出处，可信度全靠它 */
  citations: Citation[]
}

export interface Citation {
  label: string
  url: string
  /** 由哪个环节产生 */
  source: string
}
