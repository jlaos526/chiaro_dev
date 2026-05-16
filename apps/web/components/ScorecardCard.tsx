'use client'
import { useState } from 'react'
import { SCORECARD_LEAN_COLOR, type ScorecardLean } from '@chiaro/ui-tokens'
import type { ScorecardRatingWithOrg } from '@chiaro/officials'
import { MetricCardShell } from './MetricCardShell'
import { ScorecardEvidenceDrawer } from './ScorecardEvidenceDrawer'

export function ScorecardCard({ rating, officialId }: { rating: ScorecardRatingWithOrg; officialId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <MetricCardShell
        title={`${rating.org.name} (${rating.org.issue_area})`}
        value={
          <span>
            <span style={{ color: SCORECARD_LEAN_COLOR[rating.org.lean as ScorecardLean] }}>
              {rating.score}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#999' }}> / {rating.org.scoring_max}</span>
          </span>
        }
        caption={
          <a href={rating.org.methodology_url} target="_blank" rel="noreferrer">
            → methodology
          </a>
        }
        onExpand={() => setOpen(true)}
      />
      {open && (
        <ScorecardEvidenceDrawer
          rating={rating}
          officialId={officialId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
