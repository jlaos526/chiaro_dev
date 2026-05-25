import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { fetchPerMemberOffices, type ParsedMemberDetail } from '../_shared.ts'
import type { SkipReason } from '../../../shared/instrumentation.ts'

export type ParsedCaAssemblymember = ParsedMemberDetail

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
 * Extract all <p> text children of a section, joining with ", ".
 * Replaces `.first()` pattern that silently drops multi-paragraph
 * addresses (audit Bug 3 fix).
 */
function joinParagraphs($: cheerio.CheerioAPI, selector: string): string | undefined {
  const paras: string[] = []
  $(selector).each((_, p) => {
    const t = $(p).text().trim().replace(/\s+/g, ' ')
    if (t) paras.push(t)
  })
  return paras.length > 0 ? paras.join(', ') : undefined
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

  const capitolText = joinParagraphs($, 'section.capitol-office p')
  if (capitolText) out.capitol_office = capitolText

  const districtText = joinParagraphs($, 'section.district-office p')
  if (districtText) out.district_office = districtText

  return out
}

/**
 * Fetch + parse all CA Assemblymember detail pages.
 *
 * Per-AM URL derived from district_id (format "CA-14" → 14). Skipped
 * when district_id is missing or unparseable. Per-AM fetch failures
 * silently skip; per-AM URL-pattern mismatches yield 0 parsed rows
 * for that AM.
 */
export async function fetchCaAssemblyOffices(
  client: Pick<Client, 'query'>,
  opts: {
    fetcher?: (url: string) => Promise<string>
    onSkip?: (reason: SkipReason) => void
  },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_house',
    state: 'CA',
    adapter: 'ca-leginfo',
    deriveUrl: (l) => {
      if (!l.district_id) return null
      const m = l.district_id.match(/^CA-(\d+)$/)
      if (!m) return null
      const n = Number.parseInt(m[1]!, 10)
      if (!Number.isFinite(n)) return null
      return deriveAmDistrictUrl(n)
    },
    parseDetailHtml: parseCaAssemblymemberDetailHtml,
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
    ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),
  })
}
