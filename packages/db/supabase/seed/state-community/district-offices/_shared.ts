import type { Client } from 'pg'
import type { NormalizedDistrictOffice } from '../shared.ts'
import type { SkipReason } from '../../shared/instrumentation.ts'

/**
 * Fetch-timeout for per-member detail-page HTTP requests in the
 * production path. 5s aligns with slice 15/16/17 per-parser constants
 * that were hoisted in slice 18 Task 5 (audit M4).
 */
export const FETCH_TIMEOUT_MS = 5000

/**
 * Per-member courtesy throttle between detail-page fetches. 1 req/sec
 * matches the friendly-scrape convention established in slice 15.
 * Skipped (a) in test mode when `opts.fetcher` is injected and
 * (b) after the last iteration of the loop (audit M5 fix; saves
 * ~1s per orchestrator run).
 */
export const RATE_LIMIT_MS = 1000

/**
 * Common shape returned by `parseDetailHtml` callbacks. Captures the
 * two address blocks that every per-chamber detail page exposes
 * (capitol-office + district-office), as raw multi-paragraph-joined
 * strings ready for `parseAddressText`. Some chambers carry their own
 * heading labels ("Lansing Office" in MI, "Albany Office" in NY) — the
 * per-chamber parser re-maps to this canonical pair.
 */
export interface ParsedMemberDetail {
  capitol_office?: string
  district_office?: string
}

export interface PerMemberOfficesOpts {
  chamber: 'state_house' | 'state_senate'
  state: string
  /**
   * Adapter slug for skip-reason attribution (slice 22). Each caller
   * passes its own canonical slug (e.g. 'mi-legislature', 'fl-doe').
   * Used as `reason.adapter` on every onSkip emission so a
   * SkipCollector can group skips per adapter.
   */
  adapter: string
  /**
   * Build the per-member detail-page URL from the legislator row.
   * Return null to skip this legislator (e.g. missing district_id,
   * malformed name, no derivable URL).
   */
  deriveUrl: (legislator: {
    full_name: string
    district_id: string | null
    openstates_person_id: string
  }) => string | null
  /**
   * Parse a single detail page into capitol + district address blocks.
   * Implementations should use the multi-paragraph join pattern
   * (audit Bug 3 fix) — `.first()` selectors silently drop data.
   */
  parseDetailHtml: (html: string) => ParsedMemberDetail
  /**
   * Optional page fetcher for test injection. Production path uses
   * native fetch + 1-req/sec throttle (skipped when fetcher injected).
   */
  fetcher?: (url: string) => Promise<string>
  /**
   * Optional skip-reason collector (slice 22). When passed, called at
   * each silent-continue site with a SkipReason record. When omitted,
   * silent-skip behavior is preserved (back-compat).
   */
  onSkip?: (reason: SkipReason) => void
}

/**
 * Generic per-member offices fetch loop. Shared by 5 per-chamber
 * parsers (slice 16 ca-leginfo/assembly + mi-legislature/{senate,house},
 * slice 17 fl-doe/{senate,house}) plus slice 15 ny-senate/senate via
 * a re-mapping parseDetailHtml callback.
 *
 * Queries `officials` for the (chamber, state) cohort, derives each
 * legislator's profile URL via the caller-supplied deriveUrl callback,
 * fetches with 1-req/sec courtesy throttle (skipped when opts.fetcher
 * is injected), parses via the caller-supplied parseDetailHtml, and
 * emits NormalizedDistrictOffice rows via emitOfficeRow.
 *
 * Throttle skipped after the last iteration (audit M5 fix; saves
 * ~1s per run for the last legislator in each chamber cohort).
 *
 * Replaces ~240 lines of duplicated per-chamber boilerplate.
 */
