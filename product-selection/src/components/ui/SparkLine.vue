<script setup lang="ts">
import { computed } from 'vue'

/**
 * 零依赖折线图。够用即可 —— 真要做交互式图表，
 * 这里换成 ECharts / VisActor 是最自然的扩展点。
 */
const props = withDefaults(defineProps<{
  values: number[]
  width?: number
  height?: number
  color?: string
}>(), { width: 560, height: 140, color: 'var(--accent)' })

const path = computed(() => {
  const vs = props.values
  if (vs.length < 2) return ''
  const max = Math.max(...vs)
  const min = Math.min(...vs)
  const span = max - min || 1
  const stepX = props.width / (vs.length - 1)
  return vs
    .map((v, i) => {
      const x = i * stepX
      const y = props.height - ((v - min) / span) * (props.height - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="spark" preserveAspectRatio="none">
    <path :d="path" fill="none" :stroke="color" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.spark { width: 100%; height: 140px; display: block; }
</style>
