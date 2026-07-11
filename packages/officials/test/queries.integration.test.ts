import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'
import {
  fetchMyOfficials,
  fetchOfficial,
  fetchOfficialHoldings,
  fetchOfficialDisclosureOther,
} from '../src/queries.ts'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY

// Slice 63 (audit U10): skip locally when the env isn't exported instead of a
// module-scope throw. CI always runs (live = true via CI env) and still
// hard-fails there on a missing key, preserving slice-56-class regression
// coverage.
const live = !!SVC || !!process.env.CI
const describeLive = describe.skipIf(!live)
if (!live) {
  console.warn(
    '[@chiaro/officials] SUPABASE_SERVICE_ROLE_KEY not set — skipping integration suite. ' +
      'Run `pnpm db:start`, then export keys from `supabase status --output env` (SERVICE_ROLE_KEY).',
  )
}

let svc: SupabaseClient<Database>
let anon: SupabaseClient<Database>
let testUserId: string
let districtSenateCA: string
let districtHouseCA12: string
let districtStateHouseCA: string
let stateAsmId: string
let stateFinanceSummaryId: string

beforeAll(async () => {
  if (!live) return
  // IMPORTANT: each Supabase client must use a distinct auth storage key.
  // Without this, both clients share the same default key — when `anon` signs
  // in as integration@test, it overwrites the session `svc` would use, so
  // `svc.from(...).delete()` ends up using the user's JWT and hits RLS+grant
  // denial (403). Manifests as a silent test cleanup leak.
  svc = createClient<Database>(URL, SVC!, {
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
  // federal_holdings + federal_disclosure_other FK officials with ON DELETE
  // RESTRICT — must drop these rows by source='integ' before officials.
  await svc.from('federal_holdings').delete().eq('source', 'integ')
  await svc.from('federal_disclosure_other').delete().eq('source', 'integ')
  await svc.from('officials').delete().in('bioguide_id', ['P000197', 'F000062', 'P000145'])
  // Same defensive pre-clean for the state official keyed by openstates_person_id.
  await svc
    .from('officials')
    .delete()
    .eq('openstates_person_id', 'ocd-person/00000000-0000-0000-0000-000000000001-int')
  // And the state_house district by unique code, in case it was left behind.
  await svc.from('districts').delete().eq('code', 'CA-AD15')

  const { data: dCA1, error: e1 } = await svc
    .from('districts')
    .insert({
      tier: 'federal_senate',
      state: 'CA',
      code: 'federal_senate:CA',
      name: 'California (Senate)',
      geometry: 'MULTIPOLYGON(((-120 35, -119 35, -119 36, -120 36, -120 35)))',
      source_version: 'FX',
    })
    .select()
    .single()
  expect(e1).toBeNull()
  districtSenateCA = dCA1!.id

  const { data: dCA2, error: e2 } = await svc
    .from('districts')
    .insert({
      tier: 'federal_house',
      state: 'CA',
      code: 'federal_house:CA:12',
      name: 'California 12th',
      geometry: 'MULTIPOLYGON(((-122.5 37.5, -122 37.5, -122 38, -122.5 38, -122.5 37.5)))',
      source_version: 'FX',
    })
    .select()
    .single()
  expect(e2).toBeNull()
  districtHouseCA12 = dCA2!.id

  // Add a state_house district for the state-leg coexistence cases.
  // Code `CA-AD15` is chosen to NOT collide with TIGER-seeded codes (TIGER uses
  // `federal_house:CA:15` shape; this is a state assembly district).
  const { data: dCA3, error: e3 } = await svc
    .from('districts')
    .insert({
      tier: 'state_house',
      state: 'CA',
      code: 'CA-AD15',
      name: 'CA Assembly District 15',
      geometry: 'MULTIPOLYGON(((-122.5 37.5, -122 37.5, -122 38, -122.5 38, -122.5 37.5)))',
      source_version: 'FX',
    })
    .select()
    .single()
  expect(e3).toBeNull()
  districtStateHouseCA = dCA3!.id

  const { error: oErr } = await svc.from('officials').insert([
    {
      bioguide_id: 'P000197',
      first_name: 'Nancy',
      last_name: 'Pelosi',
      full_name: 'Nancy Pelosi',
      chamber: 'federal_house',
      party: 'D',
      state: 'CA',
      district_id: districtHouseCA12,
      senate_class: null,
      source_version: '119',
    },
    {
      bioguide_id: 'F000062',
      first_name: 'Dianne',
      last_name: 'Feinstein',
      full_name: 'Dianne Feinstein',
      chamber: 'federal_senate',
      party: 'D',
      state: 'CA',
      district_id: districtSenateCA,
      senate_class: 1,
      source_version: '119',
    },
    {
      bioguide_id: 'P000145',
      first_name: 'Alex',
      last_name: 'Padilla',
      full_name: 'Alex Padilla',
      chamber: 'federal_senate',
      party: 'D',
      state: 'CA',
      district_id: districtSenateCA,
      senate_class: 3,
      source_version: '119',
    },
    {
      openstates_person_id: 'ocd-person/00000000-0000-0000-0000-000000000001-int',
      full_name: 'Test State Asm',
      first_name: 'Test',
      last_name: 'Asm',
      chamber: 'state_house',
      party: 'Democratic',
      state: 'CA',
      district_id: districtStateHouseCA,
      district_code: '15',
      title: 'Assemblymember',
      senate_class: null,
      source_version: 'openstates',
    },
  ])
  expect(oErr).toBeNull()

  // Capture the state assemblymember's id so we can attach bill + vote rows.
  const stateAsmRow = await svc
    .from('officials')
    .select('id')
    .eq('openstates_person_id', 'ocd-person/00000000-0000-0000-0000-000000000001-int')
    .single()
  stateAsmId = stateAsmRow.data!.id

  // Seed 1 state_bill + sponsorship + 1 state_vote + position so the slice-5D
  // state-bills queries return real rows for this official.
  const { data: stateBill, error: sbErr } = await svc
    .from('state_bills')
    .insert({
      openstates_bill_id: 'ocd-bill/0000-int',
      state: 'CA',
      session: '20252026',
      bill_type: 'AB',
      number: 999,
      title: 'Integration Test Bill',
      source_url: 'https://x',
      openstates_url: 'https://y',
    })
    .select()
    .single()
  expect(sbErr).toBeNull()

  await svc.from('state_bill_sponsors').insert({
    bill_id: stateBill!.id,
    official_id: stateAsmId,
    role: 'sponsor',
  })

  const { data: stateVote } = await svc
    .from('state_votes')
    .insert({
      openstates_vote_id: 'ocd-vote/0000-int',
      bill_id: stateBill!.id,
      state: 'CA',
      session: '20252026',
      chamber: 'state_house',
      vote_date: '2025-03-01',
      question: 'On Passage',
      result: 'passed',
      source_url: 'https://x',
    })
    .select()
    .single()

  await svc.from('state_vote_positions').insert({
    vote_id: stateVote!.id,
    official_id: stateAsmId,
    position: 'yes',
  })

  // Seed 1 state_finance_summary + 2 individual donors so the slice-5E state
  // finance queries return real rows for this official.
  const { data: stateFinanceSummary, error: sfErr } = await svc
    .from('state_finance_summaries')
    .insert({
      official_id: stateAsmId,
      cycle: '2024',
      total_raised: 50000,
      total_disbursed: 35000,
      small_donor_pct: 20.0,
      in_state_pct: 75.0,
      source: 'ca-cal-access',
      source_url: 'https://x',
    })
    .select()
    .single()
  expect(sfErr).toBeNull()
  stateFinanceSummaryId = stateFinanceSummary!.id

  await svc.from('state_finance_individual_donors').insert([
    {
      state_finance_summary_id: stateFinanceSummaryId,
      rank: 1,
      donor_name: 'IT Donor',
      amount: 5000,
    },
    {
      state_finance_summary_id: stateFinanceSummaryId,
      rank: 2,
      donor_name: 'OG Donor',
      amount: 3000,
    },
  ])

  const { error: scErr } = await svc.from('state_committee_memberships').insert({
    official_id: stateAsmId,
    openstates_committee_id: 'ocd-committee/int-test',
    committee_name: 'Integration Test Cmt',
    state: 'CA',
    chamber: 'state_house',
    role: 'chair',
    source_url: 'https://x',
  })
  expect(scErr).toBeNull()

  const { data: u, error: ue } = await svc.auth.admin.createUser({
    email: 'integration@test',
    email_confirm: true,
    password: 'test1234',
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
    email: 'integration@test',
    password: 'test1234',
  })
  expect(se).toBeNull()
})

afterAll(async () => {
  if (!svc) return
  // Idempotent cleanup — deletes by content filter, not by stored UUIDs, so a
  // crashed beforeAll or a stale prior run doesn't leave orphans behind.
  // FK order: committee_memberships → finance_donors → finance_summaries →
  // vote_positions → votes → bill_sponsors → bills → officials → districts.
  // (Donors CASCADE on summary delete, but explicit delete is clearer.
  // Memberships are FK RESTRICT to officials so must precede officials delete.)
  if (stateAsmId) {
    await svc.from('state_committee_memberships').delete().eq('official_id', stateAsmId)
  }
  if (stateFinanceSummaryId) {
    await svc
      .from('state_finance_individual_donors')
      .delete()
      .eq('state_finance_summary_id', stateFinanceSummaryId)
    await svc.from('state_finance_summaries').delete().eq('id', stateFinanceSummaryId)
  }
  if (stateAsmId) {
    await svc.from('state_vote_positions').delete().eq('official_id', stateAsmId)
    await svc.from('state_bill_sponsors').delete().eq('official_id', stateAsmId)
  }
  await svc.from('state_votes').delete().eq('openstates_vote_id', 'ocd-vote/0000-int')
  await svc.from('state_bills').delete().eq('openstates_bill_id', 'ocd-bill/0000-int')
  // FK RESTRICT — must precede officials delete (slice 26).
  await svc.from('federal_holdings').delete().eq('source', 'integ')
  await svc.from('federal_disclosure_other').delete().eq('source', 'integ')
  await svc.from('officials').delete().in('bioguide_id', ['P000197', 'F000062', 'P000145'])
  // State official keyed by openstates_person_id (no bioguide_id on state rows).
  await svc
    .from('officials')
    .delete()
    .eq('openstates_person_id', 'ocd-person/00000000-0000-0000-0000-000000000001-int')
  if (testUserId) {
    await svc.from('user_districts').delete().eq('user_id', testUserId)
    await svc.auth.admin.deleteUser(testUserId)
  }
  // source_version='FX' sweeps all 3 fixture districts (federal_senate,
  // federal_house, state_house) in one shot.
  await svc.from('districts').delete().eq('source_version', 'FX')
})

describeLive('fetchMyOfficials', () => {
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
    expect(officials).toHaveLength(4) // 3 federal (Pelosi + Feinstein + Padilla) + 1 state (Asm)
    const stateOfficials = officials.filter(
      (o) =>
        o.chamber === 'state_house' ||
        o.chamber === 'state_senate' ||
        o.chamber === 'state_legislature',
    )
    expect(stateOfficials).toHaveLength(1)
    expect(stateOfficials[0]!.openstates_person_id).toBe(
      'ocd-person/00000000-0000-0000-0000-000000000001-int',
    )
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

  it('state officials can read their own state_bill_sponsors via anon RLS', async () => {
    const { data, error } = await anon
      .from('state_bill_sponsors')
      .select('bill_id, role')
      .eq('official_id', stateAsmId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]!.role).toBe('sponsor')
  })

  it('state officials can read their own state_finance_individual_donors via anon RLS', async () => {
    const { data, error } = await anon
      .from('state_finance_individual_donors')
      .select('rank, donor_name, amount')
      .eq('state_finance_summary_id', stateFinanceSummaryId)
      .order('rank')
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data![0]!.donor_name).toBe('IT Donor')
    expect(Number(data![0]!.amount)).toBe(5000)
  })

  it('state officials can read their own state_committee_memberships via anon RLS', async () => {
    const { data, error } = await anon
      .from('state_committee_memberships')
      .select('committee_name, role')
      .eq('official_id', stateAsmId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]!.role).toBe('chair')
    expect(data![0]!.committee_name).toBe('Integration Test Cmt')
  })
})

