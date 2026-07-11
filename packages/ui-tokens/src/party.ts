// Party palette + display labels. Used by PartyBadge in both web and mobile.
// Values match the party check constraint in 0009_officials.sql.

export type PartyCode = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID' | 'unknown'

export const PARTY_COLOR: Record<PartyCode, string> = {
  D: '#3b6ed1',
  R: '#d13b3b',
  I: '#7d57c1',
  L: '#f7c63d',
  G: '#3da75b',
  ID: '#7d57c1',
  unknown: '#807a72',
}

// Slice 37: dark-mode palette parallel to PARTY_COLOR. HSL lightness shifted
// +20-25% so saturated brand hues remain legible on a dark surface. Muted
// "unknown" stays warm-gray-neutral but slightly darker (already top of
// lightness ramp; further lightening would push into mid-gray territory).
export const PARTY_COLOR_DARK: Record<PartyCode, string> = {
  D: '#7ba0e8',
  R: '#e87878',
  I: '#b399df',
  L: '#fbdd7f',
  G: '#7fc89a',
  ID: '#b399df',
  unknown: '#7a7268',
}

export const PARTY_LABEL: Record<PartyCode, string> = {
  D: 'Democratic',
  R: 'Republican',
  I: 'Independent',
  L: 'Libertarian',
  G: 'Green',
  ID: 'Independent',
  unknown: 'Unknown',
}

export const PARTY_SHORT: Record<PartyCode, string> = {
  D: 'D',
  R: 'R',
  I: 'I',
  L: 'L',
  G: 'G',
  ID: 'I',
  unknown: '?',
}
