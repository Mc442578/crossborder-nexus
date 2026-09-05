<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MarketPanel from '@/components/panels/MarketPanel.vue'
import TrendPanel from '@/components/panels/TrendPanel.vue'
import VerdictPanel from '@/components/panels/VerdictPanel.vue'
import ReviewPanel from '@/components/panels/ReviewPanel.vue'
import AppCard from '@/components/ui/AppCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useLibraryStore } from '@/stores/library'
import type { Citation, ProfileInsight } from '@/types/domain'

const route = useRoute()
const library = useLibraryStore()
const report = computed(() => library.find(String(route.params.id)))

function insightText(item: ProfileInsight | string) {
  return typeof item === 'string' ? item : item.text
}

function insightCitations(item: ProfileInsight | string): Citation[] {
  return typeof item === 'string' ? [] : item.citations
}

function generationReason(reason?: string) {
  const labels: Record<string, string> = {
    missing_key: '缺少 DeepSeek Key',
    timeout: '请求超时',
    rate_limit: '请求限流',
    upstream_error: '上游服务异常',
    request_rejected: '请求被 DeepSeek 拒绝',
    empty: '模型返回空内容',
    invalid_output: '模型输出未通过校验',
  }
  return reason ? (labels[reason] ?? reason) : ''
}

/** TODO 练习：导出 PDF / 一键同步飞书文档，都从这里接 */
function exportJson() {
  if (!report.value) return
  const blob = new Blob([JSON.stringify(report.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${report.value.profile.name}-选品结论.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div v-if="report" class="page">
    <div class="head">
      <div>
        <h1>{{ report.profile.name }}</h1>
        <p class="meta">
          {{ report.query.market }} · {{ report.query.channels.join(' / ') }} ·
          {{ new Date(report.createdAt).toLocaleString('zh-CN') }}
        </p>
      </div>
      <button @click="exportJson">导出 JSON</button>
    </div>

    <AppCard title="品类画像">
      <p v-if="report.profileGeneration" class="generation"
        :class="{ degraded: report.profileGeneration.degraded }">
        画像生成：{{ report.profileGeneration.mode === 'deepseek' ? 'DeepSeek' : '确定性规则' }}
        <template v-if="report.profileGeneration.degraded">
          · 已降级{{ report.profileGeneration.reason ? `（${generationReason(report.profileGeneration.reason)}）` : '' }}
        </template>
      </p>
      <p>{{ report.profile.summary }}</p>
      <div class="terms">
        <span v-for="t in report.profile.searchTerms" :key="t" class="tag">{{ t }}</span>
        <span v-for="t in report.profile.relatedTerms" :key="t" class="tag alt">{{ t }}</span>
      </div>
      <div class="insights">
        <section>
          <h4>目标人群（证据提取）</h4>
          <ul v-if="report.profile.audiences?.length">
            <li v-for="item in (report.profile.audiences ?? [])" :key="insightText(item)">
              {{ insightText(item) }}
              <a v-for="source in insightCitations(item)" :key="source.url" class="insight-source"
                :href="source.url" target="_blank" rel="noreferrer">证据</a>
            </li>
          </ul>
          <p v-else class="missing">公开证据不足，未生成人群结论。</p>
        </section>
        <section>
          <h4>购买驱动（证据提取）</h4>
          <ul v-if="report.profile.purchaseDrivers?.length">
            <li v-for="item in (report.profile.purchaseDrivers ?? [])" :key="insightText(item)">
              {{ insightText(item) }}
              <a v-for="source in insightCitations(item)" :key="source.url" class="insight-source"
                :href="source.url" target="_blank" rel="noreferrer">证据</a>
            </li>
          </ul>
          <p v-else class="missing">公开证据不足，未生成购买驱动。</p>
        </section>
        <section>
          <h4>下一步必须验证</h4>
          <ul v-if="report.profile.validationQuestions?.length">
            <li v-for="item in (report.profile.validationQuestions ?? [])" :key="item">{{ item }}</li>
          </ul>
          <p v-else class="missing">旧报告没有保存该字段，请重新运行调研。</p>
        </section>
      </div>
    </AppCard>

    <VerdictPanel :verdict="report.verdict" />
    <ReviewPanel v-if="report.reviews" :snapshot="report.reviews" />
    <AppCard v-else title="真实评论与待复核痛点">
      <p class="missing">旧报告没有评论证据，请重新运行调研。</p>
    </AppCard>
    <TrendPanel v-if="report.trend" :trend="report.trend" />
    <AppCard v-else title="趋势数据">
      <p class="missing">趋势数据缺失，本结论已使用剩余维度降级。</p>
    </AppCard>
    <MarketPanel :market="report.market" />

    <AppCard v-if="report.citations.length" title="数据来源">
      <ul class="cites">
        <li v-for="(c, i) in report.citations" :key="i">
          <a :href="c.url" target="_blank" rel="noreferrer">{{ c.label }}</a>
          <span class="src">{{ c.source }}</span>
        </li>
      </ul>
    </AppCard>
  </div>

  <AppCard v-else>
    <EmptyState text="找不到这份结论，可能已被删除" />
  </AppCard>
</template>

<style scoped>
.page { display: grid; gap: 16px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.head h1 { font-size: 22px; }
.meta { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.terms { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.tag {
  padding: 3px 9px; border-radius: 999px; font-size: 12px;
  background: #f0f5ff; color: var(--accent);
}
.tag.alt { background: var(--chip); color: var(--muted); }
.insights { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 18px; }
.insights h4 { margin: 0 0 6px; font-size: 12px; color: var(--muted); }
.insights ul { margin: 0; padding-left: 18px; font-size: 13px; }
.insight-source { margin-left: 6px; color: var(--accent); font-size: 11px; }
.cites { margin: 0; padding-left: 18px; font-size: 13px; }
.cites a { color: var(--accent); }
.src { margin-left: 8px; font-size: 11px; color: var(--muted); }
.missing { margin: 0; color: var(--watch); }
.generation { margin: 0 0 8px; color: var(--muted); font-size: 12px; }
.generation.degraded { color: var(--watch); }
@media (max-width: 800px) { .insights { grid-template-columns: 1fr; } }
</style>
