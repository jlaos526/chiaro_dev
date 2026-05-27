'use client'

// Brand mode + token hook. Canonical entry point for every consumer of the
// slice-32 BRAND.* token surface. Reads override Context first (slice 33 ships
// no Provider — Context plumbing exists for future override slices), falls
// back to react-native's useColorScheme(), defaults to 'light' if both null.
//
// Source of truth: docs/superpowers/specs/2026-05-27-auth-brand-retrofit-design.md §4.1

import { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import {
  BRAND_PALETTE,
  getSemantic,
  type BrandMode,
  type BrandSemantic,
} from '@chiaro/ui-tokens'

/**
 * Override Context for forced light/dark. null = follow system preference.
 *
 * Slice 33 ships no Provider component — the value is always null at runtime.
 * Tests wrap their tree with `BrandModeOverrideContext.Provider value="dark"`
 * to force dark mode. A future slice (likely 38) will ship a Provider that
 * reads from a settings store.
 */
export const BrandModeOverrideContext = createContext<BrandMode | null>(null)

export interface BrandTokens {
  mode: BrandMode
  semantic: BrandSemantic
  palette: (typeof BRAND_PALETTE)[BrandMode]
}

/**
 * Hook returning the active brand token table.
 *
 * @example
 * const { mode, semantic } = useBrandTokens()
 * <View style={{ backgroundColor: semantic.bg.card, color: semantic.text.primary }} />
 */
export function useBrandTokens(): BrandTokens {
  const override = useContext(BrandModeOverrideContext)
  const system = useColorScheme()
  const mode: BrandMode = override ?? (system === 'dark' ? 'dark' : 'light')
  return {
    mode,
    semantic: getSemantic(mode),
    palette: BRAND_PALETTE[mode],
  }
}
