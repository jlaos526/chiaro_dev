import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedFlSenatorDetail {
  capitol_office?: string
  district_office?: string
}

/**
 * Derive FL Senator detail-page URL from district number.
 *
 * Per slice 12 audit: flsenate.gov/Senators/s{district}.
 * Implementer should verify against 2-3 real URLs during scaffold.
 */
export function deriveFlSenatorUrl(district_number: number): string {
  return `https://www.flsenate.gov/Senators/s${district_number}`
}

/**
 * Parse a single FL Senator detail page.
 *
 * Audit-derived structure: <section class="capitol-office"> and
 * <section class="district-office"> with <p>-wrapped address text.
 * Mirrors slice 16 ca-leginfo + mi-legislature parser shape.
 */
export function parseFlSenatorDetailHtml(html: string): ParsedFlSenatorDetail {
  const $ = cheerio.load(html)
  const out: ParsedFlSenatorDetail = {}

  const capitolText = $('section.capitol-office p').first().text().trim().replace(/\s+/g, ' ')
  if (capitolText) out.capitol_office = capitolText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchFlSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string; district_id: string | null }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = 'state_senate' and state = 'FL' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const senator of res.rows) {
    if (!senator.district_id) continue
    const districtMatch = senator.district_id.match(/^FL-(\d+)$/)
    if (!districtMatch) continue
    const district_number = Number.parseInt(districtMatch[1]!, 10)
    if (!Number.isFinite(district_number)) continue

    const url = deriveFlSenatorUrl(district_number)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseFlSenatorDetailHtml(html)

    if (parsed.capitol_office) {
      const parts = parseAddressText(parsed.capitol_office)
      if (parts) {
        out.push({
          official_openstates_person_id: senator.openstates_person_id,
          kind: 'capitol',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }
    if (parsed.district_office) {
      const parts = parseAddressText(parsed.district_office)
      if (parts) {
        out.push({
          official_openstates_person_id: senator.openstates_person_id,
          kind: 'district',
          street_1: parts.street_1,
          city: parts.city,
          state: parts.state,
          ...(parts.postal_code ? { postal_code: parts.postal_code } : {}),
          ...(parts.phone ? { phone: parts.phone } : {}),
          source_url: url,
        })
      }
    }

    if (!opts.fetcher) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
