import { describe, expect, it } from 'vitest'
import type { Database } from '@chiaro/db'
import { firstElectedYear, tenureByChamber } from '@/lib/derivations/service-record'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

function row(partial: Partial<LeadershipRow>): LeadershipRow {
  return {
    id: 'r-' + Math.random(),
    official_id: 'o1',
    role: 'Speaker',
    chamber: 'federal_house',
    party: 'D',
    start_date: '2007-01-04',
    end_date: null,
    source_url: 'https://example.org',
    ...partial,
  } as LeadershipRow
}

describe('firstElectedYear', () => {
  it('returns null for empty history', () => {
    expect(firstElectedYear([])).toBeNull()
  })
  it('returns the min start_date year across all rows', () => {
    const rows = [
      row({ start_date: '2019-01-03' }),
      row({ start_date: '2007-01-04' }),
      row({ start_date: '2013-01-03' }),
    ]
    expect(firstElectedYear(rows)).toBe(2007)
  })
})

describe('tenureByChamber', () => {
  it('returns 0/0 for empty history', () => {
    expect(tenureByChamber([])).toEqual({ house: 0, senate: 0 })
  })
  it('sums non-overlapping closed terms per chamber', () => {
    const rows = [
      row({ chamber: 'federal_house', start_date: '2007-01-01', end_date: '2013-01-01' }),
      row({ chamber: 'federal_senate', start_date: '2013-01-01', end_date: '2019-01-01' }),
    ]
    expect(tenureByChamber(rows)).toEqual({ house: 6, senate: 6 })
  })
  it('treats null end_date as "today" (uses current year)', () => {
    const today = new Date()
    const start = `${today.getFullYear() - 3}-01-01`
    const rows = [row({ chamber: 'federal_house', start_date: start, end_date: null })]
    const { house } = tenureByChamber(rows)
    // start is Jan 1 of (current year - 3); elapsed is at least 3 years
    // and at most ~4 years (Dec 31 of current year). Allow generous bound.
    expect(house).toBeGreaterThanOrEqual(2.95)
    expect(house).toBeLessThanOrEqual(4.05)
  })
  it('rounds to 1 decimal place', () => {
    const rows = [
      row({ chamber: 'federal_house', start_date: '2020-01-01', end_date: '2025-07-01' }),
    ]
    const { house } = tenureByChamber(rows)
    expect(house).toBeCloseTo(5.5, 1)
  })
})
