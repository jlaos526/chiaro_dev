import type { Database } from '@chiaro/db'

export type OfficialRow = Database['public']['Tables']['officials']['Row']

export type StateFinanceSummaryRow =
  Database['public']['Tables']['state_finance_summaries']['Row']

export type StateFinanceIndividualDonorRow =
  Database['public']['Tables']['state_finance_individual_donors']['Row']

export type StateCommitteeMembershipRow =
  Database['public']['Tables']['state_committee_memberships']['Row']

export type StateScorecardOrgRow =
  Database['public']['Tables']['state_scorecard_orgs']['Row']

export type StateScorecardRatingRow =
  Database['public']['Tables']['state_scorecard_ratings']['Row']

export interface StateScorecardRatingWithOrg extends StateScorecardRatingRow {
  org: StateScorecardOrgRow
}

export type StateTownHallRow =
  Database['public']['Tables']['state_town_halls']['Row']

export type StateDistrictOfficeRow =
  Database['public']['Tables']['state_district_offices']['Row']

export type StateCommitteeHearingRow =
  Database['public']['Tables']['state_committee_hearings']['Row']

export type StateFinancialDisclosureRow =
  Database['public']['Tables']['state_financial_disclosures']['Row']

export type StateEthicsComplaintRow =
  Database['public']['Tables']['state_ethics_complaints']['Row']

export type StateOfficialEventRow =
  Database['public']['Tables']['state_official_events']['Row']

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
