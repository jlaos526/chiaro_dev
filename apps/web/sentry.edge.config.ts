import * as Sentry from '@sentry/nextjs'
import { beforeSend, beforeBreadcrumb } from './sentry.scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  tracesSampleRate: 0,
  // Mirrors sentry.client.config.ts — shared beforeSend (C52 minimal-event
  // fallback) + beforeBreadcrumb (C51 Supabase URL query-strip).
  beforeSend,
  beforeBreadcrumb,
})
