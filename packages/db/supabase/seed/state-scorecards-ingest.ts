import { Client } from 'pg'
import {
  type StateScorecardAdapter,
  type StateScorecardStats,
  upsertStateScorecardOrg,
  upsertStateScorecardRating,
} from './state-scorecards/shared.ts'
import { aclu } from './state-scorecards/aclu.ts'
import { lcv } from './state-scorecards/lcv/index.ts'
import { nra } from './state-scorecards/nra.ts'
import { plannedParenthood } from './state-scorecards/planned-parenthood.ts'
import { afp } from './state-scorecards/afp.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateScorecardAdapter[] = [
  aclu, lcv, nra, plannedParenthood, afp,
]

export interface IngestStateScorecardsOpts {
  session: string
  state?: string
  org?: string
  skipOnError?: boolean
  adapters?: StateScorecardAdapter[]
  client?: Client
}

export interface IngestStateScorecardsStats {
  session: string
  adaptersAttempted: number
  adaptersOk: number
  totalOrgsUpserted: number
  totalRatingsUpserted: number
  totalOfficialsUnmatched: number
  byOrg: StateScorecardStats[]
}

export async function ingestStateScorecards(
  opts: IngestStateScorecardsOpts,
): Promise<IngestStateScorecardsStats> {
  let adapters = opts.adapters ?? ADAPTERS_DEFAULT
  if (opts.org) {
    adapters = adapters.filter(a => a.slug === opts.org)
  }
  if (opts.state) {
    adapters = adapters.filter(a => a.covered_states.includes(opts.state!))
  }

  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const byOrg: StateScorecardStats[] = []
  try {
    for (const adapter of adapters) {
      const orgStats: StateScorecardStats = {
        org_slug: adapter.slug,
        orgsUpserted: 0,
        ratingsUpserted: 0,
        officialsMatched: 0,
        officialsUnmatched: [],
        errors: [],
      }
      try {
        const targetStates = opts.state
          ? [opts.state]
          : adapter.covered_states
        const ratings = await adapter.fetchRatings({
          client, session: opts.session, state: opts.state,
        })
        // Upsert per-state org rows for each state in scope.
        const orgIdByState = new Map<string, string>()
        for (const state of targetStates) {
          const orgId = await upsertStateScorecardOrg(client, adapter, state)
          orgIdByState.set(state, orgId)
          orgStats.orgsUpserted += 1
        }
        // Upsert ratings.
        for (const r of ratings) {
          const orgId = orgIdByState.get(r.state)
          if (!orgId) {
            orgStats.errors.push(`rating for state ${r.state} not in adapter.covered_states[]`)
            continue
          }
          const ok = await upsertStateScorecardRating(
            client, orgId, r.openstates_person_id, opts.session, r.score, r.source_url,
          )
          if (ok) {
            orgStats.ratingsUpserted += 1
            orgStats.officialsMatched += 1
          } else {
            orgStats.officialsUnmatched.push(r.openstates_person_id)
          }
        }
        byOrg.push(orgStats)
      } catch (err) {
        orgStats.errors.push((err as Error).message)
        byOrg.push(orgStats)
        if (!opts.skipOnError) throw err
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    session: opts.session,
    adaptersAttempted:       byOrg.length,
    adaptersOk:              byOrg.filter(s => s.errors.length === 0).length,
    totalOrgsUpserted:       byOrg.reduce((acc, s) => acc + s.orgsUpserted, 0),
    totalRatingsUpserted:    byOrg.reduce((acc, s) => acc + s.ratingsUpserted, 0),
    totalOfficialsUnmatched: byOrg.reduce((acc, s) => acc + s.officialsUnmatched.length, 0),
    byOrg,
  }
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const sessionArg = process.argv.find(a => a.startsWith('--session='))
  const stateArg   = process.argv.find(a => a.startsWith('--state='))
  const orgArg     = process.argv.find(a => a.startsWith('--org='))
  const skipOnError = process.argv.includes('--skip-on-error')
  if (!sessionArg) {
    console.error('usage: tsx state-scorecards-ingest.ts --session=YYYY [--state=XX] [--org=SLUG] [--skip-on-error]')
    process.exit(2)
  }
  const session = sessionArg.split('=')[1]!
  const state = stateArg ? stateArg.split('=')[1]! : undefined
  const org = orgArg ? orgArg.split('=')[1]! : undefined

  ingestStateScorecards({ session, state, org, skipOnError })
    .then(stats => {
      console.log(`State scorecards ingest summary (session ${stats.session}):`)
      console.log(`  adapters attempted:       ${stats.adaptersAttempted}`)
      console.log(`  adapters ok:              ${stats.adaptersOk}`)
      console.log(`  total orgs upserted:      ${stats.totalOrgsUpserted}`)
      console.log(`  total ratings upserted:   ${stats.totalRatingsUpserted}`)
      console.log(`  total officials unmatched: ${stats.totalOfficialsUnmatched}`)
      for (const s of stats.byOrg) {
        const tag = s.errors.length > 0 ? `errors=${s.errors.length}` : 'ok'
        console.log(`  ${s.org_slug}: ${s.orgsUpserted} orgs / ${s.ratingsUpserted} ratings / ${tag}`)
      }
      process.exit(stats.adaptersOk === stats.adaptersAttempted ? 0 : 1)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
