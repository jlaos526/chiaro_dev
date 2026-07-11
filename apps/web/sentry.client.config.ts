import * as Sentry from '@sentry/nextjs'
import { beforeSend, beforeBreadcrumb } from './sentry.scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  tracesSampleRate: 0,
  // Default integrations are intentionally KEPT (breadcrumbs give error
  // context; slice 70 dropped the old `integrations: []`, which the SDK
  // merges with defaults — a no-op, audit C51). Error-only posture comes
  // from tracesSampleRate: 0 + build-time bundleSizeOptimizations (C0);
  // breadcrumb URLs are query-stripped in beforeBreadcrumb.
  beforeSend,
  beforeBreadcrumb,
})
