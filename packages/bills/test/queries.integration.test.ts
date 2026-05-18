import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@chiaro/db'
import {
  fetchBills, fetchBill, fetchBillVotes,
  fetchOfficialSponsoredBills, fetchOfficialMissedVotes, fetchOfficialVotesOnSubject,
} from '../src/queries.ts'

const URL  = 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON_KEY!
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SVC) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')

let svc: SupabaseClient<Database>
let anon: SupabaseClient<Database>
let billA: string
let billB: string
let voteAId: string
let officialId: string
let districtId: string

beforeAll(async () => {
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
    chamber: 'senate', party: 'D', state: 'CA', district_id: districtId,
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
    congress: '119', chamber: 'senate', session: 1, roll_call: 101,
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

describe('fetchBills', () => {
  it('returns bills filtered by congress', async () => {
    const bills = await fetchBills(anon, { congress: '119' })
    expect(bills.length).toBeGreaterThanOrEqual(2)
    expect(bills.find((b) => b.id === billA)).toBeDefined()
  })

  it('filters by subject', async () => {
    const bills = await fetchBills(anon, { congress: '119', subject: 'Environmental protection' })
    expect(bills.find((b) => b.id === billA)).toBeDefined()
    expect(bills.find((b) => b.id === billB)).toBeUndefined()
  })
})

describe('fetchBill', () => {
  it('returns one bill with subjects + sponsors', async () => {
    const bill = await fetchBill(anon, billA)
    expect(bill.subjects).toContain('Environmental protection')
    expect(bill.sponsors).toHaveLength(1)
    expect(bill.sponsors[0].role).toBe('sponsor')
  })
})

describe('fetchBillVotes', () => {
  it('returns all votes on a bill with rep positions', async () => {
    const votes = await fetchBillVotes(anon, billA)
    expect(votes).toHaveLength(1)
    expect(votes[0].positions[0].position).toBe('yes')
  })
})

describe('fetchOfficialSponsoredBills', () => {
  it('returns only sponsored (not cosponsored)', async () => {
    const bills = await fetchOfficialSponsoredBills(anon, officialId, '119')
    expect(bills.map((b) => b.id)).toEqual([billA])
  })
})

describe('fetchOfficialMissedVotes', () => {
  it('returns vote_positions with position = not_voting', async () => {
    // Add a missed vote
    const { data: v2 } = await svc.from('votes').insert({
      congress: '119', chamber: 'senate', session: 1, roll_call: 102,
      vote_date: '2026-01-21', question: 'On Cloture', result: 'Failed',
      bill_id: billA, source_url: 'https://congress.gov/vote/102',
    }).select().single()
    await svc.from('vote_positions').insert([
      { vote_id: v2!.id, official_id: officialId, position: 'not_voting' },
    ])

    const missed = await fetchOfficialMissedVotes(anon, officialId, '119')
    expect(missed.length).toBeGreaterThanOrEqual(1)
    expect(missed.every((m) => m.position === 'not_voting')).toBe(true)

    await svc.from('vote_positions').delete().eq('vote_id', v2!.id)
    await svc.from('votes').delete().eq('id', v2!.id)
  })
})

describe('fetchOfficialVotesOnSubject', () => {
  it('joins via bill_subjects and returns rep positions on tagged bills', async () => {
    const rows = await fetchOfficialVotesOnSubject(anon, officialId, 'Environmental protection')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].position).toBe('yes')
  })
})
