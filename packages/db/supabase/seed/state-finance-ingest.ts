import { Client } from 'pg'
import { isCliEntry } from './shared/cli.ts'
import {
  type StateFinanceAdapter,
  type StateFinanceStats,
  type FinanceState,
} from './state-finance/shared.ts'
import { fetchCalifornia } from './state-finance/fetch-ca.ts'
import { fetchNewYork    } from './state-finance/fetch-ny.ts'
import { fetchFlorida    } from './state-finance/fetch-fl.ts'
import { fetchTexas      } from './state-finance/fetch-tx.ts'
import { fetchMichigan   } from './state-finance/fetch-mi.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateFinanceAdapter[] = [
  fetchCalifornia, fetchNewYork, fetchFlorida, fetchTexas, fetchMichigan,
]

const KNOWN_STATES: ReadonlySet<FinanceState> = new Set(['CA', 'NY', 'FL', 'TX', 'MI'])

export interface IngestStateFinanceOpts {
  cycle: string
  state?: FinanceState
  skipOnError?: boolean
  adapters?: StateFinanceAdapter[]
  client?: Client
}

export interface IngestStateFinanceStats {
  cycle: string
  statesAttempted: number
  statesOk: number
  totalSummariesUpserted: number
  totalDonorsUpserted: number
  totalOfficialsUnmatched: number
  byState: StateFinanceStats[]
}

export async function ingestStateFinance(
  opts: IngestStateFinanceOpts,
): Promise<IngestStateFinanceStats> {
  if (opts.state && !KNOWN_STATES.has(opts.state)) {
    throw new Error(`unknown state code: ${opts.state}; expected one of CA, NY, FL, TX, MI`)
  }
  const adapters = (opts.adapters ?? ADAPTERS_DEFAULT)
    .filter(a => !opts.state || a.state === opts.state)
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const byState: StateFinanceStats[] = []
  try {
    for (const adapter of adapters) {
      try {
        const result = await adapter.fetch({ client, cycle: opts.cycle })
        byState.push(result)
      } catch (err) {
        const failed: StateFinanceStats = {
          state: adapter.state,
          summariesUpserted: 0,
          donorsUpserted: 0,
          officialsMatched: 0,
          officialsUnmatched: [],
          errors: [(err as Error).message],
        }
        byState.push(failed)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    cycle: opts.cycle,
    statesAttempted:           byState.length,
    statesOk:                  byState.filter(s => s.errors.length === 0).length,
    totalSummariesUpserted:    byState.reduce((acc, s) => acc + s.summariesUpserted, 0),
    totalDonorsUpserted:       byState.reduce((acc, s) => acc + s.donorsUpserted, 0),
    totalOfficialsUnmatched:   byState.reduce((acc, s) => acc + s.officialsUnmatched.length, 0),
    byState,
  }
}

if (isCliEntry(import.meta.url)) {
  const cycleArg = process.argv.find(a => a.startsWith('--cycle='))
  const stateArg = process.argv.find(a => a.startsWith('--state='))
  const skipOnError = process.argv.includes('--skip-on-error')
  if (!cycleArg) {
    console.error('usage: tsx state-finance-ingest.ts --cycle=YYYY [--state=XX] [--skip-on-error]')
    process.exit(2)
  }
  const cycle = cycleArg.split('=')[1]!
  const state = stateArg ? (stateArg.split('=')[1]! as FinanceState) : undefined

  ingestStateFinance({ cycle, ...(state !== undefined ? { state } : {}), skipOnError })
    .then(stats => {
      console.log(`State finance ingest summary (cycle ${stats.cycle}):`)
      console.log(`  states attempted:        ${stats.statesAttempted}`)
      console.log(`  states ok:               ${stats.statesOk}`)
      console.log(`  total summaries:         ${stats.totalSummariesUpserted}`)
      console.log(`  total donors:            ${stats.totalDonorsUpserted}`)
      console.log(`  total officials unmatched: ${stats.totalOfficialsUnmatched}`)
      for (const s of stats.byState) {
        const tag = s.errors.length > 0 ? `errors=${s.errors.length}` : 'ok'
        console.log(`  ${s.state}: ${s.summariesUpserted} summaries / ${s.donorsUpserted} donors / ${tag}`)
        if (s.officialsUnmatched.length > 0) {
          console.log(`    unmatched: ${s.officialsUnmatched.join(', ')}`)
        }
      }
      process.exit(stats.statesOk === stats.statesAttempted ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
