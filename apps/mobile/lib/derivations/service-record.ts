import type { Database } from '@chiaro/db'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

export function firstElectedYear(rows: ReadonlyArray<LeadershipRow>): number | null {
  if (rows.length === 0) return null
  let min = Number.POSITIVE_INFINITY
  for (const r of rows) {
    const y = new Date(r.start_date).getFullYear()
    if (y < min) min = y
  }
  return Number.isFinite(min) ? min : null
}

export interface TenureByChamber {
  house: number
  senate: number
}

function yearsBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()
  const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000
  return Math.max(0, (end - start) / MS_PER_YEAR)
}

export function tenureByChamber(rows: ReadonlyArray<LeadershipRow>): TenureByChamber {
  const now = new Date().toISOString()
  const acc: TenureByChamber = { house: 0, senate: 0 }
  for (const r of rows) {
    const end = r.end_date ?? now
    const years = yearsBetween(r.start_date, end)
    if (r.chamber === 'house') acc.house += years
    else if (r.chamber === 'senate') acc.senate += years
  }
  return {
    house:  Math.round(acc.house * 10) / 10,
    senate: Math.round(acc.senate * 10) / 10,
  }
}
