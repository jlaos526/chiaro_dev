import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'

const ADDRESS_KEY = /^address/i

function scrub(obj: unknown, seen: WeakSet<object>): void {
  if (!obj || typeof obj !== 'object') return
  if (seen.has(obj as object)) return
  seen.add(obj as object)
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (ADDRESS_KEY.test(k)) {
      ;(obj as Record<string, unknown>)[k] = '[scrubbed]'
    } else if (v && typeof v === 'object') {
      scrub(v, seen)
    }
  }
}

// `any` here mirrors the spec's decision to avoid pulling Sentry types into mobile.
export function scrubAddressInPlace(event: any): void {
  const seen = new WeakSet<object>()
  scrub(event?.request?.data, seen)
  scrub(event?.contexts, seen)
  scrub(event?.extra, seen)
  event?.breadcrumbs?.forEach((b: any) => scrub(b?.data, seen))
}

/**
 * Sentry `beforeSend` hook. Scrubs address fields in place. If scrubbing throws,
 * returns a minimal stripped event (message + level only) rather than `null` —
 * dropping the whole event would lose all telemetry signal. `any` mirrors the
 * spec's decision to avoid pulling Sentry types into mobile.
 */
export function beforeSend(event: any): any {
  try {
    scrubAddressInPlace(event)
  } catch {
    return { message: event?.message, level: event?.level }
  }
  return event
}

let initialized = false
export function initSentry(): void {
  if (initialized) return
  const dsn = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn
  if (!dsn) return
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    beforeSend,
  })
  initialized = true
}

export const ErrorBoundary = Sentry.ErrorBoundary
export { Sentry }
