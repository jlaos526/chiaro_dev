export { COLORS, type BrandColor } from './colors.ts'
export { MAP_COLORS, MAP_COLORS_DARK, type MapColor } from './map-colors.ts'
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
export {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BG_DARK,
  SUB_CASCADE_ACCENT,
  SUB_CASCADE_ACCENT_DARK,
} from './category.ts'
export {
  FINANCE_SUB_SECTION_SHADES,
  FINANCE_SUB_SECTION_SHADES_DARK,
  type FinanceSubSectionShade,
} from './finance-shades.ts'
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

// Brand design system (slice brand-design 2026-05-26). New surface — see
// docs/brand-book.md. Legacy COLORS above is @deprecated for new code.
export {
  BRAND,
  BRAND_PALETTE,
  BRAND_SEMANTIC,
  BRAND_TYPE,
  BRAND_TYPE_FAMILY,
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
