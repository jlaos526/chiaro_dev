import type { NormalizedMember, Chamber, Party } from './normalize.ts'

const API_BASE = 'https://api.congress.gov/v3'
const PAGE_SIZE = 250
const DETAIL_CONCURRENCY = 5 // parallel detail fetches per batch

type ListItem = {
  bioguideId: string
  url: string // detail endpoint
}

type ListPage = {
  members: ListItem[]
  pagination: { next: string | null }
}

interface DetailTerm {
  chamber?: string
  congress?: number
  endYear?: number | null
  startYear?: number
  stateCode?: string
  stateName?: string
  memberType?: string
}

interface DetailPartyHistory {
  partyAbbreviation?: string
  partyName?: string
  startYear?: number
}

interface DetailMember {
  bioguideId: string
  firstName?: string
  lastName?: string
  directOrderName?: string
  district?: number | null
  officialWebsiteUrl?: string | null
  terms?: DetailTerm[]
  partyHistory?: DetailPartyHistory[]
}

const PARTY_ABBREV_MAP: Record<string, Party> = {
  D: 'D',
  R: 'R',
  I: 'I',
  L: 'L',
  G: 'G',
  ID: 'ID',
}

function mapPartyAbbreviation(abbr: string | undefined): Party {
  if (!abbr) return 'ID'
  return PARTY_ABBREV_MAP[abbr] ?? 'ID'
}

function normalizeChamberString(raw: string | undefined): Chamber | null {
  if (raw === 'Senate') return 'federal_senate'
  if (raw === 'House of Representatives') return 'federal_house'
  return null
}

// API path token expected by Congress.gov's `?chamber=` querystring.
// Distinct from our DB enum: API speaks "house" / "senate"; DB stores
// "federal_house" / "federal_senate".
function chamberApiToken(chamber: Chamber): 'house' | 'senate' {
  return chamber === 'federal_house' ? 'house' : 'senate'
}

function buildPortraitUrl(bioguideId: string): string {
  const firstLetter = bioguideId[0]!.toUpperCase()
  return `https://bioguide.congress.gov/bioguide/photo/${firstLetter}/${bioguideId}.jpg`
}

function buildUrl(chamber: Chamber, congress: string): string {
  // Congress.gov's list endpoint uses chamber name in path-style: /member/congress/{c}/{state?} — the simpler
  // shape is /member?congress=N&chamber=house|senate but the chamber filter actually requires the path form.
  // Test against the public docs: querystring `chamber=house` works.
  return `${API_BASE}/member?congress=${congress}&currentMember=true&chamber=${chamberApiToken(chamber)}&limit=${PAGE_SIZE}&offset=0`
}

async function fetchListPage(url: string, apiKey: string): Promise<ListPage> {
  const res = await fetch(url, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Congress.gov list ${res.status}: ${await res.text()}`)
  }
  return (await res.json()) as ListPage
}

async function fetchDetail(detailUrl: string, apiKey: string): Promise<DetailMember> {
  const u = detailUrl.includes('?') ? `${detailUrl}&format=json` : `${detailUrl}?format=json`
  const res = await fetch(u, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Congress.gov detail ${res.status}: ${detailUrl}`)
  }
  const body = (await res.json()) as { member: DetailMember }
  return body.member
}

// Senate class derivation from Congress.gov v3 terms[].
//
// The v3 API records terms PER CONGRESS (every 2 years), not per 6-year
// senate term — and `endYear` is omitted for the current Congress. So we
// derive class from the START year of the most-recent 6-year window:
//
//   - Find the contiguous run of senate terms ending at the latest term.
//   - Take the latest 3 contiguous terms (= 1 full 6-year senate term).
//   - The earliest startYear among those 3 is the current 6-year term's start.
//   - Class mapping (startYear % 6):
//       == 3 → Class 1   (term starts 2013, 2019, 2025, 2031, ...)
//       == 5 → Class 2   (term starts 2015, 2021, 2027, ...)
//       == 1 → Class 3   (term starts 2017, 2023, 2029, ...)
function deriveSenateClass(allTerms: DetailTerm[]): 1 | 2 | 3 | null {
  const senateTerms = allTerms.filter(
    (t) =>
      normalizeChamberString(t.chamber) === 'federal_senate' && typeof t.startYear === 'number',
  )
  if (senateTerms.length === 0) return null

  // Find contiguous run ending at the last senate term — walk back while each
  // previous term's endYear equals next term's startYear (or is one less in
  // the off-by-one edge cases the API sometimes ships).
  const reversed = [...senateTerms].reverse()
  const contiguous: DetailTerm[] = [reversed[0]!]
  for (let i = 1; i < reversed.length; i++) {
    const prev = contiguous[contiguous.length - 1]!
    const cand = reversed[i]!
    const prevStart = prev.startYear!
    const candEnd = cand.endYear
    // Contiguous if cand's endYear matches prev's startYear (or is adjacent).
    if (
      typeof candEnd === 'number' &&
      (candEnd === prevStart || candEnd === prevStart - 1 || candEnd === prevStart + 1)
    ) {
      contiguous.push(cand)
    } else if (typeof candEnd !== 'number' && cand.startYear === prevStart - 2) {
      // Fallback: candidate's term is 2 years before prev — likely contiguous.
      contiguous.push(cand)
    } else {
      break
    }
  }

  // Latest 3 contiguous (or fewer); earliest startYear in this slice is the
  // current 6-year term's start.
  const window = contiguous.slice(0, 3)
  const earliestStart = Math.min(...window.map((t) => t.startYear!))
  const m = earliestStart % 6
  if (m === 3) return 1
  if (m === 5) return 2
  if (m === 1) return 3
  return null
}

