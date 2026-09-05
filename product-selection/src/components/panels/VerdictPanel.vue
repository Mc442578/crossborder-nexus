<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'
import type { Verdict } from '@/types/domain'

defineProps<{ verdict: Verdict }>()

const LABEL = { go: '建议做', watch: '再观察', pass: '不建议', insufficient: '数据不足' } as const
const COLOR = {
  go: 'var(--go)', watch: 'var(--watch)', pass: 'var(--pass)', insufficient: 'var(--watch)',
} as const
</script>

<template>
  <AppCard title="选品结论">
    <p v-if="verdict.dataCompleteness === 'partial'" class="partial">
      当前为 partial 结论：部分数据缺失，请结合风险提示复核。
    </p>
    <div class="verdict">
      <div class="score" :style="{ borderColor: COLOR[verdict.decision] }">
        <strong :style="{ color: COLOR[verdict.decision] }">{{ verdict.score ?? '—' }}</strong>
        <span :style="{ color: COLOR[verdict.decision] }">{{ LABEL[verdict.decision] }}</span>
      </div>
      <div class="dims">
        <div v-for="d in verdict.dimensions" :key="d.key" class="dim">
          <div class="dim-head">
            <span>{{ d.label }}</span>
            <span class="num">{{ d.score.toFixed(0) }}</span>
          </div>
          <div class="track"><div class="fill" :style="{ width: `${d.score}%` }" /></div>
          <div class="note">{{ d.note }}</div>
        </div>
      </div>
    </div>

    <div v-if="verdict.confidence || verdict.unitEconomics" class="evidence">
      <div v-if="verdict.confidence" class="evidence-block">
        <h4>结论可信度</h4>
        <strong>{{ verdict.confidence.score }} 分 · {{ { high: '高', medium: '中', low: '低' }[verdict.confidence.level] }}</strong>
        <p>样本 {{ verdict.confidence.sampleSize }} 个 · 来源 {{ verdict.confidence.sourceCount }} 个</p>
        <p>数据时间：{{ new Date(verdict.confidence.analyzedAt).toLocaleString('zh-CN') }}</p>
        <p v-if="verdict.confidence.missing.length" class="warning">
          缺失：{{ verdict.confidence.missing.join('、') }}
        </p>
      </div>
      <div v-if="verdict.unitEconomics" class="evidence-block channel-profit">
        <h4>各渠道简化单件毛利估算（美国服装费率）</h4>
        <div v-for="item in (verdict.channelEconomics ?? [])" :key="item.channel" class="channel-row">
          <strong>{{ item.channel }} · 单件利润 ${{ item.unitProfit.toFixed(2) }} · 毛利率 {{ (item.marginRate * 100).toFixed(1) }}%</strong>
          <p>
            中位售价 {{ item.currency }} {{ item.sellingPrice.toFixed(2) }} −
            采购 ${{ item.purchaseCost.toFixed(2) }} − 头程物流 ${{ item.firstMileCost.toFixed(2) }} −
            佣金 {{ (item.platformFeeRate * 100).toFixed(0) }}%（${{ item.platformFee.toFixed(2) }}）−
            <template v-if="item.affiliateCommissionRate !== undefined">
              联盟佣金 {{ (item.affiliateCommissionRate * 100).toFixed(1) }}%（${{ item.affiliateCommission?.toFixed(2) }}）−
            </template>
            广告 ${{ item.advertisingCost.toFixed(2) }} · 样本 {{ item.sampleSize }} 个
          </p>
          <p v-if="item.platformFeeMinimumApplied" class="warning">Amazon 推荐费已应用每件最低 $0.30。</p>
        </div>
        <p class="warning">
          TikTok 同时扣除 6% 平台费和联盟商品中位佣金；无联盟佣金数据时不展示可比较利润。
        </p>
        <p class="warning">
          本估算不含履约或末端配送、仓储、退货损耗、税费与促销成本，不能直接等同最终净利润。
        </p>
        <div v-if="!verdict.channelEconomics?.length" class="channel-row">
          <strong>旧版综合估算 · 单件利润 ${{ verdict.unitEconomics.unitProfit.toFixed(2) }} · 毛利率 {{ (verdict.unitEconomics.marginRate * 100).toFixed(1) }}%</strong>
          <p>这份旧报告尚未按渠道拆分，请重新运行调研获取 Amazon、Walmart、TikTok 明细。</p>
        </div>
      </div>
    </div>

    <div class="lists">
      <div v-if="verdict.reasons.length">
        <h4>支撑理由</h4>
        <ul><li v-for="(r, i) in verdict.reasons" :key="i">{{ r }}</li></ul>
      </div>
      <div v-if="verdict.risks.length">
        <h4>风险提示</h4>
        <ul class="risk"><li v-for="(r, i) in verdict.risks" :key="i">{{ r }}</li></ul>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.verdict { display: flex; gap: 28px; align-items: flex-start; }
.partial { margin: 0 0 14px; color: var(--watch); font-size: 13px; }
.score {
  flex: none; width: 116px; height: 116px; border: 3px solid; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.score strong { font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums; }
.score span { font-size: 13px; margin-top: 4px; }
.dims { flex: 1; display: grid; gap: 10px; }
.dim-head { display: flex; justify-content: space-between; font-size: 13px; }
.num { color: var(--muted); font-variant-numeric: tabular-nums; }
.track { height: 5px; background: var(--chip); border-radius: 3px; overflow: hidden; margin: 3px 0; }
.fill { height: 100%; background: var(--accent); border-radius: 3px; }
.note { font-size: 11.5px; color: var(--muted); }
.evidence { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
.evidence-block { padding: 12px; border: 1px solid var(--line); border-radius: 8px; }
.evidence-block h4 { margin: 0 0 6px; font-size: 12px; color: var(--muted); font-weight: 500; }
.evidence-block strong { font-size: 14px; }
.evidence-block p { margin: 5px 0 0; font-size: 12px; color: var(--muted); }
.evidence-block .warning { color: var(--watch); }
.channel-profit { grid-column: span 2; }
.channel-row + .channel-row { border-top: 1px solid var(--line); margin-top: 9px; padding-top: 9px; }
.lists { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 22px; }
.lists h4 { font-size: 12px; color: var(--muted); font-weight: 500; margin-bottom: 6px; }
.lists ul { margin: 0; padding-left: 18px; font-size: 13px; }
.lists li { margin-bottom: 4px; }
.risk li { color: var(--pass); }
</style>
