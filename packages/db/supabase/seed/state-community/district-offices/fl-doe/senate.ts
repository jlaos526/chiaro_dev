import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { fetchPerMemberOffices, type ParsedMemberDetail } from '../_shared.ts'

export type ParsedFlSenatorDetail = ParsedMemberDetail

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
 * Parse a single FL Senator detail page.
 *
 * Audit-derived structure: <section class="capitol-office"> and
 * <section class="district-office"> with <p>-wrapped address text.
 * Mirrors slice 16 ca-leginfo + mi-legislature parser shape.
 */
export function parseFlSenatorDetailHtml(html: string): ParsedFlSenatorDetail {
  const $ = cheerio.load(html)
  const out: ParsedFlSenatorDetail = {}

  const capitolText = joinParagraphs($, 'section.capitol-office p')
  if (capitolText) out.capitol_office = capitolText

  const districtText = joinParagraphs($, 'section.district-office p')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchFlSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_senate',
    state: 'FL',
    deriveUrl: (l) => {
      if (!l.district_id) return null
      const m = l.district_id.match(/^FL-(\d+)$/)
      if (!m) return null
      const n = Number.parseInt(m[1]!, 10)
      if (!Number.isFinite(n)) return null
      return deriveFlSenatorUrl(n)
    },
    parseDetailHtml: parseFlSenatorDetailHtml,
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
  })
}
