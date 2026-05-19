import { scrubAddressInPlace } from '@/lib/sentry'

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
