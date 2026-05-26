#!/usr/bin/env tsx
import { Client } from 'pg'
import { createSkipCollector, formatSkipSummary } from './shared/instrumentation.ts'
import { FD_ADAPTERS } from './federal-disclosures/fd/index.ts'
import type {
  FdAdapter,
  NormalizedDisclosureOther,
  NormalizedHolding,
} from './federal-disclosures/shared/types.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export type Chamber = 'house' | 'senate' | 'all'

export interface IngestFederalFdsOpts {
  /** Years to ingest. Defaults to [currentYear, currentYear - 1]. */
  years?:      number[]
  /** Chamber filter; 'all' includes both adapters. */
  chamber?:    Chamber
  /** Slice 22 instrumentation: print skip summary to stdout when true. */
  instrument?: boolean
  /** Dry-run: skip DB writes; log intended row count. */
  noApply?:    boolean
  /** Override FD adapters (testing hook). */
  adapters?:   FdAdapter[]
  /** Injected pg client (testing hook). */
  client?:     Client
}

export interface IngestFederalFdsStats {
  years:                number[]
  chamber:              Chamber
  holdingsFetched:      number
  holdingsInserted:     number
  otherFetched:         number
  otherInserted:        number
  officialsMatched:     number
  officialsUnmatched:   string[]
  errors:               string[]
  /** Slice 22 skip summary text (always present; "No skips recorded." when none). */
  skipSummary:          string
}

/**
 * Filter FD_ADAPTERS by --chamber CLI flag.
 *   --chamber=house  → slug.startsWith('house-')
 *   --chamber=senate → slug.startsWith('senate-')
 *   --chamber=all    → all adapters
 */
function filterAdaptersByChamber(adapters: FdAdapter[], chamber: Chamber): FdAdapter[] {
  if (chamber === 'all') return adapters
  const prefix = `${chamber}-`
  return adapters.filter(a => a.slug.startsWith(prefix))
}

/**
 * Default years window: current year + 1 prior. Annual FDs are filed
 * once per calendar year; House ZIPs are published per-year; Senate
 * report filter accepts year.
 */
function defaultYears(): number[] {
  const cur = new Date().getUTCFullYear()
  return [cur, cur - 1]
}

/**
 * Resolve a normalized FD row to officials.id. Tries bioguide_id map
 * first (one query up-front); falls back to name+chamber resolve when
 * the adapter row carries only full_name.
 *
 * Returns null when neither resolves — caller logs to officialsUnmatched.
 */
async function resolveOfficialIdForFd(
  client: Client,
  row: { official_bioguide_id?: string; official_full_name?: string },
  bioguideMap: Map<string, string>,
  adapterSlug: FdAdapter['slug'],
): Promise<string | null> {
  if (row.official_bioguide_id) {
    const id = bioguideMap.get(row.official_bioguide_id)
    if (id) return id
  }
  if (row.official_full_name) {
    const chamber = adapterSlug === 'house-efd-fd' ? 'federal_house' : 'federal_senate'
    const res = await client.query<{ id: string }>(
      `select id from public.officials
       where lower(full_name) = lower($1) and chamber = $2 and in_office = true
       limit 1`,
      [row.official_full_name, chamber],
    )
    if (res.rows[0]) return res.rows[0].id
  }
  return null
}

