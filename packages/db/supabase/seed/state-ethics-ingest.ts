import { Client } from 'pg'
import { hasFlag, isCliEntry, parseFlag } from './shared/cli.ts'
import {
  type EthicsComponent,
  type StateEthicsAdapter,
  type StateEthicsStats,
  upsertFinancialDisclosure,
  upsertEthicsComplaint,
  upsertOfficialEvent,
  type NormalizedFinancialDisclosure,
  type NormalizedEthicsComplaint,
  type NormalizedOfficialEvent,
} from './state-ethics/shared.ts'
import {
  createSkipCollector,
  formatSkipSummary,
  type SkipSummary,
} from './shared/instrumentation.ts'
import { openstatesEndReason } from './state-ethics/events/openstates-end-reason.ts'
import { ballotpediaRecalls } from './state-ethics/events/ballotpedia-recalls.ts'
import {
  caFppcEvents,
  nyJcopeEvents,
  flCoeEvents,
  txTecEvents,
  miBoardEvents,
} from './state-ethics/events/index.ts'
import {
  caFppcDisclosures,
  nyJcopeDisclosures,
  flCoeDisclosures,
  txTecDisclosures,
  miBoardDisclosures,
} from './state-ethics/disclosures/index.ts'
import {
  caFppcComplaints,
  nyJcopeComplaints,
  flCoeComplaints,
  txTecComplaints,
  miBoardComplaints,
} from './state-ethics/complaints/index.ts'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateEthicsAdapter[] = [
  // disclosures
  caFppcDisclosures,
  nyJcopeDisclosures,
  flCoeDisclosures,
  txTecDisclosures,
  miBoardDisclosures,
  // complaints
  caFppcComplaints,
  nyJcopeComplaints,
  flCoeComplaints,
  txTecComplaints,
  miBoardComplaints,
  // events — OpenStates FIRST (resignation/death), then Ballotpedia (recalls), then per-state finance violations
  openstatesEndReason,
  ballotpediaRecalls,
  caFppcEvents,
  nyJcopeEvents,
  flCoeEvents,
  txTecEvents,
  miBoardEvents,
]

export interface IngestStateEthicsOpts {
  component?: EthicsComponent | 'all'
  state?: string
  skipOnError?: boolean
  adapters?: StateEthicsAdapter[]
  client?: Client
  /** When true, collect skip reasons via shared collector + populate stats.skipSummary. */
  instrument?: boolean
  /** When true, skip the UPSERT loop (dry-run). Pair with instrument=true. */
  noApply?: boolean
}

export interface IngestStateEthicsStats {
  adaptersAttempted: number
  adaptersOk: number
  totalRowsUpserted: number
  totalOfficialsUnmatched: number
  byAdapter: StateEthicsStats[]
  /** Populated when opts.instrument === true. Aggregated skip telemetry. */
  skipSummary?: SkipSummary
}

export async function ingestStateEthics(
  opts: IngestStateEthicsOpts,
): Promise<IngestStateEthicsStats> {
  let adapters = opts.adapters ?? ADAPTERS_DEFAULT
  const wantedComponent = opts.component && opts.component !== 'all' ? opts.component : undefined
  if (wantedComponent) {
    adapters = adapters.filter((a) => a.component === wantedComponent)
  }
  if (opts.state) {
    adapters = adapters.filter((a) => a.covered_states.includes(opts.state!))
  }

  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const collector = opts.instrument ? createSkipCollector() : null
  const onSkip = collector?.onSkip

  const byAdapter: StateEthicsStats[] = []
  try {
    for (const adapter of adapters) {
      const adapterStats: StateEthicsStats = {
        component: adapter.component,
        adapter_slug: adapter.slug,
        rowsUpserted: 0,
        officialsMatched: 0,
        officialsUnmatched: [],
        errors: [],
      }
      try {
        const events = await adapter.fetchEvents({
          client,
          ...(opts.state !== undefined ? { state: opts.state } : {}),
          ...(onSkip ? { onSkip } : {}),
        })
        for (const event of events) {
          if (opts.noApply) {
            // Dry-run: skip DB writes; count would-upsert rows for visibility.
            adapterStats.rowsUpserted += 1
            continue
          }
          let ok = false
          if (adapter.component === 'disclosures') {
            ok = await upsertFinancialDisclosure(client, event as NormalizedFinancialDisclosure)
          } else if (adapter.component === 'complaints') {
            ok = await upsertEthicsComplaint(client, event as NormalizedEthicsComplaint)
          } else if (adapter.component === 'events') {
            ok = await upsertOfficialEvent(client, event as NormalizedOfficialEvent)
          }
          if (ok) {
            adapterStats.rowsUpserted += 1
            adapterStats.officialsMatched += 1
          } else {
            const pid = (event as { official_openstates_person_id?: string })
              .official_openstates_person_id
            if (pid) adapterStats.officialsUnmatched.push(pid)
          }
        }
        byAdapter.push(adapterStats)
      } catch (err) {
        adapterStats.errors.push((err as Error).message)
        byAdapter.push(adapterStats)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    adaptersAttempted: byAdapter.length,
    adaptersOk: byAdapter.filter((s) => s.errors.length === 0).length,
    totalRowsUpserted: byAdapter.reduce((a, s) => a + s.rowsUpserted, 0),
    totalOfficialsUnmatched: byAdapter.reduce((a, s) => a + s.officialsUnmatched.length, 0),
    byAdapter,
    ...(collector ? { skipSummary: collector.summary() } : {}),
  }
}

if (isCliEntry(import.meta.url)) {
  const skipOnError = hasFlag('skip-on-error')
  const instrument = hasFlag('instrument')
  const noApply = hasFlag('no-apply')

  const component = (parseFlag('component') ?? 'all') as EthicsComponent | 'all'
  const state = parseFlag('state')

  ingestStateEthics({
    component,
    ...(state !== undefined ? { state } : {}),
    skipOnError,
    instrument,
    noApply,
  })
    .then((stats) => {
      console.log(`State ethics ingest summary:`)
      console.log(`  adapters attempted:        ${stats.adaptersAttempted}`)
      console.log(`  adapters ok:               ${stats.adaptersOk}`)
      console.log(
        `  total rows upserted:       ${stats.totalRowsUpserted}${noApply ? ' (dry-run; no DB writes)' : ''}`,
      )
      console.log(`  total officials unmatched: ${stats.totalOfficialsUnmatched}`)
      for (const s of stats.byAdapter) {
        const tag = s.errors.length > 0 ? `errors=${s.errors.length}` : 'ok'
        console.log(`  ${s.component}:${s.adapter_slug}: ${s.rowsUpserted} rows / ${tag}`)
      }
      if (stats.skipSummary) {
        console.log('')
        console.log(formatSkipSummary(stats.skipSummary))
      }
      process.exit(stats.adaptersOk === stats.adaptersAttempted ? 0 : 1)
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
