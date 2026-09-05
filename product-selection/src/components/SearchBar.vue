<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { CategoryQuery, Channel } from '@/types/domain'

const emit = defineEmits<{ submit: [CategoryQuery]; abort: [] }>()
defineProps<{ running: boolean }>()

const CHANNELS: { value: Channel; label: string; available: boolean }[] = [
  { value: 'amazon', label: '亚马逊', available: true },
  { value: 'walmart', label: '沃尔玛', available: true },
  { value: 'tiktok', label: 'TikTok · 需 Seller 授权', available: true },
]

const CATEGORY_EXAMPLES = [
  { label: '上装', terms: [
    { value: 't shirts', label: 'T恤' }, { value: 'blouses', label: '女式衬衫' },
    { value: 'sweaters', label: '毛衣' }, { value: 'hoodies', label: '连帽卫衣' },
    { value: 'tank tops', label: '背心' }, { value: 'crop tops', label: '短款上衣' },
    { value: 'polo shirts', label: 'POLO衫' }, { value: 'button down shirts', label: '纽扣衬衫' },
    { value: 'camisoles', label: '吊带背心' }, { value: 'tunic tops', label: '长款上衣' },
    { value: 'sweatshirts', label: '套头卫衣' }, { value: 'knit vests', label: '针织马甲' },
    { value: 'henley shirts', label: '亨利领上衣' }, { value: 'off shoulder tops', label: '露肩上衣' },
    { value: 'peplum tops', label: '荷叶摆上衣' },
  ] },
  { label: '下装', terms: [
    { value: 'jeans', label: '牛仔裤' }, { value: 'cargo pants', label: '工装裤' },
    { value: 'leggings', label: '紧身裤' }, { value: 'shorts', label: '短裤' },
    { value: 'wide leg pants', label: '阔腿裤' },
    { value: 'joggers', label: '束脚裤' }, { value: 'sweatpants', label: '运动卫裤' },
    { value: 'chino pants', label: '休闲斜纹裤' }, { value: 'capri pants', label: '七分裤' },
    { value: 'flare pants', label: '喇叭裤' }, { value: 'high waisted pants', label: '高腰裤' },
    { value: 'straight leg pants', label: '直筒裤' }, { value: 'palazzo pants', label: '宽松阔腿裤' },
    { value: 'corduroy pants', label: '灯芯绒裤' }, { value: 'linen pants', label: '亚麻裤' },
  ] },
  { label: '裙装', terms: [
    { value: 'summer dresses', label: '夏季连衣裙' }, { value: 'midi skirts', label: '中长裙' },
    { value: 'maxi dresses', label: '长款连衣裙' }, { value: 'mini skirts', label: '短裙' },
    { value: 'bodycon dresses', label: '紧身连衣裙' }, { value: 'wrap dresses', label: '裹身裙' },
    { value: 'shirt dresses', label: '衬衫裙' }, { value: 'pleated skirts', label: '百褶裙' },
    { value: 'denim skirts', label: '牛仔裙' }, { value: 'slip dresses', label: '吊带裙' },
    { value: 'sundresses', label: '太阳裙' }, { value: 'a line skirts', label: 'A字裙' },
    { value: 'cargo skirts', label: '工装裙' }, { value: 'skater dresses', label: '伞摆连衣裙' },
    { value: 'sweater dresses', label: '毛衣裙' },
  ] },
  { label: '运动服', terms: [
    { value: 'sports bras', label: '运动内衣' }, { value: 'running shorts', label: '跑步短裤' },
    { value: 'yoga pants', label: '瑜伽裤' }, { value: 'compression shirts', label: '压缩衣' },
    { value: 'tennis skirts', label: '网球裙' },
    { value: 'workout leggings', label: '健身紧身裤' }, { value: 'track jackets', label: '运动夹克' },
    { value: 'cycling shorts', label: '骑行短裤' }, { value: 'golf shirts', label: '高尔夫衫' },
    { value: 'athletic sets', label: '运动套装' }, { value: 'running jackets', label: '跑步外套' },
    { value: 'gym shorts', label: '健身短裤' }, { value: 'sports tank tops', label: '运动背心' },
    { value: 'soccer jerseys', label: '足球球衣' }, { value: 'pickleball dresses', label: '匹克球连衣裙' },
  ] },
  { label: '外套', terms: [
    { value: 'denim jackets', label: '牛仔夹克' }, { value: 'puffer jackets', label: '羽绒夹克' },
    { value: 'blazers', label: '西装外套' }, { value: 'trench coats', label: '风衣' },
    { value: 'cardigans', label: '开衫' },
    { value: 'bomber jackets', label: '飞行夹克' }, { value: 'leather jackets', label: '皮夹克' },
    { value: 'rain jackets', label: '防雨夹克' }, { value: 'wool coats', label: '羊毛大衣' },
    { value: 'fleece jackets', label: '抓绒外套' }, { value: 'parkas', label: '派克大衣' },
    { value: 'windbreakers', label: '防风衣' }, { value: 'varsity jackets', label: '棒球夹克' },
    { value: 'sherpa jackets', label: '羊羔绒夹克' }, { value: 'quilted jackets', label: '绗缝夹克' },
  ] },
  { label: '内衣家居', terms: [
    { value: 'bras', label: '文胸' }, { value: 'shapewear', label: '塑身衣' },
    { value: 'pajamas', label: '睡衣' }, { value: 'boxer briefs', label: '平角内裤' },
    { value: 'seamless underwear', label: '无痕内衣' },
    { value: 'lingerie sets', label: '内衣套装' }, { value: 'sleep shirts', label: '睡裙衬衫' },
    { value: 'robes', label: '浴袍' }, { value: 'thermal underwear', label: '保暖内衣' },
    { value: 'lounge pants', label: '家居裤' }, { value: 'bralettes', label: '无钢圈文胸' },
    { value: 'bikini underwear', label: '比基尼内裤' }, { value: 'mens briefs', label: '男士三角内裤' },
    { value: 'nightgowns', label: '睡裙' }, { value: 'maternity bras', label: '孕妇文胸' },
  ] },
  { label: '泳装', terms: [
    { value: 'one piece swimsuits', label: '连体泳衣' }, { value: 'bikinis', label: '比基尼' },
    { value: 'swim trunks', label: '男士泳裤' }, { value: 'rash guards', label: '防晒冲浪衣' },
    { value: 'tankinis', label: '背心式泳装' }, { value: 'swim dresses', label: '裙式泳衣' },
    { value: 'board shorts', label: '沙滩裤' }, { value: 'swimsuit cover ups', label: '泳装罩衫' },
    { value: 'high waisted bikinis', label: '高腰比基尼' }, { value: 'swim shorts', label: '泳装短裤' },
    { value: 'modest swimsuits', label: '保守型泳装' }, { value: 'plus size swimsuits', label: '大码泳装' },
    { value: 'maternity swimsuits', label: '孕妇泳装' }, { value: 'kids swimsuits', label: '儿童泳装' },
    { value: 'swim leggings', label: '游泳紧身裤' },
  ] },
  { label: '商务正装', terms: [
    { value: 'business suits', label: '商务西装' }, { value: 'dress shirts', label: '正装衬衫' },
    { value: 'suit pants', label: '西裤' }, { value: 'pencil skirts', label: '铅笔裙' },
    { value: 'cocktail dresses', label: '鸡尾酒裙' }, { value: 'evening dresses', label: '晚礼服' },
    { value: 'waistcoats', label: '西装马甲' }, { value: 'formal jumpsuits', label: '正式连体裤' },
    { value: 'tuxedo jackets', label: '礼服夹克' }, { value: 'work dresses', label: '通勤连衣裙' },
    { value: 'office blouses', label: '办公室衬衫' }, { value: 'dress pants', label: '正装长裤' },
    { value: 'prom dresses', label: '舞会礼服' }, { value: 'bridesmaid dresses', label: '伴娘礼服' },
    { value: 'formal vests', label: '正式马甲' },
  ] },
  { label: '套装连体', terms: [
    { value: 'two piece outfits', label: '两件套' }, { value: 'matching sets', label: '配套套装' },
    { value: 'jumpsuits', label: '连体裤' }, { value: 'rompers', label: '连体短裤' },
    { value: 'skirt sets', label: '裙装套装' }, { value: 'pants sets', label: '裤装套装' },
    { value: 'tracksuits', label: '运动套装' }, { value: 'loungewear sets', label: '家居套装' },
    { value: 'sweater sets', label: '针织套装' }, { value: 'shorts sets', label: '短裤套装' },
    { value: 'blazer sets', label: '西装套装' }, { value: 'pajama sets', label: '睡衣套装' },
    { value: 'family matching outfits', label: '家庭亲子装' }, { value: 'workout sets', label: '健身套装' },
    { value: 'vacation outfits', label: '度假套装' },
  ] },
  { label: '童装', terms: [
    { value: 'girls dresses', label: '女童连衣裙' }, { value: 'boys shirts', label: '男童衬衫' },
    { value: 'kids pajamas', label: '儿童睡衣' }, { value: 'toddler outfits', label: '幼儿套装' },
    { value: 'baby bodysuits', label: '婴儿连体衣' }, { value: 'girls leggings', label: '女童紧身裤' },
    { value: 'boys shorts', label: '男童短裤' }, { value: 'kids jackets', label: '儿童夹克' },
    { value: 'baby rompers', label: '婴儿连身衣' }, { value: 'girls skirts', label: '女童裙子' },
    { value: 'boys pants', label: '男童长裤' }, { value: 'kids hoodies', label: '儿童连帽卫衣' },
    { value: 'school uniforms', label: '校服' }, { value: 'baby pajamas', label: '婴儿睡衣' },
    { value: 'kids swimwear', label: '儿童泳装' },
  ] },
  { label: '服饰配件', terms: [
    { value: 'baseball caps', label: '棒球帽' }, { value: 'beanies', label: '针织帽' },
    { value: 'scarves', label: '围巾' }, { value: 'belts', label: '腰带' },
    { value: 'fashion gloves', label: '时尚手套' }, { value: 'neck ties', label: '领带' },
    { value: 'hair accessories', label: '发饰' }, { value: 'fashion socks', label: '时尚袜子' },
    { value: 'bucket hats', label: '渔夫帽' }, { value: 'headbands', label: '发带' },
    { value: 'suspenders', label: '背带' }, { value: 'bow ties', label: '领结' },
    { value: 'arm sleeves', label: '防晒袖套' }, { value: 'leg warmers', label: '护腿袜套' },
    { value: 'bandanas', label: '方巾' },
  ] },
  { label: '细分人群', terms: [
    { value: 'plus size jeans', label: '大码牛仔裤' },
    { value: 'men compression shirts', label: '男士压缩衣' },
    { value: 'maternity dresses', label: '孕妇连衣裙' },
    { value: 'petite dresses', label: '小个子连衣裙' },
    { value: 'big and tall shirts', label: '大码高个男士衬衫' },
    { value: 'plus size dresses', label: '大码连衣裙' },
    { value: 'adaptive clothing', label: '无障碍适应性服装' },
    { value: 'nursing tops', label: '哺乳上衣' },
    { value: 'tall women pants', label: '高个女士长裤' },
    { value: 'teen girls clothing', label: '少女服装' },
    { value: 'plus size tops', label: '大码上衣' },
    { value: 'petite jeans', label: '小个子牛仔裤' },
    { value: 'maternity leggings', label: '孕妇紧身裤' },
    { value: 'senior clothing', label: '中老年服装' },
    { value: 'modest dresses', label: '保守型连衣裙' },
  ] },
] as const

