// Brand spacing scale. 4px base unit (Tailwind-compatible stops only — we export
// the ones we actually use, not every Tailwind index).
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §6.

export const BRAND_SPACE = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

export type BrandSpace = typeof BRAND_SPACE
export type BrandSpaceKey = keyof typeof BRAND_SPACE
