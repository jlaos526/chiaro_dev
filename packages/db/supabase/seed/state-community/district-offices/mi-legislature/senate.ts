import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedMiSenatorProfile {
  lansing_office?: string
  district_office?: string
}

/**
 * Derive a senator profile URL from a full_name.
 *
 * Per slice 12 audit: senate.michigan.gov/senators/{slug}/ where slug
 * is lowercase firstname-lastname. Implementer should verify against
 * 2-3 real URLs during scaffold.
 */
export function deriveMiSenatorUrl(full_name: string): string {
  const slug = full_name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `https://senate.michigan.gov/senators/${slug}/`
}

/**
 * Parse a single MI Senator profile page.
 *
 * Audit-derived structure: <section class="lansing-office"> and
 * <section class="district-office"> with <p>-wrapped address text.
 */
export function parseMiSenatorProfileHtml(html: string): ParsedMiSenatorProfile {
  const $ = cheerio.load(html)
  const out: ParsedMiSenatorProfile = {}

  const lansingText = $('section.lansing-office p').first().text().trim().replace(/\s+/g, ' ')
  if (lansingText) out.lansing_office = lansingText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchMiSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string }>(
    `select openstates_person_id, full_name from public.officials
     where chamber = 'state_senate' and state = 'MI' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const senator of res.rows) {
    const url = deriveMiSenatorUrl(senator.full_name)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseMiSenatorProfileHtml(html)

    if (parsed.lansing_office) {
      const parts = parseAddressText(parsed.lansing_office)
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