describeLive('fetchOfficial', () => {
  it('returns one official with district', async () => {
    const officials = await fetchMyOfficials(anon)
    const target = officials.find((o) => o.bioguide_id === 'P000145')!
    const detail = await fetchOfficial(anon, target.id)
    expect(detail.bioguide_id).toBe('P000145')
    expect(detail.district.tier).toBe('federal_senate')
  })

  it('throws on unknown id', async () => {
    await expect(fetchOfficial(anon, '00000000-0000-0000-0000-000000000000')).rejects.toThrow()
  })
})

describeLive('state_scorecard_* RLS + fetchOfficialStateScorecardRatings', () => {
  let scorecardId: string

  beforeAll(async () => {
    const o = await svc
      .from('state_scorecard_orgs')
      .insert({
        slug: 'aclu',
        state: 'CA',
        name: 'ACLU of California',
        issue_area: 'civil-liberties',
        lean: 'progressive',
        methodology_url: 'https://aclu.ca.org/scorecard',
        scoring_min: 0,
        scoring_max: 100,
      })
      .select('id')
      .single()
    if (o.error) throw o.error
    scorecardId = o.data!.id

    const r = await svc.from('state_scorecard_ratings').insert({
      scorecard_id: scorecardId,
      official_id: stateAsmId,
      session: '20252026',
      score: 88,
      source_url: 'https://x',
    })
    if (r.error) throw r.error
  })

  afterAll(async () => {
    if (!svc) return
    await svc.from('state_scorecard_ratings').delete().eq('scorecard_id', scorecardId)
    await svc.from('state_scorecard_orgs').delete().eq('id', scorecardId)
  })

  it('unauthenticated SELECT denied (RLS returns empty array, no error)', async () => {
    // Use a fresh client with no session — distinct storageKey so we don't
    // clobber the signed-in `anon` client's auth state.
    const unauth = createClient<Database>(URL, ANON, {
      auth: { persistSession: false, storageKey: 'unauth-integration-test' },
    })
    const { data, error } = await unauth
      .from('state_scorecard_orgs')
      .select('*')
      .eq('id', scorecardId)
    expect(data ?? []).toHaveLength(0)
    expect(error).toBeNull()
  })

  it('authenticated SELECT allowed', async () => {
    const { data, error } = await anon
      .from('state_scorecard_orgs')
      .select('*')
      .eq('id', scorecardId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('fetchOfficialStateScorecardRatings joins org row', async () => {
    const { fetchOfficialStateScorecardRatings } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateScorecardRatings(anon, stateAsmId)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const aclu = rows.find((r) => r.org.slug === 'aclu')
    expect(aclu).toBeDefined()
    expect(aclu!.org.name).toBe('ACLU of California')
  })
})

describeLive('state_community_* RLS + 3 fetchers', () => {
  let officialIdLocal: string
  let hearingId: string
  let townHallId: string
  let officeId: string
  let unauth: SupabaseClient<Database>

  beforeAll(async () => {
    // Ephemeral unauthenticated client with distinct storageKey so it doesn't
    // clobber the signed-in `anon` client's auth state (slice 5G pattern).
    unauth = createClient<Database>(URL, ANON, {
      auth: { persistSession: false, storageKey: 'unauth-community-integration-test' },
    })

    const off = await svc
      .from('officials')
      .select('id')
      .eq('chamber', 'state_house')
      .limit(1)
      .single()
    if (off.error) throw off.error
    officialIdLocal = off.data!.id

    const th = await svc
      .from('state_town_halls')
      .insert({
        official_id: officialIdLocal,
        event_date: '2026-01-15',
        city: 'San Jose',
        state: 'CA',
        format: 'hybrid',
        attendance_estimate: 100,
        source_url: 'https://x',
        source: 'townhallproject',
        external_id: 'th-integ',
      })
      .select('id')
      .single()
    if (th.error) throw th.error
    townHallId = th.data!.id

    const o = await svc
      .from('state_district_offices')
      .insert({
        official_id: officialIdLocal,
        kind: 'district',
        street_1: '123 Main',
        city: 'San Jose',
        state: 'CA',
        source_url: 'https://x',
      })
      .select('id')
      .single()
    if (o.error) throw o.error
    officeId = o.data!.id

    const h = await svc
      .from('state_committee_hearings')
      .insert({
        openstates_committee_id: 'ocd-org/integ',
        state: 'CA',
        session: '20252026',
        hearing_date: '2026-02-15',
        source_url: 'https://x',
      })
      .select('id')
      .single()
    if (h.error) throw h.error
    hearingId = h.data!.id

    await svc.from('state_committee_hearing_attendance').insert({
      hearing_id: hearingId,
      official_id: officialIdLocal,
    })
  })

  afterAll(async () => {
    if (!svc) return
    await svc.from('state_committee_hearing_attendance').delete().eq('hearing_id', hearingId)
    await svc.from('state_committee_hearings').delete().eq('id', hearingId)
    await svc.from('state_district_offices').delete().eq('id', officeId)
    await svc.from('state_town_halls').delete().eq('id', townHallId)
  })

  it('anon SELECT denied (RLS empty array)', async () => {
    const { data } = await unauth.from('state_town_halls').select('*').eq('id', townHallId)
    expect(data ?? []).toHaveLength(0)
  })

  it('authd SELECT allowed for town_halls + offices + hearings', async () => {
    const t = await anon.from('state_town_halls').select('*').eq('id', townHallId)
    expect(t.data).toHaveLength(1)
    const o = await anon.from('state_district_offices').select('*').eq('id', officeId)
    expect(o.data).toHaveLength(1)
    const h = await anon.from('state_committee_hearings').select('*').eq('id', hearingId)
    expect(h.data).toHaveLength(1)
  })

  it('fetchOfficialStateCommitteeHearings joins via attendance M:N', async () => {
    const { fetchOfficialStateCommitteeHearings } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateCommitteeHearings(anon, officialIdLocal)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const found = rows.find((r) => r.id === hearingId)
    expect(found).toBeDefined()
  })
})

describeLive('state_ethics_* RLS + 3 fetchers', () => {
  let officialIdLocal: string
  let discId: string
  let complaintId: string
  let eventId: string

  beforeAll(async () => {
    const off = await svc
      .from('officials')
      .select('id')
      .eq('chamber', 'state_house')
      .limit(1)
      .single()
    if (off.error) throw off.error
    officialIdLocal = off.data!.id

    const d = await svc
      .from('state_financial_disclosures')
      .insert({
        official_id: officialIdLocal,
        filing_year: 2025,
        income_kind: 'salary',
        state: 'CA',
        source_url: 'https://x',
        source: 'integ',
        external_id: 'integ-disc',
      })
      .select('id')
      .single()
    if (d.error) throw d.error
    discId = d.data!.id

    const c = await svc
      .from('state_ethics_complaints')
      .insert({
        official_id: officialIdLocal,
        complaint_date: '2026-01-01',
        status: 'open',
        summary: 'integration test complaint',
        state: 'CA',
        source_url: 'https://x',
        source: 'integ',
        external_id: 'integ-comp',
      })
      .select('id')
      .single()
    if (c.error) throw c.error
    complaintId = c.data!.id

    const e = await svc
      .from('state_official_events')
      .insert({
        official_id: officialIdLocal,
        event_date: '2026-01-01',
        event_type: 'censure',
        summary: 'integration test event',
        state: 'CA',
        source_url: 'https://x',
        source: 'integ',
        external_id: 'integ-evt',
      })
      .select('id')
      .single()
    if (e.error) throw e.error
    eventId = e.data!.id
  })

  afterAll(async () => {
    await svc.from('state_financial_disclosures').delete().eq('id', discId)
    await svc.from('state_ethics_complaints').delete().eq('id', complaintId)
    await svc.from('state_official_events').delete().eq('id', eventId)
  })

  it('authd SELECT allowed on all 3 tables', async () => {
    const d = await anon.from('state_financial_disclosures').select('*').eq('id', discId)
    expect(d.data).toHaveLength(1)
    const c = await anon.from('state_ethics_complaints').select('*').eq('id', complaintId)
    expect(c.data).toHaveLength(1)
    const e = await anon.from('state_official_events').select('*').eq('id', eventId)
    expect(e.data).toHaveLength(1)
  })

  it('anon SELECT denied (RLS empty array, representative table)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const unauth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, storageKey: 'unauth-5i-integ' },
    })
    const { data } = await unauth.from('state_financial_disclosures').select('*').eq('id', discId)
    expect(data ?? []).toHaveLength(0)
  })

  it('fetchOfficialStateEthicsComplaints retrieves rows', async () => {
    const { fetchOfficialStateEthicsComplaints } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateEthicsComplaints(anon as never, officialIdLocal)
    expect(rows.find((r) => r.id === complaintId)).toBeDefined()
  })

  it('fetchOfficialStateOfficialEvents retrieves rows', async () => {
    const { fetchOfficialStateOfficialEvents } = await import('../src/queries.ts')
    const rows = await fetchOfficialStateOfficialEvents(anon as never, officialIdLocal)
    expect(rows.find((r) => r.id === eventId)).toBeDefined()
  })
})

