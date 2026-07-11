import { describe, expect, it } from 'vitest'
import type { Breadcrumb, Event } from '@sentry/core'
import { beforeBreadcrumb, beforeSend, scrubAddressInPlace } from '@/sentry.scrub'

describe('scrubAddressInPlace', () => {
  it('scrubs event.request.data.address', () => {
    const e: Event = { request: { data: { address: '123 Main St', other: 'keep' } } }
    scrubAddressInPlace(e)
    expect((e.request!.data as Record<string, unknown>).address).toBe('[scrubbed]')
    expect((e.request!.data as Record<string, unknown>).other).toBe('keep')
  })

  it('scrubs nested address keys recursively', () => {
    const e: Event = { extra: { formInput: { address: '1 Wall St', city: 'NY' } } }
    scrubAddressInPlace(e)
    expect((e.extra!.formInput as Record<string, unknown>).address).toBe('[scrubbed]')
    expect((e.extra!.formInput as Record<string, unknown>).city).toBe('NY')
  })

  it('scrubs in event.breadcrumbs[].data', () => {
    const e: Event = { breadcrumbs: [{ data: { address: '1 Wall St' } }, { data: { ok: 1 } }] }
    scrubAddressInPlace(e)
    expect((e.breadcrumbs![0]!.data as Record<string, unknown>).address).toBe('[scrubbed]')
    expect((e.breadcrumbs![1]!.data as Record<string, unknown>).ok).toBe(1)
  })

  it('scrubs in event.contexts', () => {
    const e: Event = { contexts: { custom: { address: '1 Wall St' } } }
    scrubAddressInPlace(e)
    expect((e.contexts!.custom as Record<string, unknown>).address).toBe('[scrubbed]')
  })

  it('case-insensitive address key match', () => {
    const e: Event = { extra: { Address: 'X', ADDRESS_LINE1: 'Y' } }
    scrubAddressInPlace(e)
    expect(e.extra!.Address).toBe('[scrubbed]')
    expect(e.extra!.ADDRESS_LINE1).toBe('[scrubbed]')
  })

  it('preserves non-address fields', () => {
    const e: Event = { extra: { email: 'x@example.com', count: 42 } }
    scrubAddressInPlace(e)
    expect(e.extra!.email).toBe('x@example.com')
    expect(e.extra!.count).toBe(42)
  })

  it('handles undefined event sections gracefully', () => {
    const e: Event = {}
    expect(() => scrubAddressInPlace(e)).not.toThrow()
  })

  it('handles primitives in extra (does not recurse into strings)', () => {
    const e: Event = { extra: { greeting: 'hello' } }
    scrubAddressInPlace(e)
    expect(e.extra!.greeting).toBe('hello')
  })

  it('handles cyclic references without infinite-looping', () => {
    const cyclic: Record<string, unknown> = { address: '1 Main St' }
    cyclic.self = cyclic
    const e: Event = { extra: { nested: cyclic } }
    // If the scrubber doesn't guard against cycles, this will hang the test.
    scrubAddressInPlace(e)
    expect(((e.extra!.nested as Record<string, unknown>).address)).toBe('[scrubbed]')
    expect((e.extra!.nested as Record<string, unknown>).self).toBe(cyclic)
  })
})

describe('beforeSend (C52 — B10 web parity)', () => {
  it('returns the scrubbed event on the happy path', () => {
    const e: Event = { message: 'boom', extra: { address: '1 Main St' } }
    const out = beforeSend(e)
    expect(out).toBe(e)
    expect(out.extra!.address).toBe('[scrubbed]')
  })

  it('returns a minimal {message, level} event (NOT null) when scrubbing throws', () => {
    const poisoned: Record<string, unknown> = {}
    Object.defineProperty(poisoned, 'trap', {
      enumerable: true,
      get() { throw new Error('getter bomb') },
    })
    const e: Event = { message: 'boom', level: 'error', extra: poisoned }
    const out = beforeSend(e)
    expect(out).not.toBeNull()
    expect(out).toEqual({ message: 'boom', level: 'error' })
  })
})

describe('beforeBreadcrumb (C51 — Supabase URL query-strip)', () => {
  it('strips the query string from *.supabase.co URLs', () => {
    const b: Breadcrumb = {
      category: 'fetch',
      data: { method: 'GET', url: 'https://ebxlyxxudxapswuoonhm.supabase.co/rest/v1/user_districts?select=district_id&user_id=eq.abc-123' },
    }
    expect(beforeBreadcrumb(b).data!.url).toBe('https://ebxlyxxudxapswuoonhm.supabase.co/rest/v1/user_districts')
  })

  it('strips localhost Supabase URLs too', () => {
    const b: Breadcrumb = { data: { url: 'http://127.0.0.1:54321/rest/v1/user_locations?id=eq.abc' } }
    expect(beforeBreadcrumb(b).data!.url).toBe('http://127.0.0.1:54321/rest/v1/user_locations')
  })

  it('leaves non-Supabase URLs untouched', () => {
    const url = 'https://example.com/path?q=keep'
    const b: Breadcrumb = { data: { url } }
    expect(beforeBreadcrumb(b).data!.url).toBe(url)
  })

  it('passes through breadcrumbs without a url and malformed urls', () => {
    expect(beforeBreadcrumb({ data: { method: 'GET' } }).data!.method).toBe('GET')
    const b: Breadcrumb = { data: { url: 'not a url?x=1' } }
    expect(beforeBreadcrumb(b).data!.url).toBe('not a url?x=1')
  })
})
