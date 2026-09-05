export class ExternalRequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function fetchExternal(url, options = {}, settings = {}) {
  const {
    service = '外部服务',
    timeoutMs = 20_000,
    fetchImpl = fetch,
  } = settings
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal

  try {
    return await fetchImpl(url, { ...options, signal })
  } catch (error) {
    if (options.signal?.aborted) throw options.signal.reason ?? error
    const timedOut = error?.name === 'TimeoutError'
    throw new ExternalRequestError(
      timedOut ? 504 : 502,
      timedOut ? `${service} 请求超时` : `${service}连接失败`,
    )
  }
}
