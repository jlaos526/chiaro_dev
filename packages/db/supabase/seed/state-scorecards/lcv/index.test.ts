import { describe, expect, it, vi } from 'vitest'
import { lcv } from './index.ts'

interface FakeClient {
  query: ReturnType<typeof vi.fn>
}

function mkClient(): FakeClient {
  return {
    query: vi.fn().mockResolvedValue({
      rows: [{ openstates_person_id: 'osp-test' }],
      rowCount: 1,
    }),
  }
}

describe('lcv adapter', () => {
  it('reports correct slug + issue_area + lean', () => {
    expect(lcv.slug).toBe('lcv')
    expect(lcv.issue_area).toBe('environment')
    expect(lcv.lean).toBe('progressive')
    expect(lcv.scoring_min).toBe(0)
    expect(lcv.scoring_max).toBe(100)
  })

  it('covered_states is exactly ["MI", "CO"] after slice 11 narrowing', () => {
    expect(lcv.covered_states).toEqual(['MI', 'CO'])
  })

  it('name_template uses state full names for MI + CO', () => {
    expect(lcv.name_template('MI')).toBe('League of Conservation Voters Michigan')
    expect(lcv.name_template('CO')).toBe('League of Conservation Voters Colorado')
  })

  it('methodology_url_template returns michiganlcv URL for MI', () => {
    expect(lcv.methodology_url_template('MI')).toBe('https://www.michiganlcv.org/lawmakers/')
  })

  it('methodology_url_template returns conservationco URL for CO', () => {
    expect(lcv.methodology_url_template('CO')).toBe('https://conservationco.org/scorecards/')
  })

  it('fetchRatings with injected fetcher prop returns its output', async () => {
    const fixture = [
      {
        openstates_person_id: 'osp-fixture',
        state: 'MI',
        score: 95,
        source_url: 'fixture://lcv',
      },
    ]
    const result = await lcv.fetchRatings({
      session: '2025-2026',
      fetcher: async () => fixture,
    } as never)
    expect(result).toEqual(fixture)
  })

  it('fetchRatings with state=MI returns an array (production path may be empty without network)', async () => {
    const client = mkClient()
    const result = await lcv.fetchRatings({
      client: client as never,
      session: '2025-2026',
      state: 'MI',
    } as never)
    expect(Array.isArray(result)).toBe(true)
  })

  it('fetchRatings with unknown state returns []', async () => {
    const client = mkClient()
    const result = await lcv.fetchRatings({
      client: client as never,
      session: '2025-2026',
      state: 'XX',
    } as never)
    expect(result).toEqual([])
  })
})
