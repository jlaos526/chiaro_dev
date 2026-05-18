// Local stand-in until Task 3 installs @sentry/nextjs (and its transitive @sentry/types) — then this import swaps to:
//   import type { Event } from '@sentry/types'
type Event = {
  request?: { data?: unknown }
  contexts?: Record<string, unknown>
  extra?: Record<string, unknown>
  breadcrumbs?: Array<{ data?: unknown }>
}

const ADDRESS_KEY = /^address/i

function scrub(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) {
      (obj as Record<string, unknown>)[k] = '[scrubbed]'
    } else if (v && typeof v === 'object') {
      scrub(v)
    }
  }
}

export function scrubAddressInPlace(event: Event): void {
  scrub(event.request?.data)
  scrub(event.contexts)
  scrub(event.extra)
  event.breadcrumbs?.forEach((b) => scrub(b.data))
}
