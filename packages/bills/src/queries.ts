import type { ChiaroClient } from '@chiaro/supabase-client'
import type { BillRow, BillStatus, VoteRow, BillWithSubjectsAndSponsors, VoteWithBillAndPositions, VotePositionEnum } from './types.ts'

export interface BillsFilter {
  congress?: string
  subject?: string
  sponsorId?: string
  status?: BillStatus
}

export async function fetchBills(
  client: ChiaroClient,
  filter: BillsFilter,
): Promise<BillRow[]> {
  let q = client.from('bills').select('*').order('introduced_date', { ascending: false }).limit(200)
  if (filter.congress) q = q.eq('congress', filter.congress)
  if (filter.status)   q = q.eq('status', filter.status)

  if (filter.subject) {
    const { data: ids } = await client.from('bill_subjects')
      .select('bill_id')
      .eq('subject', filter.subject)
    const billIds = (ids ?? []).map((r: { bill_id: string }) => r.bill_id)
    if (billIds.length === 0) return []
    q = q.in('id', billIds)
  }

  if (filter.sponsorId) {
    const { data: ids } = await client.from('bill_sponsors')
      .select('bill_id')
      .eq('official_id', filter.sponsorId)
    const billIds = (ids ?? []).map((r: { bill_id: string }) => r.bill_id)
    if (billIds.length === 0) return []
    q = q.in('id', billIds)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BillRow[]
}

export async function fetchBill(
  client: ChiaroClient,
  id: string,
): Promise<BillWithSubjectsAndSponsors> {
  const { data: bill, error } = await client.from('bills').select('*').eq('id', id).single()
  if (error) throw error
  const { data: subjs } = await client.from('bill_subjects').select('subject').eq('bill_id', id)
  const { data: sps  } = await client.from('bill_sponsors')
    .select('official_id, role, added_date').eq('bill_id', id)
  return {
    ...(bill as BillRow),
    subjects: (subjs ?? []).map((r: { subject: string }) => r.subject),
    sponsors: (sps ?? []) as BillWithSubjectsAndSponsors['sponsors'],
  }
}

export async function fetchBillVotes(
  client: ChiaroClient,
  billId: string,
): Promise<VoteWithBillAndPositions[]> {
  const { data: votes, error } = await client.from('votes')
    .select('*').eq('bill_id', billId).order('vote_date', { ascending: false })
  if (error) throw error
  const voteList = (votes ?? []) as VoteRow[]
  if (voteList.length === 0) return []
  const { data: positions } = await client.from('vote_positions')
    .select('vote_id, official_id, position').in('vote_id', voteList.map(v => v.id))
  const byVote = new Map<string, Array<{ official_id: string; position: VotePositionEnum }>>()
  for (const p of (positions ?? []) as Array<{ vote_id: string; official_id: string; position: VotePositionEnum }>) {
    if (!byVote.has(p.vote_id)) byVote.set(p.vote_id, [])
    byVote.get(p.vote_id)!.push({ official_id: p.official_id, position: p.position })
  }
  return voteList.map(v => ({ ...v, bill: null, positions: byVote.get(v.id) ?? [] }))
}

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

export async function fetchOfficialVotesOnSubject(
  client: ChiaroClient,
  officialId: string,
  subject: string,
): Promise<Array<{ vote_id: string; bill_id: string; position: VotePositionEnum; bill: BillRow }>> {
  const { data: bills } = await client.from('bill_subjects').select('bill_id').eq('subject', subject)
  const billIds = (bills ?? []).map((r: { bill_id: string }) => r.bill_id)
  if (billIds.length === 0) return []
  const { data: votes } = await client.from('votes').select('*').in('bill_id', billIds)
  const voteList = (votes ?? []) as VoteRow[]
  if (voteList.length === 0) return []
  const { data: positions } = await client.from('vote_positions')
    .select('vote_id, position').eq('official_id', officialId).in('vote_id', voteList.map(v => v.id))
  const billMap = new Map<string, BillRow>()
  const { data: billRows } = await client.from('bills').select('*').in('id', billIds)
  for (const b of (billRows ?? []) as BillRow[]) billMap.set(b.id, b)
  return (positions ?? []).map((p: { vote_id: string; position: VotePositionEnum }) => {
    const vote = voteList.find(v => v.id === p.vote_id)!
    return { vote_id: p.vote_id, bill_id: vote.bill_id!, position: p.position, bill: billMap.get(vote.bill_id!)! }
  })
}
