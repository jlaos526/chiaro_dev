import { extractPdfText, fetchPdf } from '../../shared/pdf.ts'
import { acceptSenateAgreement, searchSenateEfpfd } from '../shared/senate-agreement.ts'
import { parsePtrText } from '../shared/pdf-parsers.ts'
import type { PtrAdapter, NormalizedPtr } from '../shared/types.ts'

const THROTTLE_MS = 1000

/**
 * Senate EFPFD PTR adapter (slice 26 Task 3).
 *
 * Two-step flow:
 *   1. acceptSenateAgreement() — POST agreement form to obtain session
 *      (CSRF token + cookie).
 *   2. searchSenateEfpfd({ reportType: '7c', year }) — list PTR filings
 *      for the year.
 *
 * Per filing: fetchPdf(url) → extractPdfText → parsePtrText → emit one
 * NormalizedPtr per trade row.
 *
 * external_id format: `senate-ptr-{filing-id}-{lineNo}` — deterministic
 * across re-runs; (source, external_id) UNIQUE handles dedup at DB layer.
 *
 * 1-req/sec throttle between filings (skipped after final filing per
 * slice 18 audit M5 guard).
 *
 * Silent-skip sites (slice 22 onSkip wiring):
 *   - fetch:   agreement gate failure, search failure, or per-PDF fetch
 *   - extract: extractPdfText returned empty
 *   - parse:   parsePtrText found zero trades
 */
export const senateEfpfdPtr: PtrAdapter = {
  slug: 'senate-efpfd-ptr',
  async fetchTransactions(opts) {
    let session
    try {
      const sessionOpts: Parameters<typeof acceptSenateAgreement>[0] = {}
      if (opts.fetcher) sessionOpts.fetcher = opts.fetcher
      session = await acceptSenateAgreement(sessionOpts)
    } catch (err) {
      opts.onSkip?.({
        adapter: 'senate-efpfd-ptr',
        stage:   'fetch',
        reason:  'senate agreement gate failed',
        detail:  err instanceof Error ? err.message : String(err),
      })
      return []
    }

    let results
    try {
      const searchOpts: Parameters<typeof searchSenateEfpfd>[0] = {
        session,
        reportType: '7c',
        year:       opts.year,
      }
      if (opts.fetcher) searchOpts.fetcher = opts.fetcher
      results = await searchSenateEfpfd(searchOpts)
    } catch (err) {
      opts.onSkip?.({
        adapter: 'senate-efpfd-ptr',
        stage:   'fetch',
        reason:  `senate ptr search ${opts.year} failed`,
        detail:  err instanceof Error ? err.message : String(err),
      })
      return []
    }

    const out: NormalizedPtr[] = []
    for (let n = 0; n < results.length; n++) {
      const r = results[n]!
      let pdfBytes
      try {
        pdfBytes = await fetchPdf(r.pdfUrl)
      } catch (err) {
        opts.onSkip?.({
          adapter:    'senate-efpfd-ptr',
          stage:      'fetch',
          legislator: r.fullName,
          reason:     `senate-ptr ${r.filingId}: pdf fetch failed`,
          detail:     err instanceof Error ? err.message : String(err),
        })
        continue
      }
      let text = ''
      try {
        text = await extractPdfText(pdfBytes)
      } catch (err) {
        opts.onSkip?.({
          adapter:    'senate-efpfd-ptr',
          stage:      'extract',
          legislator: r.fullName,
          reason:     `senate-ptr ${r.filingId}: extract failed`,
          detail:     err instanceof Error ? err.message : String(err),
        })
        continue
      }
      if (!text) {
        opts.onSkip?.({
          adapter:    'senate-efpfd-ptr',
          stage:      'extract',
          legislator: r.fullName,
          reason:     `senate-ptr ${r.filingId}: empty extract`,
        })
        continue
      }
      const { trades } = parsePtrText(text, { filing_year: opts.year, source_url: r.pdfUrl })
      if (trades.length === 0) {
        opts.onSkip?.({
          adapter:    'senate-efpfd-ptr',
          stage:      'parse',
          legislator: r.fullName,
          reason:     `senate-ptr ${r.filingId}: zero trades`,
        })
        continue
      }
      for (let i = 0; i < trades.length; i++) {
        out.push({
          ...trades[i]!,
          official_full_name: r.fullName,
          external_id:        `senate-ptr-${r.filingId}-${i + 1}`,
        })
      }
      // Throttle between filings (skip after last per audit M5 pattern).
      if (n + 1 < results.length) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_MS))
      }
    }
    return out
  },
}
