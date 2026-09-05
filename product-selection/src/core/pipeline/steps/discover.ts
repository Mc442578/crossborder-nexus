import type { PipelineStep } from '../types'

/** 环节一：把用户随口说的一个词，收敛成可检索的结构化品类 */
export const discoverStep: PipelineStep = {
  id: 'discover',
  title: '发现品类',
  description: '联网检索品类背景，归一化出英文检索词与长尾词',

  async run(ctx, rt) {
    rt.report('检索品类背景…', 0.2)
    const hits = await rt.ds.searchWeb(
      `${ctx.query.keyword} ${ctx.query.market} apparel market`,
      { signal: rt.signal },
    )

    rt.report('抽取品类画像…', 0.7)
    const { profile, citations, generation } = await rt.ds.profileCategory(
      ctx.query, hits, { signal: rt.signal },
    )

    ctx.profile = profile
    ctx.profileGeneration = generation
    ctx.citations.push(...citations)
    rt.report(`识别到 ${profile.searchTerms.length} 个检索词`, 1)
  },
}
