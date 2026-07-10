import type { ChiaroClient } from '@chiaro/supabase-client'
import type { BillRow, VoteRow, VotePositionEnum } from './types.ts'

export async function fetchOfficialSponsoredBills(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<BillRow[]> {
  const { data: ids, error: idsErr } = await client.from('bill_sponsors')
    .select('bill_id').eq('official_id', officialId).eq('role', 'sponsor')
  if (idsErr) throw idsErr
  const billIds = (ids ?? []).map((r: { bill_id: string }) => r.bill_id)
  if (billIds.length === 0) return []
  const { data, error } = await client.from('bills')
    .select('*').in('id', billIds).eq('congress', congress)
    .order('introduced_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as BillRow[]
}

export async function fetchOfficialCosponsoredBills(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<BillRow[]> {
  const { data: ids, error: idsErr } = await client.from('bill_sponsors')
    .select('bill_id').eq('official_id', officialId).eq('role', 'cosponsor')
  if (idsErr) throw idsErr
  const billIds = (ids ?? []).map((r: { bill_id: string }) => r.bill_id)
  if (billIds.length === 0) return []
  const { data, error } = await client.from('bills')
    .select('*').in('id', billIds).eq('congress', congress)
    .order('introduced_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as BillRow[]
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
  const { data, error } = await client.from('vote_positions')
    .select('vote_id, position, vote:votes!inner(id, congress, chamber, session, roll_call, vote_date, question, result, bill_id, source_url, ingested_at)')
    .eq('official_id', officialId)
    .eq('position', 'not_voting')
    .eq('vote.congress', congress)
  if (error) throw error
  return ((data ?? []) as unknown as Array<{ vote_id: string; position: VotePositionEnum; vote: VoteRow }>).map((r) => ({
    vote_id: r.vote_id, position: r.position, vote: r.vote,
  }))
}
