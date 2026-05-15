import { normalizeMember, type NormalizedMember } from './normalize.ts'

const API_BASE = 'https://api.congress.gov/v3'
const PAGE_SIZE = 250

type RawPage = {
  members: unknown[]
  pagination: { next: string | null }
}

function buildUrl(chamber: 'house' | 'senate', congress: string): string {
  const chamberFilter = chamber === 'house' ? 'house' : 'senate'
  return `${API_BASE}/member?congress=${congress}&currentMember=true&chamber=${chamberFilter}&limit=${PAGE_SIZE}&offset=0`
}

async function fetchPage(url: string, apiKey: string): Promise<RawPage> {
  const res = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Congress.gov ${res.status}: ${await res.text()}`)
  }
  return await res.json() as RawPage
}

export async function fetchMembers(
  chamber: 'house' | 'senate',
  congress: string,
  apiKey: string,
): Promise<NormalizedMember[]> {
  const out: NormalizedMember[] = []
  let url: string | null = buildUrl(chamber, congress)

  while (url) {
    const page: RawPage = await fetchPage(url, apiKey)
    for (const raw of page.members) {
      out.push(normalizeMember(raw))
    }
    url = page.pagination.next
  }

  return out
}
