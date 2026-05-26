import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedEthicsComplaint, NormalizedOfficialEvent } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'
import { parseTxTecOrderText } from './pdf-helpers.ts'

const SOURCE_URL = 'https://www.ethics.state.tx.us/enforcement/sworn_complaints/orders/search/'
const FETCH_TIMEOUT_MS = 5000
const MAX_PDFS_PER_RUN_DEFAULT = 200
const PDF_RATE_LIMIT_MS = 1000

export interface TxTecOrdersResult {
  complaints: NormalizedEthicsComplaint[]
  events: NormalizedOfficialEvent[]
  errors: string[]
}

export interface ParsedTxTecRow {
  order_number: string
  respondent: string
  date_issued: string
  year_filed: number
  agency: string
  status: string
  source_pdf_url: string
}

const LEGISLATOR_AGENCY_RE = /\b(Texas (?:House(?:\s+of\s+Representatives)?|Senate))\b/i

/**
 * Parse the TX TEC sworn-complaint orders table.
 *
 * Audit (2026-05-24) structure:
 *   <table class="orders-table">
 *     <thead><tr><th>Order #</th><th>Respondent</th><th>Date Issued</th>
 *                <th>Year Filed</th><th>Agency</th><th>Status</th></tr></thead>
 *     <tbody>
 *       <tr><td><a href="/data/.../SC-XXX.pdf">SC-XXX</a></td>...</tr>
 *     </tbody>
 *   </table>
 *
 * Per-case PDFs deferred to a future slice; this parser uses the HTML
 * table data only (Order #, Respondent, Date Issued, Year Filed, Agency,
 * Status all available inline).
 */
export function parseTxTecOrdersHtml(html: string): ParsedTxTecRow[] {
  const $ = cheerio.load(html)
  const out: ParsedTxTecRow[] = []

  $('table.orders-table tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 6) return

    const orderAnchor = $(cells[0]).find('a').first()
    const order_number = orderAnchor.text().trim()
    const pdfHref = orderAnchor.attr('href') ?? ''
    if (!order_number) return

    const respondent = $(cells[1]).text().trim()
    const date_issued = $(cells[2]).text().trim()
    const yearText = $(cells[3]).text().trim()
    const year_filed = Number.parseInt(yearText, 10) || 0
    const agency = $(cells[4]).text().trim()
    const status = $(cells[5]).text().trim()

    const source_pdf_url = pdfHref.startsWith('http')
      ? pdfHref
      : `https://www.ethics.state.tx.us${pdfHref}`

    out.push({ order_number, respondent, date_issued, year_filed, agency, status, source_pdf_url })
  })

  return out
}

/**
 * Filter rows where the agency column refers to a Texas state legislator
 * (House or Senate). Excludes state-agency executives, Comptroller, etc.
 */
export function isTexasLegislatorRow(row: Pick<ParsedTxTecRow, 'agency'>): boolean {
  return LEGISLATOR_AGENCY_RE.test(row.agency)
}

/**
 * Map TX TEC status text to the canonical state_ethics_complaints.status enum.
 *
 * TX lexicon (different from NY COELIG):
 *   - "Resolved" / "Final Order" / "Agreed Order" / "Penalty Order" → sanctioned
 *   - "Pending" → open
 *   - "Dismissed" → dismissed
 *   - Unknown → closed_no_action (with explicit no-action branch)
 */
function mapStatus(text: string): NormalizedEthicsComplaint['status'] {
  const norm = text.trim().toLowerCase()
  if (norm.includes('pending') || norm.includes('open')) return 'open'
  if (norm.includes('dismiss')) return 'dismissed'
  if (norm.includes('settle')) return 'settled'
  if (
    norm.includes('resolved')
    || norm.includes('final order')
    || norm.includes('agreed order')
    || norm.includes('penalty order')
    || norm.includes('sanction')
  ) return 'sanctioned'
  if (norm.includes('closed') || norm.includes('no action')) return 'closed_no_action'
  return 'closed_no_action'
}

/**
 * Production fetcher: GET ethics.state.tx.us/enforcement/sworn_complaints/orders/search/,
 * parse all rows, filter to Texas state-legislator agencies, resolve each to
 * openstates_person_id, emit BOTH a complaint AND an event row per resolved
 * respondent.
 *
 * Combined-parser pattern (mirror of slice 15 ny-coelig). Each adapter
 * (txTecComplaints, txTecEvents) calls this helper independently — 2 HTTP
 * fetches per orchestrator run. v1 inefficiency accepted per slice 15
 * precedent.
 */
