import test from 'node:test'
import assert from 'node:assert/strict'

import { discoverStep } from './discover.ts'

test('stores profile generation metadata in the pipeline context', async () => {
  const generation = { mode: 'deterministic', degraded: true, reason: 'invalid_output' }
  const ctx = {
    query: { keyword: 'women yoga pants', market: 'US', channels: ['amazon'] },
    citations: [],
  }
  const rt = {
    ds: {
      searchWeb: async () => [],
      profileCategory: async () => ({
        profile: {
          name: 'Women Yoga Pants',
          searchTerms: ['women yoga pants'],
          relatedTerms: [],
          summary: 'Profile',
          audiences: [],
          purchaseDrivers: [],
          validationQuestions: ['需要验证什么？'],
        },
        citations: [],
        generation,
      }),
    },
    signal: new AbortController().signal,
    report: () => {},
  }

  await discoverStep.run(ctx, rt)

  assert.deepEqual(ctx.profileGeneration, generation)
})
