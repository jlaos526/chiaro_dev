import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { ADAPTERS_DEFAULT, ingestStateCommunity } from './state-community-ingest.ts'
import type { StateCommunityAdapter, NormalizedDistrictOffice } from './state-community/shared.ts'
import { ADAPTER_STATUSES, formatAdapterStatusSummary } from './shared/adapter-status.ts'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let client: Client

beforeEach(async () => {
  client = new Client({ connectionString: DB_URL })
  await client.connect()
})
afterEach(async () => {
  await client.end()
})

function mkAdapter(overrides: Partial<StateCommunityAdapter>): StateCommunityAdapter {
  return {
    slug: 'test',
    component: 'halls',
    status: 'production',
    covered_states: ['CA'],
    async fetchEvents() {
      return []
    },
    ...overrides,
  }
}

describe('ingestStateCommunity', () => {
  it('happy path: runs all adapters', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        component: 'halls',
        async fetchEvents() {
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        component: 'offices',
        async fetchEvents() {
          return []
        },
      }),
    ]
    const stats = await ingestStateCommunity({ client, adapters })
    expect(stats.adaptersAttempted).toBe(2)
    expect(stats.adaptersOk).toBe(2)
    expect(stats.byAdapter).toHaveLength(2)
    // Adapter status threads through to per-adapter stats (audit C35).
    expect(stats.byAdapter.every((s) => s.status === 'production')).toBe(true)
  })

  it('--component filter restricts to that component', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        component: 'halls',
        async fetchEvents() {
          calls.push('a')
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        component: 'offices',
        async fetchEvents() {
          calls.push('b')
          return []
        },
      }),
    ]
    await ingestStateCommunity({ client, component: 'halls', adapters })
    expect(calls).toEqual(['a'])
  })

  it('--state filter passes state through to adapter and filters covered_states', async () => {
    const calls: Array<{ slug: string; state?: string }> = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        covered_states: ['CA'],
        async fetchEvents(o) {
          calls.push({ slug: 'a', ...(o.state !== undefined ? { state: o.state } : {}) })
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        covered_states: ['NY'],
        async fetchEvents() {
          calls.push({ slug: 'b' })
          return []
        },
      }),
    ]
    await ingestStateCommunity({ client, state: 'CA', adapters })
    expect(calls).toEqual([{ slug: 'a', state: 'CA' }])
  })

  it('one adapter throwing: others still run with skipOnError', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchEvents() {
          throw new Error('a broke')
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchEvents() {
          return []
        },
      }),
    ]
    const stats = await ingestStateCommunity({ client, skipOnError: true, adapters })
    expect(stats.adaptersOk).toBe(1)
    expect(stats.byAdapter.find((s) => s.adapter_slug === 'a')!.errors[0]).toMatch(/a broke/)
  })

  it('default (no skipOnError): adapter throw aborts orchestrator', async () => {
    const adapters = [
      mkAdapter({
        slug: 'a',
        async fetchEvents() {
          throw new Error('boom')
        },
      }),
      mkAdapter({
        slug: 'b',
        async fetchEvents() {
          return []
        },
      }),
    ]
    await expect(ingestStateCommunity({ client, adapters })).rejects.toThrow(/boom/)
  })

  it('--component=all runs halls + offices + hearings adapters', async () => {
    const calls: string[] = []
    const adapters = [
      mkAdapter({
        slug: 'a',
        component: 'halls',
        async fetchEvents() {
          calls.push('a')
          return []
        },
      }),
      mkAdapter({
        slug: 'b',
        component: 'offices',
        async fetchEvents() {
          calls.push('b')
          return []
        },
      }),
      mkAdapter({
        slug: 'c',
        component: 'hearings',
        async fetchEvents() {
          calls.push('c')
          return []
        },
      }),
    ]
    await ingestStateCommunity({ client, component: 'all', adapters })
    expect(calls).toEqual(['a', 'b', 'c'])
  })
})

