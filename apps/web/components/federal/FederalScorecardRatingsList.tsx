'use client'

import type { ScorecardRatingWithOrg } from '@chiaro/officials'
import { COLORS, SCORECARD_LEAN_LABEL, SCORECARD_LEAN_COLOR } from '@chiaro/ui-tokens'

interface Props { rows: ScorecardRatingWithOrg[] }

const LEAN_GROUP_ORDER = ['progressive', 'conservative', 'single-issue', 'libertarian', 'centrist'] as const

export function FederalScorecardRatingsList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No scorecard ratings on file.</div>
  }

  const byLean = new Map<string, ScorecardRatingWithOrg[]>()
  for (const r of rows) {
    const lean = r.org?.lean ?? 'centrist'
    if (!byLean.has(lean)) byLean.set(lean, [])
    byLean.get(lean)!.push(r)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 12px' }}>
      {LEAN_GROUP_ORDER.filter(l => byLean.has(l)).map(lean => (
        <div key={lean}>
          <h4 style={{
            fontSize: 13, fontWeight: 600,
            color: SCORECARD_LEAN_COLOR[lean as keyof typeof SCORECARD_LEAN_COLOR] ?? COLORS.neutral.textMuted,
            margin: '0 0 6px 0',
          }}>
            {SCORECARD_LEAN_LABEL[lean as keyof typeof SCORECARD_LEAN_LABEL] ?? lean}
          </h4>
          {byLean.get(lean)!.map(r => (
            <div
              key={r.id}
              style={{
                padding: '6px 10px', backgroundColor: COLORS.neutral.surface,
                borderRadius: 6, fontSize: 13, marginBottom: 4,
                display: 'flex', justifyContent: 'space-between',
              }}
            >
              <span style={{ color: COLORS.brand.text }}>
                {r.org?.name ?? '(unknown org)'}
                {r.org?.issue_area && (
                  <span style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginLeft: 6 }}>
                    · {r.org.issue_area}
                  </span>
                )}
              </span>
              <span style={{ fontWeight: 600, color: COLORS.brand.text }}>
                {Number(r.score).toFixed(0)} / {r.org?.scoring_max ?? 100}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
