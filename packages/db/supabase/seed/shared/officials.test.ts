import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import {
  resolveOfficialByName,
  resolveOpenstatesPersonId,
  type AmbiguousMatch,
  type Chamber,
} from './officials.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client
let officialIdState: string
let officialIdFederal: string

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
  await client.query(`
    insert into public.districts (tier, state, code, name, geometry, source_version)
    values
      ('state_house', 'CA', 'CA-FX-OFF-S', 'CA OFF state',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-off-s'),
      ('federal_house', 'CA', 'CA-FX-OFF-F', 'CA OFF federal',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        'FX-off-f')
    on conflict (tier, code) do nothing
  `)
  const s = await client.query<{ id: string }>(`
    insert into public.officials (openstates_person_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'ocd-person/fx-off-s', 'Jane Doe', 'Jane', 'Doe', 'state_house', 'D', 'CA',
      d.id, true, 'FX-off-s'
    from public.districts d where d.code = 'CA-FX-OFF-S'
    returning id
  `)
  officialIdState = s.rows[0]!.id
  const f = await client.query<{ id: string }>(`
    insert into public.officials (bioguide_id, full_name, first_name, last_name,
      chamber, party, state, district_id, in_office, source_version)
    select 'FXOFFF1', 'John Smith', 'John', 'Smith', 'federal_house', 'D', 'CA',
      d.id, true, 'FX-off-f'
    from public.districts d where d.code = 'CA-FX-OFF-F'
    returning id
  `)
  officialIdFederal = f.rows[0]!.id
})

afterEach(async () => {
  await client.query("delete from public.officials where source_version in ('FX-off-s','FX-off-f')")
  await client.query("delete from public.districts where source_version in ('FX-off-s','FX-off-f')")
  await client.end()
})

describe('resolveOfficialByName', () => {
  it('resolves state legislator by name + state + chamber', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'Jane Doe', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialIdState)
  })

  it('resolves federal legislator with federal_house chamber', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'John Smith', state: 'CA', chamber: 'federal_house',
    })
    expect(id).toBe(officialIdFederal)
  })

  it('returns null for chamber mismatch (federal name with state chamber)', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'John Smith', state: 'CA', chamber: 'state_house' as Chamber,
    })
    expect(id).toBeNull()
  })

  it('case-insensitive name match', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'JANE DOE', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBe(officialIdState)
  })

  it('returns null for unknown name', async () => {
    const id = await resolveOfficialByName(client, {
      full_name: 'Nobody Here', state: 'CA', chamber: 'state_house',
    })
    expect(id).toBeNull()
  })

  it('single match does NOT fire onAmbiguous', async () => {
    const seen: AmbiguousMatch[] = []
    const id = await resolveOfficialByName(client, {
      full_name: 'Jane Doe', state: 'CA', chamber: 'state_house',
      onAmbiguous: (info) => seen.push(info),
    })
    expect(id).toBe(officialIdState)
    expect(seen).toEqual([])
  })
})

describe('resolveOpenstatesPersonId', () => {
  it('resolves openstates_person_id for a single match', async () => {
    const pid = await resolveOpenstatesPersonId(client, {
      full_name: 'Jane Doe', state: 'CA', chamber: 'state_house',
    })
    expect(pid).toBe('ocd-person/fx-off-s')
  })

  it('returns null for a match with no openstates_person_id (federal)', async () => {
    const pid = await resolveOpenstatesPersonId(client, {
      full_name: 'John Smith', state: 'CA', chamber: 'federal_house',
    })
    expect(pid).toBeNull()
  })

  it('single match does NOT fire onAmbiguous', async () => {
    const seen: AmbiguousMatch[] = []
    const pid = await resolveOpenstatesPersonId(client, {
      full_name: 'Jane Doe', state: 'CA', chamber: 'state_house',
      onAmbiguous: (info) => seen.push(info),
    })
    expect(pid).toBe('ocd-person/fx-off-s')
    expect(seen).toEqual([])
  })
})

// Audit G3: two in-office officials sharing full_name+state+chamber must NOT
// silently attach data to an arbitrary one — both resolvers fire onAmbiguous
// and return null instead.
describe('name-resolver ambiguity guard (G3)', () => {
  const AMB_SV = 'FX-amb-g3'
  const AMB_NAME = 'Ambiguous Twin G3'

  beforeEach(async () => {
    await client.query(`
      insert into public.districts (tier, state, code, name, geometry, source_version)
      values ('state_house', 'CA', 'CA-FX-AMB-G3', 'CA AMB G3',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        $1)
      on conflict (tier, code) do nothing
    `, [AMB_SV])
    await client.query(`
      insert into public.officials (openstates_person_id, full_name, first_name, last_name,
        chamber, party, state, district_id, in_office, source_version)
      select unnest(array['ocd-person/amb-g3-1', 'ocd-person/amb-g3-2']),
             $1, 'Ambiguous', 'Twin', 'state_house', 'D', 'CA',
             d.id, true, $2
      from public.districts d where d.code = 'CA-FX-AMB-G3'
    `, [AMB_NAME, AMB_SV])
  })

  afterEach(async () => {
    await client.query('delete from public.officials where source_version = $1', [AMB_SV])
    await client.query('delete from public.districts where source_version = $1', [AMB_SV])
  })

  it('resolveOfficialByName returns null + fires onAmbiguous once', async () => {
    const seen: AmbiguousMatch[] = []
    const id = await resolveOfficialByName(client, {
      full_name: AMB_NAME, state: 'CA', chamber: 'state_house',
      onAmbiguous: (info) => seen.push(info),
    })
    expect(id).toBeNull()
    expect(seen).toEqual([{ full_name: AMB_NAME, state: 'CA', chamber: 'state_house' }])
  })

  it('resolveOpenstatesPersonId returns null + fires onAmbiguous once', async () => {
    const seen: AmbiguousMatch[] = []
    const pid = await resolveOpenstatesPersonId(client, {
      full_name: AMB_NAME, state: 'CA', chamber: 'state_house',
      onAmbiguous: (info) => seen.push(info),
    })
    expect(pid).toBeNull()
    expect(seen).toEqual([{ full_name: AMB_NAME, state: 'CA', chamber: 'state_house' }])
  })

  it('ambiguous match without onAmbiguous still returns null (safe default)', async () => {
    expect(await resolveOfficialByName(client, {
      full_name: AMB_NAME, state: 'CA', chamber: 'state_house',
    })).toBeNull()
    expect(await resolveOpenstatesPersonId(client, {
      full_name: AMB_NAME, state: 'CA', chamber: 'state_house',
    })).toBeNull()
  })
})
