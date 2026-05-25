import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'
import { resolveOpenstatesPersonId } from '../../shared/officials.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import { parseNyFdsText } from './ny-fds-helpers.ts'

const SOURCE_URL = 'https://ethics.ny.gov/financial-disclosure-statements-elected-officials?year=2024'
const FETCH_TIMEOUT_MS = 5000
const MAX_PAGES_DEFAULT = 120
const RATE_LIMIT_MS = 1000
const MAX_PDFS_PER_RUN_DEFAULT = 200
const PDF_RATE_LIMIT_MS = 1000
const ORIGIN = 'https://ethics.ny.gov'

export interface ParsedNyFdsRow {
  full_name: string
  office_text: string
  filing_year: number
  filing_date: string
  filing_id: string
  source_url: string
}

export interface ParsedNyFdsPage {
  rows: ParsedNyFdsRow[]
  nextPageHref: string | null
}

/**
 * Parse one page of the ny ethics.ny.gov FDS index.
 *
 * Audit-derived structure (2026-05-24): <table class="filings-table"> with
 * thead/tbody; each row has Name, Office, Year, Filed, PDF (anchor with
 * data-filing-id + Download text). Pagination via <nav class="pagination">
 * containing <a class="next-page" href="...">.
 *
 * Implementer should fetch a real URL during scaffold to verify selectors.
 */
export function parseNyFdsIndexHtml(html: string): ParsedNyFdsPage {
  const $ = cheerio.load(html)
  const rows: ParsedNyFdsRow[] = []

  $('table.filings-table tbody tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 5) return

    const full_name = $(cells[0]).text().trim()
    const office_text = $(cells[1]).text().trim()
    const yearText = $(cells[2]).text().trim()
    const filing_year = Number.parseInt(yearText, 10)
    const filing_date = $(cells[3]).text().trim()

    const anchor = $(cells[4]).find('a').first()
    const filing_id = anchor.attr('data-filing-id') ?? ''
    const href = anchor.attr('href') ?? ''
    const source_url = href.startsWith('http') ? href : `${ORIGIN}${href}`

    if (!full_name || !office_text || !filing_id || !Number.isFinite(filing_year)) return

    rows.push({ full_name, office_text, filing_year, filing_date, filing_id, source_url })
  })

  const nextHref = $('nav.pagination a.next-page').attr('href') ?? null
  const nextPageHref = nextHref
    ? (nextHref.startsWith('http') ? nextHref : `${ORIGIN}${nextHref}`)
    : null

  return { rows, nextPageHref }
}

/**
 * Infer chamber from NY office-type text.
 *
 * Audit variants:
 *   - "NYS Assembly Member" → state_house
 *   - "Member of Assembly" → state_house
 *   - "NYS Senator" → state_senate
 *   - other (LG, Comptroller, AG) → null (skip)
 */
export function inferChamberFromOfficeText(text: string): 'state_house' | 'state_senate' | null {
  if (/\bAssembly\b/i.test(text)) return 'state_house'
  if (/\bSenator\b|\bSenate\b/i.test(text)) return 'state_senate'
  return null
}

/**
 * Walk pagination starting from `startUrl`, fetching each page until either
 * the next-page link is absent OR the page cap is reached.
 *
 * Default cap = 120 pages (audit-derived sensible bound for 2,804
 * records at ~25/page → ~113 pages for full current cycle, plus
 * ~5% buffer). Operator can override via opts.maxPages.
 */
export async function fetchAllPages(
  startUrl: string,
  fetcher: (url: string) => Promise<string>,
  opts: { maxPages?: number } = {},
): Promise<ParsedNyFdsRow[]> {
  const maxPages = opts.maxPages ?? MAX_PAGES_DEFAULT
  const allRows: ParsedNyFdsRow[] = []
  let url: string | null = startUrl

  for (let i = 0; i < maxPages && url; i += 1) {
    let html: string
    try {
      html = await fetcher(url)
    } catch {
      break  // network failure → stop pagination, return what we have
    }
    const { rows, nextPageHref } = parseNyFdsIndexHtml(html)
    allRows.push(...rows)
    url = nextPageHref
  }

  return allRows
}

