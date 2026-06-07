import type { ChiaroClient } from '@chiaro/supabase-client'
import type { BillRow, VoteRow, VotePositionEnum } from './types.ts'

export async function fetchOfficialSponsoredBills(
  client: ChiaroClient,
  officialId: string,
  congress: string,
): Promise<BillRow[]> {
  const { data: ids } = await client.from('bill_sponsors')
    .select('bill_id').eq('official_id', officialId).eq('role', 'sponsor')
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
  const { data: ids } = await client.from('bill_sponsors')
    .select('bill_id').eq('official_id', officialId).eq('role', 'cosponsor')
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
  const { data: votes } = await client.from('votes').select('id, congress, chamber, session, roll_call, vote_date, question, result, bill_id, source_url, ingested_at').eq('congress', congress)
  const voteIds = (votes ?? []).map((v: VoteRow) => v.id)
  if (voteIds.length === 0) return []
  const { data: positions, error } = await client.from('vote_positions')
    .select('vote_id, position')
    .eq('official_id', officialId)
    .eq('position', 'not_voting')
    .in('vote_id', voteIds)
  if (error) throw error
  const voteMap = new Map<string, VoteRow>((votes as VoteRow[]).map(v => [v.id, v]))
  return (positions ?? []).map((p: { vote_id: string; position: VotePositionEnum }) => ({
    vote_id: p.vote_id, position: p.position, vote: voteMap.get(p.vote_id)!,
  }))
}
