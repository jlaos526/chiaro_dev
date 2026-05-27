// Brand design system root export. Assembles palette + semantic + type +
// space + radii + shadow + logo into a single BRAND object.
//
// Source of truth: docs/brand-book.md and docs/superpowers/specs/2026-05-26-brand-design-design.md.

import { BRAND_PALETTE, type BrandMode, type BrandPalette } from './palette.ts'
import { BRAND_SEMANTIC, getSemantic, type BrandSemantic } from './semantic.ts'
import { BRAND_TYPE, BRAND_TYPE_FAMILY, BRAND_TYPE_WEIGHT, type BrandType, type BrandTypeKey } from './typography.ts'
import { BRAND_SPACE, type BrandSpace, type BrandSpaceKey } from './spacing.ts'
import { BRAND_RADII, type BrandRadii, type BrandRadiiKey } from './radii.ts'
import { BRAND_SHADOW, type BrandShadow, type BrandShadowKey } from './shadow.ts'
import { LOGO_RATIOS, LOGO_FILLS, logoGeometry, type LogoGeometry } from './logo.ts'

export const BRAND = {
  palette:  BRAND_PALETTE,
  semantic: BRAND_SEMANTIC,
  type:     BRAND_TYPE,
  space:    BRAND_SPACE,
  radii:    BRAND_RADII,
  shadow:   BRAND_SHADOW,
  logo: {
    ratios: LOGO_RATIOS,
    fills:  LOGO_FILLS,
  },
} as const

export {
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
}

export type {
  BrandMode,
  BrandPalette,
  BrandSemantic,
  BrandType,
  BrandTypeKey,
  BrandSpace,
  BrandSpaceKey,
  BrandRadii,
  BrandRadiiKey,
  BrandShadow,
  BrandShadowKey,
  LogoGeometry,
}