describeLive('fetchOfficialHoldings — slice 26 federal_holdings ordering', () => {
  let pelosiId: string

  beforeAll(async () => {
    const off = await svc.from('officials').select('id').eq('bioguide_id', 'P000197').single()
    if (off.error) throw off.error
    pelosiId = off.data!.id

    // 3 rows mixing filing_year + value_max so we can verify the dual-order.
    // Expected order (filing_year DESC, value_max DESC NULLS LAST):
    //   1) 2024, value_max=500_000   (h-2024-large)
    //   2) 2024, value_max=null      (h-2024-null)
    //   3) 2023, value_max=100_000   (h-2023)
    const r = await svc.from('federal_holdings').insert([
      {
        official_id: pelosiId,
        filing_year: 2023,
        source: 'integ',
        external_id: 'h-2023',
        source_url: 'https://x',
        asset_name: 'Apple',
        value_min: 50000,
        value_max: 100000,
      },
      {
        official_id: pelosiId,
        filing_year: 2024,
        source: 'integ',
        external_id: 'h-2024-large',
        source_url: 'https://x',
        asset_name: 'Tesla',
        value_min: 250000,
        value_max: 500000,
      },
      {
        official_id: pelosiId,
        filing_year: 2024,
        source: 'integ',
        external_id: 'h-2024-null',
        source_url: 'https://x',
        asset_name: 'Misc',
        value_min: null,
        value_max: null,
      },
    ])
    if (r.error) throw r.error
  })

  afterAll(async () => {
    if (!svc) return
    await svc
      .from('federal_holdings')
      .delete()
      .eq('source', 'integ')
      .in('external_id', ['h-2023', 'h-2024-large', 'h-2024-null'])
  })

  it('orders by filing_year DESC then value_max DESC nullsFirst:false', async () => {
    const rows = await fetchOfficialHoldings(anon, pelosiId)
    const integRows = rows.filter((r) => r.source === 'integ')
    expect(integRows).toHaveLength(3)
    expect(integRows[0]!.external_id).toBe('h-2024-large')
    expect(integRows[1]!.external_id).toBe('h-2024-null')
    expect(integRows[2]!.external_id).toBe('h-2023')
  })
})

