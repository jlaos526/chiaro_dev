import 'server-only'
import { cookies } from 'next/headers'
import type { BrandMode } from '@chiaro/ui-tokens'

export const BRAND_MODE_COOKIE_KEY = 'chiaro_brand_mode'

export async function readBrandModeCookie(): Promise<BrandMode | null> {
  const store = await cookies()
  const v = store.get(BRAND_MODE_COOKIE_KEY)?.value
  return v === 'light' || v === 'dark' ? v : null
}
