import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateDemandSignal } from './demand-signal.ts'

const listing = (id, extra = {}) => ({
  id,
  title: id,
  channel: 'amazon',
  price: 30,
  currency: 'USD',
  ...extra,
})

test('prefers real monthly sales', () => {
  const result = calculateDemandSignal([
    listing('a', { monthlySales: 1000, reviewCount: 10 }),
    listing('b', { monthlySales: 3000, reviewCount: 20 }),
  ])
  assert.equal(result.source, 'sales')
  assert.equal(result.value, 4000)
  assert.equal(result.sampleSize, 2)
})

test('uses median review count as a labelled proxy', () => {
  const result = calculateDemandSignal([
    listing('a', { reviewCount: 100 }),
    listing('b', { reviewCount: 1000 }),
    listing('c', { reviewCount: 10000 }),
  ])
  assert.equal(result.source, 'reviews')
  assert.equal(result.value, 1000)
  assert.equal(result.sampleSize, 3)
  assert.match(result.label, /评价数.*不等于销量/)
})

test('does not present partially covered monthly sales as a complete total', () => {
  const result = calculateDemandSignal([
    listing('a', { monthlySales: 1000, reviewCount: 100 }),
    listing('b', { reviewCount: 1000 }),
    listing('c', { reviewCount: 10000 }),
  ])
  assert.equal(result.source, 'reviews')
  assert.equal(result.value, 1000)
  assert.doesNotMatch(result.label, /真实月销量合计/)
})

test('reports the actual review coverage instead of the listing count', () => {
  const result = calculateDemandSignal([
    listing('a', { reviewCount: 1000 }),
    ...Array.from({ length: 99 }, (_, index) => listing(`missing-${index}`)),
  ])
  assert.equal(result.source, 'reviews')
  assert.equal(result.sampleSize, 1)
})

test('reports a missing signal when neither field exists', () => {
  const result = calculateDemandSignal([listing('a')])
  assert.equal(result.source, 'missing')
  assert.equal(result.value, null)
  assert.equal(result.score, 0)
  assert.equal(result.sampleSize, 0)
})
