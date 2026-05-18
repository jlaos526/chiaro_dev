import { describe, expect, it } from 'vitest'
import { scrubAddressInPlace } from '@/sentry.scrub'

// Local stand-in until Task 3 installs @sentry/nextjs (and its transitive @sentry/types).
type Event = {
  request?: { data?: unknown }
  contexts?: Record<string, unknown>
  extra?: Record<string, unknown>
  breadcrumbs?: Array<{ data?: unknown }>
}

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
