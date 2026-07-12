// Slice 75 (audit C11/C19/C20): the rewritten vote fetchers lean on PostgREST
// embed semantics the audit explicitly hedged — the `positions!inner` filter
// scoping and the nested `bill!inner → state_bill_subjects!inner` subject
// filter. This suite proves them against REAL PostgREST (local Supabase), the
// same way slice 67 proved the federal `votes!inner` embed in @chiaro/bills.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  fetchOfficialCosponsoredStateBills,
  fetchOfficialMissedStateVotes,
  fetchOfficialSponsoredStateBills,
  fetchOfficialStateVotes,
  fetchOfficialStateVotesOnSubject,
} from '../src/queries.ts'
import type { ChiaroClient } from '@chiaro/supabase-client'

const live = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
if (!live) {
  console.warn(
    '[state-bills] integration suite SKIPPED — export SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (supabase status --output env)',
  )
}
const d = describe.skipIf(!live)

// Gotcha #1: explicit storageKey so this client can't collide with others.
const svc = live
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, storageKey: 'sb-state-bills-s75-integ' },
    })
  : (null as never)

const PFX = 's75-integ'
let o1 = '' // official under test
let o2 = '' // second official — proves positions!inner scoping doesn't leak

async function cleanup() {
  // FK order: votes cascade positions; bills cascade subjects; state_votes'
  // bill_id is RESTRICT so votes go before bills; officials before districts.
  await svc
    .from('state_votes')
    .delete()
    .in('openstates_vote_id', [`${PFX}-v1`, `${PFX}-v2`])
  await svc
    .from('state_bills')
    .delete()
    .in('openstates_bill_id', [`${PFX}-b1`, `${PFX}-b2`])
  await svc
    .from('officials')
    .delete()
    .in('openstates_person_id', [`${PFX}-o1`, `${PFX}-o2`])
  // Test-suffixed code, NEVER a real TIGER code — CI seeds TIGER and real
  // codes collide on districts' unique (tier, code) (slice-67 pgTAP lesson).
  await svc.from('districts').delete().eq('code', 'CA-SH-S75INT')
}

