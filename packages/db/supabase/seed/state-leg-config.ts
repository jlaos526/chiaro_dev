// Per-state OpenStates district-code normalization rules.
// Mirrors tiger-config.ts shape but for state_house + state_senate tiers.
//
// OpenStates returns `current_role.district` as raw strings. TIGER 2024 has
// state legislature districts keyed by simpler codes (e.g. CA-15, CA-08).
// This module bridges the two.
//
// Known limitation: NH uses multi-word district codes ("Rockingham 5",
// "Hillsborough 23") that don't fit any short scheme. We return null and
// the ingest orchestrator logs + skips those legislators.

export type OpenStatesOrgClassification = 'upper' | 'lower' | 'legislature'

export const STATES_WITH_UNICAMERAL = new Set(['NE'] as const)

// 50 US states. We only ingest the 50 states; DC and territories return null.
const SUPPORTED_STATES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
])

// States that use letter suffixes for multi-member districts. Strip suffix.
const STATES_MULTIMEMBER_LETTER_SUFFIX = new Set(['MD'])

// States where OpenStates emits multi-word district names we can't normalize.
const STATES_KNOWN_UNNORMALIZABLE = new Set(['NH'])

// States where the district code is itself a letter (no number).
const STATES_LETTER_ONLY_DISTRICTS = new Set(['AK'])

export function isStateChamberSupported(
  state: string,
  chamber: OpenStatesOrgClassification,
): boolean {
  if (!SUPPORTED_STATES.has(state)) return false
  if (chamber === 'legislature') return STATES_WITH_UNICAMERAL.has(state as 'NE')
  if (STATES_WITH_UNICAMERAL.has(state as 'NE')) return false
  return chamber === 'upper' || chamber === 'lower'
}

function chamberPrefix(chamber: OpenStatesOrgClassification): 'SS' | 'SH' {
  // 'upper' + 'legislature' (NE unicameral) → SS; 'lower' → SH
  // Mirrors state-officials-ingest.ts:94-97 tier mapping.
  return chamber === 'lower' ? 'SH' : 'SS'
}

export function normalizeStateLegDistrictCode(
  state: string,
  chamber: OpenStatesOrgClassification,
  rawDistrict: string,
): string | null {
  if (!isStateChamberSupported(state, chamber)) return null
  const prefix = chamberPrefix(chamber)

  if (rawDistrict.toLowerCase() === 'at-large') return `${state}-${prefix}-AL`

  if (STATES_KNOWN_UNNORMALIZABLE.has(state)) return null

  if (STATES_MULTIMEMBER_LETTER_SUFFIX.has(state)) {
    const numericPart = rawDistrict.match(/^\d+/)?.[0]
    if (!numericPart) return null
    return `${state}-${prefix}-${numericPart.replace(/^0+/, '') || '0'}`
  }

  if (STATES_LETTER_ONLY_DISTRICTS.has(state)) {
    if (!/^[A-Z]+$/.test(rawDistrict)) return null
    return `${state}-${prefix}-${rawDistrict}`
  }

  if (!/^\d+$/.test(rawDistrict)) return null
  return `${state}-${prefix}-${rawDistrict.replace(/^0+/, '') || '0'}`
}
