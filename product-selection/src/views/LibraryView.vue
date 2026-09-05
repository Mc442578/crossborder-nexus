<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import AppCard from '@/components/ui/AppCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useLibraryStore } from '@/stores/library'

const library = useLibraryStore()
const { reports } = storeToRefs(library)

const LABEL = { go: '建议做', watch: '再观察', pass: '不建议', insufficient: '数据不足' } as const
const COLOR = {
  go: 'var(--go)', watch: 'var(--watch)', pass: 'var(--pass)', insufficient: 'var(--watch)',
} as const
</script>

<template>
  <div class="page">
    <h1>结论库</h1>
    <AppCard v-if="!reports.length">
      <EmptyState text="还没有沉淀任何选品结论" />
    </AppCard>

    <div v-else class="list">
      <AppCard v-for="r in reports" :key="r.id">
        <div class="row">
          <div class="left">
            <RouterLink :to="`/report/${r.id}`" class="name">{{ r.profile.name }}</RouterLink>
            <p class="meta">
              {{ r.query.market }} · {{ r.market.listings.length }} 个 listing ·
              {{ new Date(r.createdAt).toLocaleDateString('zh-CN') }}
            </p>
          </div>
          <div class="right">
            <span class="decision" :style="{ color: COLOR[r.verdict.decision] }">
              {{ LABEL[r.verdict.decision] }} {{ r.verdict.score ?? '—' }}
            </span>
            <button @click="library.remove(r.id)">删除</button>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
.page { display: grid; gap: 16px; }
h1 { font-size: 22px; }
.list { display: grid; gap: 12px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.name { font-weight: 600; color: var(--text); text-decoration: none; }
.name:hover { color: var(--accent); }
.meta { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
.right { display: flex; align-items: center; gap: 14px; }
.decision { font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
