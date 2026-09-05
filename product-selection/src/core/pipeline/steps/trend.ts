import type { PipelineStep } from '../types'
import type { TrendPoint } from '@/types/domain'

/** 环节三：在上升还是在衰退 */
export const trendStep: PipelineStep = {
  id: 'trend',
  title: '看趋势',
  description: '拉近两年热度序列，判断走向与季节性',
  // 只依赖 discover，因此会和 market 并行发车
  dependsOn: ['discover'],

  async run(ctx, rt) {
    const term = ctx.profile?.searchTerms[0] ?? ctx.query.keyword

    rt.report('拉取热度序列…', 0.4)
    const series = await rt.ds.fetchTrend(term, { signal: rt.signal })

    rt.report('识别走向与季节性…', 0.85)
    ctx.trend = {
      series,
      direction: classify(series),
      yoyChange: yoy(series),
      seasonalPeaks: peaks(series),
    }
    rt.report(`趋势判定：${ctx.trend.direction}`, 1)
  },
}

/** 用后半段均值对比前半段，够用且不易被单点噪声带偏 */
function classify(series: TrendPoint[]): 'rising' | 'flat' | 'declining' {
  if (series.length < 4) return 'flat'
  const mid = Math.floor(series.length / 2)
  const avg = (arr: TrendPoint[]) => arr.reduce((a, p) => a + p.value, 0) / (arr.length || 1)
  const delta = (avg(series.slice(mid)) - avg(series.slice(0, mid))) / (avg(series.slice(0, mid)) || 1)
  if (delta > 0.1) return 'rising'
  if (delta < -0.1) return 'declining'
  return 'flat'
}

function yoy(series: TrendPoint[]): number {
  if (series.length < 24) return 0
  const last12 = series.slice(-12).reduce((a, p) => a + p.value, 0)
  const prev12 = series.slice(-24, -12).reduce((a, p) => a + p.value, 0)
  if (!prev12) return 0
  return Math.round(((last12 - prev12) / prev12) * 1000) / 10
}

/** 取近 12 个月中高于均值 1.15 倍的月份 */
function peaks(series: TrendPoint[]): number[] {
  const last12 = series.slice(-12)
  if (!last12.length) return []
  const avg = last12.reduce((a, p) => a + p.value, 0) / last12.length
  return last12
    .map((p) => ({ month: Number(p.period.slice(5, 7)), hot: p.value > avg * 1.15 }))
    .filter((x) => x.month >= 1 && x.month <= 12)
    .filter((x) => x.hot)
    .map((x) => x.month)
}
