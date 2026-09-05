<script setup lang="ts">
import { computed } from 'vue'
import AppCard from '@/components/ui/AppCard.vue'
import SparkLine from '@/components/ui/SparkLine.vue'
import type { TrendSnapshot } from '@/types/domain'

const props = defineProps<{ trend: TrendSnapshot }>()

const LABEL = { rising: '上升', flat: '平稳', declining: '衰退' } as const
const COLOR = { rising: 'var(--go)', flat: 'var(--watch)', declining: 'var(--pass)' } as const

const values = computed(() => props.trend.series.map((p) => p.value))
</script>

<template>
  <AppCard title="趋势走向" :hint="`近 ${trend.series.length} 个月`">
    <div class="stats">
      <div class="stat">
        <span class="label">走向</span>
        <strong :style="{ color: COLOR[trend.direction] }">{{ LABEL[trend.direction] }}</strong>
      </div>
      <div class="stat">
        <span class="label">同比</span>
        <strong>{{ trend.yoyChange > 0 ? '+' : '' }}{{ trend.yoyChange }}%</strong>
      </div>
      <div class="stat">
        <span class="label">季节高峰</span>
        <strong>{{ trend.seasonalPeaks.length ? trend.seasonalPeaks.join('、') + ' 月' : '不明显' }}</strong>
      </div>
    </div>
    <SparkLine :values="values" :color="COLOR[trend.direction]" />
  </AppCard>
</template>

<style scoped>
.stats { display: flex; gap: 32px; margin-bottom: 10px; }
.stat { display: flex; flex-direction: column; }
.stat .label { font-size: 12px; color: var(--muted); }
.stat strong { font-size: 20px; font-variant-numeric: tabular-nums; }
</style>
