import { describe, expect, it } from 'vitest'
import { mapCalibrateError } from '@/lib/calibrate-error'

describe('mapCalibrateError', () => {
  it('400 → address-not-found message', () => {
    expect(mapCalibrateError(400)).toBe("We couldn't find that address. Double-check spelling.")
  })

  it('422 → districts-not-resolvable message', () => {
    expect(mapCalibrateError(422)).toBe("We can't resolve districts for that location yet.")
  })

  it('502 → lookup-unavailable message', () => {
    expect(mapCalibrateError(502)).toBe('Address lookup is temporarily unavailable. Try again.')
  })

  it('other (undefined / unrecognized status) → generic fallback', () => {
    expect(mapCalibrateError(undefined)).toBe(
      'Something went wrong saving your location. Try again.',
    )
    expect(mapCalibrateError(500)).toBe('Something went wrong saving your location. Try again.')
  })
})
