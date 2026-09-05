import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateConfidence } from './confidence.ts'

const base = {
  sampleSize: 50,
  signalSampleSize: 50,
  sourceCount: 3,
  hasCosts: true,
  analyzedAt: '2026-08-31T04:00:00.000Z',
  extraMissing: [],
}

test('allows high confidence with real sales and complete inputs', () => {
  const result = calculateConfidence({ ...base, demandSource: 'sales' })
  assert.equal(result.score, 100)
  assert.equal(result.level, 'high')
  assert.deepEqual(result.missing, [])
})

test('caps a review proxy at medium confidence', () => {
  const result = calculateConfidence({ ...base, demandSource: 'reviews' })
  assert.equal(result.score, 79)
  assert.equal(result.level, 'medium')
  assert.ok(result.missing.includes('可靠月销量（当前使用评价数代理）'))
})

test('records missing cost and demand inputs', () => {
  const result = calculateConfidence({
    ...base,
    hasCosts: false,
    demandSource: 'missing',
    extraMissing: ['趋势数据'],
  })
  assert.ok(result.missing.includes('完整成本'))
  assert.ok(result.missing.includes('需求信号'))
  assert.ok(result.missing.includes('趋势数据'))
})

test('caps incomplete dimension coverage at medium confidence', () => {
  const result = calculateConfidence({
    ...base,
    demandSource: 'sales',
    extraMissing: ['趋势数据'],
  })
  assert.equal(result.score, 79)
  assert.equal(result.level, 'medium')
})

test('keeps confidence low when there are no real citations', () => {
  const result = calculateConfidence({
    ...base,
    sourceCount: 0,
    demandSource: 'sales',
  })
  assert.equal(result.score, 59)
  assert.equal(result.level, 'low')
  assert.ok(result.missing.includes('真实引用'))
})

test('uses demand coverage rather than all listings for the sample score', () => {
  const result = calculateConfidence({
    ...base,
    sampleSize: 100,
    signalSampleSize: 1,
    demandSource: 'reviews',
  })
  assert.equal(result.level, 'low')
  assert.ok(result.missing.includes('需求信号覆盖不完整'))
})
