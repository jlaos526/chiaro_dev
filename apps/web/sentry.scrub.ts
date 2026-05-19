import type { Event } from '@sentry/core'

const ADDRESS_KEY = /^address/i

function scrub(obj: unknown, seen: WeakSet<object>): void {
  if (!obj || typeof obj !== 'object') return
  if (seen.has(obj as object)) return
  seen.add(obj as object)
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) {
      (obj as Record<string, unknown>)[k] = '[scrubbed]'
    } else if (v && typeof v === 'object') {
      scrub(v, seen)
    }
  }
}

export function scrubAddressInPlace(event: Event): void {
  const seen = new WeakSet<object>()
  scrub(event.request?.data, seen)
  scrub(event.contexts, seen)
  scrub(event.extra, seen)
  event.breadcrumbs?.forEach((b) => scrub(b.data, seen))
}