export const nyJcopeDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'ny-jcope',
  component: 'disclosures',
  covered_states: ['NY'],
  async fetchEvents(opts): Promise<NormalizedFinancialDisclosure[]> {
    // Adapter-level fixture injection (returns pre-resolved rows). Typed
    // via the generic StateEthicsAdapter<NormalizedFinancialDisclosure>.
    if (opts.fetcher) return opts.fetcher()

    // Page-level fetcher injection (returns HTML for parser tests). Distinct
    // from the typed `fetcher?` adapter-level injection — kept under a
    // separate opts key with explicit typing (no `as never` cast).
    const pageFetcher = (opts as { pageFetcher?: (url: string) => Promise<string> }).pageFetcher
    const fetcher: (url: string) => Promise<string> = pageFetcher
      ?? (async (url: string) => {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
        return res.text()
      })

    let parsedRows: ParsedNyFdsRow[]
    try {
      parsedRows = await fetchAllPages(SOURCE_URL, fetcher)
    } catch {
      return []
    }

    const out: NormalizedFinancialDisclosure[] = []
    const client = (opts as { client: Client }).client
    const maxPdfsPerRun = (opts as { maxPdfsPerRun?: number }).maxPdfsPerRun ?? MAX_PDFS_PER_RUN_DEFAULT

    // First pass: resolve + emit placeholder rows (slice 17 behavior, unchanged).
    // Collect rows that have a resolvable legislator for the slice 20 PDF pass.
    interface ResolvedFiling {
      row: ParsedNyFdsRow
      openstates_person_id: string
    }
    const resolvedFilings: ResolvedFiling[] = []

    for (const row of parsedRows) {
      const chamber = inferChamberFromOfficeText(row.office_text)
      if (!chamber) continue

      const openstates_person_id = await resolveOpenstatesPersonId(client, {
        full_name: row.full_name,
        state: 'NY',
        chamber,
      })
      if (!openstates_person_id) continue

      out.push({
        official_openstates_person_id: openstates_person_id,
        filing_year: row.filing_year,
        filing_date: row.filing_date,
        // income_source / income_kind / amount_range_* left undefined.
        // v1 ships index-metadata-only; PDF parser slice fills line items
        // with separate external_ids (filing-{id}-{lineNo}).
        state: 'NY',
        source_url: row.source_url,
        source: 'ny-jcope',
        external_id: `filing-${row.filing_id}`,
      })

      resolvedFilings.push({ row, openstates_person_id })
    }

    // Second pass: PDF fetch + parse + line-item emission for the first
    // maxPdfsPerRun filings (slice 20 — operator caps batch size).
    const pdfBudget = Math.min(maxPdfsPerRun, resolvedFilings.length)
    const testMode = Boolean(pageFetcher)

    for (let i = 0; i < pdfBudget; i += 1) {
      const { row, openstates_person_id } = resolvedFilings[i]!

      let buffer: Buffer
      try {
        buffer = await fetchPdf(row.source_url)
      } catch {
        continue
      }

      const text = await extractPdfText(buffer)
      if (!text) continue

      const lineItems = parseNyFdsText(text)
      if (lineItems.length === 0) continue

      lineItems.forEach((item, idx) => {
        const lineNo = idx + 1
        const lineRow: NormalizedFinancialDisclosure = {
          official_openstates_person_id: openstates_person_id,
          filing_year: row.filing_year,
          filing_date: row.filing_date,
          income_source: item.income_source,
          income_kind: item.income_kind,
          state: 'NY',
          source_url: row.source_url,
          source: 'ny-jcope',
          external_id: `filing-${row.filing_id}-${lineNo}`,
        }
        if (item.amount_range_low !== undefined) lineRow.amount_range_low = item.amount_range_low
        if (item.amount_range_high !== undefined) lineRow.amount_range_high = item.amount_range_high
        out.push(lineRow)
      })

      // Audit M5 throttle guard — skip after last iteration. Skipped entirely in test mode.
      if (!testMode && i < pdfBudget - 1) {
        await new Promise(resolve => setTimeout(resolve, PDF_RATE_LIMIT_MS))
      }
    }

    return out
  },
}