export async function ingestFederalFds(
  opts: IngestFederalFdsOpts = {},
): Promise<IngestFederalFdsStats> {
  const years   = opts.years   ?? defaultYears()
  const chamber = opts.chamber ?? 'all'
  const adapters = filterAdaptersByChamber(opts.adapters ?? FD_ADAPTERS, chamber)

  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const collector = createSkipCollector()
  const stats: IngestFederalFdsStats = {
    years,
    chamber,
    holdingsFetched:    0,
    holdingsInserted:   0,
    otherFetched:       0,
    otherInserted:      0,
    officialsMatched:   0,
    officialsUnmatched: [],
    errors:             [],
    skipSummary:        '',
  }

  try {
    // One-shot bioguide_id → officials.id map (mirrors PTR + stock-watcher pattern).
    const off = await client.query<{ id: string; bioguide_id: string | null }>(
      'select id, bioguide_id from public.officials where bioguide_id is not null',
    )
    const bioguideMap = new Map<string, string>()
    for (const r of off.rows) {
      if (r.bioguide_id) bioguideMap.set(r.bioguide_id, r.id)
    }

    for (const year of years) {
      for (const adapter of adapters) {
        let result: { holdings: NormalizedHolding[]; other: NormalizedDisclosureOther[] } =
          { holdings: [], other: [] }
        try {
          result = await adapter.fetchDisclosures({ year, onSkip: collector.onSkip })
        } catch (err) {
          stats.errors.push(`${adapter.slug} year=${year}: ${(err as Error).message}`)
          continue
        }
        stats.holdingsFetched += result.holdings.length
        stats.otherFetched    += result.other.length

        // Process holdings → federal_holdings
        for (const row of result.holdings) {
          let officialId: string | null = null
          try {
            officialId = await resolveOfficialIdForFd(client, row, bioguideMap, adapter.slug)
          } catch (err) {
            stats.errors.push(`${adapter.slug} resolve ${row.external_id}: ${(err as Error).message}`)
            continue
          }
          if (!officialId) {
            const id = row.official_bioguide_id ?? row.official_full_name ?? row.external_id
            stats.officialsUnmatched.push(id)
            const legislator = row.official_full_name ?? row.official_bioguide_id
            collector.onSkip({
              adapter: adapter.slug,
              stage:   'resolve',
              reason:  `unmatched legislator for ${row.external_id}`,
              ...(legislator ? { legislator } : {}),
            })
            continue
          }

          stats.officialsMatched += 1
          if (opts.noApply) continue

          try {
            await client.query(
              `insert into public.federal_holdings (
                official_id, filing_year, source, external_id, source_url,
                asset_name, asset_ticker, asset_type,
                value_min, value_max, income_type, income_min, income_max
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              on conflict (source, external_id) where external_id is not null do update set
                official_id  = excluded.official_id,
                filing_year  = excluded.filing_year,
                source_url   = excluded.source_url,
                asset_name   = excluded.asset_name,
                asset_ticker = excluded.asset_ticker,
                asset_type   = excluded.asset_type,
                value_min    = excluded.value_min,
                value_max    = excluded.value_max,
                income_type  = excluded.income_type,
                income_min   = excluded.income_min,
                income_max   = excluded.income_max`,
              [
                officialId,
                row.filing_year,
                adapter.slug,
                row.external_id,
                row.source_url,
                row.asset_name    ?? null,
                row.asset_ticker  ?? null,
                row.asset_type    ?? null,
                row.value_min     ?? null,
                row.value_max     ?? null,
                row.income_type   ?? null,
                row.income_min    ?? null,
                row.income_max    ?? null,
              ],
            )
            stats.holdingsInserted += 1
          } catch (err) {
            stats.errors.push(`${adapter.slug} insert holding ${row.external_id}: ${(err as Error).message}`)
          }
        }

        // Process other → federal_disclosure_other
        for (const row of result.other) {
          let officialId: string | null = null
          try {
            officialId = await resolveOfficialIdForFd(client, row, bioguideMap, adapter.slug)
          } catch (err) {
            stats.errors.push(`${adapter.slug} resolve ${row.external_id}: ${(err as Error).message}`)
            continue
          }
          if (!officialId) {
            const id = row.official_bioguide_id ?? row.official_full_name ?? row.external_id
            stats.officialsUnmatched.push(id)
            const legislator = row.official_full_name ?? row.official_bioguide_id
            collector.onSkip({
              adapter: adapter.slug,
              stage:   'resolve',
              reason:  `unmatched legislator for ${row.external_id}`,
              ...(legislator ? { legislator } : {}),
            })
            continue
          }

          stats.officialsMatched += 1
          if (opts.noApply) continue

          try {
            await client.query(
              `insert into public.federal_disclosure_other (
                official_id, filing_year, source, external_id, source_url,
                category, description, source_party,
                value_min, value_max, value_text
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              on conflict (source, external_id) where external_id is not null do update set
                official_id  = excluded.official_id,
                filing_year  = excluded.filing_year,
                source_url   = excluded.source_url,
                category     = excluded.category,
                description  = excluded.description,
                source_party = excluded.source_party,
                value_min    = excluded.value_min,
                value_max    = excluded.value_max,
                value_text   = excluded.value_text`,
              [
                officialId,
                row.filing_year,
                adapter.slug,
                row.external_id,
                row.source_url,
                row.category,
                row.description  ?? null,
                row.source_party ?? null,
                row.value_min    ?? null,
                row.value_max    ?? null,
                row.value_text   ?? null,
              ],
            )
            stats.otherInserted += 1
          } catch (err) {
            stats.errors.push(`${adapter.slug} insert other ${row.external_id}: ${(err as Error).message}`)
          }
        }
      }
    }
  } finally {
    if (ownsClient) await client.end().catch(() => {})
  }

  stats.skipSummary = formatSkipSummary(collector.summary())
  return stats
}

