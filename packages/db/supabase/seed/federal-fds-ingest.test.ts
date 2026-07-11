import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ingestFederalFds } from './federal-fds-ingest.ts'
import type {
  FdAdapter,
  NormalizedDisclosureOther,
  NormalizedHolding,
} from './federal-disclosures/shared/types.ts'

/**
 * Build a minimal pg.Client-shaped stub with controllable .query()
 * implementation. The orchestrator runs one bulk `select id, bioguide_id`
 * query up front (officials seed), then per-row resolve queries + UPSERT
 * INSERTs against both federal_holdings + federal_disclosure_other.
 */
function buildClientStub(
  opts: {
    officials?: Array<{
      id: string
      bioguide_id: string | null
      full_name?: string
      chamber?: string
    }>
  } = {},
) {
  const officials = opts.officials ?? [
    {
      id: 'off-pelosi',
      bioguide_id: 'P000197',
      full_name: 'Nancy Pelosi',
      chamber: 'federal_house',
    },
    {
      id: 'off-warren',
      bioguide_id: 'W000817',
      full_name: 'Elizabeth Warren',
      chamber: 'federal_senate',
    },
  ]
  const holdingsInserts: Array<{ sql: string; params: unknown[] }> = []
  const otherInserts: Array<{ sql: string; params: unknown[] }> = []

  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    const text = String(sql)
    if (/from public\.officials\s+where bioguide_id is not null/i.test(text)) {
      return {
        rows: officials.map((o) => ({ id: o.id, bioguide_id: o.bioguide_id })),
        rowCount: officials.length,
      }
    }
    if (/lower\(full_name\)/i.test(text) && /chamber = \$2/i.test(text)) {
      const name = params?.[0] as string | undefined
      const chamber = params?.[1] as string | undefined
      if (name && chamber) {
        const hit = officials.find(
          (o) => o.full_name?.toLowerCase() === name.toLowerCase() && o.chamber === chamber,
        )
        if (hit) return { rows: [{ id: hit.id }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    }
    if (/insert into public\.federal_holdings/i.test(text)) {
      holdingsInserts.push({ sql: text, params: params ?? [] })
      return { rows: [], rowCount: 1 }
    }
    if (/insert into public\.federal_disclosure_other/i.test(text)) {
      otherInserts.push({ sql: text, params: params ?? [] })
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  })

  return {
    client: { query, end: vi.fn().mockResolvedValue(undefined) } as never,
    holdingsInserts,
    otherInserts,
    query,
  }
}

function makeAdapter(
  slug: FdAdapter['slug'],
  result: { holdings: NormalizedHolding[]; other: NormalizedDisclosureOther[] },
): FdAdapter {
  return {
    slug,
    fetchDisclosures: vi.fn().mockResolvedValue(result),
  }
}

const SAMPLE_HOUSE_HOLDING: NormalizedHolding = {
  official_bioguide_id: 'P000197',
  official_full_name: 'Nancy Pelosi',
  filing_year: 2025,
  asset_name: 'Apple Inc.',
  asset_ticker: 'AAPL',
  asset_type: 'stock',
  value_min: 15001,
  value_max: 50000,
  source_url: 'https://disclosures-clerk.house.gov/x/90012345.pdf',
  external_id: 'house-fd-90012345-A-1',
}

const SAMPLE_HOUSE_OTHER: NormalizedDisclosureOther = {
  official_bioguide_id: 'P000197',
  official_full_name: 'Nancy Pelosi',
  filing_year: 2025,
  category: 'gift',
  description: 'Annual dinner gift',
  value_min: 1001,
  value_max: 15000,
  value_text: '$1,001 - $15,000',
  source_url: 'https://disclosures-clerk.house.gov/x/90012345.pdf',
  external_id: 'house-fd-90012345-H-1',
}

const SAMPLE_SENATE_HOLDING: NormalizedHolding = {
  // No bioguide_id — orchestrator must fall back to name-based resolve.
  official_full_name: 'Elizabeth Warren',
  filing_year: 2025,
  asset_name: 'NVIDIA Corp.',
  asset_ticker: 'NVDA',
  asset_type: 'stock',
  value_min: 50001,
  value_max: 100000,
  source_url: 'https://efdsearch.senate.gov/x/S1234.pdf',
  external_id: 'senate-fd-S1234-A-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ingestFederalFds happy path', () => {
  it('writes one row per holding + one row per other (bioguide path)', async () => {
    const { client, holdingsInserts, otherInserts } = buildClientStub()
    const house = makeAdapter('house-efd-fd', {
      holdings: [SAMPLE_HOUSE_HOLDING],
      other: [SAMPLE_HOUSE_OTHER],
    })
    const senate = makeAdapter('senate-efpfd-fd', { holdings: [], other: [] })

    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'all',
      adapters: [house, senate],
      client,
    })

    expect(stats.holdingsFetched).toBe(1)
    expect(stats.holdingsInserted).toBe(1)
    expect(stats.otherFetched).toBe(1)
    expect(stats.otherInserted).toBe(1)
    expect(stats.officialsMatched).toBe(2)
    expect(stats.officialsUnmatched).toEqual([])
    expect(holdingsInserts).toHaveLength(1)
    expect(otherInserts).toHaveLength(1)
    // holdings params: [officialId, filing_year, source, external_id, source_url, ...]
    expect(holdingsInserts[0]?.params[0]).toBe('off-pelosi')
    expect(holdingsInserts[0]?.params[2]).toBe('house-efd-fd')
    expect(holdingsInserts[0]?.params[3]).toBe('house-fd-90012345-A-1')
    // other params: [officialId, filing_year, source, external_id, source_url, category, ...]
    expect(otherInserts[0]?.params[0]).toBe('off-pelosi')
    expect(otherInserts[0]?.params[2]).toBe('house-efd-fd')
    expect(otherInserts[0]?.params[3]).toBe('house-fd-90012345-H-1')
    expect(otherInserts[0]?.params[5]).toBe('gift')
    // Regression: ON CONFLICT must include the partial-index predicate
    // `where external_id is not null` so Postgres can match the partial
    // unique index from migration 0054. Without it, production INSERTs
    // throw `there is no unique or exclusion constraint matching the
    // ON CONFLICT specification` on first row. See state-side precedent
    // at state-ethics/shared.ts:99,128,153.
    expect(holdingsInserts[0]?.sql).toMatch(
      /on conflict\s*\(source,\s*external_id\)\s+where\s+external_id\s+is\s+not\s+null/i,
    )
    expect(otherInserts[0]?.sql).toMatch(
      /on conflict\s*\(source,\s*external_id\)\s+where\s+external_id\s+is\s+not\s+null/i,
    )
  })

  it('falls back to name+chamber resolve when bioguide_id is absent', async () => {
    const { client, holdingsInserts } = buildClientStub()
    const senate = makeAdapter('senate-efpfd-fd', {
      holdings: [SAMPLE_SENATE_HOLDING],
      other: [],
    })

    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'senate',
      adapters: [makeAdapter('house-efd-fd', { holdings: [], other: [] }), senate],
      client,
    })

    expect(stats.holdingsInserted).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    expect(holdingsInserts[0]?.params[0]).toBe('off-warren')
    expect(holdingsInserts[0]?.params[2]).toBe('senate-efpfd-fd')
  })

  it('logs unmatched legislator when bioguide + name both miss (resolve skip)', async () => {
    const { client, holdingsInserts } = buildClientStub({ officials: [] })
    const house = makeAdapter('house-efd-fd', {
      holdings: [SAMPLE_HOUSE_HOLDING],
      other: [SAMPLE_HOUSE_OTHER],
    })

    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'all',
      adapters: [house, makeAdapter('senate-efpfd-fd', { holdings: [], other: [] })],
      client,
    })

    expect(stats.holdingsInserted).toBe(0)
    expect(stats.otherInserted).toBe(0)
    expect(stats.officialsMatched).toBe(0)
    expect(stats.officialsUnmatched).toContain('P000197')
    expect(holdingsInserts).toHaveLength(0)
    expect(stats.skipSummary).toMatch(/resolve/)
  })
})

