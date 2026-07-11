import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ingestFederalTownHallsMobilize } from './federal-community-mobilize-ingest.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialId: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values ('federal_house', 'OH', 'OH-FX-FM', 'OH FX-FM',
      st_geogfromtext('MULTIPOLYGON(((-84 40,-83 40,-83 41,-84 41,-84 40)))'),
      'FX-fm')
    on conflict (tier, code) do nothing
  `)
  const o = await client.query<{ id: string }>(`
    insert into public.officials (bioguide_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'FXFM1', 'Jim Jordan', 'Jim', 'Jordan', 'federal_house', 'R', 'OH',
      d.id, true, 'FX-fm'
    from public.districts d where d.code = 'OH-FX-FM'
    returning id
  `)
  officialId = o.rows[0]!.id
})

afterEach(async () => {
  await client.query('delete from public.town_halls where official_id = $1', [officialId])
  await client.query("delete from public.officials where source_version = 'FX-fm'")
  await client.query("delete from public.districts where source_version = 'FX-fm'")
  await client.end()
})

describe('ingestFederalTownHallsMobilize', () => {
  it('happy path: UPSERTs events to town_halls via (source, external_id) UNIQUE', async () => {
    const events = [
      {
        official_id: officialId,
        legislator_name: 'Jim Jordan',
        chamber: 'federal_house' as const,
        event_date: '2026-02-15',
        city: 'Lima',
        state: 'OH',
        format: 'in_person' as const,
        source_url: 'https://www.mobilize.us/example/200002/',
        source: 'mobilize' as const,
        external_id: 'mobilize-200002',
      },
    ]
    const stats = await ingestFederalTownHallsMobilize({ client, fetcher: async () => events })
    expect(stats.rowsUpserted).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    const r = await client.query('select * from public.town_halls where external_id = $1', [
      'mobilize-200002',
    ])
    expect(r.rowCount).toBe(1)
  })

  it('idempotent re-run UPSERTs same row via (source, external_id) UNIQUE', async () => {
    const events = [
      {
        official_id: officialId,
        legislator_name: 'Jim Jordan',
        chamber: 'federal_house' as const,
        event_date: '2026-02-15',
        city: 'Lima',
        state: 'OH',
        format: 'in_person' as const,
        source_url: 'https://x',
        source: 'mobilize' as const,
        external_id: 'mobilize-200002',
      },
    ]
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => events })
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => events })
    const r = await client.query<{ c: number }>(
      "select count(*)::int as c from public.town_halls where external_id = 'mobilize-200002'",
    )
    expect(r.rows[0]!.c).toBe(1)
  })

  it('updates row when re-run with different source_url (UPSERT update)', async () => {
    const event1 = {
      official_id: officialId,
      legislator_name: 'Jim Jordan',
      chamber: 'federal_house' as const,
      event_date: '2026-02-15',
      city: 'Lima',
      state: 'OH',
      format: 'in_person' as const,
      source_url: 'https://original-url',
      source: 'mobilize' as const,
      external_id: 'mobilize-200002',
    }
    const event2 = { ...event1, source_url: 'https://updated-url' }
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => [event1] })
    await ingestFederalTownHallsMobilize({ client, fetcher: async () => [event2] })
    const r = await client.query<{ source_url: string }>(
      "select source_url from public.town_halls where external_id = 'mobilize-200002'",
    )
    expect(r.rows[0]!.source_url).toBe('https://updated-url')
  })

  it('skipOnError: continues after one row throws', async () => {
    const events = [
      // First event: invalid official_id (FK failure → throws)
      {
        official_id: '00000000-0000-0000-0000-000000000000',
        legislator_name: 'Bad Bad',
        chamber: 'federal_house' as const,
        event_date: '2026-02-15',
        city: 'Nowhere',
        state: 'OH',
        format: 'in_person' as const,
        source_url: 'https://x',
        source: 'mobilize' as const,
        external_id: 'mobilize-fail',
      },
      // Second event: valid (should still ingest)
      {
        official_id: officialId,
        legislator_name: 'Jim Jordan',
        chamber: 'federal_house' as const,
        event_date: '2026-02-15',
        city: 'Lima',
        state: 'OH',
        format: 'in_person' as const,
        source_url: 'https://x',
        source: 'mobilize' as const,
        external_id: 'mobilize-200002',
      },
    ]
    const stats = await ingestFederalTownHallsMobilize({
      client,
      skipOnError: true,
      fetcher: async () => events,
    })
    expect(stats.rowsUpserted).toBe(1)
    expect(stats.errors.length).toBeGreaterThan(0)
  })

  it('default (no skipOnError): throws on FK violation', async () => {
    const events = [
      {
        official_id: '00000000-0000-0000-0000-000000000000',
        legislator_name: 'Bad Bad',
        chamber: 'federal_house' as const,
        event_date: '2026-02-15',
        city: 'Nowhere',
        state: 'OH',
        format: 'in_person' as const,
        source_url: 'https://x',
        source: 'mobilize' as const,
        external_id: 'mobilize-fail',
      },
    ]
    await expect(
      ingestFederalTownHallsMobilize({ client, fetcher: async () => events }),
    ).rejects.toThrow()
  })

  it('empty input → zero ingested, no errors', async () => {
    const stats = await ingestFederalTownHallsMobilize({ client, fetcher: async () => [] })
    expect(stats.rowsUpserted).toBe(0)
    expect(stats.errors).toEqual([])
  })
})
