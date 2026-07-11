// Brand typography scale. Family is Inter (weights 400/500/600/700).
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §5.

export const BRAND_TYPE_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/**
 * Web-only variant (slice 70, audit C6): consumes the next/font-hosted Inter
 * via the CSS variable the web root layout declares (`--font-inter`).
 * next/font scopes its generated @font-face under a hashed family name, so a
 * plain 'Inter' string only matches a locally-installed Inter — the variable
 * is the contract between the app and shared components. Falls back to local
 * Inter, then the system stack. NOT for native — RN cannot parse var().
 */
export const BRAND_TYPE_FAMILY_WEB = 'var(--font-inter, Inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export const BRAND_TYPE = {
  display: { sizePx: 40,   sizeRem: 2.5,    lineHeight: 1.15, tracking: '-0.02em',  weight: 700 },
  h1:      { sizePx: 28,   sizeRem: 1.75,   lineHeight: 1.2,  tracking: '-0.015em', weight: 700 },
  h2:      { sizePx: 22,   sizeRem: 1.375,  lineHeight: 1.25, tracking: '-0.01em',  weight: 700 },
  h3:      { sizePx: 18,   sizeRem: 1.125,  lineHeight: 1.3,  tracking: '-0.005em', weight: 700 },
  h4:      { sizePx: 16,   sizeRem: 1.0,    lineHeight: 1.35, tracking: '0',        weight: 600 },
  body:    { sizePx: 15,   sizeRem: 0.9375, lineHeight: 1.55, tracking: '0',        weight: 400 },
  bodySm:  { sizePx: 13,   sizeRem: 0.8125, lineHeight: 1.5,  tracking: '0',        weight: 400 },
  label:   { sizePx: 12,   sizeRem: 0.75,   lineHeight: 1.45, tracking: '0.04em',   weight: 600 },
  micro:   { sizePx: 11,   sizeRem: 0.6875, lineHeight: 1.4,  tracking: '0.08em',   weight: 700 },
} as const

export const BRAND_TYPE_WEIGHT = {
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
} as const

export type BrandType = typeof BRAND_TYPE
export type BrandTypeKey = keyof typeof BRAND_TYPE
