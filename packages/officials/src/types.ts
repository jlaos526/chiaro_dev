import type { Database } from '@chiaro/db'

export type OfficialRow = Database['public']['Tables']['officials']['Row']

// Source of truth — mirrors the public.official_chamber enum (migration 0028)
// expanded to 5 values for state-level legislators.
export type OfficialChamber = Database['public']['Enums']['official_chamber']

// Legacy alias retained for backwards compatibility within this package.
export type Chamber = OfficialChamber

export type Party = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'

export interface OfficialWithDistrict extends OfficialRow {
  district: {
    id: string
    tier: Database['public']['Tables']['districts']['Row']['tier']
    state: string
    code: string
    name: string
  }
}

export function isStateLevel(chamber: OfficialChamber): boolean {
  return chamber === 'state_house'
      || chamber === 'state_senate'
      || chamber === 'state_legislature'
}

export function isFederalLevel(chamber: OfficialChamber): boolean {
  return chamber === 'federal_house' || chamber === 'federal_senate'
}

export function levelOf(chamber: OfficialChamber): 'federal' | 'state' {
  return isStateLevel(chamber) ? 'state' : 'federal'
}

// Senate-shape chambers — federal senate, state senate, AND Nebraska's
// state_legislature (unicameral, but functionally senate-equivalent in UI).
export function isSenateChamber(chamber: OfficialChamber): boolean {
  return chamber === 'federal_senate'
      || chamber === 'state_senate'
      || chamber === 'state_legislature'
}

// House-shape chambers — federal house + state house only.
export function isHouseChamber(chamber: OfficialChamber): boolean {
  return chamber === 'federal_house' || chamber === 'state_house'
}
