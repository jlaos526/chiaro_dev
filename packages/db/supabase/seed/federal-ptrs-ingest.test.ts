import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ingestFederalPtrs } from './federal-ptrs-ingest.ts'
import type { PtrAdapter, NormalizedPtr } from './federal-disclosures/shared/types.ts'

/**
 * Build a minimal pg.Client-shaped stub with controllable .query()
 * implementation. The orchestrator runs one bulk `select id, bioguide_id`
 * query up front (officials seed), then per-row resolve queries +
 * stock_transactions INSERTs. We track all calls for assertion.
 */
function buildClientStub(
  opts: {
    officials?: Array<{
      id: string
      bioguide_id: string | null
      full_name?: string
      chamber?: string
    }>
    resolveByName?: (full_name: string, chamber: string) => string | null
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
  const inserts: Array<{ sql: string; params: unknown[] }> = []
  const resolveByName = opts.resolveByName

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
        if (resolveByName) {
          const id = resolveByName(name, chamber)
          if (id) return { rows: [{ id }], rowCount: 1 }
        } else {
          const hit = officials.find(
            (o) => o.full_name?.toLowerCase() === name.toLowerCase() && o.chamber === chamber,
          )
          if (hit) return { rows: [{ id: hit.id }], rowCount: 1 }
        }
      }
      return { rows: [], rowCount: 0 }
    }
    if (/insert into public\.stock_transactions/i.test(text)) {
      inserts.push({ sql: text, params: params ?? [] })
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  })

  return {
    client: { query, end: vi.fn().mockResolvedValue(undefined) } as never,
    inserts,
    query,
  }
}

function makeAdapter(slug: PtrAdapter['slug'], rows: NormalizedPtr[]): PtrAdapter {
  return {
    slug,
    fetchTransactions: vi.fn().mockResolvedValue(rows),
  }
}

const SAMPLE_HOUSE_ROW: NormalizedPtr = {
  official_bioguide_id: 'P000197',
  official_full_name: 'Nancy Pelosi',
  filing_year: 2025,
  transaction_date: '2025-01-05',
  filing_date: '2025-01-19',
  asset_ticker: 'AAPL',
  asset_name: 'Apple Inc.',
  transaction_type: 'purchase',
  amount_range_low: 1001,
  amount_range_high: 15000,
  source_url: 'https://disclosures-clerk.house.gov/x/20012345.pdf',
  external_id: 'house-ptr-20012345-1',
}

const SAMPLE_SENATE_ROW: NormalizedPtr = {
  // No bioguide_id — orchestrator must fall back to name-based resolve.
  official_full_name: 'Elizabeth Warren',
  filing_year: 2025,
  transaction_date: '2025-03-02',
  filing_date: '2025-03-16',
  asset_ticker: 'NVDA',
  asset_name: 'NVIDIA Corp.',
  transaction_type: 'sale',
  amount_range_low: 50001,
  amount_range_high: 100000,
  source_url: 'https://efdsearch.senate.gov/x/S1234.pdf',
  external_id: 'senate-ptr-S1234-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ingestFederalPtrs happy path', () => {
  it('writes one stock_transactions row per NormalizedPtr (bioguide path)', async () => {
    const { client, inserts } = buildClientStub()
    const house = makeAdapter('house-efd-ptr', [SAMPLE_HOUSE_ROW])
    const senate = makeAdapter('senate-efpfd-ptr', [])

    const stats = await ingestFederalPtrs({
      years: [2025],
      chamber: 'all',
      adapters: [house, senate],
      client,
    })

    expect(stats.rowsFetched).toBe(1)
    expect(stats.rowsInserted).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    expect(stats.officialsUnmatched).toEqual([])
    expect(inserts).toHaveLength(1)
    // params: [officialId, txn_date, filing_date, ticker, name, type, low, high, url, source, external_id]
    expect(inserts[0]?.params[0]).toBe('off-pelosi')
    expect(inserts[0]?.params[5]).toBe('purchase')
    expect(inserts[0]?.params[9]).toBe('house-efd-ptr')
    expect(inserts[0]?.params[10]).toBe('house-ptr-20012345-1')
  })

  it('falls back to name+chamber resolve when bioguide_id is absent', async () => {
    const { client, inserts } = buildClientStub()
    const senate = makeAdapter('senate-efpfd-ptr', [SAMPLE_SENATE_ROW])

    const stats = await ingestFederalPtrs({
      years: [2025],
      chamber: 'senate',
      adapters: [makeAdapter('house-efd-ptr', []), senate],
      client,
    })

    expect(stats.rowsInserted).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    expect(inserts[0]?.params[0]).toBe('off-warren')
    expect(inserts[0]?.params[9]).toBe('senate-efpfd-ptr')
  })

  it('logs unmatched legislator when bioguide + name both miss', async () => {
    const { client, inserts } = buildClientStub({
      officials: [], // no officials at all
    })
    const house = makeAdapter('house-efd-ptr', [SAMPLE_HOUSE_ROW])

    const stats = await ingestFederalPtrs({
      years: [2025],
      chamber: 'all',
      adapters: [house],
      client,
    })

    expect(stats.rowsInserted).toBe(0)
    expect(stats.officialsMatched).toBe(0)
    expect(stats.officialsUnmatched).toEqual(['P000197'])
    expect(inserts).toHaveLength(0)
    // resolve skip recorded in skip summary
    expect(stats.skipSummary).toMatch(/resolve/)
  })
})

