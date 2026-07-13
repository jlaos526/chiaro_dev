import { Client } from 'pg'
import { hasFlag, isCliEntry, parseFlag } from './shared/cli.ts'
import {
  type CommunityComponent,
  type StateCommunityAdapter,
  type StateCommunityStats,
  upsertTownHall,
  upsertDistrictOffice,
  clearDistrictOfficesFor,
  upsertCommitteeHearing,
  type NormalizedTownHall,
  type NormalizedDistrictOffice,
  type NormalizedCommitteeHearing,
} from './state-community/shared.ts'
import { mobilize } from './state-community/town-halls/mobilize.ts'
import { caLeginfoTownHalls } from './state-community/town-halls/ca-leginfo.ts'
import { nySenateTownHalls } from './state-community/town-halls/ny-senate.ts'
import { flDoeTownHalls } from './state-community/town-halls/fl-doe.ts'
import { txCapitolTownHalls } from './state-community/town-halls/tx-capitol.ts'
import { miLegislatureTownHalls } from './state-community/town-halls/mi-legislature.ts'
import { caLeginfoOffices } from './state-community/district-offices/ca-leginfo/index.ts'
import { nySenateOffices } from './state-community/district-offices/ny-senate/index.ts'
import { flDoeOffices } from './state-community/district-offices/fl-doe/index.ts'
import { txCapitolOffices } from './state-community/district-offices/tx-capitol.ts'
import { miLegislatureOffices } from './state-community/district-offices/mi-legislature/index.ts'
import { openstatesV3Hearings } from './state-community/committee-hearings/openstates-v3.ts'
import {
  createSkipCollector,
  formatSkipSummary,
  type SkipSummary,
} from './shared/instrumentation.ts'
import { formatAdapterStatusSummary } from './shared/adapter-status.ts'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Exported for the registry-status test (audit C35); dispatch behavior unchanged. */
export const ADAPTERS_DEFAULT: StateCommunityAdapter[] = [
  // halls first (Mobilize nationwide baseline replaces dead TownHallProject;
  // per-state augment runs after). townhallproject.ts is retained as a
  // no-op stub (file kept for backwards-compat; @deprecated JSDoc).
  mobilize,
  caLeginfoTownHalls,
  nySenateTownHalls,
  flDoeTownHalls,
  txCapitolTownHalls,
  miLegislatureTownHalls,
  // offices
  caLeginfoOffices,
  nySenateOffices,
  flDoeOffices,
  txCapitolOffices,
  miLegislatureOffices,
  // hearings
  openstatesV3Hearings,
]

export interface IngestStateCommunityOpts {
  component?: CommunityComponent | 'all'
  state?: string
  session?: string
  skipOnError?: boolean
  adapters?: StateCommunityAdapter[]
  client?: Client
  /** When true, collect skip reasons via shared collector + populate stats.skipSummary. */
  instrument?: boolean
  /** When true, skip the UPSERT loop (dry-run). Pair with instrument=true. */
  noApply?: boolean
}

export interface IngestStateCommunityStats {
  adaptersAttempted: number
  adaptersOk: number
  totalRowsUpserted: number
  totalOfficialsUnmatched: number
  byAdapter: StateCommunityStats[]
  /** Populated when opts.instrument === true. Aggregated skip telemetry. */
  skipSummary?: SkipSummary
}

export async function ingestStateCommunity(
  opts: IngestStateCommunityOpts,
): Promise<IngestStateCommunityStats> {
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

  const byAdapter: StateCommunityStats[] = []
  try {
    for (const adapter of adapters) {
      const adapterStats: StateCommunityStats = {
        component: adapter.component,
        adapter_slug: adapter.slug,
        status: adapter.status,
        rowsUpserted: 0,
        officialsMatched: 0,
        officialsUnmatched: [],
        errors: [],
      }
      try {
        const events = await adapter.fetchEvents({
          client,
          ...(opts.state !== undefined ? { state: opts.state } : {}),
          ...(opts.session !== undefined ? { session: opts.session } : {}),
          ...(onSkip ? { onSkip } : {}),
        })
        // Offices idempotency (audit C33): upsertDistrictOffice is a bare INSERT,
        // so delete this adapter's officials' offices before re-inserting. Heals
        // pre-existing duplicates for every official the adapter still emits.
        if (!opts.noApply && adapter.component === 'offices') {
          const personIds = [
            ...new Set(
              (events as NormalizedDistrictOffice[]).map((e) => e.official_openstates_person_id),
            ),
          ]
          await clearDistrictOfficesFor(client, personIds)
        }
        for (const event of events) {
          if (opts.noApply) {
            // Dry-run: skip DB writes; count would-upsert rows for visibility.
            adapterStats.rowsUpserted += 1
            continue
          }
          if (adapter.component === 'halls') {
            const ok = await upsertTownHall(client, event as NormalizedTownHall)
            if (ok) {
              adapterStats.rowsUpserted += 1
              adapterStats.officialsMatched += 1
            } else if ((event as NormalizedTownHall).official_openstates_person_id) {
              adapterStats.officialsUnmatched.push(
                (event as NormalizedTownHall).official_openstates_person_id!,
              )
            }
          } else if (adapter.component === 'offices') {
            const ok = await upsertDistrictOffice(client, event as NormalizedDistrictOffice)
            if (ok) {
              adapterStats.rowsUpserted += 1
              adapterStats.officialsMatched += 1
            } else {
              adapterStats.officialsUnmatched.push(
                (event as NormalizedDistrictOffice).official_openstates_person_id,
              )
            }
          } else if (adapter.component === 'hearings') {
            const result = await upsertCommitteeHearing(client, event as NormalizedCommitteeHearing)
            adapterStats.rowsUpserted += 1
            adapterStats.officialsMatched += result.matched
            adapterStats.officialsUnmatched.push(...result.unmatched)
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

  const component = (parseFlag('component') ?? 'all') as CommunityComponent | 'all'
  const state = parseFlag('state')
  const session = parseFlag('session')

  ingestStateCommunity({
    component,
    ...(state !== undefined ? { state } : {}),
    ...(session !== undefined ? { session } : {}),
    skipOnError,
    instrument,
    noApply,
  })
    .then((stats) => {
      console.log(`State community ingest summary:`)
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
      // Stub-vs-production visibility (audit C35): a "green" run can otherwise
      // hide that a zero-row adapter is a stub or deprecated by design.
      console.log(
        formatAdapterStatusSummary(
          stats.byAdapter.map((s) => ({
            label: `${s.component}:${s.adapter_slug}`,
            status: s.status,
          })),
        ),
      )
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