export async function fetchSwornComplaintOrders(
  client: Pick<Client, 'query'>,
  opts: {
    fetcher?: (url: string) => Promise<string>
    maxPdfsPerRun?: number
    onSkip?: (reason: SkipReason) => void
  },
): Promise<TxTecOrdersResult> {
  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher(SOURCE_URL)
      : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch {
    return { complaints: [], events: [], errors: ['fetch failed'] }
  }

  const parsedRows = parseTxTecOrdersHtml(html)
  const complaints: NormalizedEthicsComplaint[] = []
  const events: NormalizedOfficialEvent[] = []
  const errors: string[] = []

  // First pass: existing slice 16 HTML scrape + row emission (unchanged).
  // Build a list of emitted rows alongside their source_pdf_url for the
  // slice 20 PDF enrichment pass.
  interface RowToEnrich {
    source_pdf_url: string
    complaintIdx: number
    eventIdx: number
  }
  const rowsToEnrich: RowToEnrich[] = []

  for (const row of parsedRows) {
    if (!isTexasLegislatorRow(row)) {
      opts.onSkip?.({
        adapter: 'tx-tec',
        stage: 'filter',
        legislator: row.respondent,
        reason: `agency "${row.agency}" not a TX state legislator`,
      })
      continue
    }

    const chamber: 'state_house' | 'state_senate' =
      /House/i.test(row.agency) ? 'state_house' : 'state_senate'

    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: row.respondent,
      state: 'TX',
      chamber,
    })
    if (!openstates_person_id) {
      opts.onSkip?.({
        adapter: 'tx-tec',
        stage: 'resolve',
        legislator: row.respondent,
        reason: `unmatched in officials (${chamber})`,
      })
      continue
    }

    const status = mapStatus(row.status)

    const complaintIdx = complaints.length
    complaints.push({
      official_openstates_person_id: openstates_person_id,
      complaint_date: row.date_issued,
      status,
      disposition: row.status,
      summary: `Sworn complaint order ${row.order_number} (${row.agency})`,
      state: 'TX',
      source_url: row.source_pdf_url,
      source: 'tx-tec',
      external_id: `complaint-${row.order_number}`,
    })

    const eventIdx = events.length
    events.push({
      official_openstates_person_id: openstates_person_id,
      event_date: row.date_issued,
      event_type: 'campaign_finance_violation',
      outcome: row.status,
      summary: `TEC sworn complaint ${row.order_number}`,
      state: 'TX',
      source_url: row.source_pdf_url,
      source: 'tx-tec',
      external_id: `event-${row.order_number}`,
    })

    rowsToEnrich.push({ source_pdf_url: row.source_pdf_url, complaintIdx, eventIdx })
  }

  // Second pass: slice 20 PDF enrichment. For the first maxPdfsPerRun rows,
  // fetch + parse the per-case order PDF and UPDATE the complaint + event
  // summary/disposition/outcome fields in place.
  const maxPdfsPerRun = opts.maxPdfsPerRun ?? MAX_PDFS_PER_RUN_DEFAULT
  const pdfBudget = Math.min(maxPdfsPerRun, rowsToEnrich.length)
  const testMode = Boolean(opts.fetcher)

  for (let i = 0; i < pdfBudget; i += 1) {
    const enrich = rowsToEnrich[i]!

    let buffer: Buffer
    try {
      buffer = await fetchPdf(enrich.source_pdf_url)
    } catch (e) {
      opts.onSkip?.({
        adapter: 'tx-tec',
        stage: 'fetch',
        reason: 'fetchPdf threw (per-case order PDF)',
        detail: e instanceof Error ? e.message : String(e),
      })
      continue
    }

    const text = await extractPdfText(buffer)
    if (!text) {
      opts.onSkip?.({
        adapter: 'tx-tec',
        stage: 'extract',
        reason: 'extractPdfText returned empty (per-case PDF)',
      })
      continue
    }

    const parsed = parseTxTecOrderText(text)
    if (parsed.violation_summary) {
      complaints[enrich.complaintIdx]!.summary = parsed.violation_summary
      events[enrich.eventIdx]!.summary = parsed.violation_summary
    }
    if (parsed.outcome_text) {
      complaints[enrich.complaintIdx]!.disposition = parsed.outcome_text
      events[enrich.eventIdx]!.outcome = parsed.outcome_text
    }
    // penalty_amount is parsed but not currently a column on
    // NormalizedEthicsComplaint or NormalizedOfficialEvent — store as
    // suffix to summary if present.
    if (parsed.penalty_amount !== undefined) {
      const penaltyNote = ` (Civil penalty: $${parsed.penalty_amount.toLocaleString()})`
      complaints[enrich.complaintIdx]!.summary += penaltyNote
      events[enrich.eventIdx]!.summary += penaltyNote
    }

    if (!testMode && i < pdfBudget - 1) {
      await new Promise(resolve => setTimeout(resolve, PDF_RATE_LIMIT_MS))
    }
  }

  return { complaints, events, errors }
}
