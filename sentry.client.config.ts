import { useRuntimeConfig } from '#imports'
import * as Sentry from '@sentry/nuxt'

const runtimeConfig = useRuntimeConfig()

Sentry.init({
  dsn: runtimeConfig.public.sentry.dsn,
  enabled: Boolean(runtimeConfig.public.sentry.dsn)
})