describe('ingestFederalPtrs --no-apply mode', () => {
  it('skips DB writes but reports intended row count', async () => {
    const { client, inserts } = buildClientStub()
    const house = makeAdapter('house-efd-ptr', [SAMPLE_HOUSE_ROW])

    const stats = await ingestFederalPtrs({
      years: [2025],
      chamber: 'house',
      adapters: [house, makeAdapter('senate-efpfd-ptr', [])],
      client,
      noApply: true,
    })

    expect(stats.rowsFetched).toBe(1)
    expect(stats.officialsMatched).toBe(1)
    expect(stats.rowsInserted).toBe(0) // no INSERT issued
    expect(inserts).toHaveLength(0)
  })
})

describe('ingestFederalPtrs --chamber filter', () => {
  it('chamber=house invokes only houseEfdPtr', async () => {
    const { client } = buildClientStub()
    const house = makeAdapter('house-efd-ptr', [SAMPLE_HOUSE_ROW])
    const senate = makeAdapter('senate-efpfd-ptr', [SAMPLE_SENATE_ROW])

    await ingestFederalPtrs({
      years: [2025],
      chamber: 'house',
      adapters: [house, senate],
      client,
    })

    expect(house.fetchTransactions).toHaveBeenCalledTimes(1)
    expect(senate.fetchTransactions).not.toHaveBeenCalled()
  })

  it('chamber=senate invokes only senateEfpfdPtr', async () => {
    const { client } = buildClientStub()
    const house = makeAdapter('house-efd-ptr', [SAMPLE_HOUSE_ROW])
    const senate = makeAdapter('senate-efpfd-ptr', [SAMPLE_SENATE_ROW])

    await ingestFederalPtrs({
      years: [2025],
      chamber: 'senate',
      adapters: [house, senate],
      client,
    })

    expect(house.fetchTransactions).not.toHaveBeenCalled()
    expect(senate.fetchTransactions).toHaveBeenCalledTimes(1)
  })

  it('chamber=all invokes both adapters across all years', async () => {
    const { client } = buildClientStub()
    const house = makeAdapter('house-efd-ptr', [])
    const senate = makeAdapter('senate-efpfd-ptr', [])

    await ingestFederalPtrs({
      years: [2025, 2024],
      chamber: 'all',
      adapters: [house, senate],
      client,
    })

    expect(house.fetchTransactions).toHaveBeenCalledTimes(2)
    expect(senate.fetchTransactions).toHaveBeenCalledTimes(2)
  })
})

describe('ingestFederalPtrs slice 22 skip summary', () => {
  it('skipSummary reads "No skips recorded." when adapter yields without skips', async () => {
    const { client } = buildClientStub()
    const stats = await ingestFederalPtrs({
      years: [2025],
      chamber: 'all',
      adapters: [
        makeAdapter('house-efd-ptr', [SAMPLE_HOUSE_ROW]),
        makeAdapter('senate-efpfd-ptr', []),
      ],
      client,
    })
    expect(stats.skipSummary).toBe('No skips recorded.')
  })

  it('skipSummary includes resolve stage when official is unmatched', async () => {
    const { client } = buildClientStub({ officials: [] })
    const stats = await ingestFederalPtrs({
      years: [2025],
      chamber: 'house',
      adapters: [
        makeAdapter('house-efd-ptr', [SAMPLE_HOUSE_ROW]),
        makeAdapter('senate-efpfd-ptr', []),
      ],
      client,
    })
    expect(stats.skipSummary).toMatch(/house-efd-ptr/)
    expect(stats.skipSummary).toMatch(/resolve/)
  })
})

describe('ingestFederalPtrs adapter throw containment', () => {
  it('captures adapter throw to errors[] and continues across adapters', async () => {
    const { client } = buildClientStub()
    const failing: PtrAdapter = {
      slug: 'house-efd-ptr',
      fetchTransactions: vi.fn().mockRejectedValue(new Error('boom')),
    }
    const ok = makeAdapter('senate-efpfd-ptr', [SAMPLE_SENATE_ROW])

    const stats = await ingestFederalPtrs({
      years: [2025],
      chamber: 'all',
      adapters: [failing, ok],
      client,
    })

    expect(stats.errors).toHaveLength(1)
    expect(stats.errors[0]).toMatch(/house-efd-ptr/)
    expect(stats.errors[0]).toMatch(/boom/)
    expect(stats.rowsInserted).toBe(1) // ok adapter still ran
  })
})
