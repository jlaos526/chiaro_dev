import type { Client } from 'pg'
import type { StateEthicsAdapter, NormalizedFinancialDisclosure } from '../shared.ts'
import { fetchPdf, extractPdfText } from '../../shared/pdf.ts'
import { deriveMiPfdUrl, parseMiPfdText } from './mi-pfd-helpers.ts'

const FILING_YEAR_DEFAULT = 2024 // v1 hardcodes current cycle; backfill is a future slice
const RATE_LIMIT_MS = 1000

/**
 * Michigan Personal Financial Disclosure (PFD) parser.
 *
 * Slug `mi-board` is the slice 5I stub legacy name (Michigan SOS
 * handles PFD filings, not the Michigan Bureau of Elections "board",
 * but the slug stays for state_ethics_orgs row continuity).
 *
 * Flow per legislator: query officials for MI state_house +
 * state_senate; derive PDF URL via deriveMiPfdUrl(legislator, year);
 * fetchPdf(url) → extractPdfText(buffer) → parseMiPfdText(text);
 * emit one NormalizedFinancialDisclosure per parsed line item.
 *
 * external_id format: `mi-pfd-{Lastname}-{Firstname}-{year}-{lineNo}`.
 * Deterministic across re-runs; (source, external_id) UNIQUE handles
 * dedup at DB layer.
 *
 * Per-legislator silent skip on:
 *   - Empty derived URL (single-name legislators)
 *   - fetchPdf rejection (404, timeout, network error)
 *   - Empty extractPdfText result (parse failure)
 *   - parseMiPfdText returning [] (no recognized line items)
 *
 * Production fetch volume: ~148 MI legislators × 1 PDF each = 148
 * fetches per orchestrator run, ~148s at 1-req/sec.
 */
export const miBoardDisclosures: StateEthicsAdapter<NormalizedFinancialDisclosure> = {
  slug: 'mi-board',
  component: 'disclosures',
  status: 'production',
  covered_states: ['MI'],
  async fetchEvents(opts): Promise<NormalizedFinancialDisclosure[]> {
    if (opts.fetcher) return opts.fetcher()

    const client = opts.client as Client
    const res = await client.query<{
      openstates_person_id: string
      full_name: string
    }>(
      `select openstates_person_id, full_name from public.officials
       where chamber in ('state_house', 'state_senate')
         and state = $1
         and in_office = true`,
      ['MI'],
    )

    const out: NormalizedFinancialDisclosure[] = []
    const rows = res.rows
    const totalRows = rows.length
    const year = FILING_YEAR_DEFAULT

    for (let i = 0; i < totalRows; i += 1) {
      const legislator = rows[i]!
      const url = deriveMiPfdUrl({ full_name: legislator.full_name }, year)
      if (!url) {
        opts.onSkip?.({
          adapter: 'mi-board',
          stage: 'derive_url',
          legislator: legislator.full_name,
          reason: 'deriveMiPfdUrl returned empty (single-name legislator)',
        })
        continue
      }

      let buffer: Buffer
      try {
        buffer = await fetchPdf(url)
      } catch (e) {
        opts.onSkip?.({
          adapter: 'mi-board',
          stage: 'fetch',
          legislator: legislator.full_name,
          reason: 'fetchPdf threw',
          detail: e instanceof Error ? e.message : String(e),
        })
        continue
      }

      const text = await extractPdfText(buffer)
      if (!text) {
        opts.onSkip?.({
          adapter: 'mi-board',
          stage: 'extract',
          legislator: legislator.full_name,
          reason: 'extractPdfText returned empty',
        })
        continue
      }

      const lineItems = parseMiPfdText(text)
      if (lineItems.length === 0) {
        opts.onSkip?.({
          adapter: 'mi-board',
          stage: 'parse',
          legislator: legislator.full_name,
          reason: 'parseMiPfdText returned no items',
        })
        continue
      }

      // Re-derive normalized lastname-firstname for external_id (matches URL derivation)
      const normalized = legislator.full_name
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
      const nameParts = normalized.split(/\s+/).filter(Boolean)
      const lastName = nameParts[nameParts.length - 1]!
      const firstName = nameParts[0]!

      lineItems.forEach((item, idx) => {
        const lineNo = idx + 1
        const row: NormalizedFinancialDisclosure = {
          official_openstates_person_id: legislator.openstates_person_id,
          filing_year: year,
          income_source: item.income_source,
          income_kind: item.income_kind,
          state: 'MI',
          source_url: url,
          source: 'mi-board',
          external_id: `mi-pfd-${lastName}-${firstName}-${year}-${lineNo}`,
        }
        if (item.amount_range_low !== undefined) row.amount_range_low = item.amount_range_low
        if (item.amount_range_high !== undefined) row.amount_range_high = item.amount_range_high
        out.push(row)
      })

      // Audit M5 pattern: throttle after every iteration except the last.
      if (i < totalRows - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS))
      }
    }

    return out
  },
}
