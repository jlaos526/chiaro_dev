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
  ALIGNMENT_CHIP_COLORS,
  ALIGNMENT_CHIP_COLORS_DARK,
  ALIGNMENT_DOT,
  ALIGNMENT_DOT_DARK,
  BRAND_PALETTE,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BG_DARK,
  DISTRICT_TIER_COLOR,
  DISTRICT_TIER_COLOR_DARK,
  MAP_COLORS,
  MAP_COLORS_DARK,
  PARTY_COLOR,
  PARTY_COLOR_DARK,
  RADAR,
  RADAR_DARK,
  SCORECARD_LEAN_COLOR,
  SCORECARD_LEAN_COLOR_DARK,
  getSemantic,
  type AlignmentDotLevel,
  type AlignmentTier,
  type BrandMode,
  type BrandSemantic,
  type DistrictTierKey,
  type PartyCode,
  type ScorecardLean,
} from '@chiaro/ui-tokens'

/**
 * Override Context for forced light/dark. null = follow system preference.
 *
 * Wrapped by `<BrandModeProvider>` (slice 38, `./brand-mode-provider.tsx`),
 * which manages state + persists via cookie (web) / AsyncStorage (mobile).
 * Tests may wrap their tree directly with `BrandModeOverrideContext.Provider
 * value="dark"` to force a mode without a full Provider.
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

// ---------------------------------------------------------------------------
// Slice 37: per-domain mode-aware accessor hooks.
//
// Each hook reads useBrandTokens() for the active mode then indexes the
// appropriate light/dark palette table. Consumers in slices 37 T5-T9 migrate
// away from direct PARTY_COLOR / ALIGNMENT_CHIP_COLORS / etc. imports to these
// hooks so dark-mode propagation is automatic.
// ---------------------------------------------------------------------------

/**
 * Returns the party color for the active brand mode. Falls back to the
 * `unknown` entry when the party code is not recognized.
 */
export function usePartyColor(party: PartyCode | string | undefined): string {
  const { mode } = useBrandTokens()
  const table = mode === 'dark' ? PARTY_COLOR_DARK : PARTY_COLOR
  if (party && party in table) {
    const hit = (table as Record<string, string>)[party]
    if (hit !== undefined) return hit
  }
  return table.unknown
}

/**
 * Returns `{ bg, fg }` chip colors for an alignment tier in the active mode.
 */
export function useAlignmentChipColors(tier: AlignmentTier): { bg: string; fg: string } {
  const { mode } = useBrandTokens()
  const table = mode === 'dark' ? ALIGNMENT_CHIP_COLORS_DARK : ALIGNMENT_CHIP_COLORS
  return table[tier]
}

/**
 * Returns the scorecard-lean color for the active brand mode.
 */
export function useScorecardLeanColor(lean: ScorecardLean): string {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? SCORECARD_LEAN_COLOR_DARK[lean] : SCORECARD_LEAN_COLOR[lean]
}

// useCategoryAccent + useFinanceSubSectionShade DELETED in slice 77 (audit
// C24): their only consumers were the orphaned MetricCardShell/finance-atom
// family removed in the same slice.

/**
 * Returns the `{ districtStroke, districtFill }` map color pair for the
 * active brand mode.
 */
export function useMapColors(): { districtStroke: string; districtFill: string } {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? MAP_COLORS_DARK : MAP_COLORS
}

/**
 * Returns the per-district-tier accent color table for the active brand mode
 * (slice 60). Consumed by the map legend + polygon strokes/fills (web Leaflet +
 * RN react-native-maps) — replaces the slice-2 location `TIER_COLOR` import so
 * district tiers lighten automatically in dark mode.
 */
export function useDistrictTierColors(): Record<DistrictTierKey, string> {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? DISTRICT_TIER_COLOR_DARK : DISTRICT_TIER_COLOR
}

/**
 * Returns the universal category card background color for the active brand
 * mode (slice 43). Survives the slice-77 C24 purge because BrandAlert
 * consumes it directly.
 */
export function useCategoryCardBg(): string {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? CATEGORY_CARD_BG_DARK : CATEGORY_CARD_BG
}

// ---------------------------------------------------------------------------
// Slice 52: alignment dot + radar chart accessors. Mirror the per-domain
// pattern above — read useBrandTokens() for the active mode, index the
// light/dark token table. Consumed by the issue-priorities radar (Task 13)
// + alignment strip (Task 14).
// ---------------------------------------------------------------------------

/**
 * Returns the alignment-dot color for a per-issue level in the active mode.
 */
export function useAlignmentDotColor(level: AlignmentDotLevel): string {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? ALIGNMENT_DOT_DARK[level] : ALIGNMENT_DOT[level]
}

/**
 * Returns the `{ grid, userFill, userStroke, repStroke }` radar-chart colors
 * for the active brand mode.
 */
export function useRadarColors(): typeof RADAR | typeof RADAR_DARK {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? RADAR_DARK : RADAR
}
