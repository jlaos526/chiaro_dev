import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBreakpoint } from '../../src/nav/useBreakpoint.ts'

interface FakeMQL {
  matches: boolean
  addEventListener: (event: 'change', listener: (e: { matches: boolean }) => void) => void
  removeEventListener: (event: 'change', listener: (e: { matches: boolean }) => void) => void
}

function installMatchMedia(initial: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>()
  const mql: FakeMQL = {
    matches: initial,
    addEventListener: (_e, l) => {
      listeners.add(l)
    },
    removeEventListener: (_e, l) => {
      listeners.delete(l)
    },
  }
  ;(window as unknown as { matchMedia: (q: string) => FakeMQL }).matchMedia = () => mql
  return {
    fire(matches: boolean) {
      mql.matches = matches
      listeners.forEach((l) => l({ matches }))
    },
  }
}

describe('useBreakpoint', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('returns true on mount when matchMedia matches', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => useBreakpoint(768))
    expect(result.current).toBe(true)
  })

  it('returns false on mount when matchMedia does not match', () => {
    installMatchMedia(false)
    const { result } = renderHook(() => useBreakpoint(768))
    expect(result.current).toBe(false)
  })

  it('updates when matchMedia change event fires', () => {
    const { fire } = installMatchMedia(false)
    const { result } = renderHook(() => useBreakpoint(768))
    expect(result.current).toBe(false)
    act(() => fire(true))
    expect(result.current).toBe(true)
    act(() => fire(false))
    expect(result.current).toBe(false)
  })

  it('queries the correct min-width media string', () => {
    let receivedQuery = ''
    ;(window as unknown as { matchMedia: (q: string) => FakeMQL }).matchMedia = (q: string) => {
      receivedQuery = q
      return {
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
    }
    renderHook(() => useBreakpoint(768))
    expect(receivedQuery).toBe('(min-width: 768px)')
  })
})
