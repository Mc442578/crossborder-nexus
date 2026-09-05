import type {
  EngineEvent, PipelineStep, RunContext, StepRuntime, StepState,
} from './types'
import type { DataSource } from '@/core/datasource/types'
import type { CategoryQuery } from '@/types/domain'

export interface EngineOptions {
  steps: PipelineStep[]
  ds: DataSource
  /** 单个 Step 失败时的重试次数 */
  retries?: number
  /** 某个 Step 失败后是否继续跑后面的（降级出报告 > 整条链路挂掉） */
  continueOnError?: boolean
  onEvent?: (e: EngineEvent) => void
}

/**
 * 链路编排引擎。
 *
 * 现在是"按依赖分层 + 层内并行"的最小实现：
 * discover 跑完后，market 和 trend 因为互不依赖会同时发车，verdict 等两者都到齐。
 * 这是把半天压到分钟级的关键 —— 慢的是网络 IO，不是计算。
 */
export class PipelineEngine {
  private opts: Required<Omit<EngineOptions, 'onEvent'>> & Pick<EngineOptions, 'onEvent'>
  private controller: AbortController | null = null
  private states = new Map<string, StepState>()

  constructor(opts: EngineOptions) {
    this.opts = {
      retries: 1,
      continueOnError: true,
      ...opts,
    }
  }

  get snapshot(): StepState[] {
    return this.opts.steps.map((s) => this.states.get(s.id)!).filter(Boolean)
  }

  abort() {
    this.controller?.abort()
  }

  async run(query: CategoryQuery): Promise<RunContext> {
    this.controller = new AbortController()
    const { signal } = this.controller
    const ctx: RunContext = { query, citations: [] }

    this.states.clear()
    for (const s of this.opts.steps) {
      this.states.set(s.id, {
        id: s.id, title: s.title, description: s.description, status: 'pending',
      })
    }
    this.emit({ type: 'run:start' })
    this.opts.steps.forEach((s) => this.emit({ type: 'step:update', state: this.states.get(s.id)! }))

    try {
      for (const layer of this.toLayers(this.opts.steps)) {
        if (signal.aborted) break
        await Promise.all(layer.map((step) => this.runStep(step, ctx, signal)))
      }
      if (signal.aborted) {
        for (const [id, st] of this.states) {
          if (st.status === 'pending' || st.status === 'running') {
            this.patch(id, { status: 'aborted', message: '已中止' })
          }
        }
        this.emit({ type: 'run:abort' })
      } else {
        this.emit({ type: 'run:finish', ctx })
      }
      return ctx
    } catch (err) {
      this.emit({ type: 'run:error', error: err as Error })
      throw err
    }
  }

  private async runStep(step: PipelineStep, ctx: RunContext, signal: AbortSignal) {
    if (step.enabled && !step.enabled(ctx)) {
      this.patch(step.id, { status: 'skipped' })
      return
    }
    if (signal.aborted) {
      this.patch(step.id, { status: 'aborted' })
      return
    }
    this.patch(step.id, { status: 'running', startedAt: Date.now(), progress: 0 })

    const rt: StepRuntime = {
      ds: this.opts.ds,
      signal,
      report: (message, progress) => this.patch(step.id, { message, progress }),
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= this.opts.retries; attempt++) {
      try {
        await step.run(ctx, rt)
        this.patch(step.id, { status: 'success', progress: 1, endedAt: Date.now() })
        return
      } catch (err) {
        // 中止不是失败：不重试、不报错，直接落到 aborted
        if (signal.aborted) {
          this.patch(step.id, { status: 'aborted', message: '已中止', endedAt: Date.now() })
          return
        }
        lastError = err
        if (attempt < this.opts.retries) {
          rt.report(`第 ${attempt + 1} 次失败，重试中…`)
          await delay(400 * (attempt + 1), signal)
        }
      }
    }

    this.patch(step.id, {
      status: 'error',
      error: lastError instanceof Error ? lastError.message : String(lastError),
      endedAt: Date.now(),
    })
    if (!this.opts.continueOnError) throw lastError
  }

  /** 拓扑分层：同一层内的 Step 互不依赖，可并行 */
  private toLayers(steps: PipelineStep[]): PipelineStep[][] {
    const done = new Set<string>()
    const rest = [...steps]
    const layers: PipelineStep[][] = []

    while (rest.length) {
      const layer = rest.filter((s) => (s.dependsOn ?? []).every((d) => done.has(d)))
      if (!layer.length) {
        // 依赖成环或依赖了不存在的 Step，退化成串行，别把链路卡死
        layers.push([...rest])
        break
      }
      layer.forEach((s) => {
        done.add(s.id)
        rest.splice(rest.indexOf(s), 1)
      })
      layers.push(layer)
    }
    return layers
  }

  private patch(id: string, partial: Partial<StepState>) {
    const prev = this.states.get(id)
    if (!prev) return
    const next = { ...prev, ...partial }
    this.states.set(id, next)
    this.emit({ type: 'step:update', state: next })
  }

  private emit(e: EngineEvent) {
    this.opts.onEvent?.(e)
  }
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    }, { once: true })
  })
}
