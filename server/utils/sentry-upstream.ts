import * as Sentry from '@sentry/nuxt'

type SentryTagValue = string | number | boolean | null | undefined

type SentryUpstreamContext = {
  component: string
  route: string
  companyId?: string | null
  userId?: string | null
  fingerprint?: string[]
  tags?: Record<string, SentryTagValue>
  extras?: Record<string, unknown>
}

const applyCommonScope = (scope: any, context: SentryUpstreamContext) => {
  scope.setTag('component', context.component)
  scope.setTag('route', context.route)
  scope.setTag('companyId', context.companyId || 'unknown')

  if (context.userId) {
    scope.setUser({ id: context.userId })
  }

  if (context.fingerprint?.length) {
    scope.setFingerprint(context.fingerprint)
  }

  if (context.tags) {
    for (const [key, value] of Object.entries(context.tags)) {
      if (value === undefined || value === null) continue
      scope.setTag(key, String(value))
    }
  }

  if (context.extras) {
    scope.setExtras(context.extras)
  }
}

export const captureUpstreamMessage = (
  message: string,
  context: SentryUpstreamContext,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'error'
) => {
  Sentry.withScope((scope) => {
    applyCommonScope(scope, context)
    Sentry.captureMessage(message, level as any)
  })
}

export const captureUpstreamException = (
  error: unknown,
  context: SentryUpstreamContext
) => {
  Sentry.withScope((scope) => {
    applyCommonScope(scope, context)
    Sentry.captureException(error)
  })
}
