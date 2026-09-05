import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGoogleTrendsParams, fetchGoogleTrendsResponse, mapGoogleTrendsResults,
} from './trend.mjs'
import { ExternalRequestError } from './external-request.mjs'

test('aggregates weekly Google Trends values into monthly points', () => {
  const result = mapGoogleTrendsResults({
    interest_over_time: {
      timeline_data: [
        {
          timestamp: '1704067200',
          values: [{ query: 'women yoga pants', value: '40', extracted_value: 40 }],
        },
        {
          timestamp: '1704672000',
          values: [{ query: 'women yoga pants', value: '60', extracted_value: 60 }],
        },
        {
          timestamp: '1706745600',
          values: [{ query: 'women yoga pants', value: '70', extracted_value: 70 }],
        },
      ],
    },
  })

  assert.deepEqual(result, [
    { period: '2024-01', value: 50 },
    { period: '2024-02', value: 70 },
  ])
})

test('skips malformed timeline entries', () => {
  const result = mapGoogleTrendsResults({
    interest_over_time: {
      timeline_data: [
        { timestamp: 'invalid', values: [{ extracted_value: 80 }] },
        { timestamp: '1704067200', values: [] },
        { timestamp: '1706745600', values: [{ extracted_value: 0 }] },
      ],
    },
  })

  assert.deepEqual(result, [{ period: '2024-02', value: 0 }])
  assert.deepEqual(mapGoogleTrendsResults({}), [])
})

test('builds a US Google Trends request for the previous two years', () => {
  const params = buildGoogleTrendsParams(
    'women yoga pants',
    'test-key',
    new Date('2026-08-29T00:00:00.000Z'),
  )

  assert.equal(params.get('engine'), 'google_trends')
  assert.equal(params.get('q'), 'women yoga pants')
  assert.equal(params.get('geo'), 'US')
  assert.equal(params.get('date'), '2024-08-29 2026-08-29')
  assert.equal(params.get('data_type'), 'TIMESERIES')
  assert.equal(params.get('api_key'), 'test-key')
})

test('retries one transient trend connection failure', async () => {
  let calls = 0
  const expected = { ok: true }
  const result = await fetchGoogleTrendsResponse('women yoga pants', 'test-key', {
    fetchExternal: async () => {
      calls += 1
      if (calls === 1) throw new ExternalRequestError(502, 'SerpApi 趋势连接失败')
      return expected
    },
  })

  assert.equal(calls, 2)
  assert.equal(result, expected)
})
