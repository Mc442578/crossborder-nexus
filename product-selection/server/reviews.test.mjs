import test from 'node:test'
import assert from 'node:assert/strict'

import {
  fetchReviewsForListings, mapAmazonReviews, mapWalmartReviews, normalizeReviewRequest,
} from './reviews.mjs'

const fetchedAt = '2026-09-01T08:00:00.000Z'
const amazon = {
  channel: 'amazon', productId: 'B0TEST1234', productTitle: 'Yoga Pants',
  url: 'https://www.amazon.com/dp/B0TEST1234',
}
const walmart = {
  channel: 'walmart', productId: '123456789', productTitle: 'Yoga Pants',
  url: 'https://www.walmart.com/ip/123456789',
}

test('maps Amazon author reviews to traceable review evidence', () => {
  const result = mapAmazonReviews({ reviews_information: { authors_reviews: [{
    title: 'Runs small', text: 'The waist is too tight.', rating: 2,
    date: 'August 1, 2026', verified_purchase: true,
  }] } }, amazon, fetchedAt)

  assert.deepEqual(result, [{
    id: 'amazon:B0TEST1234:review:1', channel: 'amazon', productId: 'B0TEST1234',
    productTitle: 'Yoga Pants', title: 'Runs small', text: 'The waist is too tight.',
    rating: 2, date: 'August 1, 2026', verifiedPurchase: true,
    url: 'https://www.amazon.com/dp/B0TEST1234', fetchedAt,
  }])
})

test('maps Walmart reviews and verified purchaser status', () => {
  const result = mapWalmartReviews({ reviews: [{
    title: 'Thin fabric', text: 'The material is see through.', rating: 1,
    review_submission_time: '8/2/2026', customer_type: ['VerifiedPurchaser'],
  }] }, walmart, fetchedAt)

  assert.equal(result[0].verifiedPurchase, true)
  assert.equal(result[0].text, 'The material is see through.')
})

test('fetches Amazon and Walmart reviews while marking TikTok unsupported', async () => {
  const calls = []
  const result = await fetchReviewsForListings({ listings: [
    { id: 'amazon:B0TEST1234', channel: 'amazon', title: 'Amazon Pants', url: amazon.url },
    { id: 'walmart:1GE03H1B1I89', reviewProductId: '123456789', channel: 'walmart', title: 'Walmart Pants', url: walmart.url },
    { id: 'tiktok:9988', channel: 'tiktok', title: 'TikTok Pants' },
  ] }, {
    apiKey: 'test-key',
    now: () => Date.parse(fetchedAt),
    fetchExternal: async (url) => {
      calls.push(url)
      const isAmazon = new URL(url).searchParams.get('engine') === 'amazon_product'
      const body = isAmazon
        ? { reviews_information: { authors_reviews: [{ text: 'Too small', rating: 2 }] } }
        : { reviews: [{ text: 'Loose stitching', rating: 2 }] }
      return new Response(JSON.stringify(body), { status: 200 })
    },
  })

  assert.equal(calls.length, 2)
  assert.equal(result.reviews.length, 2)
  assert.deepEqual(result.channels.map(({ channel, status }) => ({ channel, status })), [
    { channel: 'amazon', status: 'success' },
    { channel: 'walmart', status: 'success' },
    { channel: 'tiktok', status: 'unsupported' },
  ])
})

test('rejects duplicate channels and malformed product identifiers', () => {
  assert.throws(() => normalizeReviewRequest({ listings: [
    { id: 'amazon:bad', channel: 'amazon', title: 'Bad product' },
  ] }), /商品标识无效/)
  assert.throws(() => normalizeReviewRequest({ listings: [
    { id: 'walmart:one', reviewProductId: '123', channel: 'walmart', title: 'One' },
    { id: 'walmart:two', reviewProductId: '456', channel: 'walmart', title: 'Two' },
  ] }), /渠道重复/)
})

test('does not guess Walmart review ids from product_id shape', () => {
  assert.throws(() => normalizeReviewRequest({ listings: [{
    id: 'walmart:123456789', channel: 'walmart', title: 'Missing us item id',
  }] }), /商品标识无效/)
})

test('returns TikTok unsupported without requiring a SerpApi key', async () => {
  const result = await fetchReviewsForListings({ listings: [{
    id: 'tiktok:9988', channel: 'tiktok', title: 'TikTok Pants',
  }] })
  assert.equal(result.channels[0].status, 'unsupported')
})

test('stores only a short evidence excerpt', () => {
  const [result] = mapAmazonReviews({ reviews_information: { authors_reviews: [{
    text: 'x'.repeat(500), rating: 2,
  }] } }, amazon, fetchedAt)
  assert.equal(result.text.length, 300)
})
