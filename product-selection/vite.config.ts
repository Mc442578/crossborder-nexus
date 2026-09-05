import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // 刻意避开 5173：那是 Vite 默认端口，本机多开项目时极易撞车。
    // strictPort 让冲突直接报错，而不是静默换端口 / IPv4-IPv6 双绑导致代理"看起来 404"
    port: 5273,
    strictPort: true,
    host: '0.0.0.0',
    // 三方 API 全部经 BFF 中转，浏览器永远拿不到 key
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
