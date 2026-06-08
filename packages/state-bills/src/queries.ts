import type { ChiaroClient } from '@chiaro/supabase-client'
import type {
  StateBillRow,
  StateBillWithSponsors,
  StateVoteWithBill,
  StateVoteWithPosition,
  StateVotePositionRow,
} from './types.ts'

const SELECT_BILL_WITH_SPONSORS = `
  *,
  sponsors:state_bill_sponsors(*),
  subjects:state_bill_subjects(subject)
`

type StateBillJoinRow = StateBillRow & {
  sponsors: unknown[]
  subjects: { subject: string }[]
}

export async function fetchOfficialSponsoredStateBills(
  client: ChiaroClient,
  officialId: string,
): Promise<StateBillWithSponsors[]> {
  // Two-step: find sponsor bill_ids, then fetch bills with joined sponsors+subjects.
  const { data: bsRows, error: bsErr } = await client
    .from('state_bill_sponsors')
    .select('bill_id')
    .eq('official_id', officialId)
    .eq('role', 'sponsor')
  if (bsErr) throw bsErr
  if (!bsRows || bsRows.length === 0) return []

  const { data, error } = await client
    .from('state_bills')
    .select(SELECT_BILL_WITH_SPONSORS)
    .in('id', bsRows.map(r => r.bill_id))
    .order('latest_action_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => normalizeBill(row as StateBillJoinRow)) as StateBillWithSponsors[]
}

export async function fetchOfficialCosponsoredStateBills(
  client: ChiaroClient,
  officialId: string,
): Promise<StateBillWithSponsors[]> {
  const { data: bsRows, error: bsErr } = await client
    .from('state_bill_sponsors')
    .select('bill_id')
    .eq('official_id', officialId)
    .eq('role', 'cosponsor')
  if (bsErr) throw bsErr
  if (!bsRows || bsRows.length === 0) return []

  const { data, error } = await client
    .from('state_bills')
    .select(SELECT_BILL_WITH_SPONSORS)
    .in('id', bsRows.map(r => r.bill_id))
    .order('latest_action_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => normalizeBill(row as StateBillJoinRow)) as StateBillWithSponsors[]
}

export async function fetchOfficialStateVotes(
  client: ChiaroClient,
  officialId: string,
): Promise<StateVoteWithPosition[]> {
  const { data, error } = await client
    .from('state_vote_positions')
    .select(`
      position,
      vote:state_votes!state_vote_positions_vote_id_fkey(
        *,
        bill:state_bills!state_votes_bill_id_fkey(id, state, session, bill_type, number, title)
      )
    `)
    .eq('official_id', officialId)
  if (error) throw error
  // Sort client-side by vote_date desc (Supabase can't order via joined column reliably).
  const rows = (data ?? []).map(row => ({
    vote: (row as { vote: StateVoteWithBill }).vote,
    position: (row as { position: StateVotePositionRow['position'] }).position,
  }))
  rows.sort((a, b) => (b.vote.vote_date ?? '').localeCompare(a.vote.vote_date ?? ''))
  return rows as StateVoteWithPosition[]
}

export async function fetchOfficialMissedStateVotes(
  client: ChiaroClient,
  officialId: string,
): Promise<StateVoteWithPosition[]> {
  const all = await fetchOfficialStateVotes(client, officialId)
  return all.filter(v => v.position === 'not_voting' || v.position === 'abstain')
}

/**
 * Returns the legislator's votes on state bills tagged with any of the
 * provided subject candidates (state_bill_subjects.subject). Empty when
 * subjects array is empty (caller should pass `enabled: false` in the
 * hook to avoid the query altogether).
 */
export async function fetchOfficialStateVotesOnSubject(
  client: ChiaroClient,
  officialId: string,
  subjects: string[],
): Promise<StateVoteWithPosition[]> {
  if (subjects.length === 0) return []

  // Step 1: find bill ids matching any candidate subject.
  const billRows = await client
    .from('state_bill_subjects')
    .select('bill_id')
    .in('subject', subjects)
  if (billRows.error) throw billRows.error
  const billIds = Array.from(new Set((billRows.data ?? []).map(r => r.bill_id)))
  if (billIds.length === 0) return []

  // Step 2: find vote ids on those bills.
  const voteRows = await client
    .from('state_votes')
    .select('id')
    .in('bill_id', billIds)
  if (voteRows.error) throw voteRows.error
  const voteIds = (voteRows.data ?? []).map(r => r.id)
  if (voteIds.length === 0) return []

  // Step 3: find vote positions for this official on those votes.
  const { data, error } = await client
    .from('state_vote_positions')
    .select(`
      position,
      vote:state_votes!state_vote_positions_vote_id_fkey(
        *,
        bill:state_bills!state_votes_bill_id_fkey(id, state, session, bill_type, number, title)
      )
    `)
    .eq('official_id', officialId)
    .in('vote_id', voteIds)
  if (error) throw error
  const rows = (data ?? []).map(row => ({
    vote: (row as { vote: StateVoteWithBill }).vote,
    position: (row as { position: StateVotePositionRow['position'] }).position,
  }))
  rows.sort((a, b) => (b.vote.vote_date ?? '').localeCompare(a.vote.vote_date ?? ''))
  return rows as StateVoteWithPosition[]
}

// Internal helper: normalize the joined Supabase result into StateBillWithSponsors shape.
function normalizeBill(row: StateBillJoinRow): StateBillWithSponsors {
  return {
    ...row,
    sponsors: row.sponsors as StateBillWithSponsors['sponsors'],
    subjects: (row.subjects ?? []).map(s => s.subject),
  }
}
