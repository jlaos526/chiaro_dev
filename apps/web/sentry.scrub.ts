import type { Breadcrumb, Event } from '@sentry/core'

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

function isSupabaseHost(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return h.endsWith('.supabase.co') || h === '127.0.0.1' || h === 'localhost'
  } catch {
    return false
  }
}

/**
 * Shared `beforeBreadcrumb` for the 3 web runtimes (audit C51). Default
 * fetch/XHR breadcrumbs record full request URLs, and PostgREST GETs embed
 * filter values in the query string — the caller's uuid (`id=eq.<uuid>`) and
 * their district ids, a home-location signal. Strip the query string from
 * Supabase-host URLs; the path stays for debuggability. Non-Supabase URLs
 * pass through untouched.
 */
export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const url = breadcrumb.data?.url
  if (typeof url === 'string') {
    const q = url.indexOf('?')
    if (q !== -1 && isSupabaseHost(url)) breadcrumb.data!.url = url.slice(0, q)
  }
  return breadcrumb
}

/**
 * Shared `beforeSend` for the 3 web runtimes (audit C52 — slice 61 B10
 * mobile parity). If scrubbing throws, return a minimal {message, level}
 * event instead of null: dropping the whole event would lose all telemetry
 * signal, and events whose shape breaks the scrubber are precisely the
 * unusual ones worth seeing.
 */
export function beforeSend<E extends Event>(event: E): E {
  try {
    scrubAddressInPlace(event)
  } catch {
    return { message: event.message, level: event.level } as E
  }
  return event
}
