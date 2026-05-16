import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { recomputeMetrics } from './recompute-metrics.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()

  // Seed district + official (in_office = true so the recompute picks them up)
  await client.query(`
    insert into public.districts (tier,state,code,name,geometry,source_version)
    values ('federal_house','CA','CA-11-rcfix','CA-11 rc',
      st_geogfromtext('MULTIPOLYGON(((-122.5 37.7,-122.4 37.7,-122.4 37.8,-122.5 37.8,-122.5 37.7)))'),
      'FX-rc')
    on conflict (tier,code) do nothing
  `)
  const d = await client.query("select id from public.districts where code='CA-11-rcfix'")
  const o = await client.query(`
    insert into public.officials (bioguide_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version, in_office)
    values ('RCTEST1','RC','One','RC One','house','D','CA',$1::uuid,null,'119', true)
    on conflict (bioguide_id) do update set in_office = true
    returning id
  `, [d.rows[0].id])
  officialId = o.rows[0].id

  // 2 votes in this Congress (one voted, one missed)
  const v1 = await client.query(`
    insert into public.votes (congress, chamber, session, roll_call, vote_date, question, result, source_url)
    values ('119','house',1,9001,'2026-01-15','On Passage','Passed','https://x/9001')
    on conflict (congress, chamber, session, roll_call) do update set vote_date = excluded.vote_date
    returning id
  `)
  const v2 = await client.query(`
    insert into public.votes (congress, chamber, session, roll_call, vote_date, question, result, source_url)
    values ('119','house',1,9002,'2026-02-10','On Motion','Failed','https://x/9002')
    on conflict (congress, chamber, session, roll_call) do update set vote_date = excluded.vote_date
    returning id
  `)
  await client.query("insert into public.vote_positions (vote_id, official_id, position) values ($1,$2,'yes')", [v1.rows[0].id, officialId])
  await client.query("insert into public.vote_positions (vote_id, official_id, position) values ($1,$2,'not_voting')", [v2.rows[0].id, officialId])

  // 1 sponsored + 1 cosponsored bill in this Congress
  const b1 = await client.query(`
    insert into public.bills (congress, bill_type, number, title, status, introduced_date, source_url)
    values ('119','hr',9001,'Sponsored Bill','introduced','2026-01-10','https://x/b9001')
    on conflict (congress, bill_type, number) do update set title = excluded.title
    returning id
  `)
  const b2 = await client.query(`
    insert into public.bills (congress, bill_type, number, title, status, introduced_date, source_url)
    values ('119','hr',9002,'Cosponsored Bill','introduced','2026-01-20','https://x/b9002')
    on conflict (congress, bill_type, number) do update set title = excluded.title
    returning id
  `)
  await client.query("insert into public.bill_sponsors (bill_id, official_id, role, added_date) values ($1,$2,'sponsor','2026-01-10')", [b1.rows[0].id, officialId])
  await client.query("insert into public.bill_sponsors (bill_id, official_id, role, added_date) values ($1,$2,'cosponsor','2026-01-20')", [b2.rows[0].id, officialId])

  // 1 district office, 1 town hall, 1 stock disclosure (on-time → days_late = 0)
  await client.query("insert into public.district_offices (official_id, address, city, state, source_url) values ($1,'1 Main St','SF','CA','https://x/do')", [officialId])
  await client.query("insert into public.town_halls (official_id, event_date, city, state, format, source_url) values ($1,'2026-02-15','SF','CA','in_person','https://x/th')", [officialId])
  await client.query("insert into public.stock_transactions (official_id, transaction_date, filing_date, transaction_type, source_url) values ($1,'2026-01-10','2026-01-20','purchase','https://x/sk')", [officialId])
})

afterEach(async () => {
  await client.query("delete from public.official_metrics where official_id = $1", [officialId])
  await client.query("delete from public.stock_transactions where official_id = $1", [officialId])
  await client.query("delete from public.town_halls where official_id = $1", [officialId])
  await client.query("delete from public.district_offices where official_id = $1", [officialId])
  await client.query("delete from public.vote_positions where official_id = $1", [officialId])
  await client.query("delete from public.bill_sponsors where official_id = $1", [officialId])
  await client.query("delete from public.bills where congress = '119' and number in (9001, 9002)")
  await client.query("delete from public.votes where congress = '119' and roll_call in (9001, 9002)")
  await client.query("delete from public.officials where bioguide_id = 'RCTEST1'")
  await client.end()
})

describe('recomputeMetrics', () => {
  it('computes attendance, vote counts, bill counts, evidence counts, stock compliance', async () => {
    const stats = await recomputeMetrics()
    expect(stats.officialsRecomputed).toBeGreaterThanOrEqual(1)

    const m = await client.query("select * from public.official_metrics where official_id = $1", [officialId])
    expect(m.rows.length).toBe(1)
    const row = m.rows[0]

    expect(Number(row.attendance_pct)).toBe(50.00)        // 1 voted / 2 total
    expect(row.votes_voted_count).toBe(1)
    expect(row.votes_missed_count).toBe(1)
    expect(row.total_roll_calls).toBe(2)

    expect(row.bills_sponsored_count).toBe(1)
    expect(row.bills_cosponsored_count).toBe(1)
    expect(row.career_bills_sponsored_count).toBe(1)       // populated by follow-up UPDATE

    expect(row.district_offices_count).toBe(1)
    expect(row.town_halls_count).toBe(1)

    expect(row.stock_act_disclosures_total).toBe(1)
    expect(row.stock_act_disclosures_late).toBe(0)
    expect(Number(row.stock_act_compliance_pct)).toBe(100.00)

    expect(row.committee_assignment_count).toBeNull()      // slice-5 placeholder
    expect(row.party_unity_pct).toBeNull()                 // slice-5 placeholder
  })

  it('is idempotent: re-running keeps single row per official', async () => {
    await recomputeMetrics()
    await recomputeMetrics()
    const c = await client.query("select count(*)::int as c from public.official_metrics where official_id = $1", [officialId])
    expect(c.rows[0].c).toBe(1)
  })
})
