// Brand shadow scale. 3-step warm-tinted in light mode; black-tinted in dark.
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §8.

export const BRAND_SHADOW = {
  sm: {
    light: '0 1px 2px rgba(58,40,24,0.06)',
    dark: '0 1px 2px rgba(0,0,0,0.4)',
  },
  md: {
    light: '0 2px 4px rgba(58,40,24,0.08), 0 1px 2px rgba(58,40,24,0.06)',
    dark: '0 2px 4px rgba(0,0,0,0.5)',
  },
  lg: {
    light: '0 8px 16px rgba(58,40,24,0.10), 0 2px 4px rgba(58,40,24,0.08)',
    dark: '0 8px 16px rgba(0,0,0,0.6)',
  },
} as const

export type BrandShadow = typeof BRAND_SHADOW
export type BrandShadowKey = keyof typeof BRAND_SHADOW
