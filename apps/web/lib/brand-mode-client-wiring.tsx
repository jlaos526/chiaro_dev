'use client'

import { BrandModeProvider } from '@chiaro/officials-ui'
import { writeBrandModeCookie } from '@/lib/brand-mode-cookie.client'
import type { ReactNode } from 'react'
import type { BrandMode } from '@chiaro/ui-tokens'

export function ClientBrandModeWiring({
  defaultMode,
  children,
}: {
  defaultMode: BrandMode | null
  children: ReactNode
}) {
  return (
    <BrandModeProvider defaultMode={defaultMode} onChange={writeBrandModeCookie}>
      {children}
    </BrandModeProvider>
  )
}
