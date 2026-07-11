import { createClient } from '@supabase/supabase-js'
import { isCliEntry } from './shared/cli.ts'
import { ingestIssueCatalog, type IssueCatalogUpsertClient } from './issue-catalog/ingest.ts'
import { ISSUE_CATALOG } from './issue-catalog/catalog-data.ts'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Build a service-role client for the seed CLI. UPSERTs into issue_topics /
 * issue_lenses bypass RLS via the service key. Distinct storageKey per
 * Gotcha #1 (avoid GoTrue session collision). Cast to the ingester's minimal
 * structural surface: the generated Database type does not yet include the
 * slice-52 tables (regenerated in Task 7), so the typed `.from()` would reject
 * the new table names — the ingester only needs `from(table).upsert(rows)`.
 */
function createServiceClient(): IssueCatalogUpsertClient {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY not set — required for issue-catalog ingest. ' +
        'Pull it from `supabase status --output env --workdir packages/db` (SERVICE_ROLE_KEY) and export before running.',
    )
  }
  return createClient(URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'issue-catalog-seed' },
  }) as unknown as IssueCatalogUpsertClient
}

async function main(): Promise<void> {
  const client = createServiceClient()
  await ingestIssueCatalog(client)
  const lensCount = ISSUE_CATALOG.reduce((n, t) => n + t.lenses.length, 0)
  console.log(
    `Issue catalog ingest: upserted ${ISSUE_CATALOG.length} topics / ${lensCount} lenses.`,
  )
}

if (isCliEntry(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error((err as Error).message)
      process.exit(1)
    })
}
