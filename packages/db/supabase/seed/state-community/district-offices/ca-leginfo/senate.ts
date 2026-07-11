import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'
import { resolveOpenstatesPersonId } from '../../../shared/officials.ts'
import type { SkipReason } from '../../../shared/instrumentation.ts'

const SOURCE_URL = 'https://www.senate.ca.gov/senators'
const FETCH_TIMEOUT_MS = 5000

export interface ParsedCaSenator {
  full_name: string
  district_no: string
  capitol_office?: string
  district_office?: string
}

/**
 * Parse senate.ca.gov/senators — single-page roster of all 40 CA senators
 * (slice 12 audit "best-in-class" find).
 *
 * Audit-derived structure: each senator appears as <article
 * class="senator-card"> with senator-name (h3), district-number (span),
 * capitol-office (div), district-office (div). Implementer should fetch
 * a real URL during scaffold to verify selectors.
 *
 * Skips cards where:
 *   - district_no doesn't parse as a positive integer
 *   - both capitol_office AND district_office are missing
 */
export function parseCaSenateRosterHtml(html: string): ParsedCaSenator[] {
  const $ = cheerio.load(html)
  const out: ParsedCaSenator[] = []

  $('article.senator-card').each((_, el) => {
    const nameText = $(el).find('h3.senator-name').text().trim()
    const full_name = nameText.replace(/^Senator\s+/i, '').trim()

    const districtText = $(el).find('span.district-number').text().trim()
    const districtMatch = districtText.match(/\b(\d+)\b/)
    const district_no = districtMatch ? districtMatch[1]! : ''

    const capitol_office = $(el).find('.capitol-office').text().trim() || undefined
    const district_office = $(el).find('.district-office').text().trim() || undefined

    if (!full_name || !district_no) return
    if (!capitol_office && !district_office) return

    const senator: ParsedCaSenator = { full_name, district_no }
    if (capitol_office) senator.capitol_office = capitol_office
    if (district_office) senator.district_office = district_office
    out.push(senator)
  })

  return out
}

export async function fetchCaSenateOffices(
  client: Pick<Client, 'query'>,
  opts: {
    fetcher?: () => Promise<string>
    onSkip?: (reason: SkipReason) => void
  },
): Promise<NormalizedDistrictOffice[]> {
  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher()
      : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch (e) {
    opts.onSkip?.({
      adapter: 'ca-leginfo',
      stage: 'fetch',
      reason: 'roster fetch threw',
      detail: e instanceof Error ? e.message : String(e),
    })
    return []
  }

  const parsed = parseCaSenateRosterHtml(html)
  const out: NormalizedDistrictOffice[] = []

  for (const s of parsed) {
    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: s.full_name,
      state: 'CA',
      chamber: 'state_senate',
      onAmbiguous: () => opts.onSkip?.({
        adapter: 'ca-leginfo',
        stage: 'resolve_ambiguous',
        legislator: s.full_name,
        reason: 'ambiguous full_name match (2+ in-office officials)',
      }),
    })
    if (!openstates_person_id) {
      opts.onSkip?.({
        adapter: 'ca-leginfo',
        stage: 'resolve',
        legislator: s.full_name,
        reason: 'unmatched in officials table (state_senate)',
      })
      continue
    }

    if (s.capitol_office) {
      const parts = parseAddressText(s.capitol_office)
      if (parts) {
        out.push({
          official_openstates_person_id: openstates_person_id,
          kind: 'capitol',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: SOURCE_URL,
        })
      } else {
        opts.onSkip?.({
          adapter: 'ca-leginfo',
          stage: 'parse',
          legislator: s.full_name,
          reason: 'parseAddressText returned null for capitol office',
        })
      }
    }
    if (s.district_office) {
      const parts = parseAddressText(s.district_office)
      if (parts) {
        out.push({
          official_openstates_person_id: openstates_person_id,
          kind: 'district',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: SOURCE_URL,
        })
      } else {
        opts.onSkip?.({
          adapter: 'ca-leginfo',
          stage: 'parse',
          legislator: s.full_name,
          reason: 'parseAddressText returned null for district office',
        })
      }
    }
  }

  return out
}
