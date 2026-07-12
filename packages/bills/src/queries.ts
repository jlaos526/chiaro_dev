import type { ChiaroClient } from '@chiaro/supabase-client'
import type { BillRow, VoteRow, VotePositionEnum } from './types.ts'

/**
 * Slice 79 (audit C18): one request anchored on bills — the filtered `!inner`
 * sponsors embed constrains parent rows server-side, replacing the 2-step
 * id-list waterfall whose bill_id set re-crossed the wire in a GET `.in()`
 * (latent URL-length failure for prolific sponsors). Server-side ORDER BY on
 * the parent's own introduced_date is preserved. The embed itself is stripped
 * before return so the BillRow[] shape is unchanged.
 */
async function fetchOfficialBillsByRole(
  client: ChiaroClient,
  officialId: string,
  congress: string,
  role: 'sponsor' | 'cosponsor',
): Promise<BillRow[]> {
  const { data, error } = await client
    .from('bills')
    .select('*, sponsors:bill_sponsors!inner(role)')
    .eq('sponsors.official_id', officialId)
    .eq('sponsors.role', role)
    .eq('congress', congress)
    .order('introduced_date', { ascending: false })
    .returns<Array<BillRow & { sponsors: unknown }>>()
  if (error) throw error
  return (data ?? []).map(({ sponsors: _sponsors, ...bill }) => bill as BillRow)
}

export async function fetchOfficialSponsoredBills(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<BillRow[]> {
  return fetchOfficialBillsByRole(client, officialId, congress, 'sponsor')
}

export async function fetchOfficialCosponsoredBills(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<BillRow[]> {
  return fetchOfficialBillsByRole(client, officialId, congress, 'cosponsor')
}

/**
 * Slice 75 (audit C12): head-only count queries for the collapsed-by-default
 * subsection labels. The full-row fetchers above download every row just to
 * print "N sponsored" — these transfer zero rows. The `bills!inner` /
 * `votes!inner` embeds apply the same congress filter as the list fetchers so
 * label counts always match what expanding reveals.
 */
export async function fetchOfficialSponsoredBillsCount(
  client: ChiaroClient,
  officialId: string,
  congress: string,
  role: 'sponsor' | 'cosponsor' = 'sponsor',
): Promise<number> {
  const { count, error } = await client
    .from('bill_sponsors')
    .select('bill:bills!inner(id)', { count: 'exact', head: true })
    .eq('official_id', officialId)
    .eq('role', role)
    .eq('bill.congress', congress)
  if (error) throw error
  return count ?? 0
}

export async function fetchOfficialCosponsoredBillsCount(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<number> {
  return fetchOfficialSponsoredBillsCount(client, officialId, congress, 'cosponsor')
}

export async function fetchOfficialMissedVotesCount(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<number> {
  const { count, error } = await client
    .from('vote_positions')
    .select('vote:votes!inner(id)', { count: 'exact', head: true })
    .eq('official_id', officialId)
    .eq('position', 'not_voting')
    .eq('vote.congress', congress)
  if (error) throw error
  return count ?? 0
}

export async function fetchOfficialMissedVotes(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<Array<{ vote_id: string; position: VotePositionEnum; vote: VoteRow }>> {
  // Slice 67 (audit C17): one request anchored on the indexed
  // `vote_positions.official_id` (vote_positions_official_idx, 0016). The
  // `votes!inner` embed + `.eq('vote.congress', congress)` constrains the parent
  // rows server-side, so only this official's not_voting votes for the congress
  // cross the wire — was a 2-step download of EVERY vote of the congress + a
  // ~2000-UUID `.in()` GET (latent URL-length failure).
  const { data, error } = await client
    .from('vote_positions')
    .select(
      'vote_id, position, vote:votes!inner(id, congress, chamber, session, roll_call, vote_date, question, result, bill_id, source_url, ingested_at)',
    )
    .eq('official_id', officialId)
    .eq('position', 'not_voting')
    .eq('vote.congress', congress)
  if (error) throw error
  return (
    (data ?? []) as unknown as Array<{ vote_id: string; position: VotePositionEnum; vote: VoteRow }>
  ).map((r) => ({
    vote_id: r.vote_id,
    position: r.position,
    vote: r.vote,
  }))
}
