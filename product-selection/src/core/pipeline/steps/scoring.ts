import type {
  Citation, CostInputs, MarketSnapshot, TrendSnapshot, UnitEconomics, Verdict, VerdictDimension,
} from '@/types/domain'
import { calculateConfidence } from '../../analysis/confidence.ts'
import { calculateChannelEconomics } from '../../analysis/channel-economics.ts'
import { calculateDemandSignal } from '../../analysis/demand-signal.ts'

/**
 * 选品评分规则 —— 整个工程业务感最强、也最该被改的地方。
 *
 * 刻意做成纯函数：输入快照、输出结论，不碰网络不碰状态，
 * 想换成 LLM 打分或公司自己的选品模型，只要保持签名即可。
 */

export interface ScoringWeights {
  demand: number
  competition: number
  margin: number
  trend: number
  operability: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  demand: 0.25,
  competition: 0.25,
  margin: 0.2,
  trend: 0.2,
  operability: 0.1,
}

export interface ScoringOptions {
  trend?: TrendSnapshot
  costs?: CostInputs
  citations?: Citation[]
  analyzedAt?: string
  weights?: ScoringWeights
}

export function scoreCategory(
  market: MarketSnapshot,
  options: ScoringOptions = {},
): Verdict {
  const weights = options.weights ?? DEFAULT_WEIGHTS
  const demand = calculateDemandSignal(market.listings)
  let unitEconomics: UnitEconomics | undefined
  let channelEconomics: ReturnType<typeof calculateChannelEconomics> = []
  if (options.costs) {
    try {
      channelEconomics = calculateChannelEconomics(market.listings, options.costs)
      unitEconomics = [...channelEconomics]
        .sort((a, b) => a.marginRate - b.marginRate)[0]
    } catch {
      unitEconomics = undefined
      channelEconomics = []
    }
  }

  const dimensions: VerdictDimension[] = [
    { key: 'demand', label: demand.source === 'reviews' ? '需求代理（评价数）' : '需求量', score: demand.score, note: demand.label },
    competitionScore(market),
    marginScore(unitEconomics),
    ...(options.trend ? [trendScore(options.trend)] : []),
    operabilityScore(market),
  ]

  const availableWeight = dimensions.reduce(
    (sum, dimension) => sum + (weights[dimension.key] ?? 0), 0,
  )
  const weightedTotal = dimensions.reduce(
    (sum, d) => sum + d.score * (weights[d.key] ?? 0), 0,
  )
  const hasDecisionInputs = market.listings.length > 0
    && demand.source !== 'missing'
    && Boolean(unitEconomics)
  const calculatedScore = Math.round(weightedTotal / (availableWeight || 1))
  const score = hasDecisionInputs ? calculatedScore : null
  const isProfitable = Boolean(unitEconomics && unitEconomics.unitProfit > 0)
  const analyzedAt = options.analyzedAt ?? new Date().toISOString()
  const citations = options.citations ?? []
  const sourceStages = new Set(citations.map((citation) => citation.source))
  const economicsChannels = new Set(channelEconomics.map((item) => item.channel))
  const missingEconomicsChannels = options.costs
    ? [...new Set(market.listings.map((listing) => listing.channel))]
      .filter((channel) => !economicsChannels.has(channel))
    : []
  const incompleteAffiliateChannels = channelEconomics
    .filter((item) => item.channel === 'tiktok'
      && item.affiliateCommissionSampleSize !== item.sampleSize)
    .map((item) => item.channel)
  const extraMissing = [
    ...(!options.trend ? ['趋势数据'] : []),
    ...(!sourceStages.has('market') ? ['市场数据来源关联'] : []),
    ...(options.trend && !sourceStages.has('trend') ? ['趋势数据来源关联'] : []),
    ...missingEconomicsChannels.map((channel) => `${channel} 渠道利润`),
    ...incompleteAffiliateChannels.map((channel) => `${channel} 联盟佣金覆盖`),
  ]
  const confidence = calculateConfidence({
    sampleSize: market.listings.length,
    signalSampleSize: demand.sampleSize,
    sourceCount: new Set(citations.map((citation) => citation.url)).size,
    hasCosts: Boolean(unitEconomics),
    demandSource: demand.source,
    analyzedAt,
    extraMissing,
  })

  return {
    decision: hasDecisionInputs
      ? !isProfitable ? 'pass' : calculatedScore >= 70 ? 'go' : calculatedScore >= 50 ? 'watch' : 'pass'
      : 'insufficient',
    score,
    dimensions,
    reasons: buildReasons(dimensions, options.trend),
    risks: buildRisks(
      market, options.trend, demand.source, unitEconomics,
      missingEconomicsChannels, incompleteAffiliateChannels,
    ),
    unitEconomics,
    channelEconomics,
    confidence,
    dataCompleteness: confidence.missing.length === 0 ? 'complete' : 'partial',
  }
}

