import { Client } from 'pg'
import {
  fetchAndNormalizeFederal,
  type FederalTownHallRow,
} from './federal-community/town-halls/mobilize.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export interface FederalMobilizeStats {
  rowsUpserted: number
  officialsMatched: number
  officialsUnmatched: string[]
  errors: string[]
}

export interface IngestFederalTownHallsMobilizeOpts {
  client?: Client
  fetcher?: () => Promise<FederalTownHallRow[]>
  skipOnError?: boolean
}

export async function ingestFederalTownHallsMobilize(
  opts: IngestFederalTownHallsMobilizeOpts = {},
): Promise<FederalMobilizeStats> {
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const stats: FederalMobilizeStats = {
    rowsUpserted: 0, officialsMatched: 0, officialsUnmatched: [], errors: [],
  }

  try {
    const events = opts.fetcher
      ? await opts.fetcher()
      : await fetchAndNormalizeFederal(client)

    for (const e of events) {
      try {
        await client.query(`
          insert into public.town_halls (
            official_id, event_date, city, state, format,
            attendance_estimate, source_url, source, external_id
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (source, external_id) where external_id is not null
          do update set
            event_date          = excluded.event_date,
            city                = excluded.city,
            state               = excluded.state,
            format              = excluded.format,
            attendance_estimate = excluded.attendance_estimate,
            source_url          = excluded.source_url
        `, [
          e.official_id, e.event_date, e.city ?? null, e.state, e.format ?? null,
          null, e.source_url, e.source, e.external_id,
        ])
        stats.rowsUpserted += 1
        stats.officialsMatched += 1
      } catch (err) {
        stats.errors.push((err as Error).message)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return stats
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const skipOnError = process.argv.includes('--skip-on-error')
  ingestFederalTownHallsMobilize({ skipOnError })
    .then(stats => {
      console.log(`Federal town halls (mobilize) ingest:`)
      console.log(`  rows upserted:        ${stats.rowsUpserted}`)
      console.log(`  officials matched:    ${stats.officialsMatched}`)
      console.log(`  officials unmatched:  ${stats.officialsUnmatched.length}`)
      console.log(`  errors:               ${stats.errors.length}`)
      if (stats.errors.length > 0) {
        for (const err of stats.errors.slice(0, 5)) console.log(`    - ${err}`)
      }
      process.exit(stats.errors.length === 0 ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
