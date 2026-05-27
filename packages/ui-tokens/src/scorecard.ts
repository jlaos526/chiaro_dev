// Color per scorecard lean (set during Task 20 when scorecard_orgs is seeded).
export type ScorecardLean = 'progressive' | 'conservative' | 'libertarian' | 'single-issue' | 'centrist'

export const SCORECARD_LEAN_COLOR: Record<ScorecardLean, string> = {
  progressive:    '#3b6ed1',
  conservative:   '#d13b3b',
  libertarian:    '#f7c63d',
  'single-issue': '#7d57c1',
  centrist:       '#807a72',
}

// Slice 37: dark-mode palette parallel to SCORECARD_LEAN_COLOR. Lightness
// shifted +20-25% so each lean reads as a recognizable hue on dark surfaces.
export const SCORECARD_LEAN_COLOR_DARK: Record<ScorecardLean, string> = {
  progressive:    '#7ba0e8',
  conservative:   '#e87878',
  libertarian:    '#fbdd7f',
  'single-issue': '#b399df',
  centrist:       '#a8a098',
}

export const SCORECARD_LEAN_LABEL: Record<ScorecardLean, string> = {
  progressive:    'Progressive',
  conservative:   'Conservative',
  libertarian:    'Libertarian',
  'single-issue': 'Single-issue',
  centrist:       'Centrist',
}
