import type { ConfidenceSummary, DemandSignal } from '@/types/domain'

export interface ConfidenceInput {
  sampleSize: number
  signalSampleSize?: number
  sourceCount: number
  hasCosts: boolean
  demandSource: DemandSignal['source']
  analyzedAt: string
  extraMissing?: string[]
}

export function calculateConfidence(input: ConfidenceInput): ConfidenceSummary {
  const missing = [...(input.extraMissing ?? [])]
  const signalSampleSize = input.signalSampleSize ?? input.sampleSize
  if (!input.hasCosts) missing.push('完整成本')
  if (input.demandSource === 'missing') missing.push('需求信号')
  if (input.demandSource === 'reviews') missing.push('可靠月销量（当前使用评价数代理）')
  if (signalSampleSize < input.sampleSize) missing.push('需求信号覆盖不完整')
  if (!input.sourceCount) missing.push('真实引用')

  const sampleScore = Math.min(35, Math.max(0, (signalSampleSize / 50) * 35))
  const sourceScore = Math.min(20, Math.max(0, (input.sourceCount / 3) * 20))
  const freshnessScore = 15
  const costScore = input.hasCosts ? 15 : 0
  const demandScore = input.demandSource === 'sales'
    ? 15
    : input.demandSource === 'reviews' ? 7 : 0
  let score = Math.round(sampleScore + sourceScore + freshnessScore + costScore + demandScore)
  if (input.demandSource === 'reviews') score = Math.min(79, score)
  if (signalSampleSize < input.sampleSize) score = Math.min(79, score)
  if (!input.sourceCount) score = Math.min(59, score)
  if (input.extraMissing?.length) score = Math.min(79, score)

  return {
    score,
    level: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
    sampleSize: input.sampleSize,
    sourceCount: input.sourceCount,
    analyzedAt: input.analyzedAt,
    missing: [...new Set(missing)],
  }
}