const selectedCategory = ref(0)
const visibleExamples = computed(() => CATEGORY_EXAMPLES[selectedCategory.value]?.terms ?? [])

const form = reactive<CategoryQuery>({
  keyword: '',
  market: 'US',
  channels: ['amazon'],
})

const costs = reactive({
  purchaseCost: null as number | null,
  firstMileCost: null as number | null,
  advertisingPercent: null as number | null,
})

function isNonNegativeNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0
}

function isValidPercent(value: number | null): value is number {
  return isNonNegativeNumber(value) && value <= 100
}

const validCosts = computed(() =>
  isNonNegativeNumber(costs.purchaseCost)
  && isNonNegativeNumber(costs.firstMileCost)
  && isValidPercent(costs.advertisingPercent))

function chooseExample(term: string) {
  form.keyword = term
}

function submit() {
  if (!form.keyword.trim() || !form.channels.length || !validCosts.value) return
  emit('submit', {
    ...form,
    keyword: form.keyword.trim(),
    channels: [...form.channels],
    costs: {
      purchaseCost: Number(costs.purchaseCost),
      firstMileCost: Number(costs.firstMileCost),
      advertisingRate: Number(costs.advertisingPercent) / 100,
    },
  })
}
</script>

<template>
  <form class="bar" @submit.prevent="submit">
    <input v-model="form.keyword" placeholder="输入英文服装品类，如：women yoga pants"
      :disabled="running" />

    <span class="market-label">美国市场 · USD</span>

    <div class="channels">
      <label v-for="c in CHANNELS" :key="c.value" class="chip"
        :class="{ on: form.channels.includes(c.value), unavailable: !c.available }">
        <input v-model="form.channels" type="checkbox" :value="c.value"
          :disabled="running || !c.available" />
        {{ c.label }}
      </label>
    </div>

    <div class="examples" aria-label="英文服装品类快捷筛选">
      <div class="example-heading">
        <strong>快捷选品</strong>
        <span>先选大类，再点一个英文品类填入搜索框</span>
      </div>
      <div class="category-tabs" role="tablist" aria-label="服装大类">
        <button v-for="(category, index) in CATEGORY_EXAMPLES" :key="category.label"
          type="button" role="tab" class="category-tab"
          :class="{ active: selectedCategory === index }"
          :aria-selected="selectedCategory === index"
          :disabled="running" @click="selectedCategory = index">
          {{ category.label }}
        </button>
      </div>
      <div class="term-list" role="group" aria-label="可搜索英文品类">
        <button v-for="term in visibleExamples" :key="term.value" type="button" class="term-chip"
          :class="{ active: form.keyword.trim().toLowerCase() === term.value.toLowerCase() }"
          :disabled="running" @click="chooseExample(term.value)">
          {{ term.value }}（{{ term.label }}）
        </button>
      </div>
      <p class="example-note">这里只列常用品类；也可以直接输入其他英文服装品类。</p>
    </div>

    <details class="costs" open>
      <summary>每件商品成本（必填）</summary>
      <div class="cost-grid">
        <label>采购价 $/件<input v-model.number="costs.purchaseCost" type="number" min="0" step="0.01" :disabled="running" /></label>
        <label>头程物流费（跨境段）$/件<input v-model.number="costs.firstMileCost" type="number" min="0" step="0.01" :disabled="running" /></label>
        <label>广告费占售价 %<input v-model.number="costs.advertisingPercent" type="number" min="0" max="100" step="0.1" :disabled="running" /></label>
      </div>
      <p class="cost-note">这里只填写你自己的采购、头程物流和广告预算；平台抽成会按渠道和中位售价自动计算。</p>
      <p v-if="!validCosts" class="cost-error">请填写每件采购价、头程物流费和广告占比；金额不能为负数，广告占比必须在 0～100% 之间</p>
    </details>

    <button v-if="!running" class="primary" type="submit"
      :disabled="!form.keyword.trim() || !form.channels.length || !validCosts">
      开始调研
    </button>
    <button v-else type="button" @click="emit('abort')">中止</button>
  </form>
