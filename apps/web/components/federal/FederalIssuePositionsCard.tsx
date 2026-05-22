'use client'

import { useMemo } from 'react'
import { useOfficialScorecardRatings } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { FederalScorecardRatingsList } from './FederalScorecardRatingsList'

interface Props { officialId: string }

export function FederalIssuePositionsCard({ officialId }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const ratings = useOfficialScorecardRatings(client, officialId)

  if (ratings.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div style={mutedStyle}>Loading issue positions…</div>
      </section>
    )
  }

  const rows = ratings.data ?? []
  if (rows.length === 0) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No issue-position ratings available for this legislator yet.
        </div>
      </section>
    )
  }

  const leans = new Set(rows.map(r => r.org?.lean ?? 'centrist'))
  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Issue Positions</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {rows.length} org{rows.length === 1 ? '' : 's'} rated · {leans.size} lean group{leans.size === 1 ? '' : 's'}
      </div>
      <FederalScorecardRatingsList rows={rows} />
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
