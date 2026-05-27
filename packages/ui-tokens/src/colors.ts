/**
 * Brand colors lifted from existing inline hex values in slice 1/2 components.
 *
 * @deprecated These tokens are the slice-1-through-31 legacy surface. New work
 * should import from `@chiaro/ui-tokens` BRAND.* (see docs/brand-book.md and
 * docs/superpowers/specs/2026-05-26-brand-design-design.md). Legacy COLORS are
 * kept byte-identical for back-compat; do not modify values here without
 * migrating every consumer first.
 */
export const COLORS = {
  brand: {
    primary: '#5b6cff',
    accent: '#1f9b88',
    text: '#1a1714',
  },
  neutral: {
    background: '#ffffff',
    surface: '#f7f6f4',
    surfaceAlt: '#f3f4f6',
    border: '#e6e3df',
    mute: '#807a72',
    textMuted: '#666',
    outline: '#888',
  },
  signal: {
    error: '#c5364a',
    warning: '#d68a1f',
    success: '#1f9b88',
  },
} as const

/** @deprecated See `COLORS` deprecation note. */
export type BrandColor = typeof COLORS
