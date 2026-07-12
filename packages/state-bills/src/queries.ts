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
    .in(
      'id',
      bsRows.map((r) => r.bill_id),
    )
    .order('latest_action_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) =>
    normalizeBill(row as StateBillJoinRow),
  ) as StateBillWithSponsors[]
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
    .in(
      'id',
      bsRows.map((r) => r.bill_id),
    )
    .order('latest_action_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) =>
    normalizeBill(row as StateBillJoinRow),
  ) as StateBillWithSponsors[]
}

/**
 * Slice 75 (audit C11/C20): cap on the most-recent votes a detail page pulls.
 * A productive CA/NY legislator casts hundreds-to-1000+ positions per session;
 * the old shape transferred ALL of them (PostgREST max-rows permitting) and
 * sorted client-side. Sized well above the evidence panel's show-more depth.
 */
const STATE_VOTES_LIMIT = 200

type StateVoteAnchoredRow = StateVoteWithBill & {
  positions: Array<{ position: StateVotePositionRow['position'] }>
}

function toVoteWithPosition(row: StateVoteAnchoredRow): StateVoteWithPosition {
  const { positions, ...vote } = row
  return {
    vote: vote as StateVoteWithBill,
    position: positions[0]!.position,
  } as StateVoteWithPosition
}

export async function fetchOfficialStateVotes(
  client: ChiaroClient,
  officialId: string,
): Promise<StateVoteWithPosition[]> {
  // Anchored on state_votes so ORDER BY runs server-side on the parent's own
  // vote_date — which makes the .limit take the most-recent N instead of an
  // arbitrary subset. `positions:state_vote_positions!inner` constrains to
  // votes this official has a position on; (vote_id, official_id) uniqueness
  // makes it a 1-element array.
  const { data, error } = await client
    .from('state_votes')
    .select(`
      *,
      bill:state_bills!state_votes_bill_id_fkey(id, state, session, bill_type, number, title),
      positions:state_vote_positions!inner(position)
    `)
    .eq('positions.official_id', officialId)
    .order('vote_date', { ascending: false, nullsFirst: false })
    .limit(STATE_VOTES_LIMIT)
  if (error) throw error
  return ((data ?? []) as unknown as StateVoteAnchoredRow[]).map(toVoteWithPosition)
}

export async function fetchOfficialMissedStateVotes(
  client: ChiaroClient,
  officialId: string,
): Promise<StateVoteWithPosition[]> {
  // Slice 75: was fetch-everything-then-filter in JS; the position filter now
  // rides the same anchored single request.
  const { data, error } = await client
    .from('state_votes')
    .select(`
      *,
      bill:state_bills!state_votes_bill_id_fkey(id, state, session, bill_type, number, title),
      positions:state_vote_positions!inner(position)
    `)
    .eq('positions.official_id', officialId)
    .in('positions.position', ['not_voting', 'abstain'])
    .order('vote_date', { ascending: false, nullsFirst: false })
    .limit(STATE_VOTES_LIMIT)
  if (error) throw error
  return ((data ?? []) as unknown as StateVoteAnchoredRow[]).map(toVoteWithPosition)
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

  // Slice 75 (audit C19): was a 3-step waterfall whose intermediate bill/vote
  // UUID sets crossed the wire and were re-sent in GET query strings — a
  // popular subject across 5 states produces thousands of ids (URL-length
  // failure). One request: the nested `!inner` chain constrains parent votes
  // to bills tagged with a candidate subject, server-side. Filters on the
  // bill's subjects use the nested alias path; the bill embed carries a
  // second, unfiltered `subjects` alias purely for row data. Proven against
  // real PostgREST in queries.integration.test.ts. Migration 0064 adds the
  // subject-leading index the old step-1 seq-scanned without.
  const { data, error } = await client
    .from('state_votes')
    .select(`
      *,
      bill:state_bills!state_votes_bill_id_fkey!inner(
        id, state, session, bill_type, number, title,
        matched:state_bill_subjects!inner(subject)
      ),
      positions:state_vote_positions!inner(position)
    `)
    .eq('positions.official_id', officialId)
    .in('bill.matched.subject', subjects)
    .order('vote_date', { ascending: false, nullsFirst: false })
    .limit(STATE_VOTES_LIMIT)
  if (error) throw error
  return ((data ?? []) as unknown as StateVoteAnchoredRow[]).map(toVoteWithPosition)
}

// Internal helper: normalize the joined Supabase result into StateBillWithSponsors shape.
function normalizeBill(row: StateBillJoinRow): StateBillWithSponsors {
  return {
    ...row,
    sponsors: row.sponsors as StateBillWithSponsors['sponsors'],
    subjects: (row.subjects ?? []).map((s) => s.subject),
  }
}
