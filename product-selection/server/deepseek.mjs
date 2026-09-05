import { ExternalRequestError, fetchExternal } from './external-request.mjs'

export const CATEGORY_PROFILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name', 'searchTerms', 'relatedTerms', 'summary', 'audiences',
    'purchaseDrivers', 'validationQuestions', 'evidenceIds',
  ],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    searchTerms: {
      type: 'array', minItems: 1, maxItems: 5, uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    relatedTerms: {
      type: 'array', minItems: 0, maxItems: 8, uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    summary: { type: 'string', minLength: 1, maxLength: 240 },
    audiences: {
      type: 'array', minItems: 0, maxItems: 3,
      items: evidenceInsightSchema(100),
    },
    purchaseDrivers: {
      type: 'array', minItems: 0, maxItems: 5,
      items: evidenceInsightSchema(100),
    },
    validationQuestions: {
      type: 'array', minItems: 1, maxItems: 3, uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 140 },
    },
    evidenceIds: {
      type: 'array', minItems: 1, maxItems: 6, uniqueItems: true,
      items: { type: 'string' },
    },
  },
}

function evidenceInsightSchema(maxLength) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'evidenceIds'],
    properties: {
      text: { type: 'string', minLength: 1, maxLength },
      evidenceIds: {
        type: 'array', minItems: 1, maxItems: 3, uniqueItems: true,
        items: { type: 'string' },
      },
    },
  }
}

export class DeepSeekError extends Error {
  constructor(status, reason, message) {
    super(message)
    this.status = status
    this.reason = reason
  }
}

export async function requestDeepSeekProfile({
  apiKey,
  input,
  systemPrompt,
  validate,
  signal,
  fetchImpl,
}) {
  if (!apiKey) throw new DeepSeekError(500, 'missing_key', '缺少环境变量 DEEPSEEK_API_KEY')

  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
    try {
      const response = await fetchExternal('https://api.deepseek.com/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          reasoning: { effort: 'none' },
          temperature: 0.2,
          max_output_tokens: 900,
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(input) },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'category_profile',
              schema: CATEGORY_PROFILE_SCHEMA,
            },
          },
        }),
        signal,
      }, {
        service: 'DeepSeek',
        timeoutMs: 20_000,
        fetchImpl,
      })

      if (!response.ok) {
        const reason = response.status === 429
          ? 'rate_limit'
          : [500, 503].includes(response.status) ? 'upstream_error' : 'request_rejected'
        const error = new DeepSeekError(response.status, reason, `DeepSeek 请求失败：${response.status}`)
        if (!isRetryableStatus(response.status)) throw error
        lastError = error
        continue
      }

      const data = await response.json()
      const outputText = extractOutputText(data)
      if (!outputText) throw new DeepSeekError(502, 'empty', 'DeepSeek 返回空内容')
      return validate(JSON.parse(outputText))
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error
      if (error instanceof DeepSeekError && !isRetryableReason(error.reason)) throw error
      if (error instanceof SyntaxError) {
        lastError = new DeepSeekError(502, 'invalid_output', 'DeepSeek 返回非法 JSON')
      } else if (error instanceof ExternalRequestError) {
        lastError = new DeepSeekError(error.status, error.status === 504 ? 'timeout' : 'upstream_error', error.message)
      } else {
        lastError = error instanceof DeepSeekError
          ? error
          : new DeepSeekError(502, 'invalid_output', error?.message ?? 'DeepSeek 输出校验失败')
      }
    }
  }
  throw lastError ?? new DeepSeekError(502, 'upstream_error', 'DeepSeek 请求失败')
}

export function extractOutputText(data) {
  if (data?.status !== 'completed' || !Array.isArray(data.output)) return ''
  for (const item of data.output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue
    const part = item.content.find((content) => content?.type === 'output_text')
    if (typeof part?.text === 'string') return part.text.trim()
  }
  return ''
}

const isRetryableStatus = (status) => [429, 500, 503].includes(status)
const isRetryableReason = (reason) => ['timeout', 'rate_limit', 'upstream_error', 'empty', 'invalid_output'].includes(reason)
