<script setup lang="ts">
defineProps<{ title?: string; hint?: string }>()
</script>

<template>
  <section class="card">
    <header v-if="title" class="head">
      <h3>{{ title }}</h3>
      <span v-if="hint" class="hint">{{ hint }}</span>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.card {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 18px 20px;
}
.head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.hint { font-size: 12px; color: var(--muted); }
</style>
