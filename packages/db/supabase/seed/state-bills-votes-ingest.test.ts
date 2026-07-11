import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestStateBillsVotes } from './state-bills-votes-ingest.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-bills')

let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house',       'CA', 'CA-15', 'CA AD 15',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-bills'),
      ('state_senate',      'CA', 'CA-08', 'CA SD 8',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'), 'FX-bills'),
      ('state_senate',      'NE', 'NE-23', 'NE District 23',
        st_geogfromtext('MULTIPOLYGON(((-100 40,-99 40,-99 41,-100 41,-100 40)))'), 'FX-bills'),
      ('state_house',       'MD', 'MD-01', 'MD HD 01',
        st_geogfromtext('MULTIPOLYGON(((-77 39,-76 39,-76 40,-77 40,-77 39)))'), 'FX-bills')
    on conflict (tier, code) do nothing
  `)
  await client.query(`
    insert into public.officials (
      openstates_person_id, first_name, last_name, full_name,
      chamber, party, state, district_id, senate_class, source_version
    )
    select t.opid, t.fname, t.lname, t.fullname,
           t.chamber::public.official_chamber, t.party, t.state,
           d.id, null, 'FX-bills'
    from (values
      ('ocd-person/00000000-0000-0000-0000-000000000001', 'Test', 'Asm', 'Test Asm',     'state_house',       'Democratic', 'CA', 'CA-15'),
      ('ocd-person/00000000-0000-0000-0000-000000000002', 'Test', 'Sen', 'Test Sen',     'state_senate',      'Republican', 'CA', 'CA-08'),
      ('ocd-person/00000000-0000-0000-0000-000000000003', 'Test', 'NE',  'Test NE Sen',  'state_legislature', 'Nonpartisan','NE', 'NE-23'),
      ('ocd-person/00000000-0000-0000-0000-000000000004', 'Test', '1A',  'Test Del 1A',  'state_house',       'Democratic', 'MD', 'MD-01'),
      ('ocd-person/00000000-0000-0000-0000-000000000005', 'Test', '1B',  'Test Del 1B',  'state_house',       'Republican', 'MD', 'MD-01')
    ) as t(opid, fname, lname, fullname, chamber, party, state, code)
    join public.districts d on d.state = t.state and d.code = t.code
    on conflict (openstates_person_id) where openstates_person_id is not null do nothing
  `)
})

afterEach(async () => {
  await client.query(
    "delete from public.state_vote_positions where official_id in (select id from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%')",
  )
  await client.query("delete from public.state_votes where state in ('CA','NE','MD')")
  await client.query(
    "delete from public.state_bill_sponsors where official_id in (select id from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%')",
  )
  await client.query(
    "delete from public.state_bill_subjects where bill_id in (select id from public.state_bills where state in ('CA','NE','MD'))",
  )
  await client.query("delete from public.state_bills where state in ('CA','NE','MD')")
  await client.query(
    "delete from public.officials where openstates_person_id like 'ocd-person/00000000-0000-0000-0000-%' and source_version = 'FX-bills'",
  )
  await client.query("delete from public.districts where source_version = 'FX-bills'")
  await client.end()
})

describe('ingestStateBillsVotes', () => {
  it('happy path: 4 bills + 1 vote ingested', async () => {
    const stats = await ingestStateBillsVotes({
      fixturesDir: FIXTURE_DIR,
      minStateBillsCount: 0,
    })
    expect(stats.errors).toEqual([])
    expect(stats.billsUpserted).toBe(4)
    expect(stats.votesUpserted).toBe(1)
  })

  it('multi-sponsor bill (MD): 1 primary + 1 cosponsor', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const sponsors = await client.query<{ role: string }>(`
      select sps.role from public.state_bill_sponsors sps
      join public.state_bills b on b.id = sps.bill_id
      where b.state = 'MD' and b.bill_type = 'HB' and b.number = 1
      order by sps.role
    `)
    const roles = sponsors.rows.map((r) => r.role)
    expect(roles).toContain('sponsor')
    expect(roles).toContain('cosponsor')
  })

  it('subjects upserted (CA AB123: Air quality + Environmental protection)', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const subjects = await client.query<{ subject: string }>(`
      select s.subject from public.state_bill_subjects s
      join public.state_bills b on b.id = s.bill_id
      where b.state = 'CA' and b.bill_type = 'AB' and b.number = 123
    `)
    const set = new Set(subjects.rows.map((r) => r.subject))
    expect(set).toContain('Air quality')
    expect(set).toContain('Environmental protection')
  })

  it('vote position attributed to correct official', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const pos = await client.query<{ position: string; oid: string }>(`
      select svp.position::text, o.openstates_person_id as oid
      from public.state_vote_positions svp
      join public.officials o on o.id = svp.official_id
      join public.state_votes v on v.id = svp.vote_id
      where v.state = 'CA'
    `)
    expect(pos.rows).toHaveLength(1)
    expect(pos.rows[0]!.position).toBe('yes')
    expect(pos.rows[0]!.oid).toBe('ocd-person/00000000-0000-0000-0000-000000000002')
  })

  it('idempotent re-run: same fixture → same row counts', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const stats2 = await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    expect(stats2.billsUpserted).toBe(4)
    const count = await client.query<{ c: number }>(`
      select count(*)::int as c from public.state_bills where state in ('CA','NE','MD')
    `)
    expect(count.rows[0]!.c).toBe(4)
  })

  it('--skip-bills: only votes ingested', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    await client.query(
      "delete from public.state_vote_positions where vote_id in (select id from public.state_votes where state = 'CA')",
    )
    await client.query("delete from public.state_votes where state = 'CA'")
    const stats = await ingestStateBillsVotes({
      fixturesDir: FIXTURE_DIR,
      minStateBillsCount: 0,
      skipBills: true,
    })
    expect(stats.billsUpserted).toBe(0)
    expect(stats.votesUpserted).toBe(1)
  })

  it('--skip-votes: only bills ingested', async () => {
    const stats = await ingestStateBillsVotes({
      fixturesDir: FIXTURE_DIR,
      minStateBillsCount: 0,
      skipVotes: true,
    })
    expect(stats.billsUpserted).toBe(4)
    expect(stats.votesUpserted).toBe(0)
  })

  it('vote with unknown bill_id logged to unmatched + skipped', async () => {
    const tmp = join(__dirname, 'fixtures', 'openstates-bills-orphan-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmp, { recursive: true })
    await writeFile(
      join(tmp, 'orphan-vote.yml'),
      `id: ocd-vote/orphan\nbill_id: ocd-bill/does-not-exist\nmotion_text: X\nresult: passed\nstart_date: '2025-01-01'\norganization: {classification: upper}\nvotes: []\nsources: [{url: 'https://x'}]\n`,
    )
    try {
      const stats = await ingestStateBillsVotes({ fixturesDir: tmp, minStateBillsCount: 0 })
      expect(stats.votesUpserted).toBe(0)
      expect(stats.unmatchedBills).toContain('ocd-bill/does-not-exist')
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })

  it('pre-flight count below threshold aborts non-zero', async () => {
    await expect(
      ingestStateBillsVotes({
        fixturesDir: FIXTURE_DIR,
        minStateBillsCount: 1000,
      }),
    ).rejects.toThrow(/pre-flight count/i)
    const c = await client.query<{ c: number }>(`
      select count(*)::int as c from public.state_bills where state in ('CA','NE','MD')
    `)
    expect(c.rows[0]!.c).toBe(0)
  })

  it('parses session per state (CA "20252026", NE "109", MD "2025rs")', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const sessions = await client.query<{ state: string; session: string }>(`
      select distinct state, session from public.state_bills where state in ('CA','NE','MD')
      order by state
    `)
    const map = Object.fromEntries(sessions.rows.map((r) => [r.state, r.session]))
    expect(map.CA).toBe('20252026')
    expect(map.NE).toBe('109')
    expect(map.MD).toBe('2025rs')
  })

  it('augmented_from is null after baseline ingest (enrichment lands later)', async () => {
    await ingestStateBillsVotes({ fixturesDir: FIXTURE_DIR, minStateBillsCount: 0 })
    const rows = await client.query<{ augmented_from: string | null }>(`
      select augmented_from from public.state_bills where state in ('CA','NE','MD')
    `)
    for (const r of rows.rows) expect(r.augmented_from).toBeNull()
  })
})
