<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'
import type { ReviewSnapshot } from '@/types/domain'

const props = defineProps<{ snapshot: ReviewSnapshot }>()

const STATUS_LABEL = {
  success: '已取得评论', empty: '没有返回评论', error: '评论请求失败', unsupported: '暂无竞品评论接口',
} as const

function evidenceReviews(ids: string[]) {
  const allowed = new Set(ids)
  return props.snapshot.reviews.filter((review) => allowed.has(review.id))
}
</script>

<template>
  <AppCard title="真实评论与待复核痛点">
    <div class="status-list">
      <span v-for="item in snapshot.channels" :key="item.channel"
        class="status" :class="item.status">
        {{ item.channel }} · {{ STATUS_LABEL[item.status] }}{{ item.count ? ` ${item.count} 条` : '' }}
      </span>
    </div>
    <p v-for="item in snapshot.channels.filter((channel) => channel.error)"
      :key="`${item.channel}-error`" class="channel-error">
      {{ item.channel }}：{{ item.error }}
    </p>
    <p class="boundary">
      只分析每个可用渠道的一个代表商品，最多保留 20 条公开评论；这是小样本证据，不代表整个品类。
    </p>

    <p v-if="snapshot.painPoints.length" class="boundary">
      下列主题来自低评分评论中的负面表达，仍需人工阅读证据确认是否代表普遍痛点。
    </p>
    <div v-if="snapshot.painPoints.length" class="pain-grid">
      <section v-for="point in snapshot.painPoints" :key="point.key" class="pain-point">
        <strong>{{ point.label }} · {{ point.reviewCount }} 条低评分证据</strong>
        <details v-for="review in evidenceReviews(point.evidenceIds)" :key="review.id">
          <summary>{{ review.channel }} · {{ review.rating }} 星 · {{ review.title || '查看评论证据' }}</summary>
          <blockquote>{{ review.text }}</blockquote>
          <a v-if="review.url" :href="review.url" target="_blank" rel="noreferrer">查看商品来源</a>
        </details>
      </section>
    </div>
    <p v-else class="missing">当前低评分样本没有形成可验证的尺码、面料、做工、舒适度或外观痛点。</p>

    <details v-if="snapshot.reviews.length" class="all-reviews">
      <summary>查看全部 {{ snapshot.reviews.length }} 条评论样本</summary>
      <article v-for="review in snapshot.reviews" :id="review.id" :key="review.id" class="review">
        <strong>{{ review.channel }} · {{ review.rating }} 星 · {{ review.title || review.productTitle }}</strong>
        <span v-if="review.verifiedPurchase">已验证购买</span>
        <p>{{ review.text }}</p>
        <a v-if="review.url" :href="review.url" target="_blank" rel="noreferrer">{{ review.productTitle }}</a>
        <small>抓取时间：{{ new Date(review.fetchedAt).toLocaleString('zh-CN') }}</small>
      </article>
    </details>
  </AppCard>
</template>

<style scoped>
.status-list { display: flex; flex-wrap: wrap; gap: 7px; }
.status { padding: 4px 8px; border-radius: 999px; background: var(--chip); font-size: 12px; }
.status.success { color: var(--go); }
.status.error, .status.unsupported, .status.empty { color: var(--watch); }
.boundary, .missing { color: var(--muted); font-size: 12px; }
.channel-error { margin: 5px 0 0; color: var(--watch); font-size: 12px; }
.pain-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; }
.pain-point { padding: 10px; border: 1px solid var(--line); border-radius: 8px; }
.pain-point strong { font-size: 13px; }
details { margin-top: 7px; }
summary { cursor: pointer; font-size: 12px; }
blockquote { margin: 7px 0; padding-left: 9px; border-left: 2px solid var(--line); font-size: 12px; }
a { color: var(--accent); font-size: 12px; }
.all-reviews { margin-top: 14px; }
.review { display: grid; gap: 5px; margin-top: 9px; padding-top: 9px; border-top: 1px solid var(--line); }
.review strong, .review p { margin: 0; font-size: 12px; }
.review span, .review small { color: var(--muted); font-size: 11px; }
@media (max-width: 800px) { .pain-grid { grid-template-columns: 1fr; } }
</style>
