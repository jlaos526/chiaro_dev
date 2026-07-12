// Slice 79 (audit C18): fetchCatalog collapsed from 2 queries to 1 via the
// `lenses:issue_lenses(*)` embed with an embedded (non-!inner) active filter
// + per-embed ordering. This suite proves the embed semantics against REAL
// PostgREST (local Supabase), following the S75 state-bills harness pattern.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'
import type { ChiaroClient } from '@chiaro/supabase-client'
import { fetchCatalog } from '../src/queries.ts'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY

// Slice 63 (audit U10): skip locally when the env isn't exported instead of a
// module-scope throw. CI always runs (live = true via CI env).
const live = !!SVC || !!process.env.CI
const d = describe.skipIf(!live)
if (!live) {
  console.warn(
    '[@chiaro/issues] SUPABASE_SERVICE_ROLE_KEY not set — skipping integration suite. ' +
      'Run `pnpm db:start`, then export keys from `supabase status --output env` (SERVICE_ROLE_KEY).',
  )
}

// Gotcha #1: explicit storageKey so this client can't collide with others.
const svc = live
  ? createClient<Database>(URL, SVC!, {
      auth: { persistSession: false, storageKey: 'svc-issues-s79-integ' },
    })
  : (null as never)

const PFX = 's79-integ'

async function cleanup() {
  // Lenses CASCADE on topic delete.
  await svc
    .from('issue_topics')
    .delete()
    .in('slug', [`${PFX}-topic-a`, `${PFX}-topic-b`, `${PFX}-topic-c`])
}

d('fetchCatalog — slice 79 single-request embed (real PostgREST)', () => {
  beforeAll(async () => {
    await cleanup()
    // High display_order keeps the test topics clear of any real seeded
    // catalog (seed:issue-catalog) sharing the local DB.
    const { error: tErr } = await svc.from('issue_topics').insert([
      {
        slug: `${PFX}-topic-a`,
        display_name: 'S79 Topic A',
        description: 'integration fixture',
        display_order: 9001,
        active: true,
      },
      {
        slug: `${PFX}-topic-b`,
        display_name: 'S79 Topic B (lens-less)',
        description: 'integration fixture',
        display_order: 9002,
        active: true,
      },
      {
        slug: `${PFX}-topic-c`,
        display_name: 'S79 Topic C (inactive)',
        description: 'integration fixture',
        display_order: 9003,
        active: false,
      },
    ])
    expect(tErr).toBeNull()
    const { error: lErr } = await svc.from('issue_lenses').insert([
      // Inserted out of display_order to prove the per-embed server-side sort.
      {
        topic_slug: `${PFX}-topic-a`,
        slug: 'l2',
        label: 'Lens 2',
        lens_type: 'stance',
        display_order: 2,
        active: true,
      },
      {
        topic_slug: `${PFX}-topic-a`,
        slug: 'l1',
        label: 'Lens 1',
        lens_type: 'stance',
        display_order: 1,
        active: true,
      },
      {
        topic_slug: `${PFX}-topic-a`,
        slug: 'l3',
        label: 'Inactive Lens',
        lens_type: 'watchlist',
        display_order: 3,
        active: false,
      },
      // topic-b's ONLY lens is inactive — the embedded filter must empty the
      // lens list WITHOUT dropping the topic (the !inner-vs-plain distinction).
      {
        topic_slug: `${PFX}-topic-b`,
        slug: 'l1',
        label: 'Inactive Lens',
        lens_type: 'stance',
        display_order: 1,
        active: false,
      },
    ])
    expect(lErr).toBeNull()
  }, 30_000)

  afterAll(async () => {
    if (!svc) return
    await cleanup()
  }, 30_000)

  it('embeds only active lenses, server-ordered by display_order', async () => {
    const topics = await fetchCatalog(svc as unknown as ChiaroClient)
    const a = topics.find((t) => t.slug === `${PFX}-topic-a`)
    expect(a).toBeDefined()
    expect(a!.lenses.map((l) => l.slug)).toEqual(['l1', 'l2'])
  })

  it('keeps a topic whose only lens is inactive (embedded filter, not !inner)', async () => {
    const topics = await fetchCatalog(svc as unknown as ChiaroClient)
    const b = topics.find((t) => t.slug === `${PFX}-topic-b`)
    expect(b).toBeDefined()
    expect(b!.lenses).toEqual([])
  })

  it('excludes inactive topics', async () => {
    const topics = await fetchCatalog(svc as unknown as ChiaroClient)
    expect(topics.some((t) => t.slug === `${PFX}-topic-c`)).toBe(false)
  })

  it('orders topics by display_order (fixtures arrive a-then-b)', async () => {
    const topics = await fetchCatalog(svc as unknown as ChiaroClient)
    const slugs = topics.map((t) => t.slug).filter((s) => s.startsWith(PFX))
    expect(slugs).toEqual([`${PFX}-topic-a`, `${PFX}-topic-b`])
  })
})
