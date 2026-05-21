import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchOpenStatesV3, type FetchOpenStatesV3Stats } from './openstates-v3-fetch.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CACHE_DIR = join(__dirname, '.cache', 'openstates')

// Known per-state session strings, keyed by year. Sessions are state-specific
// text (CA biennial 20252026 vs NY annual 2025 vs TX legislature-numbered 89R).
// Per CLAUDE.md gotcha #9: "session field format varies per state — don't normalize".
// Expand this table as new states gain coverage; unknown states are skipped
// (or fail loudly with --strict).
const KNOWN_SESSIONS: Record<number, Record<string, string>> = {
  2025: {
    CA: '20252026',
    NY: '2025',
    FL: '2025',
    TX: '89R',
    MI: '2025-2026',
  },
}

type RunFetchFn = (state: string, session: string) => Promise<FetchOpenStatesV3Stats>

export interface FetchAllOpts {
  year?: number
  /** Override the year's session map; takes precedence over KNOWN_SESSIONS. */
  sessionMap?: Record<string, string>
  /** When true, one state's failure doesn't abort the rest. */
  skipOnError?: boolean
  /** When true, abort if year has no known session map AND no override supplied. */
  strict?: boolean
  cacheDir?: string
  apiKey?: string
  force?: boolean
  /** Test-only injection: replaces fetchOpenStatesV3 entirely. */
  runFetch?: RunFetchFn
}

export interface FetchAllStats {
  year: number
  statesAttempted: number
  statesOk: number
  statesErrored: Array<{ state: string; error: string }>
  totalBillsCached: number
  totalBillsSkippedFresh: number
  perStateStats: FetchOpenStatesV3Stats[]
}

export async function fetchOpenStatesV3All(opts: FetchAllOpts = {}): Promise<FetchAllStats> {
  const year = opts.year ?? new Date().getFullYear()
  const yearMap = KNOWN_SESSIONS[year]
  const sessionMap = opts.sessionMap ?? yearMap

  if (!sessionMap || Object.keys(sessionMap).length === 0) {
    if (opts.strict || !opts.sessionMap) {
      throw new Error(
        `no session map for year ${year}; pass --year=YYYY for a year in [${Object.keys(KNOWN_SESSIONS).join(', ')}] ` +
        `or supply a custom sessionMap via opts/config`,
      )
    }
  }

  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR
  const runFetch: RunFetchFn = opts.runFetch ?? ((state, session) =>
    fetchOpenStatesV3({
      state, session, cacheDir,
      apiKey: opts.apiKey, force: opts.force,
    })
  )

  const stats: FetchAllStats = {
    year,
    statesAttempted: 0,
    statesOk: 0,
    statesErrored: [],
    totalBillsCached: 0,
    totalBillsSkippedFresh: 0,
    perStateStats: [],
  }

  const entries = Object.entries(sessionMap ?? {}).sort(([a], [b]) => a.localeCompare(b))
  for (const [state, session] of entries) {
    stats.statesAttempted += 1
    try {
      const result = await runFetch(state, session)
      stats.perStateStats.push(result)
      stats.totalBillsCached       += result.billsCached
      stats.totalBillsSkippedFresh += result.billsSkippedFresh
      if (result.errors.length > 0) {
        stats.statesErrored.push({ state, error: result.errors.join('; ') })
        if (!opts.skipOnError) {
          throw new Error(`state ${state} reported errors: ${result.errors.join('; ')}`)
        }
      } else {
        stats.statesOk += 1
      }
    } catch (err) {
      stats.statesErrored.push({ state, error: (err as Error).message })
      if (!opts.skipOnError) throw err
    }
  }
  return stats
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const yearArg        = process.argv.find(a => a.startsWith('--year='))
  const skipOnError    = process.argv.includes('--skip-on-error')
  const force          = process.argv.includes('--force')
  const year           = yearArg ? Number(yearArg.split('=')[1]) : new Date().getFullYear()

  if (!Number.isFinite(year)) {
    console.error(`invalid --year value (got '${yearArg}')`)
    process.exit(2)
  }

  fetchOpenStatesV3All({ year, skipOnError, force })
    .then(stats => {
      console.log(`OpenStates v3 fetch-all summary (year ${stats.year}):`)
      console.log(`  states attempted:     ${stats.statesAttempted}`)
      console.log(`  states ok:            ${stats.statesOk}`)
      console.log(`  states with errors:   ${stats.statesErrored.length}`)
      console.log(`  total bills cached:   ${stats.totalBillsCached}`)
      console.log(`  total skipped fresh:  ${stats.totalBillsSkippedFresh}`)
      for (const e of stats.statesErrored) console.log(`    - ${e.state}: ${e.error}`)
      process.exit(stats.statesErrored.length > 0 && !skipOnError ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
