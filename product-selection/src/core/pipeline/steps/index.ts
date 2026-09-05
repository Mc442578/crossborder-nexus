import type { PipelineStep } from '../types'
import { discoverStep } from './discover.ts'
import { marketStep } from './market.ts'
import { trendStep } from './trend.ts'
import { verdictStep } from './verdict.ts'
import { reviewsStep } from './reviews.ts'

/**
 * 链路注册表 —— 加环节就往这里加一行。
 * 顺序不决定执行顺序，dependsOn 才决定；互不依赖的会自动并行。
 *
 * 【练习区】可以往里加：竞品广告位分析、评论痛点挖掘、供应链成本估算…
 */
export const DEFAULT_PIPELINE: PipelineStep[] = [
  discoverStep,
  marketStep,
  trendStep,
  reviewsStep,
  verdictStep,
]

export { discoverStep, marketStep, trendStep, reviewsStep, verdictStep }
