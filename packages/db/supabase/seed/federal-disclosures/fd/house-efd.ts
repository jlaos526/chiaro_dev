import { extractPdfText } from '../../shared/pdf.ts'
import { fetchHouseDisclosureZip } from '../shared/house-zip.ts'
import { parseFdText } from '../shared/pdf-parsers.ts'
import type {
  FdAdapter,
  NormalizedDisclosureOther,
  NormalizedHolding,
} from '../shared/types.ts'

/**
 * House EFD annual FD adapter (slice 26 Task 4).
 *
 * Yearly flow:
 *   1. Download the per-year bulk FD ZIP from disclosures-clerk.house.gov
 *      via fetchHouseDisclosureZip({ formType: 'fd' }).
 *   2. For each filing in the manifest: extractPdfText → parseFdText →
 *      emit holdings (Schedule A) + other (Schedules C/D/E/F/G/H/I).
 *
 * Combined-parser pattern (1 fetch → 2 sinks); mirrors slice 16 tx-tec.
 *
 * external_id formats (Schedule-letter-encoded for traceability back to
 * the source PDF schedule):
 *   - holdings: `house-fd-{filingId}-A-{i + 1}`           (Schedule A)
 *   - other:    `house-fd-{filingId}-{schedLetter}-{i + 1}` per category:
 *       liability   → C
 *       position    → D
 *       agreement   → E
 *       compensation→ F
 *       honoraria   → G
 *       gift        → H
 *       travel      → I
 *
 * Silent-skip sites (slice 22 onSkip wiring):
 *   - fetch:   ZIP download failure
 *   - extract: extractPdfText threw or returned empty
 *
 * Zero parsed rows from a filing are acceptable per spec Risk #5 (the
 * parse stage emits nothing rather than logging a skip — D/E/F/G are
 * shipped as empty until real samples surface).
 */
export const houseEfdFd: FdAdapter = {
  slug: 'house-efd-fd',
  async fetchDisclosures(opts) {
    let manifest
    try {
      const zipOpts: Parameters<typeof fetchHouseDisclosureZip>[0] = {
        year:     opts.year,
        formType: 'fd',
      }
      if (opts.fetcher) zipOpts.fetcher = opts.fetcher
      manifest = await fetchHouseDisclosureZip(zipOpts)
    } catch (err) {
      opts.onSkip?.({
        adapter: 'house-efd-fd',
        stage:   'fetch',
        reason:  `house-fd ZIP fetch ${opts.year} failed`,
        detail:  err instanceof Error ? err.message : String(err),
      })
      return { holdings: [], other: [] }
    }

    const holdings: NormalizedHolding[] = []
    const other:    NormalizedDisclosureOther[] = []
    for (const f of manifest.filings) {
      let text = ''
      try {
        text = await extractPdfText(f.pdfBytes)
      } catch (err) {
        opts.onSkip?.({
          adapter:    'house-efd-fd',
          stage:      'extract',
          legislator: f.fullName,
          reason:     `house-fd ${f.filingId}: extractPdfText threw`,
          detail:     err instanceof Error ? err.message : String(err),
        })
        continue
      }
      if (!text) {
        opts.onSkip?.({
          adapter:    'house-efd-fd',
          stage:      'extract',
          legislator: f.fullName,
          reason:     `house-fd ${f.filingId}: empty extract`,
        })
        continue
      }
      const parsed = parseFdText(text, { filing_year: opts.year, source_url: f.pdfUrl })
      for (let i = 0; i < parsed.holdings.length; i++) {
        const row: NormalizedHolding = {
          ...parsed.holdings[i]!,
          official_full_name: f.fullName,
          external_id:        `house-fd-${f.filingId}-A-${i + 1}`,
        }
        if (f.bioguideId) row.official_bioguide_id = f.bioguideId
        holdings.push(row)
      }
      for (let i = 0; i < parsed.other.length; i++) {
        const base = parsed.other[i]!
        const row: NormalizedDisclosureOther = {
          ...base,
          official_full_name: f.fullName,
          external_id:        `house-fd-${f.filingId}-${schedLetterFor(base.category)}-${i + 1}`,
        }
        if (f.bioguideId) row.official_bioguide_id = f.bioguideId
        other.push(row)
      }
    }
    return { holdings, other }
  },
}

/** Map category → Schedule letter for external_id traceability. */
function schedLetterFor(cat: NormalizedDisclosureOther['category']): string {
  const map: Record<NormalizedDisclosureOther['category'], string> = {
    liability:    'C',
    position:     'D',
    agreement:    'E',
    compensation: 'F',
    honoraria:    'G',
    gift:         'H',
    travel:       'I',
  }
  return map[cat]
}