export async function fetchPerMemberOffices(
  client: Pick<Client, 'query'>,
  opts: PerMemberOfficesOpts,
): Promise<NormalizedDistrictOffice[]> {
  const res = await client.query<{
    openstates_person_id: string
    full_name: string
    district_id: string | null
  }>(
    `select openstates_person_id, full_name, district_id from public.officials
     where chamber = $1 and state = $2 and in_office = true`,
    [opts.chamber, opts.state],
  )

  const out: NormalizedDistrictOffice[] = []
  const rows = res.rows
  const totalRows = rows.length

  for (let i = 0; i < totalRows; i += 1) {
    const legislator = rows[i]!
    // Tolerate mock rows that omit district_id by coercing undefined → null.
    const normalized = {
      full_name: legislator.full_name,
      openstates_person_id: legislator.openstates_person_id,
      district_id: legislator.district_id ?? null,
    }
    const url = opts.deriveUrl(normalized)
    if (!url) {
      opts.onSkip?.({
        adapter: opts.adapter,
        stage: 'derive_url',
        legislator: legislator.full_name,
        reason: 'deriveUrl returned null (e.g. missing district_id or unparseable name)',
      })
      continue
    }

    let html: string
    try {
      html = opts.fetcher
        ? await opts.fetcher(url)
        : await (await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
    } catch (e) {
      opts.onSkip?.({
        adapter: opts.adapter,
        stage: 'fetch',
        legislator: legislator.full_name,
        reason: 'fetch threw',
        detail: e instanceof Error ? e.message : String(e),
      })
      continue
    }

    const parsed = opts.parseDetailHtml(html)
    const hadCapitol = Boolean(parsed.capitol_office)
    const hadDistrict = Boolean(parsed.district_office)
    if (!hadCapitol && !hadDistrict) {
      opts.onSkip?.({
        adapter: opts.adapter,
        stage: 'parse',
        legislator: legislator.full_name,
        reason: 'parseDetailHtml returned no addresses',
      })
      // No continue — each capitol/district half evaluates independently
      // below (both are absent here so neither will emit a row), but we
      // still want to fall through to the throttle gate.
    }

    if (parsed.capitol_office) {
      const row = emitOfficeRow(parsed.capitol_office, {
        openstates_person_id: legislator.openstates_person_id,
        kind: 'capitol',
        source_url: url,
      })
      if (row) {
        out.push(row)
      } else {
        opts.onSkip?.({
          adapter: opts.adapter,
          stage: 'parse',
          legislator: legislator.full_name,
          reason: 'parseAddressText returned null for capitol office',
        })
      }
    }
    if (parsed.district_office) {
      const row = emitOfficeRow(parsed.district_office, {
        openstates_person_id: legislator.openstates_person_id,
        kind: 'district',
        source_url: url,
      })
      if (row) {
        out.push(row)
      } else {
        opts.onSkip?.({
          adapter: opts.adapter,
          stage: 'parse',
          legislator: legislator.full_name,
          reason: 'parseAddressText returned null for district office',
        })
      }
    }

    // Audit M5: skip throttle after last iteration (saves ~1s/run).
    if (!opts.fetcher && i < totalRows - 1) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS))
    }
  }

  return out
}

/**
 * Build a NormalizedDistrictOffice row from a raw address string via
 * parseAddressText. Returns null if the address can't be parsed
 * (missing street_1, city, or state).
 */
export function emitOfficeRow(
  raw: string,
  opts: {
    openstates_person_id: string
    kind: 'capitol' | 'district'
    source_url: string
  },
): NormalizedDistrictOffice | null {
  const parts = parseAddressText(raw)
  if (!parts) return null
  const row: NormalizedDistrictOffice = {
    official_openstates_person_id: opts.openstates_person_id,
    kind: opts.kind,
    street_1: parts.street_1,
    city: parts.city,
    state: parts.state,
    source_url: opts.source_url,
  }
  if (parts.postal_code) row.postal_code = parts.postal_code
  if (parts.phone) row.phone = parts.phone
  return row
}

/**
 * Best-effort regex parser for a raw US legislator-office address string.
 *
 * Input: "123 Main Street, Buffalo, NY 14201 · Phone: (716) 555-1234"
 * Output: { street_1: "123 Main Street", city: "Buffalo", state: "NY",
 *           postal_code: "14201", phone: "(716) 555-1234" }
 *
 * Returns null if street_1 + city + state can't be extracted (required
 * NormalizedDistrictOffice fields).
 *
 * Hoisted from slice 15 ny-senate/assembly.ts in slice 16 — needed by
 * 5 callers (NY assembly + senate, CA senate + assembly, MI senate +
 * house = 6 total). Slice 15 callers (ny-senate/{assembly,senate}.ts)
 * re-import from this canonical location.
 *
 * Underscore prefix on filename signals package-internal helper.
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
  const segments = addrPart
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (segments.length < 3) return null

  const street_1 = segments[0]!
  const city = segments[segments.length - 2]!
  const stateZip = segments[segments.length - 1]!

  const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)?\s*$/)
  if (!stateZipMatch) return null
  const state = stateZipMatch[1]!
  const postal_code = stateZipMatch[2]

  const result: {
    street_1: string
    city: string
    state: string
    postal_code?: string
    phone?: string
  } = {
    street_1,
    city,
    state,
  }
  if (postal_code) result.postal_code = postal_code
  if (phone) result.phone = phone
  return result
}
