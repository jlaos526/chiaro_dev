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
let districtStateHouseCA: string

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
  // Same defensive pre-clean for the state official keyed by openstates_person_id.
  await svc.from('officials').delete().eq('openstates_person_id', 'ocd-person/00000000-0000-0000-0000-000000000001-int')
  // And the state_house district by unique code, in case it was left behind.
  await svc.from('districts').delete().eq('code', 'CA-AD15')

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

  // Add a state_house district for the state-leg coexistence cases.
  // Code `CA-AD15` is chosen to NOT collide with TIGER-seeded codes (TIGER uses
  // `federal_house:CA:15` shape; this is a state assembly district).
  const { data: dCA3, error: e3 } = await svc.from('districts').insert({
    tier: 'state_house',
    state: 'CA',
    code: 'CA-AD15',
    name: 'CA Assembly District 15',
    geometry: 'MULTIPOLYGON(((-122.5 37.5, -122 37.5, -122 38, -122.5 38, -122.5 37.5)))',
    source_version: 'FX',
  }).select().single()
  expect(e3).toBeNull()
  districtStateHouseCA = dCA3!.id

  const { error: oErr } = await svc.from('officials').insert([
    { bioguide_id: 'P000197', first_name: 'Nancy', last_name: 'Pelosi',
      full_name: 'Nancy Pelosi', chamber: 'federal_house', party: 'D', state: 'CA',
      district_id: districtHouseCA12, senate_class: null, source_version: '119' },
    { bioguide_id: 'F000062', first_name: 'Dianne', last_name: 'Feinstein',
      full_name: 'Dianne Feinstein', chamber: 'federal_senate', party: 'D', state: 'CA',
      district_id: districtSenateCA, senate_class: 1, source_version: '119' },
    { bioguide_id: 'P000145', first_name: 'Alex', last_name: 'Padilla',
      full_name: 'Alex Padilla', chamber: 'federal_senate', party: 'D', state: 'CA',
      district_id: districtSenateCA, senate_class: 3, source_version: '119' },
    { openstates_person_id: 'ocd-person/00000000-0000-0000-0000-000000000001-int',
      full_name: 'Test State Asm', first_name: 'Test', last_name: 'Asm',
      chamber: 'state_house', party: 'Democratic', state: 'CA',
      district_id: districtStateHouseCA,
      district_code: '15', title: 'Assemblymember',
      senate_class: null, source_version: 'openstates' },
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
    { user_id: testUserId, district_id: districtStateHouseCA, tier: 'state_house' },
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
  // State official keyed by openstates_person_id (no bioguide_id on state rows).
  await svc.from('officials').delete().eq('openstates_person_id', 'ocd-person/00000000-0000-0000-0000-000000000001-int')
  if (testUserId) {
    await svc.from('user_districts').delete().eq('user_id', testUserId)
    await svc.auth.admin.deleteUser(testUserId)
  }
  // source_version='FX' sweeps all 3 fixture districts (federal_senate,
  // federal_house, state_house) in one shot.
  await svc.from('districts').delete().eq('source_version', 'FX')
})

describe('fetchMyOfficials', () => {
  it('returns the 3 federal officials joined via user_districts', async () => {
    const officials = await fetchMyOfficials(anon)
    // 3 federal + 1 state (Asm) = 4 total; filter to federal-only for this case
    // to keep the assertion stable as state coverage expands.
    const federalIds = officials
      .filter((o) => o.bioguide_id !== null)
      .map((o) => o.bioguide_id!)
      .sort()
    expect(federalIds).toEqual(['F000062', 'P000145', 'P000197'])
  })

  it('includes district join', async () => {
    const officials = await fetchMyOfficials(anon)
    const pelosi = officials.find((o) => o.bioguide_id === 'P000197')!
    expect(pelosi.district.code).toBe('federal_house:CA:12')
  })

  it('returns federal + state officials together when user has both district links', async () => {
    const officials = await fetchMyOfficials(anon)
    expect(officials).toHaveLength(4)  // 3 federal (Pelosi + Feinstein + Padilla) + 1 state (Asm)
    const stateOfficials = officials.filter((o) =>
      o.chamber === 'state_house' || o.chamber === 'state_senate' || o.chamber === 'state_legislature'
    )
    expect(stateOfficials).toHaveLength(1)
    expect(stateOfficials[0]!.openstates_person_id).toBe('ocd-person/00000000-0000-0000-0000-000000000001-int')
  })

  it('state official has district_code + title fields populated', async () => {
    const officials = await fetchMyOfficials(anon)
    const stateAsm = officials.find((o) => o.chamber === 'state_house')!
    expect(stateAsm.district_code).toBe('15')
    expect(stateAsm.title).toBe('Assemblymember')
  })

  it('federal officials keep bioguide_id and have null openstates_person_id', async () => {
    const officials = await fetchMyOfficials(anon)
    const pelosi = officials.find((o) => o.bioguide_id === 'P000197')!
    expect(pelosi.openstates_person_id).toBeNull()
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
