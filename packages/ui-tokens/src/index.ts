// Legacy COLORS + BrandColor DELETED in slice 77 (audit C28): fully dead
// since slice 60 closed the dark-mode track — every consumer migrated to
// BRAND.semantic.* via useBrandTokens() across slices 33-37 + 60.
export { MAP_COLORS, MAP_COLORS_DARK, type MapColor } from './map-colors.ts'
export {
  DISTRICT_TIER_COLOR,
  DISTRICT_TIER_COLOR_DARK,
  type DistrictTierKey,
} from './district-tier.ts'
export {
  type PartyCode,
  PARTY_COLOR,
  PARTY_COLOR_DARK,
  PARTY_LABEL,
  PARTY_SHORT,
} from './party.ts'
export {
  SCORECARD_LEAN_COLOR,
  SCORECARD_LEAN_COLOR_DARK,
  SCORECARD_LEAN_LABEL,
  type ScorecardLean,
} from './scorecard.ts'
// Slice 77 (audit C24): CategoryId/CATEGORY_LABEL/CATEGORY_ACCENT(_DARK)/
// SUB_CASCADE_ACCENT(_DARK) + the whole finance-shades module deleted with
// their only consumers (the orphaned MetricCardShell family).
export { CATEGORY_CARD_BG, CATEGORY_CARD_BG_DARK } from './category.ts'
export {
  type AlignmentTier,
  ALIGNMENT_LABEL,
  ALIGNMENT_CHIP_COLORS,
  ALIGNMENT_CHIP_COLORS_DARK,
  scoreToTier,
  type AlignmentDotLevel,
  ALIGNMENT_DOT,
  ALIGNMENT_DOT_DARK,
  RADAR,
  RADAR_DARK,
} from './alignment.ts'
export { titleCaseIssueArea } from './issue-area.ts'

// Brand design system (slice brand-design 2026-05-26). See docs/brand-book.md.
export {
  BRAND,
  BRAND_PALETTE,
  BRAND_SEMANTIC,
  BRAND_TYPE,
  BRAND_TYPE_FAMILY,
  BRAND_TYPE_FAMILY_WEB,
  BRAND_TYPE_WEIGHT,
  BRAND_SPACE,
  BRAND_RADII,
  BRAND_SHADOW,
  LOGO_RATIOS,
  LOGO_FILLS,
  getSemantic,
  logoGeometry,
  type BrandMode,
  type BrandPalette,
  type BrandSemantic,
  type BrandType,
  type BrandTypeKey,
  type BrandSpace,
  type BrandSpaceKey,
  type BrandRadii,
  type BrandRadiiKey,
  type BrandShadow,
  type BrandShadowKey,
  type LogoGeometry,
} from './brand/index.ts'
