// Party palette + display labels. Used by PartyBadge in both web and mobile.
// Values match the party check constraint in 0009_officials.sql.

export type PartyCode = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'

export const PARTY_COLOR: Record<PartyCode, string> = {
  D:  '#3b6ed1',
  R:  '#d13b3b',
  I:  '#7d57c1',
  L:  '#f7c63d',
  G:  '#3da75b',
  ID: '#7d57c1',
}

export const PARTY_LABEL: Record<PartyCode, string> = {
  D:  'Democratic',
  R:  'Republican',
  I:  'Independent',
  L:  'Libertarian',
  G:  'Green',
  ID: 'Independent',
}

export const PARTY_SHORT: Record<PartyCode, string> = {
  D: 'D', R: 'R', I: 'I', L: 'L', G: 'G', ID: 'I',
}