function competitionScore(m: MarketSnapshot): VerdictDimension {
  // 集中度越高越难切，分数越低
  const score = clamp((1 - m.concentration) * 100)
  return {
    key: 'competition', label: '竞争格局', score,
    note: `头部 4 品牌 listing 占比 ${(m.concentration * 100).toFixed(0)}%，${m.brandCount} 个已识别品牌`,
  }
}

function marginScore(unitEconomics?: UnitEconomics): VerdictDimension {
  if (!unitEconomics) {
    return {
      key: 'margin', label: '估算毛利（缺少成本假设）', score: 0,
      note: '缺少成本假设，无法估算毛利',
    }
  }
  const score = clamp((unitEconomics.marginRate / 0.4) * 100)
  return {
    key: 'margin', label: '估算毛利（按渠道保守值）', score,
    note: `最低单件利润 $${unitEconomics.unitProfit.toFixed(2)}，毛利率 ${(unitEconomics.marginRate * 100).toFixed(1)}%`,
  }
}

function trendScore(t: TrendSnapshot): VerdictDimension {
  const base = t.direction === 'rising' ? 80 : t.direction === 'flat' ? 55 : 25
  const score = clamp(base + t.yoyChange / 4)
  return { key: 'trend', label: '趋势走向', score, note: `同比 ${t.yoyChange > 0 ? '+' : ''}${t.yoyChange}%` }
}

function operabilityScore(m: MarketSnapshot): VerdictDimension {
  const channels = new Set(m.listings.map((l) => l.channel)).size
  const score = clamp(channels * 30 + 10)
  return { key: 'operability', label: '可操作性', score, note: `覆盖 ${channels} 个渠道` }
}

function buildReasons(dims: VerdictDimension[], trend?: TrendSnapshot): string[] {
  const reasons = dims
    .filter((d) => d.score >= 65)
    .map((d) => `${d.label}表现良好（${d.score.toFixed(0)} 分）：${d.note ?? ''}`)
  if (trend?.seasonalPeaks.length) {
    reasons.push(`检测到季节性高峰月份：${trend.seasonalPeaks.join('、')} 月`)
  }
  return reasons
}

function buildRisks(
  market: MarketSnapshot,
  trend: TrendSnapshot | undefined,
  demandSource: 'sales' | 'reviews' | 'missing',
  unitEconomics?: UnitEconomics,
  missingEconomicsChannels: string[] = [],
  incompleteAffiliateChannels: string[] = [],
): string[] {
  const risks: string[] = []
  if (demandSource === 'reviews') risks.push('当前使用评价数作为需求代理；评价数不等于销量')
  if (demandSource === 'missing') risks.push('缺少月销量和评价数，需求维度不可用于商业判断')
  if (!unitEconomics) risks.push('缺少完整成本，无法计算估算毛利')
  if (unitEconomics && unitEconomics.unitProfit <= 0) risks.push('单件利润不为正，不建议进入该品类')
  if (missingEconomicsChannels.length) {
    risks.push(`缺少 ${missingEconomicsChannels.join('、')} 的必要费率，未生成该渠道可比较利润`)
  }
  if (incompleteAffiliateChannels.length) {
    risks.push('TikTok 联盟佣金只覆盖部分商品，当前利润使用已知费率的中位数估算')
  }
  if (!trend) risks.push('趋势数据缺失，本结论已使用剩余维度降级计算')
  if (market.concentration > 0.6) risks.push('头部集中度过高，新卖家难以获得曝光')
  if (trend?.direction === 'declining') risks.push('热度处于下行通道，存在接盘风险')
  if (market.listings.length < 10) risks.push('样本量偏少，结论置信度低，建议扩大检索词范围')
  return risks
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))
