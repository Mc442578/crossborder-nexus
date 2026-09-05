import test from 'node:test'
import assert from 'node:assert/strict'

import { validateCategoryProfile } from './category-profile-ai.mjs'

test('rejects a profile containing an unknown evidence id', () => {
  const profile = {
    name: 'Women Yoga Pants',
    searchTerms: ['women yoga pants'],
    relatedTerms: [],
    summary: '女式瑜伽裤品类画像。',
    audiences: [],
    purchaseDrivers: [],
    validationQuestions: ['需要验证哪些真实评论痛点？'],
    evidenceIds: ['fake-999'],
  }

  assert.throws(
    () => validateCategoryProfile(profile, ['evidence-1']),
    /不存在的证据/,
  )
})

test('rejects non-English product search terms', () => {
  assert.throws(
    () => validateCategoryProfile({
      name: 'Women Yoga Pants',
      searchTerms: ['女士瑜伽裤'],
      relatedTerms: [],
      summary: '品类画像。',
      audiences: [],
      purchaseDrivers: [],
      validationQuestions: ['需要验证哪些真实评论痛点？'],
      evidenceIds: ['evidence-1'],
    }, ['evidence-1']),
    /searchTerms 必须包含英文/,
  )
})

test('accepts evidence-grounded audiences, purchase drivers and validation questions', () => {
  const result = validateCategoryProfile({
    name: 'Women Yoga Pants',
    searchTerms: ['women yoga pants'],
    relatedTerms: ['high waisted yoga pants'],
    summary: '公开证据提到高腰设计。',
    audiences: [{ text: '关注高腰支撑的女性消费者', evidenceIds: ['evidence-1'] }],
    purchaseDrivers: [{ text: '高腰支撑', evidenceIds: ['evidence-1'] }],
    validationQuestions: ['真实评论中是否经常出现尺码问题？'],
    evidenceIds: ['evidence-1'],
  }, ['evidence-1'])

  assert.deepEqual(result.purchaseDrivers, [{
    text: '高腰支撑', evidenceIds: ['evidence-1'],
  }])
  assert.deepEqual(result.validationQuestions, ['真实评论中是否经常出现尺码问题？'])
})

test('rejects an insight containing an unknown evidence id', () => {
  assert.throws(() => validateCategoryProfile({
    name: 'Women Yoga Pants',
    searchTerms: ['women yoga pants'],
    relatedTerms: [],
    summary: '公开证据提到高腰设计。',
    audiences: [{ text: '关注高腰支撑的人群', evidenceIds: ['fake-999'] }],
    purchaseDrivers: [],
    validationQuestions: ['真实评论中是否经常出现尺码问题？'],
    evidenceIds: ['evidence-1'],
  }, ['evidence-1']), /不存在的证据/)
})
