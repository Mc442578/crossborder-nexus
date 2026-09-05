export function resolveHost(env) {
  const host = typeof env?.HOST === 'string' ? env.HOST.trim() : ''
  return host || '127.0.0.1'
}
