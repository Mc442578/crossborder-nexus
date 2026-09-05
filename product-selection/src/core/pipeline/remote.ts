import type { CategoryQuery } from '@/types/domain'
import type { RunContext, StepState } from './types'

export interface ServerProgressMessage {
  id: number
  text: string
  cache?: 'hit' | 'miss'
}

interface RemoteRunCallbacks {
  onStep: (state: StepState) => void
  onServerMessage: (message: ServerProgressMessage) => void
  onConnection: (status: 'connecting' | 'open' | 'reconnecting' | 'closed') => void
}

interface RemoteRunDependencies {
  fetchImpl?: typeof fetch
  createEventSource?: (url: string) => EventSource
  reconnectTimeoutMs?: number
}

export class RemotePipelineClient {
  private source: EventSource | null = null
  private runId: string | null = null
  private rejectRun: ((reason?: unknown) => void) | null = null
  private aborted = false
  private readonly fetchImpl: typeof fetch
  private readonly createEventSource: (url: string) => EventSource
  private readonly callbacks: RemoteRunCallbacks
  private readonly reconnectTimeoutMs: number

  constructor(callbacks: RemoteRunCallbacks, deps: RemoteRunDependencies = {}) {
    this.callbacks = callbacks
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.createEventSource = deps.createEventSource ?? ((url) => new EventSource(url))
    this.reconnectTimeoutMs = deps.reconnectTimeoutMs ?? 30_000
  }

  async run(query: CategoryQuery): Promise<RunContext> {
    this.callbacks.onConnection('connecting')
    const response = await this.fetchImpl('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!response.ok) throw new Error(`/runs 请求失败: ${response.status} ${await response.text()}`)
    const run = await response.json() as { runId: string; eventsUrl: string; resultUrl: string }
    this.runId = run.runId
    if (this.aborted) {
      await this.sendAbort()
      throw new DOMException('Aborted', 'AbortError')
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    return new Promise<RunContext>((resolve, reject) => {
      this.rejectRun = reject
      const source = this.createEventSource(run.eventsUrl)
      this.source = source
      const finishWithResult = async () => {
        const result = await this.fetchImpl(run.resultUrl)
        if (!result.ok) throw new Error(`读取调研结果失败: ${result.status} ${await result.text()}`)
        const data = await result.json() as { context: RunContext }
        source.close()
        this.callbacks.onConnection('closed')
        resolve(data.context)
      }
      source.onopen = () => {
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
        this.callbacks.onConnection('open')
      }
      source.onerror = () => {
        if (this.aborted || reconnectTimer) return
        this.callbacks.onConnection('reconnecting')
        reconnectTimer = setTimeout(async () => {
          try {
            const result = await this.fetchImpl(run.resultUrl)
            if (result.status === 200) {
              const data = await result.json() as { context: RunContext }
              source.close()
              this.callbacks.onConnection('closed')
              resolve(data.context)
              return
            }
            const stopped = result.status === 202 ? await this.sendAbort() : true
            throw new Error(stopped
              ? 'SSE 进度连接持续中断，调研任务已安全停止'
              : 'SSE 进度连接持续中断，无法确认服务端任务已停止')
          } catch (error) {
            source.close()
            this.callbacks.onConnection('closed')
            reject(error)
          }
        }, this.reconnectTimeoutMs)
      }
      source.addEventListener('progress', async (raw) => {
        try {
          const event = JSON.parse((raw as MessageEvent).data)
          if (event.type === 'snapshot') event.steps.forEach(this.callbacks.onStep)
          if (event.type === 'step:update') this.callbacks.onStep(event.state)
          if (event.type === 'cache:update') {
            const hit = event.cache.status === 'hit'
            this.callbacks.onServerMessage({
              id: Number((raw as MessageEvent).lastEventId),
              cache: event.cache.status,
              text: hit
                ? `${event.cache.label}：缓存命中，未调用第三方 API`
                : event.cache.stored
                  ? `${event.cache.label}：实时获取并写入缓存`
                  : `${event.cache.label}：实时获取，本次结果未缓存`,
            })
          }
          if (event.type === 'complete') {
            clearTimeout(reconnectTimer)
            await finishWithResult()
          }
          if (event.type === 'failed') throw new Error(event.error || '服务端调研失败')
          if (event.type === 'aborted') throw new DOMException('Aborted', 'AbortError')
        } catch (error) {
          source.close()
          this.callbacks.onConnection('closed')
          reject(error)
        }
      })
    }).finally(() => {
      clearTimeout(reconnectTimer)
      this.source?.close()
      this.source = null
      this.rejectRun = null
    })
  }

  abort() {
    this.aborted = true
    this.source?.close()
    this.callbacks.onConnection('closed')
    void this.sendAbort()
    this.rejectRun?.(new DOMException('Aborted', 'AbortError'))
  }

  private async sendAbort() {
    if (!this.runId) return false
    try {
      const response = await this.fetchImpl(`/api/runs/${this.runId}`, { method: 'DELETE' })
      return response.ok
    } catch {
      return false
    }
  }
}
