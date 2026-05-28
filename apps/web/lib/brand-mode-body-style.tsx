'use client'

import { useEffect } from 'react'
import { useBrandTokens } from '@chiaro/officials-ui'

/**
 * Syncs document.body background + text color and html color-scheme to the
 * active brand mode. Server-side inline style on <body> in root layout handles
 * first paint; this client component keeps it in sync when the user toggles
 * in-session, and when useColorScheme() flips with no override set.
 */
export function BrandModeBodyStyle(): null {
  const { mode, semantic } = useBrandTokens()
  useEffect(() => {
    document.body.style.backgroundColor = semantic.bg.app
    document.body.style.color = semantic.text.body
    document.documentElement.style.colorScheme = mode
  }, [mode, semantic.bg.app, semantic.text.body])
  return null
}