describeLive('fetchOfficialDisclosureOther — slice 26 federal_disclosure_other ordering', () => {
  let pelosiId: string

  beforeAll(async () => {
    const off = await svc.from('officials').select('id').eq('bioguide_id', 'P000197').single()
    if (off.error) throw off.error
    pelosiId = off.data!.id

    // 3 rows mixing filing_year + category so we can verify the dual-order.
    // Expected order (filing_year DESC, category ASC):
    //   1) 2024, category='gift'    (do-2024-gift)
    //   2) 2024, category='travel'  (do-2024-travel)
    //   3) 2023, category='gift'    (do-2023-gift)
    const r = await svc.from('federal_disclosure_other').insert([
      {
        official_id: pelosiId,
        filing_year: 2023,
        source: 'integ',
        external_id: 'do-2023-gift',
        source_url: 'https://x',
        category: 'gift',
        description: 'Old gift',
      },
      {
        official_id: pelosiId,
        filing_year: 2024,
        source: 'integ',
        external_id: 'do-2024-travel',
        source_url: 'https://x',
        category: 'travel',
        description: 'Conference trip',
      },
      {
        official_id: pelosiId,
        filing_year: 2024,
        source: 'integ',
        external_id: 'do-2024-gift',
        source_url: 'https://x',
        category: 'gift',
        description: 'New gift',
      },
    ])
    if (r.error) throw r.error
  })

  afterAll(async () => {
    if (!svc) return
    await svc
      .from('federal_disclosure_other')
      .delete()
      .eq('source', 'integ')
      .in('external_id', ['do-2023-gift', 'do-2024-travel', 'do-2024-gift'])
  })

  it('orders by filing_year DESC then category ASC', async () => {
    const rows = await fetchOfficialDisclosureOther(anon, pelosiId)
    const integRows = rows.filter((r) => r.source === 'integ')
    expect(integRows).toHaveLength(3)
    expect(integRows[0]!.external_id).toBe('do-2024-gift')
    expect(integRows[1]!.external_id).toBe('do-2024-travel')
    expect(integRows[2]!.external_id).toBe('do-2023-gift')
  })
})
