import assert from 'node:assert/strict'
import test from 'node:test'
import { formatSseEvent, RunManager, validateQuery } from './run-manager.mjs'

const QUERY = {
  keyword: 'blouses', market: 'US', channels: ['amazon'],
  costs: { purchaseCost: 5, firstMileCost: 2, advertisingRate: 0.1 },
}

const step = {
  id: 'one', title: 'one', description: 'one',
  async run(ctx, rt) {
    rt.report('working', 0.5)
    await rt.ds.work(rt.signal)
    ctx.done = true
    ctx.profile = {}
    ctx.market = {}
    ctx.verdict = {}
  },
}

test('creates a run, replays events, and exposes the final result', async () => {
  let cacheEvents = 0
  const manager = new RunManager({
    id: () => 'run-1', steps: [step],
    createDataSource: (onCache) => ({
      work: async () => { onCache({ label: 'fixture', status: 'hit' }); cacheEvents += 1 },
    }),
  })
  assert.equal(manager.create(QUERY).status, 'running')
  await new Promise((resolve) => setImmediate(resolve))
  const received = []
  manager.subscribe('run-1', 0, (event) => received.push(event))
  assert.equal(cacheEvents, 1)
  assert.equal(received.some((event) => event.data.type === 'cache:update'), true)
  assert.equal(received.at(-1).data.type, 'complete')
  assert.equal(manager.result('run-1').data.context.done, true)
})

test('reconnect replays only events after Last-Event-ID', async () => {
  const manager = new RunManager({
    id: () => 'run-2', steps: [step],
    createDataSource: () => ({ work: async () => {} }),
  })
  manager.create(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  const all = []
  manager.subscribe('run-2', 0, (event) => all.push(event))()
  const replay = []
  manager.subscribe('run-2', all.at(-2).id, (event) => replay.push(event))()
  assert.deepEqual(replay.map((event) => event.id), [all.at(-1).id])
})

test('aborts a running job without treating SSE disconnect as cancellation', async () => {
  let release
  const waiting = new Promise((resolve) => { release = resolve })
  const manager = new RunManager({
    id: () => 'run-3', steps: [step],
    createDataSource: () => ({ work: async () => waiting }),
  })
  manager.create(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  const unsubscribe = manager.subscribe('run-3', 0, () => {})
  unsubscribe()
  assert.equal(manager.get('run-3').status, 'running')
  manager.abort('run-3')
  release()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(manager.get('run-3').status, 'aborted')
})

test('validates inputs and formats standards-compatible SSE frames', () => {
  assert.throws(() => validateQuery({ ...QUERY, channels: [] }), /至少选择/)
  assert.match(formatSseEvent({ id: 2, data: { type: 'complete' } }),
    /^id: 2\nevent: progress\ndata: \{"type":"complete"\}\n\n$/)
})

test('fails honestly when the pipeline finishes without a core report', async () => {
  const manager = new RunManager({
    id: () => 'run-empty',
    steps: [{ id: 'empty', title: 'empty', description: 'empty', run: async () => {} }],
    createDataSource: () => ({}),
  })
  manager.create(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(manager.get('run-empty').status, 'failed')
  assert.match(manager.result('run-empty').data.error, /核心调研步骤失败/)
})

test('completed jobs do not consume the running concurrency limit', async () => {
  let id = 0
  const manager = new RunManager({
    id: () => `done-${++id}`, maxRuns: 1,
    steps: [{ id: 'complete', title: 'complete', description: 'complete', run: async (ctx) => {
      ctx.profile = {}; ctx.market = {}; ctx.verdict = {}
    } }],
    createDataSource: () => ({}),
  })
  manager.create(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  assert.doesNotThrow(() => manager.create(QUERY))
})