describe('ingestFederalFds --no-apply mode', () => {
  it('skips DB writes but reports intended counts for both sinks', async () => {
    const { client, holdingsInserts, otherInserts } = buildClientStub()
    const house = makeAdapter('house-efd-fd', {
      holdings: [SAMPLE_HOUSE_HOLDING],
      other: [SAMPLE_HOUSE_OTHER],
    })

    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'house',
      adapters: [house, makeAdapter('senate-efpfd-fd', { holdings: [], other: [] })],
      client,
      noApply: true,
    })

    expect(stats.holdingsFetched).toBe(1)
    expect(stats.otherFetched).toBe(1)
    expect(stats.officialsMatched).toBe(2) // matched twice (once per row)
    expect(stats.holdingsInserted).toBe(0) // not written
    expect(stats.otherInserted).toBe(0) // not written
    expect(holdingsInserts).toHaveLength(0)
    expect(otherInserts).toHaveLength(0)
  })
})

describe('ingestFederalFds --chamber filter', () => {
  it('chamber=house invokes only houseEfdFd', async () => {
    const { client } = buildClientStub()
    const house = makeAdapter('house-efd-fd', {
      holdings: [SAMPLE_HOUSE_HOLDING],
      other: [],
    })
    const senate = makeAdapter('senate-efpfd-fd', {
      holdings: [SAMPLE_SENATE_HOLDING],
      other: [],
    })

    await ingestFederalFds({
      years: [2025],
      chamber: 'house',
      adapters: [house, senate],
      client,
    })

    expect(house.fetchDisclosures).toHaveBeenCalledTimes(1)
    expect(senate.fetchDisclosures).not.toHaveBeenCalled()
  })

  it('chamber=senate invokes only senateEfpfdFd', async () => {
    const { client } = buildClientStub()
    const house = makeAdapter('house-efd-fd', {
      holdings: [SAMPLE_HOUSE_HOLDING],
      other: [],
    })
    const senate = makeAdapter('senate-efpfd-fd', {
      holdings: [SAMPLE_SENATE_HOLDING],
      other: [],
    })

    await ingestFederalFds({
      years: [2025],
      chamber: 'senate',
      adapters: [house, senate],
      client,
    })

    expect(house.fetchDisclosures).not.toHaveBeenCalled()
    expect(senate.fetchDisclosures).toHaveBeenCalledTimes(1)
  })

  it('chamber=all invokes both adapters across all years', async () => {
    const { client } = buildClientStub()
    const house = makeAdapter('house-efd-fd', { holdings: [], other: [] })
    const senate = makeAdapter('senate-efpfd-fd', { holdings: [], other: [] })

    await ingestFederalFds({
      years: [2025, 2024],
      chamber: 'all',
      adapters: [house, senate],
      client,
    })

    expect(house.fetchDisclosures).toHaveBeenCalledTimes(2)
    expect(senate.fetchDisclosures).toHaveBeenCalledTimes(2)
  })
})

