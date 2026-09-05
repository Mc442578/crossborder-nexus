<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import SearchBar from '@/components/SearchBar.vue'
import PipelineTimeline from '@/components/PipelineTimeline.vue'
import MarketPanel from '@/components/panels/MarketPanel.vue'
import TrendPanel from '@/components/panels/TrendPanel.vue'
import VerdictPanel from '@/components/panels/VerdictPanel.vue'
import AppCard from '@/components/ui/AppCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useResearchStore } from '@/stores/research'
import type { CategoryQuery } from '@/types/domain'

const router = useRouter()
const store = useResearchStore()
const {
  steps, running, error, context, elapsed, lastReportId, serverMessages, streamStatus,
} = storeToRefs(store)

const ctx = computed(() => context.value)

function start(q: CategoryQuery) {
  store.run(q)
}
</script>

<template>
  <div class="page">
    <div class="hero">
      <h1>把一个品类的调研，从半天压到一分钟</h1>
      <p>输入一个潜在品类，自动完成 发现 → 查竞争 → 看趋势 → 出结论 全链路。</p>
    </div>

    <AppCard>
      <SearchBar :running="running" @submit="start" @abort="store.abort()" />
    </AppCard>

    <div v-if="steps.length" class="grid">
      <AppCard title="调研链路" :hint="elapsed ? `耗时 ${(elapsed / 1000).toFixed(1)}s` : ''">
        <PipelineTimeline :steps="steps" />
        <div v-if="streamStatus !== 'idle'" class="stream-status">
          <strong>SSE 实时进度</strong>
          <span>{{ streamStatus === 'open' ? '已连接' : streamStatus === 'reconnecting' ? '重连中' : streamStatus === 'connecting' ? '连接中' : '已结束' }}</span>
        </div>
        <ul v-if="serverMessages.length" class="server-messages">
          <li v-for="message in serverMessages" :key="message.id"
            :class="{ hit: message.cache === 'hit' }">{{ message.text }}</li>
        </ul>
        <p v-if="error" class="err">{{ error }}</p>
        <button v-if="lastReportId" class="primary full"
          @click="router.push(`/report/${lastReportId}`)">
          查看完整结论
        </button>
      </AppCard>

      <div class="results">
        <VerdictPanel v-if="ctx?.verdict" :verdict="ctx.verdict" />
        <TrendPanel v-if="ctx?.trend" :trend="ctx.trend" />
        <MarketPanel v-if="ctx?.market" :market="ctx.market" />
        <AppCard v-if="!ctx?.verdict && !running" title="等待结果">
          <EmptyState text="链路尚未产出结论" />
        </AppCard>
      </div>
    </div>

    <AppCard v-else>
      <EmptyState text="输入一个品类关键词开始，比如「oversized graphic tee」" />
    </AppCard>
  </div>
</template>

<style scoped>
.page { display: grid; gap: 16px; }
.hero { padding: 8px 4px 4px; }
.hero h1 { font-size: 24px; }
.hero p { margin: 6px 0 0; color: var(--muted); }
.grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
.results { display: grid; gap: 16px; }
.err { color: var(--pass); font-size: 13px; margin: 10px 0 0; }
.full { width: 100%; margin-top: 14px; }
.stream-status { display: flex; justify-content: space-between; margin-top: 12px; font-size: 12px; color: var(--muted); }
.server-messages { margin: 7px 0 0; padding-left: 18px; color: var(--muted); font-size: 12px; }
.server-messages .hit { color: var(--go); }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
