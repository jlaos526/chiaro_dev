import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { fetchPerMemberOffices } from '../_shared.ts'
import type { SkipReason } from '../../../shared/instrumentation.ts'

export interface ParsedMiRepProfile {
  lansing_office?: string
  district_office?: string
}

/**
 * Derive a representative profile URL from a full_name.
 *
 * Per slice 12 audit: house.mi.gov/representative-{slug} where slug
 * is lowercase firstname-lastname. Audit flagged TLS-handshake flake
 * risk on house.mi.gov — production fetch failures land in the
 * try/catch silent-skip path.
 */
export function deriveMiRepUrl(full_name: string): string {
  const slug = full_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return `https://house.mi.gov/representative-${slug}`
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

export function parseMiRepProfileHtml(html: string): ParsedMiRepProfile {
  const $ = cheerio.load(html)
  const out: ParsedMiRepProfile = {}

  const lansingText = joinParagraphs($, 'section.lansing-office p')
  if (lansingText) out.lansing_office = lansingText

  const districtText = joinParagraphs($, 'section.district-office p')
  if (districtText) out.district_office = districtText

  return out
}

export async function fetchMiHouseOffices(
  client: Pick<Client, 'query'>,
  opts: {
    fetcher?: (url: string) => Promise<string>
    onSkip?: (reason: SkipReason) => void
  },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_house',
    state: 'MI',
    adapter: 'mi-legislature',
    deriveUrl: (l) => deriveMiRepUrl(l.full_name),
    parseDetailHtml: (html) => {
      const parsed = parseMiRepProfileHtml(html)
      // Remap MI-local key (lansing_office) → canonical (capitol_office).
      return {
        ...(parsed.lansing_office ? { capitol_office: parsed.lansing_office } : {}),
        ...(parsed.district_office ? { district_office: parsed.district_office } : {}),
      }
    },
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
    ...(opts.onSkip ? { onSkip: opts.onSkip } : {}),
  })
}
