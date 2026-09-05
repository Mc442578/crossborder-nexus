import assert from 'node:assert/strict'
import test from 'node:test'
import { stableCacheKey, TtlCache } from './ttl-cache.mjs'

test('hits before TTL and reloads after expiry', async () => {
  let now = 1_000
  let calls = 0
  const cache = new TtlCache({ now: () => now })
  const load = () => cache.getOrLoad('same', async () => ({ call: ++calls }), { ttlMs: 100 })

  assert.equal((await load()).cache, 'miss')
  assert.deepEqual(await load(), { value: { call: 1 }, cache: 'hit', stored: true })
  now = 1_101
  assert.deepEqual(await load(), { value: { call: 2 }, cache: 'miss', stored: true })
})

test('does not cache a rejected loader or share mutable values', async () => {
  const cache = new TtlCache()
  await assert.rejects(cache.getOrLoad('error', async () => { throw new Error('boom') }, { ttlMs: 100 }))
  const loaded = await cache.getOrLoad('error', async () => ({ items: ['ok'] }), { ttlMs: 100 })
  loaded.value.items.push('changed')
  assert.deepEqual(cache.get('error'), { items: ['ok'] })
})

test('evicts the oldest entry and builds order-independent object keys', () => {
  const cache = new TtlCache({ maxEntries: 2 })
  cache.set('a', 1, 1000)
  cache.set('b', 2, 1000)
  cache.set('c', 3, 1000)
  assert.equal(cache.get('a'), undefined)
  assert.equal(cache.get('c'), 3)
  assert.equal(stableCacheKey('x', { b: 2, a: 1 }), stableCacheKey('x', { a: 1, b: 2 }))
})

test('reports when a successful loader is intentionally not stored', async () => {
  const cache = new TtlCache({ maxEntries: -1 })
  const result = await cache.getOrLoad('partial', async () => 'value', {
    ttlMs: 100, shouldCache: () => false,
  })
  assert.deepEqual(result, { value: 'value', cache: 'miss', stored: false })
  assert.equal(cache.get('partial'), undefined)
  assert.equal(cache.maxEntries, 100)
})

test('coalesces concurrent loads for the same key', async () => {
  const cache = new TtlCache()
  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const loader = async () => {
    calls += 1
    await gate
    return { items: ['one'] }
  }
  const first = cache.getOrLoad('same', loader, { ttlMs: 100 })
  const second = cache.getOrLoad('same', loader, { ttlMs: 100 })
  release()
  const [a, b] = await Promise.all([first, second])
  assert.equal(calls, 1)
  a.value.items.push('changed')
  assert.deepEqual(b.value, { items: ['one'] })
})
