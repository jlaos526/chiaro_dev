import { Client } from 'pg'
import type { StateEnrichAdapter, EnrichStats } from './state-bills/shared.ts'
import { enrichCalifornia } from './state-bills/enrich-ca.ts'
import { enrichNewYork    } from './state-bills/enrich-ny.ts'
import { enrichFlorida    } from './state-bills/enrich-fl.ts'
import { enrichTexas      } from './state-bills/enrich-tx.ts'
import { enrichMichigan   } from './state-bills/enrich-mi.ts'

const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const ADAPTERS_DEFAULT: StateEnrichAdapter[] = [
  enrichCalifornia,
  enrichNewYork,
  enrichFlorida,
  enrichTexas,
  enrichMichigan,
]

export interface IngestStateBillsEnrichOpts {
  session: string
  adapters?: StateEnrichAdapter[]
  client?: Client
}

export interface IngestStateBillsEnrichStats {
  totalBillsUpdated: number
  totalErrors: number
  byState: EnrichStats[]
}

export async function ingestStateBillsEnrich(
  opts: IngestStateBillsEnrichOpts,
): Promise<IngestStateBillsEnrichStats> {
  const adapters = opts.adapters ?? ADAPTERS_DEFAULT
  const client = opts.client ?? new Client({ connectionString: DB_URL })
  const ownsClient = !opts.client
  if (ownsClient) await client.connect()

  const byState: EnrichStats[] = []
  try {
    for (const adapter of adapters) {
      try {
        const stats = await adapter.enrich({ client, session: opts.session })
        byState.push(stats)
      } catch (err) {
        byState.push({
          state: adapter.state,
          billsUpdated: 0,
          errors: [(err as Error).message],
        })
      }
    }
  } finally {
    if (ownsClient) await client.end()
  }

  return {
    totalBillsUpdated: byState.reduce((s, x) => s + x.billsUpdated, 0),
    totalErrors:       byState.reduce((s, x) => s + x.errors.length, 0),
    byState,
  }
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const sessionArg = process.argv.find(a => a.startsWith('--session='))
  const session = sessionArg ? sessionArg.split('=')[1]! : new Date().getFullYear().toString()
  ingestStateBillsEnrich({ session })
    .then(stats => {
      console.log('State bills enrich summary:')
      console.log(`  total bills updated: ${stats.totalBillsUpdated}`)
      console.log(`  total errors:        ${stats.totalErrors}`)
      for (const s of stats.byState) {
        const tag = s.skipped ? `SKIPPED (${s.skipReason})` : `${s.billsUpdated} updated, ${s.errors.length} errors`
        console.log(`  ${s.state}: ${tag}`)
      }
      process.exit(stats.totalErrors > 0 ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
