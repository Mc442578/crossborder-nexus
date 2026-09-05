<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

const dataSource = import.meta.env.VITE_DATA_SOURCE || 'mock'
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">选品工作台<span class="badge">demo</span></div>
      <nav>
        <RouterLink to="/">工作台</RouterLink>
        <RouterLink to="/library">结论库</RouterLink>
      </nav>
      <div class="ds-tag">数据源：{{ dataSource }}</div>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app { min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  display: flex; align-items: center; gap: 24px;
  padding: 0 24px; height: 56px;
  border-bottom: 1px solid var(--line); background: var(--surface);
}
.brand { font-weight: 650; letter-spacing: .02em; }
.badge {
  margin-left: 8px; padding: 2px 6px; border-radius: 4px;
  font-size: 11px; font-weight: 500; color: var(--muted); background: var(--chip);
}
nav { display: flex; gap: 4px; }
nav a {
  padding: 6px 12px; border-radius: 6px;
  color: var(--muted); text-decoration: none; font-size: 14px;
}
nav a:hover { background: var(--chip); color: var(--text); }
nav a.router-link-active { background: var(--chip); color: var(--text); font-weight: 550; }
.ds-tag { margin-left: auto; font-size: 12px; color: var(--muted); }
.main { flex: 1; padding: 24px; max-width: 1180px; width: 100%; margin: 0 auto; }
</style>
