// Logo geometry + fills. The Chiaro mark is two cascading squares with four
// L-shaped corner brackets framing the overlap region. All dimensions scale
// with a single parameter S (square side length, px).
//
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §9.

export const LOGO_RATIOS = {
  // Front square SE offset from back square's top-left
  offsetXRatio: 0.4375,    // 14/32 — horizontal offset
  offsetYRatio: 0.25,      // 8/32  — vertical offset

  // Overlap rectangle dimensions (in terms of S)
  overlapWidthRatio: 0.5625,   // 18/32
  overlapHeightRatio: 0.75,    // 24/32

  // Corner bracket geometry
  bracketArmRatio: 0.20,       // arm length is 20% of S

  // Bounding box (S + offsetX, S + offsetY)
  boundingWidthRatio: 1.4375,
  boundingHeightRatio: 1.25,
} as const

export const LOGO_FILLS = {
  backSquare:  'linear-gradient(135deg, rgba(196,106,42,0.6) 0%, rgba(196,106,42,0.08) 100%)',
  frontSquare: 'linear-gradient(135deg, rgba(232,160,96,0.6) 0%, rgba(232,160,96,0.08) 100%)',
  borderColor:  '#c46a2a',   // matches BRAND_PALETTE.light.accent[500]
  bracketColor: '#c46a2a',
} as const

export interface LogoGeometry {
  squareSize: number
  squareRadius: number
  offsetX: number
  offsetY: number
  overlapWidth: number
  overlapHeight: number
  bracketArm: number
  bracketStroke: number
  borderStroke: number
  boundingWidth: number
  boundingHeight: number
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max)

/**
 * Resolve concrete logo geometry for a given square side length S (in px).
 *
 * @example
 * const g = logoGeometry(32)
 * // g.boundingWidth === 46, g.boundingHeight === 40, g.squareRadius === 3
 */
export function logoGeometry(S: number): LogoGeometry {
  return {
    squareSize:     S,
    squareRadius:   clamp(S * 0.09375, 2, 6),     // 3/32 — ≈ 3 at S=32
    offsetX:        S * LOGO_RATIOS.offsetXRatio,
    offsetY:        S * LOGO_RATIOS.offsetYRatio,
    overlapWidth:   S * LOGO_RATIOS.overlapWidthRatio,
    overlapHeight:  S * LOGO_RATIOS.overlapHeightRatio,
    bracketArm:     S * LOGO_RATIOS.bracketArmRatio,
    bracketStroke:  clamp(S * 0.046875, 0.75, 2.5), // 1.5/32 — 1.5 at S=32
    borderStroke:   clamp(S * 0.03125, 0.75, 2),    // 1/32 — 1 at S=32
    boundingWidth:  S * LOGO_RATIOS.boundingWidthRatio,
    boundingHeight: S * LOGO_RATIOS.boundingHeightRatio,
  }
}
