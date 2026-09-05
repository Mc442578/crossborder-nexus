import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchListingsByChannel, ListingsError } from './listings.mjs'

function response(data, ok = true, status = 200) {
  return { ok, status, json: async () => data }
}

test('keeps Amazon results when Walmart fails and reports each channel', async () => {
  const urls = []
  const fetchStub = async (url) => {
    urls.push(url)
    const params = new URL(url).searchParams
    if (params.get('engine') === 'walmart') throw new Error('Walmart unavailable')
    return response({
      organic_results: [{ asin: 'B0ONE', title: 'Yoga Pants', extracted_price: 19.99 }],
    })
  }

  const result = await fetchListingsByChannel({
    query: { channels: ['amazon', 'walmart'] },
    terms: ['yoga pants'],
  }, { apiKey: 'test-key', fetchExternal: fetchStub })

  assert.equal(result.listings[0].id, 'amazon:B0ONE')
  assert.deepEqual(result.channels, [
    { channel: 'amazon', status: 'success', count: 1 },
    { channel: 'walmart', status: 'error', count: 0, error: 'yoga pants：Walmart unavailable' },
  ])
  const walmartParams = new URL(urls.find((url) => url.includes('engine=walmart'))).searchParams
  assert.equal(walmartParams.get('query'), 'yoga pants')
  assert.equal(walmartParams.get('walmart_domain'), 'walmart.com')
})

test('keeps channels separate and does not deduplicate across them', async () => {
  const fetchStub = async (url) => {
    const channel = new URL(url).searchParams.get('engine')
    return channel === 'amazon'
      ? response({ organic_results: [{ asin: 'SAME', title: 'Same Item', extracted_price: 10 }] })
      : response({ organic_results: [{ product_id: 'SAME', title: 'Same Item', primary_offer: { offer_price: 11 } }] })
  }
  const result = await fetchListingsByChannel({
    query: { channels: ['amazon', 'walmart'] },
    terms: ['same'],
  }, { apiKey: 'test-key', fetchExternal: fetchStub })

  assert.deepEqual(result.listings.map((item) => item.id), ['amazon:SAME', 'walmart:SAME'])
  assert.deepEqual(result.channels.map(({ status, count }) => ({ status, count })), [
    { status: 'success', count: 1 },
    { status: 'success', count: 1 },
  ])
})

test('rejects only after all requested channels fail', async () => {
  await assert.rejects(
    fetchListingsByChannel({
      query: { channels: ['amazon', 'walmart'] },
      terms: ['test'],
    }, { apiKey: 'test-key', fetchExternal: async () => { throw new Error('offline') } }),
    (error) => error instanceof ListingsError && error.status === 502,
  )
})

test('rejects an empty result and reports missing TikTok authorization', async () => {
  await assert.rejects(
    fetchListingsByChannel({
      query: { channels: ['amazon', 'walmart'] },
      terms: ['test'],
    }, { apiKey: 'test-key', fetchExternal: async () => response({ organic_results: [] }) }),
    (error) => error instanceof ListingsError && error.status === 422,
  )
  await assert.rejects(
    fetchListingsByChannel({
      query: { channels: ['tiktok'] },
      terms: ['test'],
    }, { apiKey: 'test-key', fetchExternal: async () => assert.fail('must not fetch') }),
    (error) => error instanceof ListingsError && error.status === 503,
  )
})

test('searches and maps real TikTok affiliate marketplace response fields', async () => {
  const requests = []
  const result = await fetchListingsByChannel({
    query: { channels: ['tiktok'] },
    terms: ['yoga pants'],
  }, {
    tiktokCredentials: {
      appKey: 'app', appSecret: 'secret', accessToken: 'token', shopCipher: 'cipher',
    },
    fetchExternal: async (url, options) => {
      requests.push({ url, options })
      return response({
        code: 0,
        data: {
          products: [{
            id: 'TT1', title: 'Yoga Pants', units_sold: 123,
            sales_price: { minimum_amount: '21.50', currency: 'USD' },
            detail_link: 'https://shop.tiktok.com/view/product/TT1',
          }],
        },
      })
    },
  })

  assert.equal(result.listings[0].id, 'tiktok:TT1')
  assert.equal(result.listings[0].price, 21.5)
  assert.equal(result.listings[0].lifetimeSales, 123)
  assert.deepEqual(result.channels, [
    { channel: 'tiktok', status: 'success', count: 1 },
  ])
  assert.match(requests[0].url, /open_collaborations\/products\/search/)
  assert.equal(requests[0].options.headers['x-tts-access-token'], 'token')
})

test('keeps Amazon results and marks TikTok unauthorized in a mixed request', async () => {
  const result = await fetchListingsByChannel({
    query: { channels: ['amazon', 'tiktok'] },
    terms: ['yoga pants'],
  }, {
    apiKey: 'test-key',
    fetchExternal: async () => response({
      organic_results: [{ asin: 'A1', title: 'Yoga Pants', extracted_price: 20 }],
    }),
  })

  assert.equal(result.listings.length, 1)
  assert.deepEqual(result.channels, [
    { channel: 'amazon', status: 'success', count: 1 },
    { channel: 'tiktok', status: 'error', count: 0, error: 'TikTok Shop 尚未完成 Seller 授权' },
  ])
})

test('runs at most three terms in one channel batch', async () => {
  let active = 0
  let peak = 0
  let sequence = 0
  const fetchStub = async () => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setImmediate(resolve))
    active -= 1
    sequence += 1
    return response({ organic_results: [{ title: `Item ${sequence}`, extracted_price: 10 }] })
  }
  await fetchListingsByChannel({
    query: { channels: ['amazon'] },
    terms: ['one', 'two', 'three', 'four'],
  }, { apiKey: 'test-key', fetchExternal: fetchStub })

  assert.equal(peak, 3)
})

test('keeps successful terms when another term in the same channel fails', async () => {
  const result = await fetchListingsByChannel({
    query: { channels: ['amazon'] },
    terms: ['works', 'fails'],
  }, {
    apiKey: 'test-key',
    fetchExternal: async (url) => {
      if (new URL(url).searchParams.get('k') === 'fails') throw new Error('term unavailable')
      return response({ organic_results: [{ asin: 'KEPT', title: 'Kept Item', extracted_price: 20 }] })
    },
  })

  assert.equal(result.listings[0].id, 'amazon:KEPT')
  assert.equal(result.channels[0].status, 'partial')
  assert.match(result.channels[0].error, /fails/)
})

test('limits search terms before spending SerpApi quota', async () => {
  await assert.rejects(
    fetchListingsByChannel({
      query: { channels: ['amazon'] },
      terms: ['one', 'two', 'three', 'four', 'five', 'six'],
    }, { apiKey: 'test-key', fetchExternal: async () => assert.fail('must not fetch') }),
    (error) => error instanceof ListingsError && error.status === 400,
  )
})

test('propagates a user abort instead of reporting a channel failure', async () => {
  const controller = new AbortController()
  controller.abort(new DOMException('Aborted', 'AbortError'))

  await assert.rejects(
    fetchListingsByChannel({
      query: { channels: ['amazon'] },
      terms: ['one'],
    }, {
      apiKey: 'test-key',
      signal: controller.signal,
      fetchExternal: async (_url, options) => { throw options.signal.reason },
    }),
    (error) => error.name === 'AbortError',
  )
})
