'use client'

import type { BrandMode } from '@chiaro/ui-tokens'

export const BRAND_MODE_COOKIE_KEY = 'chiaro_brand_mode'

export function writeBrandModeCookie(mode: BrandMode | null): void {
  if (typeof document === 'undefined') return
  const maxAge = mode === null ? 0 : 60 * 60 * 24 * 365
  const value = mode === null ? '' : mode
  document.cookie = `${BRAND_MODE_COOKIE_KEY}=${value}; Max-Age=${maxAge}; path=/; SameSite=Lax`
}
