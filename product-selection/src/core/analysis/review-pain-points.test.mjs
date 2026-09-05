import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyReviewPainPoints } from './review-pain-points.ts'

const review = (id, rating, text) => ({
  id, rating, text, channel: 'amazon', productId: 'B0TEST1234',
  productTitle: 'Yoga Pants', fetchedAt: '2026-09-01T08:00:00.000Z',
})

test('classifies only low-rating reviews and preserves evidence ids', () => {
  const result = classifyReviewPainPoints([
    review('r1', 2, 'The size runs small and the waist is too tight.'),
    review('r2', 1, 'The material is too thin and has loose stitching after one wash.'),
    review('r3', 5, 'The fabric is soft and comfortable.'),
  ])

  assert.deepEqual(result.map(({ key, reviewCount, evidenceIds }) => ({
    key, reviewCount, evidenceIds,
  })), [
    { key: 'size_fit', reviewCount: 1, evidenceIds: ['r1'] },
    { key: 'material', reviewCount: 1, evidenceIds: ['r2'] },
    { key: 'workmanship', reviewCount: 1, evidenceIds: ['r2'] },
  ])
})

test('returns no pain point when the sample has no supported low-rating evidence', () => {
  assert.deepEqual(classifyReviewPainPoints([
    review('r1', 5, 'Perfect fit and very comfortable.'),
    review('r2', 2, 'I did not like it.'),
  ]), [])
})

test('does not turn positive words inside a low-rating review into a pain point', () => {
  assert.deepEqual(classifyReviewPainPoints([
    review('r1', 2, 'The fabric is great and the fit is perfect, but delivery was late.'),
  ]), [])
})
