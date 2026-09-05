import test from 'node:test'
import assert from 'node:assert/strict'

import { mapWalmartResults } from './walmart.mjs'

test('maps a Walmart organic result to CompetitorListing', () => {
  const data = {
    organic_results: [{
      product_id: '123',
      title: 'Women Yoga Pants',
      primary_offer: {
        offer_price: 24.98,
        currency: 'USD',
      },
      reviews: 321,
      rating: 4.6,
      product_page_url: 'https://www.walmart.com/ip/123',
      seller_name: 'Example Seller',
    }],
  }  
  const result = mapWalmartResults(data)  
  assert.deepEqual(result, [{
    id: 'walmart:123',
    title: 'Women Yoga Pants',
    channel: 'walmart',
    price: 24.98,
    currency: 'USD',
    reviewCount: 321,
    rating: 4.6,
    url: 'https://www.walmart.com/ip/123',
  }])
})

test('skips Walmart products without a usable positive price', () => {
  const data = {
    organic_results: [{
      product_id: 'bad-price',
      title: 'Invalid Yoga Pants',
      primary_offer: {
        offer_price: 0,
        currency: 'USD',
      },
    }],
  }
  const result = mapWalmartResults(data)

  assert.deepEqual(result, [])
})

test('preserves us_item_id separately for the Walmart reviews API', () => {
  const [listing] = mapWalmartResults({ organic_results: [{
    us_item_id: '643159571',
    product_id: '1GE03H1B1I89',
    title: 'Women Yoga Pants',
    primary_offer: { offer_price: 24.98, currency: 'USD' },
  }] })

  assert.equal(listing.id, 'walmart:1GE03H1B1I89')
  assert.equal(listing.reviewProductId, '643159571')
})

test('uses a stable fallback id and deduplicates titles within Walmart', () => {
  const product = {
    title: ' Women Yoga Pants ',
    primary_offer: { offer_price: 24.98 },
  }

  const result = mapWalmartResults({ organic_results: [product, { ...product }] })

  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'walmart:title:women yoga pants')
  assert.equal(result[0].currency, 'USD')
})