interface ParsedCli {
  years?:      number[]
  chamber:     Chamber
  instrument:  boolean
  noApply:     boolean
}

function parseArgs(argv: readonly string[]): ParsedCli {
  let chamber: Chamber = 'all'
  let years: number[] | undefined
  let instrument = false
  let noApply = false

  for (const arg of argv) {
    if (arg === '--instrument') instrument = true
    else if (arg === '--no-apply') noApply = true
    else if (arg.startsWith('--chamber=')) {
      const v = arg.slice('--chamber='.length)
      if (v === 'house' || v === 'senate' || v === 'all') chamber = v
      else throw new Error(`invalid --chamber=${v}; expected house|senate|all`)
    } else if (arg.startsWith('--year=')) {
      const v = Number(arg.slice('--year='.length))
      if (!Number.isInteger(v) || v < 2000 || v > 2100) {
        throw new Error(`invalid --year=${arg.slice('--year='.length)}`)
      }
      years = [v]
    }
  }
  const out: ParsedCli = { chamber, instrument, noApply }
  if (years) out.years = years
  return out
}

// CLI entrypoint
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  let cli: ParsedCli
  try {
    cli = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error((err as Error).message)
    console.error('usage: tsx federal-fds-ingest.ts [--year=YYYY] [--chamber=house|senate|all] [--instrument] [--no-apply]')
    process.exit(2)
  }

  const ingestOpts: IngestFederalFdsOpts = {
    chamber:    cli.chamber,
    instrument: cli.instrument,
    noApply:    cli.noApply,
  }
  if (cli.years) ingestOpts.years = cli.years

  ingestFederalFds(ingestOpts)
    .then(stats => {
      console.log(`Federal FD ingest summary:`)
      console.log(`  years:                ${stats.years.join(', ')}`)
      console.log(`  chamber:              ${stats.chamber}`)
      console.log(`  holdings fetched:     ${stats.holdingsFetched}`)
      console.log(`  holdings inserted:    ${stats.holdingsInserted}${cli.noApply ? ' (no-apply: not written)' : ''}`)
      console.log(`  other fetched:        ${stats.otherFetched}`)
      console.log(`  other inserted:       ${stats.otherInserted}${cli.noApply ? ' (no-apply: not written)' : ''}`)
      console.log(`  officials matched:    ${stats.officialsMatched}`)
      console.log(`  officials unmatched:  ${stats.officialsUnmatched.length}`)
      console.log(`  errors:               ${stats.errors.length}`)
      if (stats.errors.length > 0) {
        for (const err of stats.errors.slice(0, 5)) console.log(`    - ${err}`)
      }
      if (cli.instrument) {
        console.log('')
        console.log(stats.skipSummary)
      }
      process.exit(stats.errors.length === 0 ? 0 : 1)
    })
    .catch(err => { console.error((err as Error).message); process.exit(1) })
}
