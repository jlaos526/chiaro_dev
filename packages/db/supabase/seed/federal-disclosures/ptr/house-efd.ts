import { extractPdfText } from '../../shared/pdf.ts'
import { fetchHouseDisclosureZip } from '../shared/house-zip.ts'
import { parsePtrText } from '../shared/pdf-parsers.ts'
import type { PtrAdapter, NormalizedPtr } from '../shared/types.ts'

/**
 * House EFD PTR adapter (slice 26 Task 3).
 *
 * Yearly flow:
 *   1. Download the per-year bulk PTR ZIP from disclosures-clerk.house.gov
 *      via fetchHouseDisclosureZip().
 *   2. For each filing in the manifest: extractPdfText → parsePtrText
 *      → emit one NormalizedPtr per trade row.
 *
 * external_id format: `house-ptr-{filing-id}-{lineNo}` — deterministic
 * across re-runs; (source, external_id) UNIQUE handles dedup at DB layer.
 *
 * Silent-skip sites (slice 22 onSkip wiring):
 *   - fetch:   ZIP download failure
 *   - extract: extractPdfText threw or returned empty
 *   - parse:   parsePtrText found zero trades
 */
export const houseEfdPtr: PtrAdapter = {
  slug: 'house-efd-ptr',
  async fetchTransactions(opts) {
    let manifest
    try {
      const zipOpts: Parameters<typeof fetchHouseDisclosureZip>[0] = {
        year:     opts.year,
        formType: 'ptr',
      }
      if (opts.fetcher) zipOpts.fetcher = opts.fetcher
      manifest = await fetchHouseDisclosureZip(zipOpts)
    } catch (err) {
      opts.onSkip?.({
        adapter: 'house-efd-ptr',
        stage:   'fetch',
        reason:  `house-ptr ZIP fetch ${opts.year} failed`,
        detail:  err instanceof Error ? err.message : String(err),
      })
      return []
    }

    const out: NormalizedPtr[] = []
    for (const f of manifest.filings) {
      let text = ''
      try {
        text = await extractPdfText(f.pdfBytes)
      } catch (err) {
        opts.onSkip?.({
          adapter:    'house-efd-ptr',
          stage:      'extract',
          legislator: f.fullName,
          reason:     `house-ptr ${f.filingId}: extractPdfText threw`,
          detail:     err instanceof Error ? err.message : String(err),
        })
        continue
      }
      if (!text) {
        opts.onSkip?.({
          adapter:    'house-efd-ptr',
          stage:      'extract',
          legislator: f.fullName,
          reason:     `house-ptr ${f.filingId}: empty extract`,
        })
        continue
      }
      const { trades } = parsePtrText(text, { filing_year: opts.year, source_url: f.pdfUrl })
      if (trades.length === 0) {
        opts.onSkip?.({
          adapter:    'house-efd-ptr',
          stage:      'parse',
          legislator: f.fullName,
          reason:     `house-ptr ${f.filingId}: zero trades`,
        })
        continue
      }
      for (let i = 0; i < trades.length; i++) {
        const row: NormalizedPtr = {
          ...trades[i]!,
          official_full_name: f.fullName,
          external_id:        `house-ptr-${f.filingId}-${i + 1}`,
        }
        if (f.bioguideId) row.official_bioguide_id = f.bioguideId
        out.push(row)
      }
    }
    return out
  },
}
