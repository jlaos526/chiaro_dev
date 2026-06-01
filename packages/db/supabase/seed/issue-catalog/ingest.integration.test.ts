import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { ingestIssueCatalog } from './ingest.ts'
import { ISSUE_CATALOG_FIXTURE } from '../fixtures/issue-catalog.fixture.ts'

// Distinct storageKey + persistSession:false to avoid the GoTrue session
// collision documented in CLAUDE.md Gotcha #1 when multiple createClient calls
// share a process.
const svc = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, storageKey: 'issue-catalog-it' } },
)

describe('issue catalog integration', () => {
  beforeAll(async () => {
    // Order-independent: clear the catalog tables first. Selections cascade off
    // lenses, but clear them explicitly (FK guard) before lenses/topics.
    await svc
      .from('user_issue_selections')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000')
    await svc.from('issue_lenses').delete().neq('topic_slug', '')
    await svc.from('issue_topics').delete().neq('slug', '')
  })

  it('ingests the fixture catalog', async () => {
    await ingestIssueCatalog(svc as never, ISSUE_CATALOG_FIXTURE)
    const { count } = await svc
      .from('issue_topics')
      .select('*', { count: 'exact', head: true })
    expect(count).toBe(ISSUE_CATALOG_FIXTURE.length)
  })
})
