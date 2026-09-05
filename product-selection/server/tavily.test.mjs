import test from 'node:test'
import assert from 'node:assert/strict'

import { mapSearchResults } from './tavily.mjs'

test('maps Tavily results to SearchHit objects', () => {
  const result = mapSearchResults({
    results: [
      {
        title: 'Example title',
        url: 'https://example.com/item',
        content: 'Example content',
        score: 0.9,
      },
    ],
  })

  assert.deepEqual(result, [
    {
      title: 'Example title',
      url: 'https://example.com/item',
      snippet: 'Example content',
    },
  ])
})

test('returns an empty list when Tavily has no results array', () => {
  assert.deepEqual(mapSearchResults({ answer: 'No results' }), [])
})
