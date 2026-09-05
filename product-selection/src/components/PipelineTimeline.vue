<script setup lang="ts">
import type { StepState } from '@/core/pipeline/types'

defineProps<{ steps: StepState[] }>()

const ICON: Record<string, string> = {
  pending: '○', running: '◐', success: '●', error: '✕', skipped: '—', aborted: '⊘',
}

function duration(s: StepState) {
  if (!s.startedAt || !s.endedAt) return ''
  return `${((s.endedAt - s.startedAt) / 1000).toFixed(1)}s`
}
</script>

<template>
  <ol class="timeline">
    <li v-for="s in steps" :key="s.id" :class="['item', s.status]">
      <span class="icon">{{ ICON[s.status] }}</span>
      <div class="body">
        <div class="row">
          <strong>{{ s.title }}</strong>
          <span class="dur">{{ duration(s) }}</span>
        </div>
        <div class="desc">{{ s.error || s.message || s.description }}</div>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.timeline { list-style: none; margin: 0; padding: 0; }
.item { display: flex; gap: 12px; padding: 10px 0; }
.item + .item { border-top: 1px dashed var(--line); }
.icon { width: 18px; text-align: center; color: var(--muted); flex: none; }
.item.running .icon { color: var(--accent); animation: spin 1.4s linear infinite; }
.item.success .icon { color: var(--go); }
.item.error .icon { color: var(--pass); }
.item.aborted .icon { color: var(--muted); }
.item.aborted .body { opacity: .6; }
.body { flex: 1; min-width: 0; }
.row { display: flex; justify-content: space-between; gap: 12px; }
.dur { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.desc { font-size: 12.5px; color: var(--muted); }
.item.error .desc { color: var(--pass); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
