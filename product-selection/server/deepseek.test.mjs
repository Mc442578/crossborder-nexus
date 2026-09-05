import test from 'node:test'
import assert from 'node:assert/strict'

import { extractOutputText, requestDeepSeekProfile } from './deepseek.mjs'

const completed = (text) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
})

test('extracts output text from a completed DeepSeek response', () => {
  assert.equal(extractOutputText(completed(' {"name":"pants"} ')), '{"name":"pants"}')
})

test('retries once when DeepSeek returns empty content', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response(JSON.stringify(calls === 1 ? completed('') : completed('{"name":"pants"}')), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const result = await requestDeepSeekProfile({
    apiKey: 'test-key',
    input: { keyword: 'pants', sources: [] },
    systemPrompt: 'Return JSON.',
    validate: (value) => value,
    fetchImpl,
  })
  assert.equal(calls, 2)
  assert.deepEqual(result, { name: 'pants' })
})

test('does not retry an authentication failure', async () => {
  let calls = 0
  await assert.rejects(
    requestDeepSeekProfile({
      apiKey: 'bad-key',
      input: {},
      systemPrompt: 'Return JSON.',
      validate: (value) => value,
      fetchImpl: async () => {
        calls += 1
        return new Response('{}', { status: 401 })
      },
    }),
    (error) => error.status === 401,
  )
  assert.equal(calls, 1)
})
