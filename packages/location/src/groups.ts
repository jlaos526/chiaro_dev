import type { DistrictTier } from './types.ts'

export const TIER_LABEL: Record<DistrictTier, string> = {
  federal_house: 'U.S. House',
  federal_senate: 'U.S. Senate',
  state_senate: 'State Senate',
  state_house: 'State House',
  county: 'County',
  place: 'City',
}

export type DistrictGroup = { heading: string; tiers: DistrictTier[] }

// Federal is Senate-before-House so the two senators sort above the
// representative; in-tier sort is by code so S1/S2 stay stable.
export const DISTRICT_GROUPS: DistrictGroup[] = [
  { heading: 'Federal', tiers: ['federal_senate', 'federal_house'] },
  { heading: 'State', tiers: ['state_senate', 'state_house'] },
  { heading: 'Local', tiers: ['county', 'place'] },
]
