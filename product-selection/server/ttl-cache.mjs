import { createHash } from 'node:crypto'

export class TtlCache {
  constructor(options = {}) {
    this.now = options.now ?? Date.now
    this.maxEntries = Number.isInteger(options.maxEntries) && options.maxEntries > 0
      ? options.maxEntries
      : 100
    this.entries = new Map()
    this.inFlight = new Map()
  }

  get(key) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return undefined
    }
    return structuredClone(entry.value)
  }

  set(key, value, ttlMs) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return
    this.entries.delete(key)
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: this.now() + ttlMs,
    })
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      this.entries.delete(oldestKey)
    }
  }

  async getOrLoad(key, loader, options) {
    const cached = this.get(key)
    if (cached !== undefined) return { value: cached, cache: 'hit', stored: true }

    const pending = this.inFlight.get(key)
    if (pending) {
      const result = await pending
      return { ...result, value: structuredClone(result.value) }
    }

    const load = (async () => {
      const value = await loader()
      const stored = options.shouldCache?.(value) ?? true
      if (stored) this.set(key, value, options.ttlMs)
      return { value, cache: 'miss', stored }
    })()
    this.inFlight.set(key, load)
    try {
      return await load
    } finally {
      if (this.inFlight.get(key) === load) this.inFlight.delete(key)
    }
  }
}

export function stableCacheKey(namespace, value) {
  const digest = createHash('sha256').update(stableStringify(value)).digest('hex')
  return `${namespace}:${digest}`
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`,
    )
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}
