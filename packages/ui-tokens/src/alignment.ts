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

export function scoreToTier(score: number, scoringMax: number): AlignmentTier {
  const pct = (score / scoringMax) * 100
  if (pct >= 90) return 'strongly-aligned'
  if (pct >= 70) return 'mostly-aligned'
  if (pct >= 40) return 'mixed'
  if (pct >= 10) return 'mostly-differs'
  return 'strongly-differs'
}
