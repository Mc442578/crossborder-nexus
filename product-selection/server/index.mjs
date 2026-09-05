import { createServer } from 'node:http'
import { ProfileError } from './profile.mjs'
import { ListingsError } from './listings.mjs'
import { ReviewsError } from './reviews.mjs'
import { ExternalRequestError } from './external-request.mjs'
import { resolveHost } from './host.mjs'
import { TtlCache } from './ttl-cache.mjs'
import { ServerDataSource } from './server-data-source.mjs'
import { formatSseEvent, RunError, RunManager } from './run-manager.mjs'

/**
 * 轻量 BFF：保护密钥、执行 live Pipeline、缓存成功结果，并通过 SSE 推送进度。
 * 旧的五个 POST 数据接口继续保留，主页面的 live 模式改走 /api/runs。
 */
const PORT = 8787
const HOST = resolveHost(process.env)
const TAVILY_KEY = process.env.TAVILY_API_KEY
const SERPAPI_KEY = process.env.SERPAPI_API_KEY
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
const TIKTOK_CREDENTIALS = {
  appKey: process.env.TIKTOK_SHOP_APP_KEY,
  appSecret: process.env.TIKTOK_SHOP_APP_SECRET,
  accessToken: process.env.TIKTOK_SHOP_ACCESS_TOKEN,
  shopCipher: process.env.TIKTOK_SHOP_CIPHER,
}

const cache = new TtlCache({ maxEntries: 150 })
const runManager = new RunManager({
  createDataSource: (onCache) => new ServerDataSource({
    cache,
    keys: { tavily: TAVILY_KEY, serpapi: SERPAPI_KEY, deepseek: DEEPSEEK_KEY },
    tiktokCredentials: TIKTOK_CREDENTIALS,
    onCache,
  }),
})
const legacyDataSource = new ServerDataSource({
  cache,
  keys: { tavily: TAVILY_KEY, serpapi: SERPAPI_KEY, deepseek: DEEPSEEK_KEY },
  tiktokCredentials: TIKTOK_CREDENTIALS,
})

const routes = {
  '/api/search': (body, context) => legacyDataSource.searchWeb(body.query, context),
  '/api/listings': (body, context) => legacyDataSource.fetchListings(
    body.query, body.terms, context,
  ),
  '/api/trend': (body, context) => legacyDataSource.fetchTrend(body.term, context),
  '/api/profile': (body, context) => legacyDataSource.profileCategory(
    body.query, body.hits, context,
  ),
  '/api/reviews': (body, context) => legacyDataSource.fetchReviews(body.listings, context),
}

createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  try {
    if (req.method === 'POST' && pathname === '/api/runs') {
      const body = await readJson(req)
      return sendJson(res, 202, runManager.create(body.query))
    }

    const runRoute = matchRunRoute(pathname)
    if (runRoute?.action === 'events' && req.method === 'GET') {
      return streamRunEvents(req, res, runRoute.runId)
    }
    if (runRoute?.action === 'result' && req.method === 'GET') {
      const result = runManager.result(runRoute.runId)
      return sendJson(res, result.status, result.data)
    }
    if (runRoute?.action === 'run' && req.method === 'DELETE') {
      return sendJson(res, 202, runManager.abort(runRoute.runId))
    }

    const handler = Object.hasOwn(routes, pathname) ? routes[pathname] : null
    if (!handler || req.method !== 'POST') return sendJson(res, 404, { error: 'not found' })

    const controller = new AbortController()
    req.once('aborted', () => controller.abort())
    res.once('close', () => {
      if (!res.writableEnded) controller.abort()
    })
    const body = await readJson(req)
    const data = await handler(body, { signal: controller.signal })
    return sendJson(res, 200, data)
  } catch (err) {
    const status = errorStatus(err)
    if (!res.headersSent) return sendJson(res, status, { error: err.message })
    res.end()
  }
}).listen(PORT, HOST, () => {
  console.log(`[bff] http://${HOST}:${PORT}`)
  console.log(`[bff] tavily key: ${TAVILY_KEY ? '已配置' : '未配置'} · serpapi key: ${SERPAPI_KEY ? '已配置' : '未配置'}`)
  console.log(`[bff] deepseek key: ${DEEPSEEK_KEY ? '已配置' : '未配置（使用确定性画像降级）'}`)
  console.log(`[bff] tiktok shop: ${Object.values(TIKTOK_CREDENTIALS).every(Boolean) ? '已配置' : '未授权'}`)
  console.log('[bff] live Pipeline: 服务端执行 · SSE 实时推送 · TTL 内存缓存')
})

function matchRunRoute(pathname) {
  const match = pathname.match(/^\/api\/runs\/([A-Za-z0-9-]+)(?:\/(events|result))?$/)
  return match ? { runId: match[1], action: match[2] ?? 'run' } : null
}

function streamRunEvents(req, res, runId) {
  runManager.get(runId)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()
  res.write(': connected\n\n')
  let terminalTimer
  const unsubscribe = runManager.subscribe(runId, req.headers['last-event-id'], (event) => {
    res.write(formatSseEvent(event))
    if (['complete', 'failed', 'aborted'].includes(event.data.type)) {
      terminalTimer = setTimeout(() => res.end(), 1_000)
    }
  })
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000)
  req.once('close', () => {
    clearInterval(heartbeat)
    clearTimeout(terminalTimer)
    unsubscribe()
  })
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function errorStatus(err) {
  return err instanceof HttpError
    || err instanceof ProfileError
    || err instanceof ExternalRequestError
    || err instanceof ListingsError
    || err instanceof ReviewsError
    || err instanceof RunError
    || Number.isInteger(err?.status)
    ? err.status
    : 500
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1e6) reject(new HttpError(413, 'payload too large'))
    })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new HttpError(400, 'invalid json')) }
    })
    req.on('error', reject)
  })
}
