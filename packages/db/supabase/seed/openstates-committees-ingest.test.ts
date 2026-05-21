import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ingestStateCommittees } from './openstates-committees-ingest.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let cacheDir: string
let asmChairId: string
let asmVcId: string
let asmMemId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  cacheDir = await mkdtemp(join(tmpdir(), 'openstates-committees-test-'))

  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('state_house', 'CA', 'CA-CMT-T1', 'CA Cmt T1',
      st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
      'FX-cmt-ingest')
    on conflict (tier, code) do nothing
  `)

  const chair = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-chair', 'FX Asm Chair', 'FX', 'Asm Chair', 'state_house', 'D', 'CA',
      d.id, true, 'FX-cmt-ingest'
    from public.districts d where d.code = 'CA-CMT-T1'
    returning id
  `)
  asmChairId = chair.rows[0]!.id

  const vc = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-vc', 'FX Asm VC', 'FX', 'Asm VC', 'state_house', 'D', 'CA',
      d.id, true, 'FX-cmt-ingest'
    from public.districts d where d.code = 'CA-CMT-T1'
    returning id
  `)
  asmVcId = vc.rows[0]!.id

  const mem = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-mem', 'FX Asm Mem', 'FX', 'Asm Mem', 'state_house', 'D', 'CA',
      d.id, true, 'FX-cmt-ingest'
    from public.districts d where d.code = 'CA-CMT-T1'
    returning id
  `)
  asmMemId = mem.rows[0]!.id
})

afterEach(async () => {
  await client.query(
    "delete from public.state_committee_memberships where official_id in ($1, $2, $3)",
    [asmChairId, asmVcId, asmMemId],
  )
  await client.query("delete from public.officials where source_version = $1", ['FX-cmt-ingest'])
  await client.query("delete from public.districts where source_version = $1", ['FX-cmt-ingest'])
  await client.end()
  await rm(cacheDir, { recursive: true, force: true })
})

function writeCommittee(filename: string, body: object) {
  return writeFile(join(cacheDir, filename), JSON.stringify(body), 'utf8')
}

describe('ingestStateCommittees', () => {
  it('chair role mapping: "Chair" → chair', async () => {
    await writeCommittee('CA-c1.json', {
      id: 'ocd-committee/c1', name: 'Test',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-chair', name: 'FX Asm Chair', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.committeesProcessed).toBe(1)
    expect(stats.membershipsUpserted).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    expect(stats.officialsUnmatched).toEqual([])
    expect(stats.errors).toEqual([])
    const row = await client.query<{ role: string }>(
      "select role from public.state_committee_memberships where official_id = $1",
      [asmChairId],
    )
    expect(row.rows[0]!.role).toBe('chair')
  })

  it('vice_chair role mapping handles "Vice Chair", "vice_chair", "vice-chair"', async () => {
    await writeCommittee('CA-vc.json', {
      id: 'ocd-committee/vc',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-vc',    name: 'X', role: 'Vice Chair' },
        { person_id: 'ocd-person/fx-mem',   name: 'X', role: 'vice-chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.membershipsUpserted).toBe(2)
    const rows = await client.query<{ role: string }>(
      "select role from public.state_committee_memberships where official_id in ($1, $2)",
      [asmVcId, asmMemId],
    )
    expect(rows.rows.every(r => r.role === 'vice_chair')).toBe(true)
  })

  it('unknown roles fold to member (e.g. "Ranking Member")', async () => {
    await writeCommittee('CA-rm.json', {
      id: 'ocd-committee/rm',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-mem', name: 'X', role: 'Ranking Member' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.membershipsUpserted).toBe(1)
    const row = await client.query<{ role: string }>(
      "select role from public.state_committee_memberships where official_id = $1",
      [asmMemId],
    )
    expect(row.rows[0]!.role).toBe('member')
  })

  it('unmatched person_id surfaces to officialsUnmatched', async () => {
    await writeCommittee('CA-unmatched.json', {
      id: 'ocd-committee/unmatched',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/UNKNOWN-1', name: 'Nobody', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.officialsUnmatched).toContain('ocd-person/UNKNOWN-1')
    expect(stats.membershipsUpserted).toBe(0)
  })

  it('idempotent re-run: same fixture twice → 1 membership row', async () => {
    await writeCommittee('CA-idem.json', {
      id: 'ocd-committee/idem',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'lower',
      memberships: [
        { person_id: 'ocd-person/fx-chair', name: 'X', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    await ingestStateCommittees({ cacheDir, client })
    await ingestStateCommittees({ cacheDir, client })
    const c = await client.query<{ c: number }>(
      "select count(*)::int as c from public.state_committee_memberships where official_id = $1",
      [asmChairId],
    )
    expect(c.rows[0]!.c).toBe(1)
  })

  it('joint chamber: logged + skipped, doesnt insert', async () => {
    await writeCommittee('CA-joint.json', {
      id: 'ocd-committee/joint',
      jurisdiction: { id: 'ocd-jurisdiction/country:us/state:ca/government', classification: 'state' },
      chamber: 'joint',
      memberships: [
        { person_id: 'ocd-person/fx-chair', name: 'X', role: 'Chair' },
      ],
      sources: [{ url: 'https://x' }],
      name: 'X',
    })
    const stats = await ingestStateCommittees({ cacheDir, client })
    expect(stats.membershipsUpserted).toBe(0)
    expect(stats.errors.length).toBeGreaterThan(0)
    expect(stats.errors[0]).toMatch(/unknown chamber/i)
  })
})
