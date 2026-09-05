import test from 'node:test'
import assert from 'node:assert/strict'

import { mapAmazonResults } from './amazon.mjs'

test('maps a SerpApi Amazon result to CompetitorListing', () => {
  const result = mapAmazonResults({
    organic_results: [
      {
        asin: 'B0TEST1234',
        title: 'Women Yoga Pants',
        brand: 'Example Brand',
        extracted_price: 12.99,
        rating: 4.4,
        reviews: 1600,
        link_clean: 'https://www.amazon.com/dp/B0TEST1234',
      },
    ],
  })

  assert.deepEqual(result, [
    {
      id: 'amazon:B0TEST1234',
      title: 'Women Yoga Pants',
      channel: 'amazon',
      brand: 'Example Brand',
      price: 12.99,
      currency: 'USD',
      rating: 4.4,
      reviewCount: 1600,
      url: 'https://www.amazon.com/dp/B0TEST1234',
    },
  ])
})

test('cleans a price string and skips products without a usable price', () => {
  const result = mapAmazonResults({
    organic_results: [
      {
        asin: 'B0PRICE123',
        title: 'Priced Product',
        price: '$1,299.50',
      },
      {
        asin: 'B0NOPRICE1',
        title: 'Missing Price Product',
      },
    ],
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].price, 1299.5)
})

test('deduplicates products by ASIN or normalized title', () => {
  const result = mapAmazonResults({
    organic_results: [
      { asin: 'B0SAME1234', title: 'First Product', extracted_price: 10 },
      { asin: 'B0SAME1234', title: 'Different Title', extracted_price: 11 },
      { asin: 'B0OTHER123', title: '  FIRST   PRODUCT  ', extracted_price: 12 },
    ],
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'amazon:B0SAME1234')
})

test('returns an empty array for malformed SerpApi results', () => {
  assert.deepEqual(mapAmazonResults({}), [])
  assert.deepEqual(mapAmazonResults({ organic_results: null }), [])
})