d('state-bills vote queries (slice 75 embed shapes, real PostgREST)', () => {
  beforeAll(async () => {
    await cleanup()

    const { data: dist, error: dErr } = await svc
      .from('districts')
      .insert({
        tier: 'state_house',
        state: 'CA',
        code: 'CA-SH-S75INT',
        name: 'S75 integration test district',
        geometry: 'MULTIPOLYGON(((-120 35, -119 35, -119 36, -120 36, -120 35)))',
        source_version: 'FX',
      })
      .select('id')
      .single()
    expect(dErr).toBeNull()
    const districtId = dist!.id

    const { data: offs, error: oErr } = await svc
      .from('officials')
      .insert([
        {
          full_name: 'S75 Test Rep',
          first_name: 'S75',
          last_name: 'Rep',
          chamber: 'state_house',
          party: 'D',
          state: 'CA',
          district_id: districtId,
          openstates_person_id: `${PFX}-o1`,
          source_version: 'integ',
        },
        {
          full_name: 'S75 Other Rep',
          first_name: 'S75',
          last_name: 'Other',
          chamber: 'state_house',
          party: 'R',
          state: 'CA',
          district_id: districtId,
          openstates_person_id: `${PFX}-o2`,
          source_version: 'integ',
        },
      ])
      .select('id, openstates_person_id')
    expect(oErr).toBeNull()
    o1 = offs!.find((o) => o.openstates_person_id === `${PFX}-o1`)!.id
    o2 = offs!.find((o) => o.openstates_person_id === `${PFX}-o2`)!.id

    const { data: bills, error: bErr } = await svc
      .from('state_bills')
      .insert([
        {
          openstates_bill_id: `${PFX}-b1`,
          state: 'CA',
          session: '20252026',
          bill_type: 'AB',
          number: 101,
          title: 'S75 education funding bill',
          source_url: 'https://example.com/b1',
          openstates_url: 'https://example.com/os/b1',
        },
        {
          openstates_bill_id: `${PFX}-b2`,
          state: 'CA',
          session: '20252026',
          bill_type: 'AB',
          number: 102,
          title: 'S75 budget bill',
          source_url: 'https://example.com/b2',
          openstates_url: 'https://example.com/os/b2',
        },
      ])
      .select('id, openstates_bill_id')
    expect(bErr).toBeNull()
    const b1 = bills!.find((b) => b.openstates_bill_id === `${PFX}-b1`)!.id
    const b2 = bills!.find((b) => b.openstates_bill_id === `${PFX}-b2`)!.id

    const { error: sErr } = await svc.from('state_bill_subjects').insert([
      { bill_id: b1, subject: 'education' },
      { bill_id: b2, subject: 'budget' },
    ])
    expect(sErr).toBeNull()

    // Sponsorships for the slice-79 single-request sponsored/cosponsored
    // fetchers. o2's rows on the SAME bills prove (a) the `me` !inner filter
    // doesn't leak other officials' bills in, and (b) the unfiltered
    // `sponsors` alias still carries the bill's FULL sponsor list.
    const { error: spErr } = await svc.from('state_bill_sponsors').insert([
      { bill_id: b1, official_id: o1, role: 'sponsor' },
      { bill_id: b1, official_id: o2, role: 'cosponsor' },
      { bill_id: b2, official_id: o1, role: 'cosponsor' },
      { bill_id: b2, official_id: o2, role: 'sponsor' },
    ])
    expect(spErr).toBeNull()

    const { data: votes, error: vErr } = await svc
      .from('state_votes')
      .insert([
        {
          openstates_vote_id: `${PFX}-v1`,
          bill_id: b1,
          state: 'CA',
          session: '20252026',
          chamber: 'state_house',
          vote_date: '2025-03-02',
          question: 'S75 v1 — Assembly floor passage',
          result: 'pass',
          source_url: 'https://example.com/v1',
        },
        {
          openstates_vote_id: `${PFX}-v2`,
          bill_id: b2,
          state: 'CA',
          session: '20252026',
          chamber: 'state_house',
          vote_date: '2025-03-01',
          question: 'S75 v2 — Assembly floor passage',
          result: 'pass',
          source_url: 'https://example.com/v2',
        },
      ])
      .select('id, openstates_vote_id')
    expect(vErr).toBeNull()
    const v1 = votes!.find((v) => v.openstates_vote_id === `${PFX}-v1`)!.id
    const v2 = votes!.find((v) => v.openstates_vote_id === `${PFX}-v2`)!.id

    const { error: pErr } = await svc.from('state_vote_positions').insert([
      { vote_id: v1, official_id: o1, position: 'yes' },
      { vote_id: v2, official_id: o1, position: 'not_voting' },
      { vote_id: v1, official_id: o2, position: 'no' }, // must never leak into o1 results
    ])
    expect(pErr).toBeNull()
  }, 30_000)

  afterAll(async () => {
    await cleanup()
  }, 30_000)

  it('fetchOfficialStateVotes: single anchored request, server-ordered, position scoped to the official', async () => {
    const rows = await fetchOfficialStateVotes(svc as unknown as ChiaroClient, o1)
    const mine = rows.filter((r) => r.vote.question.startsWith('S75'))
    expect(mine).toHaveLength(2)
    // Server-side vote_date desc — v1 (03-02) before v2 (03-01).
    expect(mine[0]!.vote.question).toContain('v1')
    expect(mine[0]!.position).toBe('yes') // o1's position, NOT o2's 'no'
    expect(mine[1]!.position).toBe('not_voting')
    expect(mine[0]!.vote.bill?.title).toContain('education')
  })

  it('fetchOfficialMissedStateVotes: position filter rides the same request', async () => {
    const rows = await fetchOfficialMissedStateVotes(svc as unknown as ChiaroClient, o1)
    const mine = rows.filter((r) => r.vote.question.startsWith('S75'))
    expect(mine).toHaveLength(1)
    expect(mine[0]!.vote.question).toContain('v2')
    expect(mine[0]!.position).toBe('not_voting')
  })

  it('fetchOfficialSponsoredStateBills: one request; me-filter constrains, sponsors alias carries the full list', async () => {
    const rows = await fetchOfficialSponsoredStateBills(svc as unknown as ChiaroClient, o1)
    expect(rows.map((b) => b.number)).toEqual([101])
    // The unfiltered `sponsors` alias: BOTH officials' rows, not just o1's.
    expect(rows[0]!.sponsors).toHaveLength(2)
    expect(rows[0]!.subjects).toEqual(['education'])
    // The filtering `me` embed is stripped before return (shape unchanged).
    expect('me' in rows[0]!).toBe(false)
  })

  it('fetchOfficialCosponsoredStateBills: role isolation via the me alias', async () => {
    const rows = await fetchOfficialCosponsoredStateBills(svc as unknown as ChiaroClient, o1)
    expect(rows.map((b) => b.number)).toEqual([102])
    expect(rows[0]!.sponsors).toHaveLength(2)
  })

  it('fetchOfficialStateVotesOnSubject: nested bill!inner subjects filter constrains parents', async () => {
    const edu = await fetchOfficialStateVotesOnSubject(svc as unknown as ChiaroClient, o1, [
      'education',
    ])
    const eduMine = edu.filter((r) => r.vote.question.startsWith('S75'))
    expect(eduMine).toHaveLength(1)
    expect(eduMine[0]!.vote.question).toContain('v1')

    const both = await fetchOfficialStateVotesOnSubject(svc as unknown as ChiaroClient, o1, [
      'education',
      'budget',
    ])
    expect(both.filter((r) => r.vote.question.startsWith('S75'))).toHaveLength(2)

    expect(await fetchOfficialStateVotesOnSubject(svc as unknown as ChiaroClient, o1, [])).toEqual(
      [],
    )
  })
})
