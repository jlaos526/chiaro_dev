// Pages through /v3/{house,senate}-vote?congress=N, then fetches per-vote
// member positions. Returns NormalizedVote[] for the orchestrator to upsert.

import type { Database } from '../../src/index.ts'

type Chamber = Database['public']['Enums']['official_chamber']
type VotePos = Database['public']['Enums']['vote_position']

export interface NormalizedVote {
  congress: string
  chamber: Chamber
  session: number
  roll_call: number
  vote_date: string
  question: string
  result: string
  bill_ref: { type: string; number: number } | null
  source_url: string
  positions: Array<{ bioguide_id: string; position: VotePos }>
}

const API_BASE = 'https://api.congress.gov/v3'

export async function fetchVotes(
  chamber: 'federal_house' | 'federal_senate',
  congress: string,
  apiKey: string,
): Promise<NormalizedVote[]> {
  // Congress.gov v3 URL token: 'house' / 'senate'. DB chamber: federal_*.
  const apiToken = chamber === 'federal_house' ? 'house' : 'senate'
  const endpoint = chamber === 'federal_house' ? 'house-vote' : 'senate-vote'
  const out: NormalizedVote[] = []
  let url: string | null = `${API_BASE}/${endpoint}?congress=${congress}&limit=250&offset=0`
  while (url) {
    const res = await fetch(url, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Congress.gov votes ${res.status}: ${await res.text()}`)
    const page = (await res.json()) as any
    const votes: any[] = page.votes ?? page[endpoint + 'Votes'] ?? []
    for (const v of votes) {
      const members = await fetchMembers(
        `${API_BASE}/${endpoint}/${congress}/${v.session}/${v.rollCallNumber}/members`,
        apiKey,
      )
      out.push({
        congress: String(v.congress),
        chamber,
        session: v.session,
        roll_call: v.rollCallNumber,
        vote_date: v.date.slice(0, 10),
        question: v.voteQuestion ?? '',
        result: v.result ?? '',
        bill_ref: v.bill ? { type: v.bill.type, number: v.bill.number } : null,
        source_url:
          v.url ??
          `https://www.congress.gov/vote/${congress}/${apiToken}/${v.session}/${v.rollCallNumber}`,
        positions: members,
      })
    }
    url = page.pagination?.next ?? null
  }
  return out
}

async function fetchMembers(url: string, apiKey: string): Promise<NormalizedVote['positions']> {
  const res = await fetch(url, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Congress.gov vote members ${res.status}: ${url}`)
  const d = (await res.json()) as any
  const items: any[] = d.members ?? d.results ?? []
  return items.map((m) => ({
    bioguide_id: m.bioguideId,
    position: normalizePosition(m.votePosition),
  }))
}

function normalizePosition(raw: string): VotePos {
  switch (raw?.toLowerCase()) {
    case 'yea':
    case 'aye':
    case 'yes':
      return 'yes'
    case 'nay':
    case 'no':
      return 'no'
    case 'present':
      return 'present'
    default:
      return 'not_voting'
  }
}
