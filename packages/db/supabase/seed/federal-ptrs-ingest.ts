#!/usr/bin/env tsx
import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'
import { createSkipCollector, formatSkipSummary } from './shared/instrumentation.ts'
import { PTR_ADAPTERS } from './federal-disclosures/ptr/index.ts'
import type { PtrAdapter, NormalizedPtr } from './federal-disclosures/shared/types.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export type Chamber = 'house' | 'senate' | 'all'

export interface IngestFederalPtrsOpts {
  /** Years to ingest. Defaults to [currentYear, currentYear - 1]. */
  years?:      number[]
  /** Chamber filter; 'all' includes both adapters. */
  chamber?:    Chamber
  /** Slice 22 instrumentation: print skip summary to stdout when true. */
  instrument?: boolean
  /** Dry-run: skip DB writes; log intended row count. */
  noApply?:    boolean
  /** Override PTR adapters (testing hook). */
  adapters?:   PtrAdapter[]
  /** Injected pg client (testing hook). */
  client?:     Client
}

export interface IngestFederalPtrsStats {
  years:              number[]
  chamber:            Chamber
  rowsFetched:        number
  rowsInserted:       number
  officialsMatched:   number
  officialsUnmatched: string[]
  errors:             string[]
  /** Slice 22 skip summary text (always present; "No skips recorded." when none). */
  skipSummary:        string
}

/**
 * Filter PTR_ADAPTERS by --chamber CLI flag.
 *   --chamber=house  → slug.startsWith('house-')
 *   --chamber=senate → slug.startsWith('senate-')
 *   --chamber=all    → all adapters
 */
function filterAdaptersByChamber(adapters: PtrAdapter[], chamber: Chamber): PtrAdapter[] {
  if (chamber === 'all') return adapters
  const prefix = `${chamber}-`
  return adapters.filter(a => a.slug.startsWith(prefix))
}

/**
 * Default years window: current year + 1 prior. PTR cycles are calendar-year
 * indexed; House ZIPs are published per-year; Senate report filter accepts year.
 */
function defaultYears(): number[] {
  const cur = new Date().getUTCFullYear()
  return [cur, cur - 1]
}

/**
 * Resolve a NormalizedPtr to officials.id. Tries bioguide_id map first
 * (one query up-front); falls back to resolveOfficialByName when the
 * adapter row carries only full_name.
 *
 * Returns null when neither resolves — caller logs to officialsUnmatched.
 */
async function resolveOfficialIdForPtr(
  client: Client,
  row: NormalizedPtr,
  bioguideMap: Map<string, string>,
  adapterSlug: PtrAdapter['slug'],
): Promise<string | null> {
  if (row.official_bioguide_id) {
    const id = bioguideMap.get(row.official_bioguide_id)
    if (id) return id
  }
  if (row.official_full_name) {
    const chamber = adapterSlug === 'house-efd-ptr' ? 'federal_house' : 'federal_senate'
    // No `state` available from NormalizedPtr; resolveOfficialByName expects
    // state — use a NULL-safe query path here directly to avoid forcing a
    // bogus state through. Mirrors stock-watcher-ingest.ts:38 lookup but by name.
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

export async function ingestFederalPtrs(
  opts: IngestFederalPtrsOpts = {},
): Promise<IngestFederalPtrsStats> {
  const years   = opts.years   ?? defaultYears()
  const chamber = opts.chamber ?? 'all'
  const adapters = filterAdaptersByChamber(opts.adapters ?? PTR_ADAPTERS, chamber)

  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const collector = createSkipCollector()
  const stats: IngestFederalPtrsStats = {
    years,
    chamber,
    rowsFetched:        0,
    rowsInserted:       0,
    officialsMatched:   0,
    officialsUnmatched: [],
    errors:             [],
    skipSummary:        '',
  }

  try {
    // One-shot bioguide_id → officials.id map (mirrors stock-watcher-ingest.ts pattern).
    const off = await client.query<{ id: string; bioguide_id: string | null }>(
      'select id, bioguide_id from public.officials where bioguide_id is not null',
    )
    const bioguideMap = new Map<string, string>()
    for (const r of off.rows) {
      if (r.bioguide_id) bioguideMap.set(r.bioguide_id, r.id)
    }

    for (const year of years) {
      for (const adapter of adapters) {
        let rows: NormalizedPtr[] = []
        try {
          rows = await adapter.fetchTransactions({ year, onSkip: collector.onSkip })
        } catch (err) {
          stats.errors.push(`${adapter.slug} year=${year}: ${(err as Error).message}`)
          continue
        }
        stats.rowsFetched += rows.length

        for (const row of rows) {
          let officialId: string | null = null
          try {
            officialId = await resolveOfficialIdForPtr(client, row, bioguideMap, adapter.slug)
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
              `insert into public.stock_transactions (
                official_id, transaction_date, filing_date, asset_ticker, asset_name,
                transaction_type, amount_range_low, amount_range_high, source_url,
                source, external_id
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              on conflict (source, external_id) do update set
                official_id        = excluded.official_id,
                transaction_date   = excluded.transaction_date,
                filing_date        = excluded.filing_date,
                asset_ticker       = excluded.asset_ticker,
                asset_name         = excluded.asset_name,
                transaction_type   = excluded.transaction_type,
                amount_range_low   = excluded.amount_range_low,
                amount_range_high  = excluded.amount_range_high,
                source_url         = excluded.source_url`,
              [
                officialId,
                row.transaction_date,
                row.filing_date,
                row.asset_ticker  ?? null,
                row.asset_name    ?? null,
                row.transaction_type,
                row.amount_range_low  ?? null,
                row.amount_range_high ?? null,
                row.source_url,
                adapter.slug,
                row.external_id,
              ],
            )
            stats.rowsInserted += 1
          } catch (err) {
            stats.errors.push(`${adapter.slug} insert ${row.external_id}: ${(err as Error).message}`)
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
if (isCliEntry(import.meta.url)) {
  let cli: ParsedCli
  try {
    cli = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error((err as Error).message)
    console.error('usage: tsx federal-ptrs-ingest.ts [--year=YYYY] [--chamber=house|senate|all] [--instrument] [--no-apply]')
    process.exit(2)
  }

  const ingestOpts: IngestFederalPtrsOpts = {
    chamber:    cli.chamber,
    instrument: cli.instrument,
    noApply:    cli.noApply,
  }
  if (cli.years) ingestOpts.years = cli.years

  ingestFederalPtrs(ingestOpts)
    .then(stats => {
      console.log(`Federal PTR ingest summary:`)
      console.log(`  years:               ${stats.years.join(', ')}`)
      console.log(`  chamber:             ${stats.chamber}`)
      console.log(`  rows fetched:        ${stats.rowsFetched}`)
      console.log(`  rows inserted:       ${stats.rowsInserted}${cli.noApply ? ' (no-apply: not written)' : ''}`)
      console.log(`  officials matched:   ${stats.officialsMatched}`)
      console.log(`  officials unmatched: ${stats.officialsUnmatched.length}`)
      console.log(`  errors:              ${stats.errors.length}`)
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
