import * as Sentry from '@sentry/nuxt'

const SENSITIVE_KEY_PATTERN = /(authorization|token|cookie|password|secret|api[-_]?key|x-agentic-ally-token)/i
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi

const redactString = (value: string) => value.replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')

const sanitizeValue = (input: unknown): unknown => {
  const seen = new WeakSet<object>()

  const walk = (value: unknown): unknown => {
    if (value === null || value === undefined) return value
    if (typeof value === 'string') return redactString(value)
    if (typeof value !== 'object') return value

    if (seen.has(value as object)) {
      return '[Circular]'
    }
    seen.add(value as object)

    if (Array.isArray(value)) {
      return value.map(walk)
    }

    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : walk(nested)
    }
    return output
  }

  return walk(input)
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    beforeSend(event) {
      return sanitizeValue(event) as any
    }
  })
}
