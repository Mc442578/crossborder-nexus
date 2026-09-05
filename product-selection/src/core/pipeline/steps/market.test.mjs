import test from 'node:test'
import assert from 'node:assert/strict'

import { marketStep } from './market.ts'

test('does not group every unbranded listing into one brand', async () => {
  const listings = [
    { id: 'a-1', title: 'A1', channel: 'amazon', brand: 'Brand A', price: 10, currency: 'USD' },
    { id: 'a-2', title: 'A2', channel: 'amazon', brand: 'Brand A', price: 11, currency: 'USD' },
    { id: 'b-1', title: 'B1', channel: 'amazon', brand: 'Brand B', price: 12, currency: 'USD' },
    { id: 'b-2', title: 'B2', channel: 'amazon', brand: 'Brand B', price: 13, currency: 'USD' },
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `unknown-${index}`,
      title: `Unknown ${index}`,
      channel: 'amazon',
      price: 14 + index,
      currency: 'USD',
    })),
  ]
  const ctx = { query: { keyword: 'women yoga pants' }, profile: { searchTerms: ['women yoga pants'] } }
  const rt = {
    ds: { fetchListings: async () => ({
      listings,
      channels: [{ channel: 'amazon', status: 'success', count: listings.length }],
    }) },
    signal: new AbortController().signal,
    report: () => {},
  }

  await marketStep.run(ctx, rt)

  assert.equal(ctx.market.concentration, 0.6)
  assert.deepEqual(ctx.market.channelCoverage, [
    { channel: 'amazon', status: 'success', count: listings.length },
  ])
})

test('keeps successful listings and records partial channel coverage', async () => {
  const listings = [
    { id: 'a-1', title: 'A1', channel: 'amazon', brand: 'Brand A', price: 10, currency: 'USD' },
  ]
  const channels = [
    { channel: 'amazon', status: 'success', count: 1 },
    { channel: 'walmart', status: 'error', count: 0, error: 'upstream failed' },
  ]
  const ctx = {
    query: { keyword: 'women yoga pants', channels: ['amazon', 'walmart'] },
    profile: { searchTerms: ['women yoga pants'] },
  }
  const rt = {
    ds: { fetchListings: async () => ({ listings, channels }) },
    signal: new AbortController().signal,
    report: () => {},
  }

  await marketStep.run(ctx, rt)

  assert.equal(ctx.market.listings.length, 1)
  assert.deepEqual(ctx.market.channelCoverage, channels)
})
