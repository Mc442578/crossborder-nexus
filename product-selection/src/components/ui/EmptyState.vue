<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <div class="empty">{{ text }}</div>
</template>

<style scoped>
.empty {
  padding: 48px 16px; text-align: center;
  color: var(--muted); font-size: 13px;
}
</style>
