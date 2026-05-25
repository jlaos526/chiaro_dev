import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from '../_shared.ts'

const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

export interface ParsedFlRepDetail {
  capitol_office?: string
  district_office?: string
}

/**
 * Derive FL House Rep detail-page URL from MemberId.
 *
 * Per slice 12 audit: flhouse.gov/Sections/Representatives/details.aspx?MemberId={n}.
 * MemberId may NOT equal district number — implementer verifies at scaffold time.
 * If MemberId is opaque per district, fetch the index page first to extract
 * district → MemberId mapping (deferred to slice 18 if needed).
 *
 * v1: assume MemberId == district number. Production drift surfaces via
 * 0 parsed rows per rep (silent skip on 404 / unmatched selector).
 */
export function deriveFlRepUrl(member_id: number): string {
  return `https://www.flhouse.gov/Sections/Representatives/details.aspx?MemberId=${member_id}`
}

export function parseFlRepDetailHtml(html: string): ParsedFlRepDetail {
  const $ = cheerio.load(html)
  const out: ParsedFlRepDetail = {}

  const capitolText = $('section.capitol-office p').first().text().trim().replace(/\s+/g, ' ')
  if (capitolText) out.capitol_office = capitolText

  const districtText = $('section.district-office p').first().text().trim().replace(/\s+/g, ' ')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchFlHouseOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string; district_id: string | null }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = 'state_house' and state = 'FL' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const rep of res.rows) {
    if (!rep.district_id) continue
    const districtMatch = rep.district_id.match(/^FL-(\d+)$/)
    if (!districtMatch) continue
    const member_id = Number.parseInt(districtMatch[1]!, 10)
    if (!Number.isFinite(member_id)) continue

    const url = deriveFlRepUrl(member_id)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseFlRepDetailHtml(html)

    if (parsed.capitol_office) {
      const parts = parseAddressText(parsed.capitol_office)
      if (parts) {
        out.push({
          official_openstates_person_id: rep.openstates_person_id,
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
          official_openstates_person_id: rep.openstates_person_id,
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
