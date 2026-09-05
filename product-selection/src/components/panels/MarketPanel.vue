<script setup lang="ts">
import { computed } from 'vue'
import AppCard from '@/components/ui/AppCard.vue'
import type { MarketSnapshot } from '@/types/domain'

const props = defineProps<{ market: MarketSnapshot }>()

const maxCount = computed(() => Math.max(1, ...props.market.priceBands.map((b) => b.count)))
const hasCompleteMonthlySales = computed(() => props.market.listings.length > 0
  && props.market.listings.every((listing) =>
    Number.isFinite(listing.monthlySales) && listing.monthlySales! >= 0))
const top = computed(() =>
  [...props.market.listings]
    .sort((a, b) => hasCompleteMonthlySales.value
      ? (b.monthlySales ?? 0) - (a.monthlySales ?? 0)
      : (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, 8),
)
</script>

<template>
  <AppCard title="市场竞争" :hint="`${market.listings.length} 个 listing · ${market.brandCount} 个品牌`">
    <div v-if="market.channelCoverage?.length" class="coverage">
      <span v-for="channel in market.channelCoverage" :key="channel.channel"
        class="coverage-chip" :class="channel.status">
        {{ channel.channel }} · {{ channel.status === 'success' ? `${channel.count} 个` : channel.status === 'partial' ? `${channel.count} 个（部分失败）` : channel.status === 'empty' ? '无结果' : '失败' }}
      </span>
    </div>
    <div class="stats">
      <div class="stat">
        <span class="label">头部集中度 CR4</span>
        <strong>{{ (market.concentration * 100).toFixed(0) }}%</strong>
      </div>
      <div class="stat">
        <span class="label">品牌数</span>
        <strong>{{ market.brandCount }}</strong>
      </div>
    </div>

    <h4 class="sub">价格带分布</h4>
    <div class="bands">
      <div v-for="(b, i) in market.priceBands" :key="i" class="band">
        <div class="bar" :style="{ height: `${(b.count / maxCount) * 100}%` }" />
        <span class="tick">${{ b.min.toFixed(0) }}</span>
      </div>
    </div>

    <h4 class="sub">商品样本</h4>
    <table class="tbl">
      <thead>
        <tr><th>商品</th><th>渠道</th><th>价格</th><th>{{ hasCompleteMonthlySales ? '月销' : '评价数（代理）' }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="l in top" :key="l.id">
          <td class="ellipsis">{{ l.title }}</td>
          <td>{{ l.channel }}</td>
          <td>${{ l.price.toFixed(2) }}</td>
          <td>{{ hasCompleteMonthlySales
            ? (l.monthlySales ?? '—')
            : l.lifetimeSales !== undefined
              ? `累计 ${l.lifetimeSales}`
              : (l.reviewCount ?? '—') }}</td>
        </tr>
      </tbody>
    </table>
  </AppCard>
</template>

<style scoped>
.stats { display: flex; gap: 32px; margin-bottom: 18px; }
.coverage { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.coverage-chip { padding: 3px 8px; border-radius: 999px; font-size: 11px; background: var(--chip); }
.coverage-chip.success { color: var(--go); }
.coverage-chip.partial, .coverage-chip.empty, .coverage-chip.error { color: var(--watch); }
.stat { display: flex; flex-direction: column; }
.stat .label { font-size: 12px; color: var(--muted); }
.stat strong { font-size: 22px; font-variant-numeric: tabular-nums; }
.sub { font-size: 12px; color: var(--muted); margin: 18px 0 8px; font-weight: 500; }
.bands { display: flex; gap: 6px; align-items: flex-end; height: 90px; }
.band { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
.bar { background: var(--accent); border-radius: 3px 3px 0 0; min-height: 2px; opacity: .8; }
.tick { font-size: 10px; color: var(--muted); text-align: center; margin-top: 4px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
.tbl th { text-align: left; font-weight: 500; color: var(--muted); font-size: 12px; padding: 6px 8px; }
.tbl td { padding: 6px 8px; border-top: 1px solid var(--line); }
.tbl th:not(:first-child), .tbl td:not(:first-child) { width: 88px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
