import * as cheerio from 'cheerio'
import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../../shared.ts'
import { parseAddressText } from './assembly.ts'

const SENATOR_CONTACT_URL = (slug: string) =>
  `https://www.nysenate.gov/senators/${slug}/contact`
const FETCH_TIMEOUT_MS = 5000
const RATE_LIMIT_MS = 1000

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
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Parse a single senator's /contact page.
 *
 * Audit: HTML shape is loose — <h2>/<h3> headings labeled "Albany Office"
 * and "District Office" with <br>-separated text underneath. Use cheerio
 * heading-walk to extract each block's text.
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
 * Queries `officials` table for NY state-senate legislators, derives a
 * slug from each `full_name`, fetches the contact page with a 1-req/sec
 * courtesy throttle (skipped in test mode when opts.fetcher is provided).
 * Per-senator fetch failures are silently skipped (no log surface in v1).
 */
export async function fetchSenateOffices(
  client: Pick<Client, 'query'>,
  opts: { fetcher?: (url: string) => Promise<string> },
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{ openstates_person_id: string; full_name: string }>(
    `select openstates_person_id, full_name from public.officials
     where chamber = 'state_senate' and state = 'NY' and in_office = true`,
  )

  const out: NormalizedDistrictOffice[] = []

  for (const senator of res.rows) {
    const slug = deriveSenatorSlug(senator.full_name)
    const url = SENATOR_CONTACT_URL(slug)

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch {
      continue
    }

    const parsed = parseNySenatorContactHtml(html)

    if (parsed.albany_office) {
      const parts = parseAddressText(parsed.albany_office)
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
      // Production-path courtesy throttle (skipped in tests where fetcher is injected).
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}
