import assert from 'node:assert/strict'
import test from 'node:test'
import { RemotePipelineClient } from './remote.ts'

const QUERY = {
  keyword: 'blouses', market: 'US', channels: ['amazon'],
  costs: { purchaseCost: 5, firstMileCost: 2, advertisingRate: 0.1 },
}

class FakeEventSource {
  listeners = new Map()
  closed = false
  addEventListener(name, listener) { this.listeners.set(name, listener) }
  close() { this.closed = true }
  emit(data, id = '1') {
    this.listeners.get('progress')?.({ data: JSON.stringify(data), lastEventId: id })
  }
}

test('applies SSE steps and cache messages before fetching one final result', async () => {
  const source = new FakeEventSource()
  const calls = []
  const steps = []
  const messages = []
  const client = new RemotePipelineClient({
    onStep: (state) => steps.push(state),
    onServerMessage: (message) => messages.push(message),
    onConnection: () => {},
  }, {
    createEventSource: () => source,
    fetchImpl: async (url, init) => {
      calls.push([url, init?.method ?? 'GET'])
      if (url === '/api/runs') return Response.json({
        runId: 'r1', eventsUrl: '/api/runs/r1/events', resultUrl: '/api/runs/r1/result',
      }, { status: 202 })
      return Response.json({ context: { query: QUERY, citations: [] } })
    },
  })

  const resultPromise = client.run(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  source.emit({ type: 'step:update', state: { id: 'discover', status: 'running' } }, '2')
  source.emit({ type: 'cache:update', cache: { label: '公开网页', status: 'hit' } }, '3')
  source.emit({ type: 'complete' }, '4')
  const result = await resultPromise
  assert.equal(steps[0].id, 'discover')
  assert.match(messages[0].text, /缓存命中/)
  assert.equal(result.query.keyword, 'blouses')
  assert.deepEqual(calls.map(([url]) => url), ['/api/runs', '/api/runs/r1/result'])
  assert.equal(source.closed, true)
})

test('abort closes SSE and sends DELETE for the server job', async () => {
  const source = new FakeEventSource()
  const calls = []
  const client = new RemotePipelineClient({
    onStep: () => {}, onServerMessage: () => {}, onConnection: () => {},
  }, {
    createEventSource: () => source,
    fetchImpl: async (url, init) => {
      calls.push([url, init?.method ?? 'GET'])
      if (url === '/api/runs') return Response.json({
        runId: 'r2', eventsUrl: '/events', resultUrl: '/result',
      }, { status: 202 })
      return Response.json({})
    },
  })
  const promise = client.run(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  client.abort()
  await assert.rejects(promise, (error) => error.name === 'AbortError')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(source.closed, true)
  assert.equal(calls.some(([url, method]) => url === '/api/runs/r2' && method === 'DELETE'), true)
})

test('a persistent SSE disconnect stops a still-running server job', async () => {
  const source = new FakeEventSource()
  const calls = []
  const client = new RemotePipelineClient({
    onStep: () => {}, onServerMessage: () => {}, onConnection: () => {},
  }, {
    reconnectTimeoutMs: 5,
    createEventSource: () => source,
    fetchImpl: async (url, init) => {
      calls.push([url, init?.method ?? 'GET'])
      if (url === '/api/runs') return Response.json({
        runId: 'r3', eventsUrl: '/events', resultUrl: '/result',
      }, { status: 202 })
      if (url === '/result') return Response.json({ status: 'running' }, { status: 202 })
      return Response.json({})
    },
  })
  const promise = client.run(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  source.onerror()
  await assert.rejects(promise, /持续中断/)
  assert.equal(calls.some(([url, method]) => url === '/api/runs/r3' && method === 'DELETE'), true)
})

test('does not claim a disconnected run stopped when DELETE fails', async () => {
  const source = new FakeEventSource()
  const client = new RemotePipelineClient({
    onStep: () => {}, onServerMessage: () => {}, onConnection: () => {},
  }, {
    reconnectTimeoutMs: 5,
    createEventSource: () => source,
    fetchImpl: async (url) => {
      if (url === '/api/runs') return Response.json({
        runId: 'r5', eventsUrl: '/events', resultUrl: '/result',
      }, { status: 202 })
      if (url === '/result') return Response.json({ status: 'running' }, { status: 202 })
      return Response.json({ error: 'failed' }, { status: 500 })
    },
  })
  const promise = client.run(QUERY)
  await new Promise((resolve) => setImmediate(resolve))
  source.onerror()
  await assert.rejects(promise, /无法确认服务端任务已停止/)
})

test('abort during run creation waits for runId and then deletes the job', async () => {
  let release
  const created = new Promise((resolve) => { release = resolve })
  const calls = []
  const client = new RemotePipelineClient({
    onStep: () => {}, onServerMessage: () => {}, onConnection: () => {},
  }, {
    createEventSource: () => new FakeEventSource(),
    fetchImpl: async (url, init) => {
      calls.push([url, init?.method ?? 'GET'])
      if (url === '/api/runs') {
        await created
        return Response.json({ runId: 'r4', eventsUrl: '/events', resultUrl: '/result' }, { status: 202 })
      }
      return Response.json({})
    },
  })
  const promise = client.run(QUERY)
  client.abort()
  release()
  await assert.rejects(promise, (error) => error.name === 'AbortError')
  assert.equal(calls.some(([url, method]) => url === '/api/runs/r4' && method === 'DELETE'), true)
})
