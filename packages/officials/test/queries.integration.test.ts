import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'
import { fetchMyOfficials, fetchOfficial } from '../src/queries.ts'

const URL  = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON_KEY
  ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SVC) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY not set — required for officials integration tests. ' +
    'Pull it from `supabase status --output env` (SERVICE_ROLE_KEY) and export before running.'
  )
}

let svc: SupabaseClient<Database>
let anon: SupabaseClient<Database>
let testUserId: string
let districtSenateCA: string
let districtHouseCA12: string

beforeAll(async () => {
  // IMPORTANT: each Supabase client must use a distinct auth storage key.
  // Without this, both clients share the same default key — when `anon` signs
  // in as integration@test, it overwrites the session `svc` would use, so
  // `svc.from(...).delete()` ends up using the user's JWT and hits RLS+grant
  // denial (403). Manifests as a silent test cleanup leak.
  svc  = createClient<Database>(URL, SVC, {
    auth: { persistSession: false, storageKey: 'svc-integration-test' },
  })
  anon = createClient<Database>(URL, ANON, {
    auth: { persistSession: false, storageKey: 'anon-integration-test' },
  })

  // Pre-clean any leftover rows from prior failed runs OR sibling tests that
  // truncate-and-insert P000197 without cleaning up (e.g.
  // packages/db/supabase/seed/scorecards/index.test.ts seeds Nancy Pelosi
  // into a fixture district and never deletes the official row). Without
  // this, our batch `officials.insert([...])` below hits the unique
  // constraint on bioguide_id and rolls back all three rows silently —
  // user_districts insert succeeds, but the JOIN in fetchMyOfficials returns
  // zero rows. See ROOT CAUSE in commit message.
  await svc.from('officials').delete().in('bioguide_id', ['P000197', 'F000062', 'P000145'])

  const { data: dCA1, error: e1 } = await svc.from('districts').insert({
    tier: 'federal_senate',
    state: 'CA',
    code: 'federal_senate:CA',
    name: 'California (Senate)',
    geometry: 'MULTIPOLYGON(((-120 35, -119 35, -119 36, -120 36, -120 35)))',
    source_version: 'FX',
  }).select().single()
  expect(e1).toBeNull()
  districtSenateCA = dCA1!.id

  const { data: dCA2, error: e2 } = await svc.from('districts').insert({
    tier: 'federal_house',
    state: 'CA',
    code: 'federal_house:CA:12',
    name: 'California 12th',
    geometry: 'MULTIPOLYGON(((-122.5 37.5, -122 37.5, -122 38, -122.5 38, -122.5 37.5)))',
    source_version: 'FX',
  }).select().single()
  expect(e2).toBeNull()
  districtHouseCA12 = dCA2!.id

  const { error: oErr } = await svc.from('officials').insert([
    { bioguide_id: 'P000197', first_name: 'Nancy', last_name: 'Pelosi',
      full_name: 'Nancy Pelosi', chamber: 'house', party: 'D', state: 'CA',
      district_id: districtHouseCA12, senate_class: null, source_version: '119' },
    { bioguide_id: 'F000062', first_name: 'Dianne', last_name: 'Feinstein',
      full_name: 'Dianne Feinstein', chamber: 'senate', party: 'D', state: 'CA',
      district_id: districtSenateCA, senate_class: 1, source_version: '119' },
    { bioguide_id: 'P000145', first_name: 'Alex', last_name: 'Padilla',
      full_name: 'Alex Padilla', chamber: 'senate', party: 'D', state: 'CA',
      district_id: districtSenateCA, senate_class: 3, source_version: '119' },
  ])
  expect(oErr).toBeNull()

  const { data: u, error: ue } = await svc.auth.admin.createUser({
    email: 'integration@test', email_confirm: true, password: 'test1234',
  })
  expect(ue).toBeNull()
  testUserId = u.user!.id

  const { error: udErr } = await svc.from('user_districts').insert([
    { user_id: testUserId, district_id: districtSenateCA, tier: 'federal_senate' },
    { user_id: testUserId, district_id: districtHouseCA12, tier: 'federal_house' },
  ])
  expect(udErr).toBeNull()

  const { error: se } = await anon.auth.signInWithPassword({
    email: 'integration@test', password: 'test1234',
  })
  expect(se).toBeNull()
})

afterAll(async () => {
  if (!svc) return
  // Idempotent cleanup — deletes by content filter, not by stored UUIDs, so a
  // crashed beforeAll or a stale prior run doesn't leave orphans behind.
  await svc.from('officials').delete().in('bioguide_id', ['P000197', 'F000062', 'P000145'])
  if (testUserId) {
    await svc.from('user_districts').delete().eq('user_id', testUserId)
    await svc.auth.admin.deleteUser(testUserId)
  }
  await svc.from('districts').delete().eq('source_version', 'FX')
})

describe('fetchMyOfficials', () => {
  it('returns the 3 officials joined via user_districts', async () => {
    const officials = await fetchMyOfficials(anon)
    expect(officials).toHaveLength(3)
    const ids = officials.map((o) => o.bioguide_id).sort()
    expect(ids).toEqual(['F000062', 'P000145', 'P000197'])
  })

  it('includes district join', async () => {
    const officials = await fetchMyOfficials(anon)
    const pelosi = officials.find((o) => o.bioguide_id === 'P000197')!
    expect(pelosi.district.code).toBe('federal_house:CA:12')
  })
})

describe('fetchOfficial', () => {
  it('returns one official with district', async () => {
    const officials = await fetchMyOfficials(anon)
    const target = officials.find((o) => o.bioguide_id === 'P000145')!
    const detail = await fetchOfficial(anon, target.id)
    expect(detail.bioguide_id).toBe('P000145')
    expect(detail.district.tier).toBe('federal_senate')
  })

  it('throws on unknown id', async () => {
    await expect(
      fetchOfficial(anon, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow()
  })
})