function detailToNormalized(d: DetailMember, expectedChamber: Chamber): NormalizedMember | null {
  if (!d.firstName || !d.lastName) return null

  // Pick the most-recent term to derive chamber + stateCode. Detail's `terms`
  // is an array sorted oldest → newest. Use the last entry (current term).
  const terms = (d.terms ?? []).filter((t) => normalizeChamberString(t.chamber) !== null)
  const current = terms[terms.length - 1]
  if (!current) return null
  const chamber = normalizeChamberString(current.chamber)
  if (!chamber) return null
  // Some retired members might leak through `currentMember=true` filter races —
  // skip if the term ended in the past.
  if (current.endYear && current.endYear < new Date().getFullYear() - 1) return null
  // Drop members whose current term doesn't match the chamber we asked for.
  if (chamber !== expectedChamber) return null

  const stateCode = current.stateCode
  if (!stateCode || stateCode.length !== 2) return null

  // Senate class derived from the senator's most-recent contiguous 6-year
  // term window (see deriveSenateClass).
  const senateClass = chamber === 'federal_senate' ? deriveSenateClass(d.terms ?? []) : null
  // Constraint senate_class_matches_chamber requires senators have a class —
  // skip senators whose class we can't derive (rare: term endYear missing).
  if (chamber === 'federal_senate' && senateClass === null) return null

  // Latest party from partyHistory (also chronological).
  const ph = d.partyHistory ?? []
  const party = mapPartyAbbreviation(ph[ph.length - 1]?.partyAbbreviation)

  return {
    bioguideId: d.bioguideId,
    firstName: d.firstName,
    lastName: d.lastName,
    fullName: d.directOrderName ?? `${d.firstName} ${d.lastName}`,
    chamber,
    party,
    state: stateCode,
    districtNumber:
      chamber === 'federal_senate' ? null : typeof d.district === 'number' ? d.district : null,
    senateClass,
    portraitUrl: buildPortraitUrl(d.bioguideId),
    officialUrl: d.officialWebsiteUrl ?? null,
    // nextElection is not exposed on Congress.gov v3. Stub null.
    nextElection: null,
  }
}

async function fetchDetailsBatched(
  items: ListItem[],
  apiKey: string,
  expectedChamber: Chamber,
): Promise<NormalizedMember[]> {
  const out: NormalizedMember[] = []
  for (let i = 0; i < items.length; i += DETAIL_CONCURRENCY) {
    const slice = items.slice(i, i + DETAIL_CONCURRENCY)
    const results = await Promise.all(
      slice.map(async (it) => {
        try {
          const detail = await fetchDetail(it.url, apiKey)
          return detailToNormalized(detail, expectedChamber)
        } catch (err) {
          console.error(
            `  detail fetch failed for ${it.bioguideId}:`,
            err instanceof Error ? err.message : err,
          )
          return null
        }
      }),
    )
    for (const r of results) if (r) out.push(r)
  }
  return out
}

export async function fetchMembers(
  chamber: Chamber,
  congress: string,
  apiKey: string,
): Promise<NormalizedMember[]> {
  // 1. Page list endpoint to collect every current member's bioguide + detail URL.
  const listItems: ListItem[] = []
  let url: string | null = buildUrl(chamber, congress)
  while (url) {
    const page = await fetchListPage(url, apiKey)
    for (const m of page.members) {
      if (m.bioguideId && m.url) listItems.push({ bioguideId: m.bioguideId, url: m.url })
    }
    url = page.pagination?.next ?? null
  }
  console.log(
    `Congress.gov ${chamber}: ${listItems.length} list items; fetching details (concurrency=${DETAIL_CONCURRENCY})...`,
  )

  // 2. Fan out per-bioguide detail fetches with concurrency cap.
  const members = await fetchDetailsBatched(listItems, apiKey, chamber)
  console.log(
    `Congress.gov ${chamber}: ${members.length} members normalized (${listItems.length - members.length} skipped/failed).`,
  )
  return members
}
