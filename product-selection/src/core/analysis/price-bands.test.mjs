import test from 'node:test'
import assert from 'node:assert/strict'

import { buildQuantilePriceBands } from './price-bands.ts'

test('splits sorted listings by sample position instead of equal price width', () => {
  const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000]
  const listings = prices.map((price, index) => ({
    id: String(index),
    title: String(index),
    channel: 'amazon',
    price,
    currency: 'USD',
  }))

  const bands = buildQuantilePriceBands(listings)

  assert.deepEqual(bands.map((band) => band.count), [3, 3, 4])
  assert.deepEqual(bands[0], { min: 10, max: 12, count: 3 })
  assert.deepEqual(bands[2], { min: 16, max: 1000, count: 4 })
})

test('uses one band when fewer than three prices are available', () => {
  const listings = [10, 20].map((price, index) => ({
    id: String(index), title: String(index), channel: 'amazon', price, currency: 'USD',
  }))
  assert.deepEqual(buildQuantilePriceBands(listings), [{ min: 10, max: 20, count: 2 }])
})
