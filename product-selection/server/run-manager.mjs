import { randomUUID } from 'node:crypto'
import { PipelineEngine } from '../src/core/pipeline/engine.ts'
import { DEFAULT_PIPELINE } from '../src/core/pipeline/steps/index.ts'

export class RunError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export class RunManager {
  constructor(options) {
    this.createDataSource = options.createDataSource
    this.now = options.now ?? Date.now
    this.id = options.id ?? randomUUID
    this.ttlMs = options.ttlMs ?? 10 * 60_000
    this.maxRuns = options.maxRuns ?? 20
    this.maxRunMs = options.maxRunMs ?? 2 * 60_000
    this.steps = options.steps ?? DEFAULT_PIPELINE
    this.runs = new Map()
  }

  create(rawQuery) {
    this.cleanup()
    const runningCount = [...this.runs.values()].filter((job) => job.status === 'running').length
    if (runningCount >= this.maxRuns) throw new RunError(429, '同时运行的调研任务过多，请稍后重试')
    this.trimTerminalRuns()
    const query = validateQuery(rawQuery)
    const job = {
      id: this.id(), query, status: 'running', sequence: 0, events: [], subscribers: new Set(),
      steps: [], result: undefined, error: undefined, createdAt: this.now(), expiresAt: Infinity,
      engine: undefined, timedOut: false, timeout: undefined,
    }
    this.runs.set(job.id, job)
    const ds = this.createDataSource((cache) => this.publish(job, {
      type: 'cache:update', cache,
    }))
    job.engine = new PipelineEngine({
      steps: this.steps,
      ds,
      onEvent: (event) => this.handleEngineEvent(job, event),
    })
    job.timeout = setTimeout(() => {
      if (job.status !== 'running') return
      job.timedOut = true
      job.engine.abort()
    }, this.maxRunMs)
    job.timeout.unref?.()
    queueMicrotask(() => this.execute(job))
    return this.describe(job)
  }

  get(runId) {
    this.cleanup()
    const job = this.runs.get(runId)
    if (!job) throw new RunError(404, '调研任务不存在或已过期')
    return job
  }

  result(runId) {
    const job = this.get(runId)
    if (job.status === 'running') return { status: 202, data: { status: 'running' } }
    if (job.status === 'complete') return { status: 200, data: { status: 'complete', context: job.result } }
    return { status: job.status === 'aborted' ? 409 : 500, data: {
      status: job.status, error: job.error ?? (job.status === 'aborted' ? '任务已取消' : '任务失败'),
    } }
  }

  abort(runId) {
    const job = this.get(runId)
    if (job.status !== 'running') return this.describe(job)
    job.engine.abort()
    return this.describe(job)
  }

  subscribe(runId, lastEventId, callback) {
    const job = this.get(runId)
    const after = Number.isSafeInteger(Number(lastEventId)) ? Number(lastEventId) : 0
    job.subscribers.add(callback)
    const firstRetainedId = job.events[0]?.id ?? job.sequence + 1
    if (after < firstRetainedId - 1 || job.events.length === 0) {
      callback({
        id: Math.max(0, firstRetainedId - 1),
        data: { type: 'snapshot', steps: job.steps, status: job.status },
      })
    }
    for (const event of job.events) {
      if (event.id > after) callback(event)
    }
    return () => job.subscribers.delete(callback)
  }

  describe(job) {
    return {
      runId: job.id,
      status: job.status,
      eventsUrl: `/api/runs/${job.id}/events`,
      resultUrl: `/api/runs/${job.id}/result`,
    }
  }

  async execute(job) {
    try {
      const context = await job.engine.run(job.query)
      if (job.status === 'aborted' || job.timedOut) return
      if (!context.profile || !context.market || !context.verdict) {
        job.status = 'failed'
        job.error = '核心调研步骤失败，未生成可用报告'
        this.publish(job, { type: 'failed', error: job.error })
        return
      }
      job.status = 'complete'
      job.result = context
      this.publish(job, { type: 'complete', resultUrl: `/api/runs/${job.id}/result` })
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : String(error)
      this.publish(job, { type: 'failed', error: job.error })
    } finally {
      clearTimeout(job.timeout)
      job.expiresAt = this.now() + this.ttlMs
    }
  }

  handleEngineEvent(job, event) {
    if (event.type === 'step:update') {
      const index = job.steps.findIndex((step) => step.id === event.state.id)
      if (index === -1) job.steps.push(event.state)
      else job.steps[index] = event.state
      this.publish(job, { type: 'step:update', state: event.state })
      return
    }
    if (event.type === 'run:abort') {
      job.status = job.timedOut ? 'failed' : 'aborted'
      job.error = job.timedOut ? '任务执行超时' : '任务已取消'
      this.publish(job, job.timedOut
        ? { type: 'failed', error: job.error }
        : { type: 'aborted' })
      return
    }
    if (event.type === 'run:error') {
      this.publish(job, { type: 'run:error', error: event.error.message })
      return
    }
    if (event.type === 'run:start') this.publish(job, { type: 'run:start' })
  }

  publish(job, data) {
    const event = { id: ++job.sequence, data }
    job.events.push(event)
    if (job.events.length > 100) job.events.shift()
    for (const subscriber of job.subscribers) subscriber(event)
  }

  cleanup() {
    const now = this.now()
    for (const [id, job] of this.runs) {
      if (job.expiresAt <= now) this.runs.delete(id)
    }
  }

  trimTerminalRuns() {
    const limit = this.maxRuns * 5
    if (this.runs.size < limit) return
    const terminal = [...this.runs.values()]
      .filter((job) => job.status !== 'running')
      .sort((left, right) => left.createdAt - right.createdAt)
    while (this.runs.size >= limit && terminal.length) {
      this.runs.delete(terminal.shift().id)
    }
  }
}

export function validateQuery(value) {
  const keyword = typeof value?.keyword === 'string' ? value.keyword.trim().replace(/\s+/g, ' ') : ''
  if (!keyword || !/[A-Za-z]/.test(keyword)) throw new RunError(400, '请输入英文品类关键词')
  if (value?.market !== 'US') throw new RunError(400, '当前只支持 US 市场')
  const channels = Array.isArray(value?.channels) ? [...new Set(value.channels)] : []
  if (!channels.length || channels.some((item) => !['amazon', 'walmart', 'tiktok'].includes(item))) {
    throw new RunError(400, '至少选择一个有效渠道')
  }
  const costs = value?.costs
  if (!isNonNegative(costs?.purchaseCost) || !isNonNegative(costs?.firstMileCost)
    || !Number.isFinite(costs?.advertisingRate)
    || costs.advertisingRate < 0 || costs.advertisingRate > 1) {
    throw new RunError(400, '成本必须为非负数，广告费率必须在 0～100% 之间')
  }
  return { keyword, market: 'US', channels, costs: {
    purchaseCost: costs.purchaseCost,
    firstMileCost: costs.firstMileCost,
    advertisingRate: costs.advertisingRate,
  } }
}

function isNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

export function formatSseEvent(event) {
  return `id: ${event.id}\nevent: progress\ndata: ${JSON.stringify(event.data)}\n\n`
}
