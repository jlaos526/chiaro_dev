import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedCaAssemblymember {
  capitol_office?: string
  district_office?: string
}

/**
 * Derive AM detail-page URL from district number.
 *
 * Per slice 12 audit: assembly.ca.gov/assemblymembers/{district_number}.
 * Implementer verifies against 2-3 real URLs during scaffold.
 */
export function deriveAmDistrictUrl(district_number: number): string {
  return `https://www.assembly.ca.gov/assemblymembers/${district_number}`
}

/**
 * Parse a single CA Assemblymember detail page.
 *
 * Audit-derived structure: <section class="capitol-office"> and
 * <section class="district-office"> contain <p>-wrapped address text.
 * Each section's text is captured for downstream parseAddressText.
 */
export function parseCaAssemblymemberDetailHtml(html: string): ParsedCaAssemblymember {
  const $ = cheerio.load(html)
  const out: ParsedCaAssemblymember = {}

  const capitolText = $('section.capitol-office p').first().text().trim().replace(/\s+/g, ' ')
  if (capitolText) out.capitol_office = capitolText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

/**
 * Fetch + parse all CA Assemblymember detail pages.
 *
 * Queries officials table for CA state_house legislators, extracts district
 * number from district_id (format "CA-14"), fetches each detail page with
 * a 1-req/sec courtesy throttle (skipped in test mode), parses address
 * blocks, emits NormalizedDistrictOffice rows per parsed address.
 *
 * Per-AM fetch failures silently skip; per-AM URL-pattern mismatches
 * yield 0 parsed rows for that AM.
 */
export async function fetchCaAssemblyOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string; district_id: string | null }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = 'state_house' and state = 'CA' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const am of res.rows) {
    if (!am.district_id) continue
    const districtMatch = am.district_id.match(/^CA-(\d+)$/)
    if (!districtMatch) continue
    const district_number = Number.parseInt(districtMatch[1]!, 10)
    if (!Number.isFinite(district_number)) continue

    const url = deriveAmDistrictUrl(district_number)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseCaAssemblymemberDetailHtml(html)

    if (parsed.capitol_office) {
      const parts = parseAddressText(parsed.capitol_office)
      if (parts) {
        out.push({
          official_openstates_person_id: am.openstates_person_id,
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
          official_openstates_person_id: am.openstates_person_id,
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
