import { extractPdfText, fetchPdf } from '../../shared/pdf.ts'
import { acceptSenateAgreement, searchSenateEfpfd } from '../shared/senate-agreement.ts'
import { parseFdText } from '../shared/pdf-parsers.ts'
import type { FdAdapter, NormalizedDisclosureOther, NormalizedHolding } from '../shared/types.ts'

const THROTTLE_MS = 1000

/**
 * Senate EFPFD annual FD adapter (slice 26 Task 4).
 *
 * Two-step flow:
 *   1. acceptSenateAgreement() — POST agreement form to obtain session
 *      (CSRF token + cookie).
 *   2. searchSenateEfpfd({ reportType: '11', year }) — list annual FD
 *      filings for the year.
 *
 * Per filing: fetchPdf(url) → extractPdfText → parseFdText → emit
 * holdings (Schedule A) + other (Schedules C/D/E/F/G/H/I).
 *
 * Combined-parser pattern (1 fetch → 2 sinks); mirrors slice 16 tx-tec.
 *
 * external_id formats — Schedule-letter-encoded for traceability:
 *   - holdings: `senate-fd-{filingId}-A-{i + 1}`
 *   - other:    `senate-fd-{filingId}-{schedLetter}-{i + 1}`
 *
 * 1-req/sec throttle between filings (skipped after final filing per
 * slice 18 audit M5 guard).
 *
 * Silent-skip sites (slice 22 onSkip wiring):
 *   - fetch:   agreement gate failure, search failure, or per-PDF fetch
 *   - extract: extractPdfText threw or returned empty
 *
 * Zero parsed rows from a filing are acceptable per spec Risk #5.
 */
export const senateEfpfdFd: FdAdapter = {
  slug: 'senate-efpfd-fd',
  async fetchDisclosures(opts) {
    let session
    try {
      const sessionOpts: Parameters<typeof acceptSenateAgreement>[0] = {}
      if (opts.fetcher) sessionOpts.fetcher = opts.fetcher
      session = await acceptSenateAgreement(sessionOpts)
    } catch (err) {
      opts.onSkip?.({
        adapter: 'senate-efpfd-fd',
        stage: 'fetch',
        reason: 'senate agreement gate failed',
        detail: err instanceof Error ? err.message : String(err),
      })
      return { holdings: [], other: [] }
    }

    let results
    try {
      const searchOpts: Parameters<typeof searchSenateEfpfd>[0] = {
        session,
        reportType: '11',
        year: opts.year,
      }
      if (opts.fetcher) searchOpts.fetcher = opts.fetcher
      results = await searchSenateEfpfd(searchOpts)
    } catch (err) {
      opts.onSkip?.({
        adapter: 'senate-efpfd-fd',
        stage: 'fetch',
        reason: `senate fd search ${opts.year} failed`,
        detail: err instanceof Error ? err.message : String(err),
      })
      return { holdings: [], other: [] }
    }

    const holdings: NormalizedHolding[] = []
    const other: NormalizedDisclosureOther[] = []
    for (let n = 0; n < results.length; n++) {
      const r = results[n]!
      let pdfBytes
      try {
        pdfBytes = await fetchPdf(r.pdfUrl)
      } catch (err) {
        opts.onSkip?.({
          adapter: 'senate-efpfd-fd',
          stage: 'fetch',
          legislator: r.fullName,
          reason: `senate-fd ${r.filingId}: pdf fetch failed`,
          detail: err instanceof Error ? err.message : String(err),
        })
        continue
      }
      let text = ''
      try {
        text = await extractPdfText(pdfBytes)
      } catch (err) {
        opts.onSkip?.({
          adapter: 'senate-efpfd-fd',
          stage: 'extract',
          legislator: r.fullName,
          reason: `senate-fd ${r.filingId}: extract failed`,
          detail: err instanceof Error ? err.message : String(err),
        })
        continue
      }
      if (!text) {
        opts.onSkip?.({
          adapter: 'senate-efpfd-fd',
          stage: 'extract',
          legislator: r.fullName,
          reason: `senate-fd ${r.filingId}: empty extract`,
        })
        continue
      }
      const parsed = parseFdText(text, { filing_year: opts.year, source_url: r.pdfUrl })
      for (let i = 0; i < parsed.holdings.length; i++) {
        holdings.push({
          ...parsed.holdings[i]!,
          official_full_name: r.fullName,
          external_id: `senate-fd-${r.filingId}-A-${i + 1}`,
        })
      }
      for (let i = 0; i < parsed.other.length; i++) {
        const base = parsed.other[i]!
        other.push({
          ...base,
          official_full_name: r.fullName,
          external_id: `senate-fd-${r.filingId}-${schedLetterFor(base.category)}-${i + 1}`,
        })
      }
      // Throttle between filings (skip after last per audit M5 pattern).
      if (n + 1 < results.length) {
        await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS))
      }
    }
    return { holdings, other }
  },
}

/** Map category → Schedule letter for external_id traceability. */
function schedLetterFor(cat: NormalizedDisclosureOther['category']): string {
  const map: Record<NormalizedDisclosureOther['category'], string> = {
    liability: 'C',
    position: 'D',
    agreement: 'E',
    compensation: 'F',
    honoraria: 'G',
    gift: 'H',
    travel: 'I',
  }
  return map[cat]
}
