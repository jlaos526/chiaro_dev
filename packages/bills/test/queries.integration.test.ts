import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'
import {
  fetchOfficialSponsoredBills, fetchOfficialMissedVotes,
} from '../src/queries.ts'

const URL  = 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON_KEY!
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Slice 63 (audit U10): skip locally when the env isn't exported instead of a
// module-scope throw. CI always runs (live = true via CI env) and still
// hard-fails there on a missing key.
const live = !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.CI
const describeLive = describe.skipIf(!live)
if (!live) {
  console.warn(
    '[@chiaro/bills] SUPABASE_SERVICE_ROLE_KEY not set — skipping integration suite. ' +
    'Run `pnpm db:start`, then export keys from `supabase status --output env` (SERVICE_ROLE_KEY).'
  )
}

let svc: SupabaseClient<Database>
let anon: SupabaseClient<Database>
let billA: string
let billB: string
let voteAId: string
let officialId: string
let districtId: string

beforeAll(async () => {
  if (!live) return
  svc  = createClient<Database>(URL, SVC,  { auth: { persistSession: false, storageKey: 'svc-bills-test'  } })
  anon = createClient<Database>(URL, ANON, { auth: { persistSession: false, storageKey: 'anon-bills-test' } })

  // Seed a district + official to FK from
  const { data: d } = await svc.from('districts').insert({
    tier: 'federal_senate', state: 'CA', code: 'CA-S1-bills', name: 'CA Senate test',
    geometry: 'MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))',
    source_version: 'FX-bills',
  }).select().single()
  districtId = d!.id

  const { data: o } = await svc.from('officials').insert({
    bioguide_id: 'BILLTEST1', first_name: 'B', last_name: 'T', full_name: 'Bill T',
    chamber: 'federal_senate', party: 'D', state: 'CA', district_id: districtId,
    senate_class: 1, source_version: '119',
  }).select().single()
  officialId = o!.id

  // Seed 2 bills
  const { data: b1 } = await svc.from('bills').insert({
    congress: '119', bill_type: 'hr', number: 9001, title: 'Test Env Bill',
    status: 'introduced', introduced_date: '2026-01-15',
    source_url: 'https://congress.gov/bill/9001',
  }).select().single()
  billA = b1!.id
  await svc.from('bill_subjects').insert([
    { bill_id: billA, subject: 'Environmental protection' },
    { bill_id: billA, subject: 'Air quality' },
  ])
  await svc.from('bill_sponsors').insert([
    { bill_id: billA, official_id: officialId, role: 'sponsor', added_date: '2026-01-15' },
  ])

  const { data: b2 } = await svc.from('bills').insert({
    congress: '119', bill_type: 's', number: 9002, title: 'Test Defense Bill',
    status: 'introduced', introduced_date: '2026-02-01',
    source_url: 'https://congress.gov/bill/9002',
  }).select().single()
  billB = b2!.id
  await svc.from('bill_sponsors').insert([
    { bill_id: billB, official_id: officialId, role: 'cosponsor', added_date: '2026-02-01' },
  ])

  // Seed 1 vote on bill A
  const { data: v } = await svc.from('votes').insert({
    congress: '119', chamber: 'federal_senate', session: 1, roll_call: 101,
    vote_date: '2026-01-20', question: 'On Passage', result: 'Passed',
    bill_id: billA, source_url: 'https://congress.gov/vote/101',
  }).select().single()
  voteAId = v!.id
  await svc.from('vote_positions').insert([
    { vote_id: voteAId, official_id: officialId, position: 'yes' },
  ])
})

afterAll(async () => {
  if (!svc) return
  await svc.from('vote_positions').delete().eq('vote_id', voteAId)
  await svc.from('votes').delete().eq('id', voteAId)
  await svc.from('bill_sponsors').delete().in('bill_id', [billA, billB])
  await svc.from('bill_subjects').delete().in('bill_id', [billA, billB])
  await svc.from('bills').delete().in('id', [billA, billB])
  await svc.from('officials').delete().eq('id', officialId)
  await svc.from('districts').delete().eq('id', districtId)
})

describeLive('fetchOfficialSponsoredBills', () => {
  it('returns only sponsored (not cosponsored)', async () => {
    const bills = await fetchOfficialSponsoredBills(anon, officialId, '119')
    expect(bills.map((b) => b.id)).toEqual([billA])
  })
})

describeLive('fetchOfficialMissedVotes', () => {
  it('returns vote_positions with position = not_voting, scoped to the congress', async () => {
    // Add a missed vote in the requested congress (119)
    const { data: v2 } = await svc.from('votes').insert({
      congress: '119', chamber: 'federal_senate', session: 1, roll_call: 102,
      vote_date: '2026-01-21', question: 'On Cloture', result: 'Failed',
      bill_id: billA, source_url: 'https://congress.gov/vote/102',
    }).select().single()
    // And a missed vote in a DIFFERENT congress (118) — must be excluded by the
    // `vote.congress` filter (slice 67 C17 single-request inversion).
    const { data: v3 } = await svc.from('votes').insert({
      congress: '118', chamber: 'federal_senate', session: 2, roll_call: 55,
      vote_date: '2024-09-10', question: 'On Passage', result: 'Passed',
      bill_id: billA, source_url: 'https://congress.gov/vote/118-55',
    }).select().single()
    await svc.from('vote_positions').insert([
      { vote_id: v2!.id, official_id: officialId, position: 'not_voting' },
      { vote_id: v3!.id, official_id: officialId, position: 'not_voting' },
    ])

    const missed = await fetchOfficialMissedVotes(anon, officialId, '119')
    expect(missed.length).toBeGreaterThanOrEqual(1)
    expect(missed.every((m) => m.position === 'not_voting')).toBe(true)
    // every returned vote belongs to the requested congress; the 118 row is gone
    expect(missed.every((m) => m.vote.congress === '119')).toBe(true)
    expect(missed.some((m) => m.vote_id === v3!.id)).toBe(false)

    await svc.from('vote_positions').delete().in('vote_id', [v2!.id, v3!.id])
    await svc.from('votes').delete().in('id', [v2!.id, v3!.id])
  })
})
