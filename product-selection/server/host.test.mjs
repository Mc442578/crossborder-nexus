import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveHost } from './host.mjs'

test('binds the local BFF to loopback by default', () => {
  assert.equal(resolveHost({}), '127.0.0.1')
})

test('allows deployment to explicitly select a public host', () => {
  assert.equal(resolveHost({ HOST: '0.0.0.0' }), '0.0.0.0')
})
