// Slice 80: migrated from sentry.client.config.ts — @sentry/nextjs 10
// deprecates the old filename in favor of Next 15.3+'s instrumentation-client.
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

// Required export with the instrumentation-client convention; with tracing
// disabled (tracesSampleRate 0) it is a no-op hook.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
