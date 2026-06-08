import { beforeSend, scrubAddressInPlace } from '@/lib/sentry'

describe('scrubAddressInPlace (mobile)', () => {
  it('scrubs event.request.data.address', () => {
    const e: any = { request: { data: { address: '123 Main St', other: 'keep' } } }
    scrubAddressInPlace(e)
    expect(e.request.data.address).toBe('[scrubbed]')
    expect(e.request.data.other).toBe('keep')
  })

  it('scrubs nested address keys recursively', () => {
    const e: any = { extra: { formInput: { address: '1 Wall St', city: 'NY' } } }
    scrubAddressInPlace(e)
    expect(e.extra.formInput.address).toBe('[scrubbed]')
    expect(e.extra.formInput.city).toBe('NY')
  })

  it('scrubs in event.breadcrumbs[].data', () => {
    const e: any = { breadcrumbs: [{ data: { address: '1 Wall St' } }] }
    scrubAddressInPlace(e)
    expect(e.breadcrumbs[0].data.address).toBe('[scrubbed]')
  })

  it('case-insensitive match', () => {
    const e: any = { extra: { Address: 'X' } }
    scrubAddressInPlace(e)
    expect(e.extra.Address).toBe('[scrubbed]')
  })

  it('handles empty event', () => {
    const e: any = {}
    expect(() => scrubAddressInPlace(e)).not.toThrow()
  })

  it('handles cyclic references without infinite-looping', () => {
    const cyclic: any = { address: '1 Main St' }
    cyclic.self = cyclic
    const e: any = { extra: { nested: cyclic } }
    scrubAddressInPlace(e)
    expect(e.extra.nested.address).toBe('[scrubbed]')
    expect(e.extra.nested.self).toBe(cyclic)
  })
})

describe('beforeSend (mobile)', () => {
  it('returns the scrubbed event on success', () => {
    const e: any = {
      message: 'boom',
      level: 'error',
      request: { data: { address: '123 Main St', other: 'keep' } },
    }
    const result = beforeSend(e)
    expect(result).toBe(e)
    expect(result.request.data.address).toBe('[scrubbed]')
    expect(result.request.data.other).toBe('keep')
  })

  it('keeps a minimal event (message + level) when scrubbing throws — not null', () => {
    // A throwing getter on `extra` forces scrubAddressInPlace to throw,
    // exercising the catch branch (frozen-object assignment silently no-ops
    // under jest's non-strict transpile, so a getter is the reliable trip).
    const e: any = { message: 'boom', level: 'warning' }
    Object.defineProperty(e, 'extra', {
      enumerable: true,
      get() {
        throw new Error('scrub blew up')
      },
    })
    const result = beforeSend(e)
    expect(result).not.toBeNull()
    expect(result.message).toBe('boom')
    expect(result.level).toBe('warning')
    // The minimal event carries only message + level — the unscrubbed payload
    // is dropped (no throwing getter copied over).
    expect(Object.keys(result).sort()).toEqual(['level', 'message'])
  })
})
