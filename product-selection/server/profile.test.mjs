import test from 'node:test'
import assert from 'node:assert/strict'

import { createCategoryProfile } from './profile.mjs'

test('builds a deterministic profile from an English category and real hits', () => {
  const result = createCategoryProfile({
    query: {
      keyword: 'women yoga pants',
      market: 'US',
      channels: ['amazon'],
    },
    hits: [
      {
        title: 'Yoga pants market overview',
        url: 'https://example.com/market',
        snippet: 'Market source',
      },
      {
        title: 'Yoga pants product trends',
        url: 'https://example.com/trends',
        snippet: 'Trend source',
      },
    ],
  })

  assert.deepEqual(result, {
    profile: {
      name: 'women yoga pants',
      searchTerms: [
        'women yoga pants',
        'women yoga pants outfit',
        'women yoga pants plus size',
      ],
      relatedTerms: [
        'vintage women yoga pants',
        'oversized women yoga pants',
        'plus size women yoga pants',
      ],
      summary: 'women yoga pants：已整理 2 条 US 市场公开来源，供后续商品、趋势和评分环节使用。',
      audiences: [],
      purchaseDrivers: [],
      validationQuestions: [
        '哪些商品属性在真实评论中最影响购买和退货？',
        '不同渠道的目标人群和可接受价格是否一致？',
      ],
    },
    citations: [
      {
        label: 'Yoga pants market overview',
        url: 'https://example.com/market',
        source: 'discover',
      },
      {
        label: 'Yoga pants product trends',
        url: 'https://example.com/trends',
        source: 'discover',
      },
    ],
  })
})

test('rejects a profile without real search sources', () => {
  assert.throws(
    () => createCategoryProfile({
      query: {
        keyword: 'women yoga pants',
        market: 'US',
        channels: ['amazon'],
      },
      hits: [],
    }),
    (error) => error.status === 422 && error.message === '没有可用的真实搜索来源',
  )
})

test('rejects a Chinese-only category in the deterministic MVP', () => {
  assert.throws(
    () => createCategoryProfile({
      query: {
        keyword: '女士瑜伽裤',
        market: 'US',
        channels: ['amazon'],
      },
      hits: [
        {
          title: 'Yoga pants market overview',
          url: 'https://example.com/market',
          snippet: 'Market source',
        },
      ],
    }),
    (error) => error.status === 400 && error.message === '第一版请输入英文品类关键词',
  )
})

test('rejects an empty category keyword', () => {
  assert.throws(
    () => createCategoryProfile({
      query: {
        keyword: '   ',
        market: 'US',
        channels: ['amazon'],
      },
      hits: [
        {
          title: 'Yoga pants market overview',
          url: 'https://example.com/market',
          snippet: 'Market source',
        },
      ],
    }),
    (error) => error.status === 400 && error.message === 'keyword 不能为空',
  )
})

test('rejects markets outside the first MVP scope', () => {
  assert.throws(
    () => createCategoryProfile({
      query: {
        keyword: 'women yoga pants',
        market: 'EU',
        channels: ['amazon'],
      },
      hits: [
        {
          title: 'Yoga pants market overview',
          url: 'https://example.com/market',
          snippet: 'Market source',
        },
      ],
    }),
    (error) => error.status === 400 && error.message === '第一版仅支持 US 市场',
  )
})

test('rejects a request body without a query object', () => {
  assert.throws(
    () => createCategoryProfile({}),
    (error) => error.status === 400 && error.message === 'keyword 不能为空',
  )
})
