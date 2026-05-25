import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { resolveOpenstatesPersonId } from '../../../shared/officials.ts'

const SOURCE_URL = 'https://nyassembly.gov/mem/'
const FETCH_TIMEOUT_MS = 5000

export interface ParsedAssemblyMember {
  full_name: string
  district_no: string
  albany_office?: string   // raw address text
  district_office?: string
}

/**
 * Parse nyassembly.gov/mem/ — single-page directory of all 150 AMs.
 *
 * Audit-derived structure: each member appears as <div class="member-card">
 * with <h3 class="member-name">, <span class="district">District N</span>,
 * and address blocks. Implementer should fetch a real URL during scaffold
 * to verify selectors before relying on them.
 *
 * Skips cards where:
 *   - district number doesn't parse as a positive integer
 *   - both albany_office AND district_office are missing
 */
export function parseNyAssemblyDirectoryHtml(html: string): ParsedAssemblyMember[] {
  const $ = cheerio.load(html)
  const out: ParsedAssemblyMember[] = []

  $('div.member-card').each((_, el) => {
    const full_name = $(el).find('h3.member-name').text().trim()
    const districtText = $(el).find('span.district').text().trim()
    const districtMatch = districtText.match(/\b(\d+)\b/)
    const district_no = districtMatch ? districtMatch[1]! : ''

    const albany_office = $(el).find('.albany-address').text().trim() || undefined
    const district_office = $(el).find('.district-address').text().trim() || undefined

    if (!full_name || !district_no) return
    if (!albany_office && !district_office) return

    const member: ParsedAssemblyMember = { full_name, district_no }
    if (albany_office) member.albany_office = albany_office
    if (district_office) member.district_office = district_office
    out.push(member)
  })

  return out
}

/**
 * Best-effort regex parser for a raw address string.
 *
 * Input: "123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234"
 * Output: { street_1: "123 Main Street", city: "Buffalo", state: "NY",
 *           postal_code: "14201", phone: "(716) 555-1234" }
 *
 * Returns null if street_1 + city + state can't be extracted (required
 * NormalizedDistrictOffice fields).
 */
export function parseAddressText(raw: string): {
  street_1: string
  city: string
  state: string
  postal_code?: string
  phone?: string
} | null {
  // Extract phone (anything after "Phone:" or matching standard phone format)
  let phone: string | undefined
  const phoneMatch = raw.match(/\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/)
  if (phoneMatch) {
    phone = `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`
  }

  // Remove phone segment from address (split on "·" or "Phone:" markers)
  const addrPart = raw.split(/·|Phone:/i)[0]!.trim()

  // Split on commas; expect "Street, City, State Zip" format
  const segments = addrPart.split(',').map(s => s.trim()).filter(Boolean)
  if (segments.length < 3) return null

  const street_1 = segments[0]!
  const city = segments[segments.length - 2]!
  const stateZip = segments[segments.length - 1]!

  const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)?\s*$/)
  if (!stateZipMatch) return null
  const state = stateZipMatch[1]!
  const postal_code = stateZipMatch[2]

  const result: ReturnType<typeof parseAddressText> = { street_1, city, state }
  if (postal_code) result.postal_code = postal_code
  if (phone) result.phone = phone
  return result as { street_1: string; city: string; state: string; postal_code?: string; phone?: string }
}

export async function fetchAssemblyOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: () => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  let html: string
  try {
    html = opts.fetcher
      ? await opts.fetcher()
      : await (await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  } catch {
    return []
  }

  const parsed = parseNyAssemblyDirectoryHtml(html)
  const out: NormalizedDistrictOffice[] = []

  for (const m of parsed) {
    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: m.full_name,
      state: 'NY',
      chamber: 'state_house',
    })
    if (!openstates_person_id) continue

    if (m.albany_office) {
      const parts = parseAddressText(m.albany_office)
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
      }
    }
    if (m.district_office) {
      const parts = parseAddressText(m.district_office)
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
      }
    }
  }

  return out
}
