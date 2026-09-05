import type { CustomerReview, ReviewPainPoint } from '@/types/domain'

const RULES: Array<{
  key: ReviewPainPoint['key']
  label: string
  pattern: RegExp
}> = [
  { key: 'size_fit', label: '尺码与版型', pattern: /\b(runs?|ran)\s+(small|large|short|long|tight|loose)\b|\btoo\s+(small|large|short|long|tight|loose)\b|\bdoes(?:n'?t| not)\s+fit\b|\b(sizing|size)\s+(?:is\s+)?(off|wrong|inaccurate)\b/i },
  { key: 'material', label: '面料与质感', pattern: /\btoo\s+(thin|thick|sheer|rough|scratchy)\b|\bsee[ -]?through\b|\btransparent\b|\b(cheap|poor|bad)\s+(fabric|material)\b/i },
  { key: 'workmanship', label: '做工与耐用性', pattern: /\b(loose|poor|bad)\s+(seam|stitch|stitching)\b|\b(zipper|button|seam|stitching?)\s+(broke|broke off|failed|came (?:off|apart|loose))\b|\b(ripped|tore|hole|poorly made)\b/i },
  { key: 'comfort', label: '舒适度', pattern: /\b(uncomfortable|itchy|scratchy|not comfortable|not breathable|too rough)\b/i },
  { key: 'appearance', label: '颜色与外观', pattern: /\b(color|colour)\s+(wrong|faded|off)\b|\bnot as (?:pictured|shown|expected)\b|\blooks?\s+(cheap|bad|different)\b/i },
]

/** 只从 1~3 星评论识别负面表达，并保留支持每一项的真实 review ID。 */
export function classifyReviewPainPoints(reviews: CustomerReview[]): ReviewPainPoint[] {
  const negativeReviews = reviews.filter((review) => review.rating <= 3)
  return RULES.flatMap((rule) => {
    const evidenceIds = negativeReviews
      .filter((review) => rule.pattern.test(`${review.title ?? ''} ${review.text}`))
      .map((review) => review.id)
    if (!evidenceIds.length) return []
    return [{
      key: rule.key,
      label: rule.label,
      reviewCount: evidenceIds.length,
      evidenceIds,
    }]
  }).sort((a, b) => b.reviewCount - a.reviewCount)
}
