import type {
  CategoryProfile, CategoryQuery, Citation, MarketSnapshot, ProfileGeneration, ReviewSnapshot,
  TrendSnapshot, Verdict,
} from '@/types/domain'
import type { DataSource } from '@/core/datasource/types'

/** 链路上下文：所有 Step 共享的读写黑板。后面的 Step 消费前面的产出。 */
export interface RunContext {
  query: CategoryQuery
  profile?: CategoryProfile
  profileGeneration?: ProfileGeneration
  market?: MarketSnapshot
  trend?: TrendSnapshot
  reviews?: ReviewSnapshot
  verdict?: Verdict
  citations: Citation[]
}

export type StepId = 'discover' | 'market' | 'trend' | 'verdict' | (string & {})

export type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped' | 'aborted'

/** Step 运行期能拿到的能力，通过注入而非 import 获取，方便测试替换 */
export interface StepRuntime {
  ds: DataSource
  signal: AbortSignal
  /** 汇报细粒度进度，UI 上就是那行滚动的小字 */
  report: (message: string, progress?: number) => void
}

/**
 * 一个链路环节。加环节 = 新建一个文件实现它 + 在 steps/index.ts 注册。
 * run 只负责往 ctx 上写自己那一段产出，不关心谁在前谁在后。
 */
export interface PipelineStep {
  id: StepId
  title: string
  /** 给 UI 展示的一句话说明 */
  description: string
  /** 依赖的前置 Step，引擎据此判断能否并行 */
  dependsOn?: StepId[]
  /** 返回 false 则跳过该环节（如用户没勾选趋势分析） */
  enabled?: (ctx: RunContext) => boolean
  run: (ctx: RunContext, rt: StepRuntime) => Promise<void>
}

export interface StepState {
  id: StepId
  title: string
  description: string
  status: StepStatus
  message?: string
  progress?: number
  error?: string
  startedAt?: number
  endedAt?: number
}

export type EngineEvent =
  | { type: 'run:start' }
  | { type: 'step:update'; state: StepState }
  | { type: 'run:finish'; ctx: RunContext }
  | { type: 'run:error'; error: Error }
  | { type: 'run:abort' }
