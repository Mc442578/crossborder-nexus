import assert from 'node:assert/strict'
import test from 'node:test'
import { ServerDataSource } from './server-data-source.mjs'
import { TtlCache } from './ttl-cache.mjs'

test('reuses a successful mapped search and reports cache miss then hit', async () => {
  let calls = 0
  const events = []
  const source = new ServerDataSource({
    cache: new TtlCache(), keys: { tavily: 'key' }, tiktokCredentials: {},
    onCache: (event) => events.push(event),
    services: {
      searchWebEvidence: async () => {
        calls += 1
        return { results: [{ title: 'Source', url: 'https://example.com', content: 'Evidence' }] }
      },
    },
  })

  assert.equal((await source.searchWeb('  Blouses  ')).length, 1)
  assert.equal((await source.searchWeb('blouses')).length, 1)
  assert.equal(calls, 1)
  assert.deepEqual(events.map((event) => event.status), ['miss', 'hit'])
})

test('does not cache a deterministic degraded profile', async () => {
  let calls = 0
  const source = new ServerDataSource({
    cache: new TtlCache(), keys: { deepseek: 'key' }, tiktokCredentials: {},
    services: {
      createProfileResponse: async () => {
        calls += 1
        return { profile: {}, citations: [], generation: { mode: 'deterministic', degraded: true } }
      },
    },
  })
  const query = { keyword: 'blouses', market: 'US', channels: ['amazon'] }
  await source.profileCategory(query, [])
  await source.profileCategory(query, [])
  assert.equal(calls, 2)
})

test('cost changes do not invalidate external profile data', async () => {
  let calls = 0
  const receivedQueries = []
  const source = new ServerDataSource({
    cache: new TtlCache(), keys: { deepseek: 'key' }, tiktokCredentials: {},
    services: {
      createProfileResponse: async ({ query }) => {
        calls += 1
        receivedQueries.push(query)
        return { profile: {}, citations: [], generation: { mode: 'deepseek', degraded: false } }
      },
    },
  })
  const base = { keyword: 'blouses', market: 'US', channels: ['amazon'] }
  await source.profileCategory({ ...base, costs: { purchaseCost: 5 } }, [])
  await source.profileCategory({ ...base, costs: { purchaseCost: 9 } }, [])
  assert.equal(calls, 1)
  assert.deepEqual(receivedQueries, [{ keyword: 'blouses', market: 'US' }])
})

test('does not cache an empty Tavily mapping', async () => {
  let calls = 0
  const events = []
  const source = new ServerDataSource({
    cache: new TtlCache(), keys: { tavily: 'key' }, tiktokCredentials: {},
    onCache: (event) => events.push(event),
    services: { searchWebEvidence: async () => { calls += 1; return { results: [] } } },
  })
  await source.searchWeb('blouses')
  await source.searchWeb('blouses')
  assert.equal(calls, 2)
  assert.equal(events.every((event) => event.stored === false), true)
})
