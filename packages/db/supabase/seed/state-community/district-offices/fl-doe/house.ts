import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { fetchPerMemberOffices, type ParsedMemberDetail } from '../_shared.ts'
import type { SkipReason } from '../../../shared/instrumentation.ts'

export type ParsedFlRepDetail = ParsedMemberDetail

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

export function parseFlRepDetailHtml(html: string): ParsedFlRepDetail {
  const $ = cheerio.load(html)
  const out: ParsedFlRepDetail = {}

  const capitolText = joinParagraphs($, 'section.capitol-office p')
  if (capitolText) out.capitol_office = capitolText

  const districtText = joinParagraphs($, 'section.district-office p')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchFlHouseOffices(
  client: Pick<Client, 'query'>,
  opts: {
    fetcher?: (url: string) => Promise<string>
    onSkip?: (reason: SkipReason) => void
  },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_house',
    state: 'FL',
    adapter: 'fl-doe',
    deriveUrl: (l) => {
      if (!l.district_id) return null
      const m = l.district_id.match(/^FL-(\d+)$/)
      if (!m) return null
      const n = Number.parseInt(m[1]!, 10)
      if (!Number.isFinite(n)) return null
      return deriveFlRepUrl(n)
    },
    parseDetailHtml: parseFlRepDetailHtml,
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
    ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),
  })
}
