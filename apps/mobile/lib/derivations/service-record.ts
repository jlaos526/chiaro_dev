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
