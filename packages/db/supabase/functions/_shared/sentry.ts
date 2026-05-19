// deno-lint-ignore-file no-explicit-any
import * as Sentry from 'npm:@sentry/deno@8'

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

function scrubEvent(event: any): any {
  try {
    const seen = new WeakSet<object>()
    scrub(event?.request?.data, seen)
    scrub(event?.contexts, seen)
    scrub(event?.extra, seen)
    event?.breadcrumbs?.forEach((b: any) => scrub(b?.data, seen))
    return event
  } catch {
    return null
  }
}

// Test hook — lets unit tests exercise the scrubber without booting Sentry.
export function scrubEventForTesting(event: any): void {
  scrubEvent(event)
}

let initialized = false

export function initSentry(): void {
  if (initialized) return
  const dsn = Deno.env.get('SENTRY_DSN_EDGE')
  if (!dsn) return
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  })
  initialized = true
}

export function withSentry(handler: (req: Request) => Promise<Response>) {
  initSentry()
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req)
    } catch (e) {
      Sentry.captureException(e)
      throw e
    }
  }
}

export { Sentry }
