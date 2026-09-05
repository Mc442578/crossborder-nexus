import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import { PipelineEngine } from '@/core/pipeline/engine'
import { DEFAULT_PIPELINE } from '@/core/pipeline/steps'
import { createDataSource } from '@/core/datasource'
import { RemotePipelineClient, type ServerProgressMessage } from '@/core/pipeline/remote'
import type { RunContext, StepState } from '@/core/pipeline/types'
import type { CategoryQuery, SelectionReport } from '@/types/domain'
import { useLibraryStore } from './library'

/** 当前这一次调研会话的状态。一次只跑一条链路，够用。 */
export const useResearchStore = defineStore('research', () => {
  const steps = ref<StepState[]>([])
  const running = ref(false)
  const error = ref<string | null>(null)
  const context = shallowRef<RunContext | null>(null)
  const lastReportId = ref<string | null>(null)
  const serverMessages = ref<ServerProgressMessage[]>([])
  const streamStatus = ref<'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'>('idle')

  let engine: PipelineEngine | null = null
  let remote: RemotePipelineClient | null = null

  const progress = computed(() => {
    if (!steps.value.length) return 0
    const done = steps.value.filter((s) => s.status === 'success' || s.status === 'skipped').length
    return done / steps.value.length
  })

  const elapsed = computed(() => {
    const starts = steps.value.map((s) => s.startedAt).filter(Boolean) as number[]
    const ends = steps.value.map((s) => s.endedAt).filter(Boolean) as number[]
    if (!starts.length || !ends.length) return 0
    return Math.max(...ends) - Math.min(...starts)
  })

  async function run(query: CategoryQuery) {
    if (running.value) return
    running.value = true
    steps.value = []
    error.value = null
    context.value = null
    lastReportId.value = null
    serverMessages.value = []
    streamStatus.value = 'idle'

    const onStep = (state: StepState) => {
      const i = steps.value.findIndex((step) => step.id === state.id)
      if (i === -1) steps.value.push(state)
      else steps.value[i] = state
    }

    try {
      let ctx: RunContext
      if (import.meta.env.VITE_DATA_SOURCE === 'live') {
        remote = new RemotePipelineClient({
          onStep,
          onServerMessage(message) {
            serverMessages.value = [...serverMessages.value.slice(-5), message]
          },
          onConnection(status) { streamStatus.value = status },
        })
        ctx = await remote.run(query)
      } else {
        engine = new PipelineEngine({
          steps: DEFAULT_PIPELINE,
          ds: createDataSource('mock'),
          onEvent(e) {
            if (e.type === 'run:start') steps.value = []
            if (e.type === 'step:update') onStep(e.state)
            if (e.type === 'run:error') error.value = e.error.message
          },
        })
        ctx = await engine.run(query)
      }
      context.value = ctx
      if (ctx.verdict && ctx.profile && ctx.market) {
        const report: SelectionReport = {
          id: cryptoId(),
          query: ctx.query,
          profile: ctx.profile,
          profileGeneration: ctx.profileGeneration,
          market: ctx.market,
          trend: ctx.trend,
          reviews: ctx.reviews,
          verdict: ctx.verdict,
          createdAt: new Date().toISOString(),
          citations: ctx.citations,
        }
        useLibraryStore().save(report)
        lastReportId.value = report.id
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        error.value = err instanceof Error ? err.message : String(err)
      }
    } finally {
      running.value = false
      remote = null
    }
  }

  function abort() {
    engine?.abort()
    remote?.abort()
  }

  return {
    steps, running, error, context, lastReportId, serverMessages, streamStatus,
    progress, elapsed, run, abort,
  }
})

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() ?? `r-${Date.now().toString(36)}`
}
