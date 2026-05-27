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

export const ALIGNMENT_CHIP_COLORS: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#c5e3c7', fg: '#1f4d24' },
  'mostly-aligned':   { bg: '#d4ecd5', fg: '#2a6b30' },
  'mixed':            { bg: '#f0eee5', fg: '#5a5751' },
  'mostly-differs':   { bg: '#f4d3c0', fg: '#7a3e1c' },
  'strongly-differs': { bg: '#f0b8a0', fg: '#5a2812' },
}

// Slice 37: dark-mode chip palette. Inverts the lightness relationship —
// `bg` becomes a deep tier-tinted surface; `fg` becomes the bright text
// readable against it. Same 5 keys for parity with the light variant.
export const ALIGNMENT_CHIP_COLORS_DARK: Record<AlignmentTier, { bg: string; fg: string }> = {
  'strongly-aligned': { bg: '#1f3a25', fg: '#a8d8ad' },
  'mostly-aligned':   { bg: '#26482e', fg: '#b8e0bd' },
  'mixed':            { bg: '#3a3830', fg: '#d4d0c5' },
  'mostly-differs':   { bg: '#4a2e1c', fg: '#f0c2a5' },
  'strongly-differs': { bg: '#5a2a18', fg: '#f5b095' },
}

export function scoreToTier(score: number, scoringMax: number): AlignmentTier {
  const pct = (score / scoringMax) * 100
  if (pct >= 90) return 'strongly-aligned'
  if (pct >= 70) return 'mostly-aligned'
  if (pct >= 40) return 'mixed'
  if (pct >= 10) return 'mostly-differs'
  return 'strongly-differs'
}