// Audit C33 vector (a): upsertDistrictOffice is a bare INSERT, so the
// orchestrator delete-before-inserts each offices adapter's officials to stay
// idempotent + heal pre-existing duplicates.
describe('ingestStateCommunity offices idempotency (C33)', () => {
  const SV = 'FX-off-c33'
  const PID = 'ocd-person/fx-off-c33'
  let officialId: string

  beforeEach(async () => {
    await client.query(
      `
      insert into public.districts (tier, state, code, name, geometry, source_version)
      values ('state_house', 'CA', 'CA-OFF-C33', 'CA OFF C33',
        st_geogfromtext('MULTIPOLYGON(((-120 35,-119 35,-119 36,-120 36,-120 35)))'),
        $1)
      on conflict (tier, code) do nothing
    `,
      [SV],
    )
    const o = await client.query<{ id: string }>(
      `
      insert into public.officials (openstates_person_id, full_name, first_name, last_name,
        chamber, party, state, district_id, in_office, source_version)
      select $2, 'Office Twice C33', 'Office', 'Twice', 'state_house', 'D', 'CA',
        d.id, true, $1
      from public.districts d where d.code = 'CA-OFF-C33'
      returning id
    `,
      [SV, PID],
    )
    officialId = o.rows[0]!.id
  })

  afterEach(async () => {
    await client.query('delete from public.state_district_offices where official_id = $1', [
      officialId,
    ])
    await client.query('delete from public.officials where source_version = $1', [SV])
    await client.query('delete from public.districts where source_version = $1', [SV])
  })

  function officesAdapter(): StateCommunityAdapter {
    return mkAdapter({
      slug: 'off-c33',
      component: 'offices',
      covered_states: ['CA'],
      async fetchEvents(): Promise<NormalizedDistrictOffice[]> {
        return [
          {
            official_openstates_person_id: PID,
            kind: 'district',
            street_1: '1 A St',
            city: 'San Jose',
            state: 'CA',
            source_url: 'https://x/1',
          },
          {
            official_openstates_person_id: PID,
            kind: 'capitol',
            street_1: '2 B St',
            city: 'Sacramento',
            state: 'CA',
            source_url: 'https://x/2',
          },
        ]
      },
    })
  }

  it('running the offices ingest twice keeps exactly 2 rows (no duplication)', async () => {
    await ingestStateCommunity({ client, adapters: [officesAdapter()] })
    await ingestStateCommunity({ client, adapters: [officesAdapter()] })
    const r = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_district_offices where official_id = $1',
      [officialId],
    )
    expect(r.rows[0]!.c).toBe(2)
  })

  it('delete-before-insert heals pre-existing duplicate rows', async () => {
    // Simulate 3 stray rows left by a prior non-idempotent run.
    for (let i = 0; i < 3; i++) {
      await client.query(
        `insert into public.state_district_offices (official_id, kind, street_1, city, state, source_url)
         values ($1, 'district', '999 STRAY', 'San Jose', 'CA', 'https://stray')`,
        [officialId],
      )
    }
    await ingestStateCommunity({ client, adapters: [officesAdapter()] })
    const r = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_district_offices where official_id = $1',
      [officialId],
    )
    expect(r.rows[0]!.c).toBe(2) // 3 strays cleared + 2 fresh inserted
    const stray = await client.query<{ c: number }>(
      `select count(*)::int as c from public.state_district_offices
        where official_id = $1 and street_1 = '999 STRAY'`,
      [officialId],
    )
    expect(stray.rows[0]!.c).toBe(0)
  })

  it('dry-run (noApply) does NOT clear existing rows', async () => {
    await client.query(
      `insert into public.state_district_offices (official_id, kind, street_1, city, state, source_url)
       values ($1, 'district', '1 A St', 'San Jose', 'CA', 'https://x/1')`,
      [officialId],
    )
    await ingestStateCommunity({ client, adapters: [officesAdapter()], noApply: true })
    const r = await client.query<{ c: number }>(
      'select count(*)::int as c from public.state_district_offices where official_id = $1',
      [officialId],
    )
    expect(r.rows[0]!.c).toBe(1) // untouched: dry-run skips both clear + insert
  })
})

// Audit C35: stub/deprecated adapters are registered on purpose (dispatch
// unchanged) but must be visibly annotated so a zero-row "green" run can't
// masquerade as healthy coverage. Counts are pinned — they change ONLY when
// an operator wires a stub to production (or deprecates an adapter).
describe('adapter status registry (C35)', () => {
  it('every registered adapter carries a valid status; summary renders counts + slugs', () => {
    for (const a of ADAPTERS_DEFAULT) {
      expect(ADAPTER_STATUSES).toContain(a.status)
    }
    const summary = formatAdapterStatusSummary(
      ADAPTERS_DEFAULT.map((a) => ({ label: `${a.component}:${a.slug}`, status: a.status })),
    )
    expect(summary).toContain(
      'production 7 · stub 1 · deprecated 4 — stub/deprecated adapters return 0 rows BY DESIGN (audit C35)',
    )
    expect(summary).toContain('stub: offices:tx-capitol')
    expect(summary).toContain(
      'deprecated: halls:ca-leginfo, halls:fl-doe, halls:tx-capitol, halls:mi-legislature',
    )
  })
})
