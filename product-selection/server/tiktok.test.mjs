import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildTikTokProductRequest, generateTikTokSignature, mapTikTokResults,
} from './tiktok.mjs'

test('signs a TikTok Shop request from the exact body and sorted query params', () => {
  const signature = generateTikTokSignature(
    '/test/path',
    { timestamp: '1700000000', app_key: 'app', sign: 'ignored' },
    '{"title_keywords":["yoga pants"]}',
    'secret',
  )
  assert.equal(signature, 'ba78a053c04dcde2fec81abc975a6d6e9940cda9bd44f38119bb3e06c06b5a4d')
})

test('builds an authenticated TikTok affiliate product search', () => {
  const request = buildTikTokProductRequest('yoga pants', {
    appKey: 'app', appSecret: 'secret', accessToken: 'token', shopCipher: 'cipher',
  }, 1_700_000_000_000)
  const url = new URL(request.url)

  assert.equal(url.pathname, '/affiliate_seller/202405/open_collaborations/products/search')
  assert.equal(url.searchParams.get('shop_cipher'), 'cipher')
  assert.equal(url.searchParams.get('timestamp'), '1700000000')
  assert.ok(url.searchParams.get('sign'))
  assert.equal(request.options.headers['x-tts-access-token'], 'token')
  assert.equal(request.options.body, '{"title_keywords":["yoga pants"]}')
})

test('cleans and maps TikTok affiliate products to CompetitorListing', () => {
  const result = mapTikTokResults({
    data: {
      products: [{
        id: '123', title: ' Yoga Pants ', units_sold: 456,
        shop: { name: 'Example Shop' },
        commission: { rate: '1250' },
        sales_price: { minimum_amount: '24.98', currency: 'USD' },
        detail_link: 'https://shop.tiktok.com/view/product/123',
      }, {
        id: '123', title: 'Yoga Pants',
        sales_price: { minimum_amount: '24.98', currency: 'USD' },
      }, {
        id: 'bad', title: 'No Price', sales_price: { minimum_amount: '0' },
      }, {
        id: 'eu', title: 'EU Product', sale_region: 'DE',
        sales_price: { minimum_amount: '20', currency: 'EUR' },
      }],
    },
  })

  assert.deepEqual(result, [{
    id: 'tiktok:123', title: 'Yoga Pants', channel: 'tiktok',
    price: 24.98, currency: 'USD', lifetimeSales: 456,
    affiliateCommissionRate: 0.125,
    url: 'https://shop.tiktok.com/view/product/123',
  }])
})

test('omits an invalid or missing affiliate commission rate', () => {
  const result = mapTikTokResults({
    data: {
      products: [{
        id: 'missing-rate', title: 'Yoga Pants', commission: { rate: 'invalid' },
        sales_price: { minimum_amount: '24.98', currency: 'USD' },
      }],
    },
  })

  assert.equal('affiliateCommissionRate' in result[0], false)
})

test('maps a direct commission_rate field from basis points', () => {
  const [result] = mapTikTokResults({
    data: {
      products: [{
        id: 'direct-rate', title: 'Yoga Pants', commission_rate: 850,
        sales_price: { minimum_amount: '24.98', currency: 'USD' },
      }],
    },
  })

  assert.equal(result.affiliateCommissionRate, 0.085)
})
