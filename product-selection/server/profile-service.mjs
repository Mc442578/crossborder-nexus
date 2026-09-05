import { CATEGORY_PROFILE_SYSTEM_PROMPT, validateCategoryProfile } from './category-profile-ai.mjs'
import { DeepSeekError, requestDeepSeekProfile } from './deepseek.mjs'
import { createCategoryProfile } from './profile.mjs'

export async function createProfileResponse(body, options = {}) {
  const fallback = createCategoryProfile(body)
  const evidence = buildEvidence(body?.hits)

  if (!options.apiKey) {
    return withFallbackGeneration(fallback, 'missing_key')
  }

  const requestProfile = options.requestProfile ?? requestDeepSeekProfile
  try {
    const modelEvidence = evidence.map(({ id, title, snippet }) => ({ id, title, snippet }))
    const profile = await requestProfile({
      apiKey: options.apiKey,
      input: { query: body.query, evidence: modelEvidence },
      systemPrompt: CATEGORY_PROFILE_SYSTEM_PROMPT,
      validate: (value) => validateCategoryProfile(value, evidence.map((item) => item.id)),
      signal: options.signal,
      fetchImpl: options.fetchImpl,
    })
    const evidenceById = new Map(evidence.map((item) => [item.id, item]))
    return {
      profile: withoutEvidenceIds(profile, evidenceById),
      citations: profile.evidenceIds.map((id) => {
        const item = evidenceById.get(id)
        return { label: item.title, url: item.url, source: 'discover' }
      }),
      generation: { mode: 'deepseek', degraded: false },
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return withFallbackGeneration(fallback, normalizeReason(error))
  }
}

function buildEvidence(hits) {
  return (Array.isArray(hits) ? hits : [])
    .filter((hit) => (
      typeof hit?.title === 'string'
      && typeof hit?.url === 'string'
      && /^https?:\/\//.test(hit.url)
    ))
    .slice(0, 6)
    .map((hit, index) => ({
      id: `evidence-${index + 1}`,
      title: hit.title,
      snippet: typeof hit.snippet === 'string' ? hit.snippet : '',
      url: hit.url,
    }))
}

function withoutEvidenceIds(profile, evidenceById) {
  const { evidenceIds: _evidenceIds, ...categoryProfile } = profile
  return {
    ...categoryProfile,
    audiences: mapInsights(profile.audiences, evidenceById),
    purchaseDrivers: mapInsights(profile.purchaseDrivers, evidenceById),
  }
}

function mapInsights(insights, evidenceById) {
  return insights.map(({ text, evidenceIds }) => ({
    text,
    citations: evidenceIds.map((id) => {
      const item = evidenceById.get(id)
      return { label: item.title, url: item.url, source: 'discover' }
    }),
  }))
}

function withFallbackGeneration(fallback, reason) {
  return {
    ...fallback,
    generation: { mode: 'deterministic', degraded: true, reason },
  }
}

function normalizeReason(error) {
  if (error instanceof DeepSeekError) return error.reason
  if (error instanceof SyntaxError) return 'invalid_output'
  return 'invalid_output'
}