</template>

<style scoped>
.bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.bar > input { flex: 1; min-width: 260px; }
.market-label { color: var(--muted); font-size: 13px; }
.channels { display: flex; gap: 6px; }
.chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--line); background: var(--surface);
  color: var(--muted); cursor: default; user-select: none;
}
.chip.on { border-color: var(--accent); color: var(--accent); background: #f0f5ff; }
.chip.unavailable { cursor: not-allowed; opacity: .55; }
.chip input { display: none; }
.examples {
  flex-basis: 100%; display: grid; gap: 10px;
  padding: 12px; border-radius: 10px; background: var(--chip);
  color: var(--muted); font-size: 12px;
}
.examples strong { color: var(--text); }
.example-heading { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.category-tabs, .term-list { display: flex; gap: 7px; flex-wrap: wrap; }
.category-tab, .term-chip {
  border: 1px solid var(--line); background: var(--surface); color: var(--muted);
  border-radius: 8px; cursor: pointer; transition: border-color .15s, color .15s, background .15s;
}
.category-tab { padding: 6px 11px; font-weight: 600; }
.term-chip { padding: 5px 10px; border-radius: 999px; }
.category-tab:hover, .term-chip:hover,
.category-tab.active, .term-chip.active {
  border-color: var(--accent); color: var(--accent); background: #f0f5ff;
}
.category-tab:disabled, .term-chip:disabled { cursor: not-allowed; opacity: .55; }
.example-note { margin: 0; }
.costs { flex-basis: 100%; font-size: 13px; color: var(--muted); }
.costs summary { cursor: pointer; width: fit-content; }
.cost-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.cost-grid label { display: flex; align-items: center; gap: 5px; }
.cost-grid input { width: 82px; }
.cost-error { color: var(--pass); margin: 6px 0 0; }
.cost-note { margin: 6px 0 0; font-size: 12px; }
</style>
