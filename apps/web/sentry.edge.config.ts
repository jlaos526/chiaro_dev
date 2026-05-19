import * as Sentry from '@sentry/nextjs'
import { scrubAddressInPlace } from './sentry.scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  tracesSampleRate: 0,
  integrations: [],
  beforeSend(event) {
    try { scrubAddressInPlace(event) } catch { return null }
    return event
  },
})
