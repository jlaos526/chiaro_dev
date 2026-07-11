import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { resolveOpenstatesPersonId } from '../../../shared/officials.ts'
import { parseAddressText } from '../_shared.ts'
import type { SkipReason } from '../../../shared/instrumentation.ts'

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

export async function fetchAssemblyOffices(
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
      adapter: 'ny-senate',
      stage: 'fetch',
      reason: 'directory fetch threw',
      detail: e instanceof Error ? e.message : String(e),
    })
    return []
  }

  const parsed = parseNyAssemblyDirectoryHtml(html)
  const out: NormalizedDistrictOffice[] = []

  for (const m of parsed) {
    const openstates_person_id = await resolveOpenstatesPersonId(client, {
      full_name: m.full_name,
      state: 'NY',
      chamber: 'state_house',
      onAmbiguous: () => opts.onSkip?.({
        adapter: 'ny-senate',
        stage: 'resolve_ambiguous',
        legislator: m.full_name,
        reason: 'ambiguous full_name match (2+ in-office officials)',
      }),
    })
    if (!openstates_person_id) {
      opts.onSkip?.({
        adapter: 'ny-senate',
        stage: 'resolve',
        legislator: m.full_name,
        reason: 'unmatched in officials table (state_house)',
      })
      continue
    }

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
      } else {
        opts.onSkip?.({
          adapter: 'ny-senate',
          stage: 'parse',
          legislator: m.full_name,
          reason: 'parseAddressText returned null for albany office',
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
      } else {
        opts.onSkip?.({
          adapter: 'ny-senate',
          stage: 'parse',
          legislator: m.full_name,
          reason: 'parseAddressText returned null for district office',
        })
      }
    }
  }

  return out
}
