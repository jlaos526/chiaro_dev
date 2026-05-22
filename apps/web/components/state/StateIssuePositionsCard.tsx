'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialStateScorecardRatings,
  type StateScorecardRatingWithOrg,
} from '@chiaro/officials'
import {
  COLORS,
  SCORECARD_LEAN_COLOR,
  SCORECARD_LEAN_LABEL,
  type ScorecardLean,
} from '@chiaro/ui-tokens'
import { StateIssueVotesEvidence } from './StateIssueVotesEvidence'

interface Props { officialId: string }

const LEAN_GROUP_ORDER: ScorecardLean[] = [
  'progressive',
  'conservative',
  'single-issue',
  'libertarian',
  'centrist',
]

function leanColor(lean: string): string {
  return (SCORECARD_LEAN_COLOR as Record<string, string>)[lean] ?? COLORS.neutral.textMuted
}

function leanLabel(lean: string): string {
  return (SCORECARD_LEAN_LABEL as Record<string, string>)[lean] ?? lean
}

export function StateIssuePositionsCard({ officialId }: Props): React.JSX.Element {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const { data, isLoading } = useOfficialStateScorecardRatings(client, officialId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div style={{ color: COLORS.neutral.textMuted, fontSize: 13 }}>
          Loading issue positions…
        </div>
      </section>
    )
  }
  if (!data || data.length === 0) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Issue Positions</h2>
        <div
          style={{
            color: COLORS.neutral.textMuted,
            fontSize: 13,
            fontStyle: 'italic',
          }}
        >
          No issue-position ratings available for this legislator yet.
        </div>
      </section>
    )
  }

  // Group ratings by org.lean (preserve LEAN_GROUP_ORDER for display).
  const byLean = new Map<string, StateScorecardRatingWithOrg[]>()
  for (const r of data) {
    const key = r.org.lean
    if (!byLean.has(key)) byLean.set(key, [])
    byLean.get(key)!.push(r)
  }

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  // Render in canonical order, then any unknown leans last (defensive).
  const orderedLeans: string[] = [
    ...LEAN_GROUP_ORDER.filter(l => byLean.has(l)),
    ...Array.from(byLean.keys()).filter(l => !LEAN_GROUP_ORDER.includes(l as ScorecardLean)),
  ]

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Issue Positions</h2>
      {orderedLeans.map(lean => (
        <div key={lean} style={{ marginBottom: 12 }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: leanColor(lean),
              marginBottom: 6,
              marginTop: 0,
            }}
          >
            {leanLabel(lean)}
          </h3>
          {byLean.get(lean)!.map(r => (
            <div
              key={r.id}
              style={{
                borderBottom: `1px solid ${COLORS.neutral.border}`,
                padding: '8px 0',
              }}
            >
              <button
                type="button"
                onClick={() => toggle(r.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: COLORS.brand.text,
                  fontSize: 14,
                  textAlign: 'left',
                }}
              >
                <span style={{ textAlign: 'left' }}>
                  {r.org.name}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: COLORS.neutral.textMuted,
                    }}
                  >
                    {r.org.issue_area}
                  </span>
                </span>
                <span style={{ fontWeight: 600 }}>
                  {Number(r.score).toFixed(0)} / {r.org.scoring_max}
                </span>
              </button>
              {expanded.has(r.id) && (
                <StateIssueVotesEvidence
                  officialId={officialId}
                  issueArea={r.org.issue_area}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  background: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
}

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 12,
  marginTop: 0,
  color: COLORS.brand.text,
}
