export type AlignmentTier =
  | 'strongly-aligned'
  | 'mostly-aligned'
  | 'mixed'
  | 'mostly-differs'
  | 'strongly-differs'

export const ALIGNMENT_LABEL: Record<AlignmentTier, string> = {
  'strongly-aligned': 'Strongly Aligned',
  'mostly-aligned':   'Mostly Aligned',
  'mixed':            'Mixed',
  'mostly-differs':   'Mostly Differs',
  'strongly-differs': 'Strongly Differs',
}

// Slice 42 thermal palette: cool emerald (aligned) → gold (Mixed pivot) →
// warm terracotta (differs). V2 deeper saturation on the 2 Strongly tiers
// as polar emphasis — color does the work, no font-weight differentiation.
// Mixed bg #eedbb5 borrows the slice 41 Service Record gold family,
// solving the slice 37 "Mixed blends into cream page bg" problem.
export const ALIGNMENT_CHIP_COLORS: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#a8d4b0', fg: '#0f3a1c' },  // V2 deeper emerald
  'mostly-aligned':   { bg: '#d8ecda', fg: '#2a6b30' },
  'mixed':            { bg: '#eedbb5', fg: '#7c5a1e' },  // gold pivot (Service Record family)
  'mostly-differs':   { bg: '#f0d3c0', fg: '#6a3e1c' },
  'strongly-differs': { bg: '#dca088', fg: '#4a1e0c' },  // V2 deeper terracotta
}

// Slice 42: dark-mode chip palette. Same cool-to-warm thermal structure as
// light, re-toned for cool-slate page bg (#16181c, slice 40). Mixed bg
// #23211a matches CATEGORY_CARD_BG_SOLID_DARK['service-record'] byte-for-byte —
// shared gold-tinted-slate identity with the slice 41 Service Record card.
export const ALIGNMENT_CHIP_COLORS_DARK: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#143020', fg: '#a8e0b0' },  // V2 deeper emerald slate
  'mostly-aligned':   { bg: '#24462d', fg: '#a8c9af' },
  'mixed':            { bg: '#23211a', fg: '#e1c896' },  // gold-tinted cool slate
  'mostly-differs':   { bg: '#3e2820', fg: '#e0a890' },
  'strongly-differs': { bg: '#5e2418', fg: '#f5a888' },  // V2 deeper terracotta slate
}

export function scoreToTier(score: number, scoringMax: number): AlignmentTier {
  const pct = (score / scoringMax) * 100
  if (pct >= 90) return 'strongly-aligned'
  if (pct >= 70) return 'mostly-aligned'
  if (pct >= 40) return 'mixed'
  if (pct >= 10) return 'mostly-differs'
  return 'strongly-differs'
}
