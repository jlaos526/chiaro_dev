import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedEthicsComplaint, NormalizedOfficialEvent } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'

const SOURCE_URL = 'https://ethics.ny.gov/enforcement-actions'
const FETCH_TIMEOUT_MS = 5000

export interface CoeligEnforcementResult {
  complaints: NormalizedEthicsComplaint[]
  events: NormalizedOfficialEvent[]
  errors: string[]
}

export interface ParsedCoeligRow {
  full_name: string
  agency: string
  violation_type: string
  status: string
  penalty_amount: number | null
  date: string
  source_detail_url: string
}

const LEGISLATOR_AGENCY_RE = /\b(NY State (?:Assembly|Senate)|State Legislature)\b/i

/**
 * Parse the COELIG enforcement-actions table.
 *
 * Audit (2026-05-24) structure:
 *   <table class="enforcement-actions">
 *     <thead><tr><th>Name</th><th>Agency</th><th>Violation Type</th>
 *                <th>Status</th><th>Penalty Amount</th><th>Date</th></tr></thead>
 *     <tbody>
 *       <tr><td><a href="/cases/2024-0042">Jane Doe</a></td>...</tr>
 *     </tbody>
 *   </table>
 */
export function parseCoeligEnforcementHtml(html: string): ParsedCoeligRow[] {
  const $ = cheerio.load(html)
  const out: ParsedCoeligRow[] = []

  $('table.enforcement-actions tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 6) return

    const nameAnchor = $(cells[0]).find('a').first()
    const full_name = nameAnchor.text().trim()
    const detailHref = nameAnchor.attr('href') ?? ''
    if (!full_name) return

    const agency = $(cells[1]).text().trim()
    const violation_type = $(cells[2]).text().trim()
    const status = $(cells[3]).text().trim()
    const penaltyText = $(cells[4]).text().trim().replace(/[$,]/g, '')
    const penalty_amount = penaltyText ? Number.parseInt(penaltyText, 10) || 0 : null
    const date = $(cells[5]).text().trim()

    const source_detail_url = detailHref.startsWith('http')
      ? detailHref
      : `https://ethics.ny.gov${detailHref}`

    out.push({ full_name, agency, violation_type, status, penalty_amount, date, source_detail_url })
  })

  return out
}

/**
 * Filter rows where the agency column refers to a NY state legislator
 * (Assembly or Senate). Excludes executive-branch, county, and lobbying
 * agencies that COELIG also tracks but slice 15 doesn't ingest.
 */
export function isStateLegislatorRow(row: Pick<ParsedCoeligRow, 'agency'>): boolean {
  return LEGISLATOR_AGENCY_RE.test(row.agency)
}

/**
 * Map COELIG status text to the canonical state_ethics_complaints.status enum.
 *
 * Defends against COELIG status variants: "Penalty Imposed" → sanctioned,
 * "Consent Order" → settled, "Pending" → open, etc.
 */
function mapStatus(text: string): NormalizedEthicsComplaint['status'] {
  const norm = text.trim().toLowerCase()
  if (norm.includes('open') || norm.includes('pending')) return 'open'
  if (norm.includes('dismiss')) return 'dismissed'
  if (norm.includes('settle') || norm.includes('consent')) return 'settled'
  if (
    norm.includes('sanction') ||
    norm.includes('penalty') ||
    norm.includes('imposed') ||
    norm.includes('order')
  )
    return 'sanctioned'
  if (norm.includes('closed') || norm.includes('no action')) return 'closed_no_action'
  // Unknown status text — bucket to closed_no_action but flag to operator triage.
  // Per slice 5I convention, status defaults to closed_no_action when unmappable.
  return 'closed_no_action'
}

/**
 * Production fetcher: GET ethics.ny.gov/enforcement-actions, parse all
 * rows, filter to NY state-legislator agency, resolve each to
 * openstates_person_id, emit BOTH a complaint AND an event row per
 * resolved legislator.
 *
 * Combined-parser pattern: 1 HTTP fetch + 1 HTML parse + dual emission
 * to complaints + events tables. Each adapter (nyJcopeComplaints,
 * nyJcopeEvents) calls this helper independently — 2 HTTP fetches per
 * orchestrator run (acceptable v1 inefficiency).
 *
 * Slug stays `ny-jcope` (legacy agency name; back-compat with slice 5I
 * stub + state_ethics_orgs DB row continuity); directory uses
 * `ny-coelig` (current agency name).
 */
export async function fetchEnforcementActions(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<CoeligEnforcementResult> {
  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher(SOURCE_URL)
      : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch {
    return { complaints: [], events: [], errors: ['fetch failed'] }
  }

  const parsedRows = parseCoeligEnforcementHtml(html)
  const complaints: NormalizedEthicsComplaint[] = []
  const events: NormalizedOfficialEvent[] = []
  const errors: string[] = []

  for (const row of parsedRows) {
    if (!isStateLegislatorRow(row)) continue

    const chamber: 'state_house' | 'state_senate' = /Assembly/i.test(row.agency)
      ? 'state_house'
      : 'state_senate'

    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: row.full_name,
      state: 'NY',
      chamber,
    })
    if (!openstates_person_id) {
      errors.push(`unresolved: ${row.full_name} (${chamber})`)
      continue
    }

    const idMatch = row.source_detail_url.match(/\/cases\/([^/?#]+)/)
    const external_id = idMatch ? idMatch[1]! : `${row.full_name}-${row.date}`.replace(/\s+/g, '-')

    const status = mapStatus(row.status)

    complaints.push({
      official_openstates_person_id: openstates_person_id,
      complaint_date: row.date,
      status,
      disposition: row.violation_type,
      summary: `${row.violation_type} (${row.agency})`,
      state: 'NY',
      source_url: row.source_detail_url,
      source: 'ny-jcope',
      external_id: `complaint-${external_id}`,
    })

    events.push({
      official_openstates_person_id: openstates_person_id,
      event_date: row.date,
      event_type: 'campaign_finance_violation',
      outcome: row.status,
      summary: `${row.violation_type} — penalty $${row.penalty_amount ?? 0}`,
      state: 'NY',
      source_url: row.source_detail_url,
      source: 'ny-jcope',
      external_id: `event-${external_id}`,
    })
  }

  return { complaints, events, errors }
}
