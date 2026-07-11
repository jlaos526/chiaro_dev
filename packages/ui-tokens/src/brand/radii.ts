// Brand radius scale. Sharp / editorial.
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §7.

export const BRAND_RADII = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const

export type BrandRadii = typeof BRAND_RADII
export type BrandRadiiKey = keyof typeof BRAND_RADII
