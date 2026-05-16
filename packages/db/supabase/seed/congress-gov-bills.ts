// Pages through /v3/bill?congress=N then /v3/bill/N/{type}/{number} for detail.
// Returns NormalizedBill[] for the orchestrator to upsert.
// Slice 4 inherits the slice-3 threshold-guard + audit-run pattern from
// officials-ingest.ts; not re-tested exhaustively (proven by slice 3 Task 17).

import type { Database } from '../../src/index.ts'

type BillType   = Database['public']['Enums']['bill_type']
type BillStatus = Database['public']['Enums']['bill_status']

export interface NormalizedBill {
  congress:         string
  bill_type:        BillType
  number:           number
  title:            string
  short_title:      string | null
  policy_area:      string | null
  status:           BillStatus
  introduced_date:  string
  latest_action:    string | null
  source_url:       string
  congress_gov_url: string | null
  sponsors:         Array<{ bioguide_id: string; role: 'sponsor' | 'cosponsor'; added_date: string | null }>
  subjects:         string[]
}

const API_BASE = 'https://api.congress.gov/v3'

export async function fetchBills(
  congress: string,
  apiKey: string,
  opts?: { since?: string; limit?: number },
): Promise<NormalizedBill[]> {
  const out: NormalizedBill[] = []
  let url: string | null = `${API_BASE}/bill?congress=${congress}&limit=${opts?.limit ?? 250}&offset=0`
  if (opts?.since) url += `&fromDateTime=${encodeURIComponent(opts.since)}`

  while (url) {
    const res = await fetch(url, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Congress.gov bills ${res.status}: ${await res.text()}`)
    const page = await res.json() as {
      bills: Array<{ congress: number; type: string; number: number; url: string }>
      pagination?: { next: string | null }
    }
    for (const summary of page.bills) {
      const detail = await fetchBillDetail(summary.url, apiKey)
      out.push(detail)
    }
    url = page.pagination?.next ?? null
  }
  return out
}

async function fetchBillDetail(detailUrl: string, apiKey: string): Promise<NormalizedBill> {
  const res = await fetch(detailUrl, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Congress.gov bill detail ${res.status}: ${detailUrl}`)
  const d = await res.json() as any
  const bill = d.bill
  return {
    congress: String(bill.congress),
    bill_type: bill.type.toLowerCase() as BillType,
    number: bill.number,
    title: bill.title,
    short_title: bill.shortTitle ?? null,
    policy_area: bill.policyArea?.name ?? null,
    status: mapStatus(bill),
    introduced_date: bill.introducedDate,
    latest_action: bill.latestAction?.text ?? null,
    source_url: `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.type.toLowerCase()}-bill/${bill.number}`,
    congress_gov_url: detailUrl,
    sponsors: [
      ...(bill.sponsors ?? []).map((s: any) => ({
        bioguide_id: s.bioguideId,
        role: 'sponsor' as const,
        added_date: bill.introducedDate,
      })),
      ...(bill.cosponsors?.items ?? []).map((c: any) => ({
        bioguide_id: c.bioguideId,
        role: 'cosponsor' as const,
        added_date: c.sponsorshipDate ?? null,
      })),
    ],
    subjects: (bill.subjects?.legislativeSubjects ?? []).map((s: any) => s.name).filter(Boolean),
  }
}

// Maps Congress.gov latestAction text to the bill_status enum declared in
// migration 0014_bills.sql. Enum members: introduced, in_committee, reported,
// passed_chamber, passed_both, enrolled, signed, vetoed, became_law, died.
function mapStatus(bill: any): BillStatus {
  const text = (bill.latestAction?.text ?? '').toLowerCase()
  if (text.includes('became public law'))                              return 'became_law'
  if (text.includes('vetoed'))                                         return 'vetoed'
  if (text.includes('signed by president'))                            return 'signed'
  if (text.includes('presented to president'))                         return 'enrolled'
  if (text.includes('passed senate') && text.includes('passed house')) return 'passed_both'
  if (text.includes('passed senate') || text.includes('passed house')) return 'passed_chamber'
  if (text.includes('reported'))                                       return 'reported'
  if (text.includes('committee'))                                      return 'in_committee'
  return 'introduced'
}