describe('ingestFederalFds slice 22 skip summary', () => {
  it('skipSummary reads "No skips recorded." when adapter yields without skips', async () => {
    const { client } = buildClientStub()
    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'all',
      adapters: [
        makeAdapter('house-efd-fd', { holdings: [SAMPLE_HOUSE_HOLDING], other: [] }),
        makeAdapter('senate-efpfd-fd', { holdings: [], other: [] }),
      ],
      client,
    })
    expect(stats.skipSummary).toBe('No skips recorded.')
  })

  it('skipSummary includes resolve stage when official is unmatched', async () => {
    const { client } = buildClientStub({ officials: [] })
    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'house',
      adapters: [
        makeAdapter('house-efd-fd', { holdings: [SAMPLE_HOUSE_HOLDING], other: [] }),
        makeAdapter('senate-efpfd-fd', { holdings: [], other: [] }),
      ],
      client,
    })
    expect(stats.skipSummary).toMatch(/house-efd-fd/)
    expect(stats.skipSummary).toMatch(/resolve/)
  })

  it('propagates onSkip calls from adapter into the collector', async () => {
    const { client } = buildClientStub()
    const skippingHouse: FdAdapter = {
      slug: 'house-efd-fd',
      fetchDisclosures: vi.fn(async (opts) => {
        opts.onSkip?.({
          adapter: 'house-efd-fd',
          stage: 'fetch',
          reason: 'ZIP 502',
        })
        return { holdings: [], other: [] }
      }),
    }
    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'house',
      adapters: [skippingHouse, makeAdapter('senate-efpfd-fd', { holdings: [], other: [] })],
      client,
    })
    expect(stats.skipSummary).toMatch(/fetch/)
    expect(stats.skipSummary).toMatch(/ZIP 502/)
  })
})

describe('ingestFederalFds adapter throw containment', () => {
  it('captures adapter throw to errors[] and continues across adapters', async () => {
    const { client } = buildClientStub()
    const failing: FdAdapter = {
      slug: 'house-efd-fd',
      fetchDisclosures: vi.fn().mockRejectedValue(new Error('boom')),
    }
    const ok = makeAdapter('senate-efpfd-fd', {
      holdings: [SAMPLE_SENATE_HOLDING],
      other: [],
    })

    const stats = await ingestFederalFds({
      years: [2025],
      chamber: 'all',
      adapters: [failing, ok],
      client,
    })

    expect(stats.errors).toHaveLength(1)
    expect(stats.errors[0]).toMatch(/house-efd-fd/)
    expect(stats.errors[0]).toMatch(/boom/)
    expect(stats.holdingsInserted).toBe(1) // ok adapter still ran
  })
})
