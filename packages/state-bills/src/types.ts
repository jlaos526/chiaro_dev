import type { Database } from '@chiaro/db'

export type StateBillRow = Database['public']['Tables']['state_bills']['Row']
export type StateBillSponsorRow = Database['public']['Tables']['state_bill_sponsors']['Row']
export type StateBillSubjectRow = Database['public']['Tables']['state_bill_subjects']['Row']
export type StateVoteRow = Database['public']['Tables']['state_votes']['Row']
export type StateVotePositionRow = Database['public']['Tables']['state_vote_positions']['Row']

// Joined view types used by the query layer.
export interface StateBillWithSponsors extends StateBillRow {
  sponsors: StateBillSponsorRow[]
  subjects: string[]
}

export interface StateVoteWithBill extends StateVoteRow {
  bill: Pick<StateBillRow, 'id' | 'state' | 'session' | 'bill_type' | 'number' | 'title'>
}

export interface StateVoteWithPosition {
  vote: StateVoteWithBill
  position: StateVotePositionRow['position']
}
