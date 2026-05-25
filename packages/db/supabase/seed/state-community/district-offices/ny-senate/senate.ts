import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { fetchPerMemberOffices } from '../_shared.ts'

const SENATOR_CONTACT_URL = (slug: string) =>
  `https://www.nysenate.gov/senators/${slug}/contact`

export interface ParsedSenatorContact {
  albany_office?: string
  district_office?: string
}

/**
 * Derive a URL slug from a senator's full_name.
 *
 * Heuristic: lowercase + replace whitespace with '-' + strip non-alphanumeric.
 * Per slice 12 audit, the URL pattern is /senators/{slug}/contact. Real
 * senator slugs MAY differ for senators with non-standard names — implementer
 * verifies with 2-3 real URLs during scaffold + production parser logs
 * per-senator fetch failures to `stats.errors` for operator triage.
 */
export function deriveSenatorSlug(full_name: string): string {
  return full_name
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Parse a single senator's /contact page.
 *
 * Audit: HTML shape is loose — <h2>/<h3> headings labeled "Albany Office"
 * and "District Office" with <br>-separated text underneath. Use cheerio
 * heading-walk to extract each block's text. The <br>-aware extraction
 * (slice 15) is the distinguishing trait vs the slice 16/17 cheerio
 * <p>-walk parsers; keep it intact here.
 */
export function parseNySenatorContactHtml(html: string): ParsedSenatorContact {
  const $ = cheerio.load(html)
  const out: ParsedSenatorContact = {}

  $('h2, h3, h4').each((_, headingEl) => {
    const headingText = $(headingEl).text().trim()
    if (headingText !== 'Albany Office' && headingText !== 'District Office') return

    // Walk forward to the next address-block element (or until next heading)
    let next = $(headingEl).next()
    while (next.length && !next.is('h2, h3, h4')) {
      // Convert <br> tags to newlines BEFORE extracting text so multi-line
      // address blocks segment correctly.
      const htmlWithNewlines = ($.html(next) ?? '').replace(/<br\s*\/?>/gi, '\n')
      const lines = cheerio
        .load(htmlWithNewlines)
        .root()
        .text()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
      // Drop the leading "Senator <name>" line if present (it's not part of the address).
      const addressLines = lines[0]?.startsWith('Senator ')
        ? lines.slice(1)
        : lines
      const blockText = addressLines.join(', ')
      if (blockText) {
        if (headingText === 'Albany Office' && !out.albany_office) {
          out.albany_office = blockText
        } else if (headingText === 'District Office' && !out.district_office) {
          out.district_office = blockText
        }
        break
      }
      next = next.next()
    }
  })

  return out
}

/**
 * Fetch + parse all NY senators' contact pages.
 *
 * Per-senator URL slug derived from full_name; collapses through the
 * shared fetchPerMemberOffices loop. The slice 15 <br>-aware
 * parseNySenatorContactHtml is preserved as the parseDetailHtml
 * callback (re-mapping `albany_office` → canonical `capitol_office`).
 */
export async function fetchSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  return fetchPerMemberOffices(client, {
    chamber: 'state_senate',
    state: 'NY',
    deriveUrl: (l) => SENATOR_CONTACT_URL(deriveSenatorSlug(l.full_name)),
    parseDetailHtml: (html) => {
      const parsed = parseNySenatorContactHtml(html)
      // Remap NY-local key (albany_office) → canonical (capitol_office).
      return {
        ...(parsed.albany_office ? { capitol_office: parsed.albany_office } : {}),
        ...(parsed.district_office ? { district_office: parsed.district_office } : {}),
      }
    },
    ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
  })
}
