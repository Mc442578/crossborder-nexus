import type { PipelineStep } from '../types'
import { scoreCategory } from './scoring.ts'

/** 环节四：做不做 —— 市场必须存在，趋势允许失败后降级 */
export const verdictStep: PipelineStep = {
  id: 'verdict',
  title: '给出结论',
  description: '五维加权打分，输出 go / watch / pass',
  dependsOn: ['market', 'trend'],

  async run(ctx, rt) {
    if (!ctx.market) throw new Error('缺少市场数据，无法给出结论')
    rt.report('加权打分中…', 0.6)
    ctx.verdict = scoreCategory(ctx.market, {
      trend: ctx.trend,
      costs: ctx.query.costs,
      citations: ctx.citations,
    })
    const incompleteChannels = ctx.market.channelCoverage?.filter(
      (channel) => channel.status !== 'success',
    ) ?? []
    if (incompleteChannels.length) {
      const details = incompleteChannels.map((channel) => {
        const status = channel.status === 'empty'
          ? '无结果'
          : channel.status === 'partial' ? '部分检索词失败' : '抓取失败'
        return `${channel.channel} ${status}`
      })
      ctx.verdict.dataCompleteness = 'partial'
      ctx.verdict.risks.push(`渠道数据不完整：${details.join('、')}；结论仅基于成功渠道`)
    }
    const scoreText = ctx.verdict.score === null ? '数据不足' : `${ctx.verdict.score} 分`
    rt.report(`结论：${ctx.verdict.decision}（${scoreText}）`, 1)
  },
}
