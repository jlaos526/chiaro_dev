'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * Subscribe to a min-width media query. SSR-safe: server snapshot is `false`
 * (treat SSR as below breakpoint — safer for narrow viewports). Client
 * snapshot reflects current `matchMedia` state and updates on `change` events.
 *
 * @example
 *   const isDesktop = useBreakpoint(768)
 */
export function useBreakpoint(minWidthPx: number): boolean {
  return useSyncExternalStore(
    typeof window === 'undefined'
      ? noopSubscribe
      : (onChange) => {
          const mql = window.matchMedia(`(min-width: ${minWidthPx}px)`)
          const handler = () => onChange()
          mql.addEventListener('change', handler)
          return () => mql.removeEventListener('change', handler)
        },
    () =>
      typeof window === 'undefined'
        ? false
        : window.matchMedia(`(min-width: ${minWidthPx}px)`).matches,
    () => false,
  )
}
