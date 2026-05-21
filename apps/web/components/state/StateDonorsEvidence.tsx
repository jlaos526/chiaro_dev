'use client'
import { useState } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'

const INITIAL_ROW_COUNT = 5

function fmtAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function secondaryLine(d: StateFinanceIndividualDonorRow): string | null {
  const parts: string[] = []
  if (d.employer) parts.push(d.employer)
  if (d.occupation) parts.push(d.occupation)
  if (d.city) {
    parts.push(d.donor_state ? `${d.city}, ${d.donor_state}` : d.city)
  } else if (d.donor_state) {
    parts.push(d.donor_state)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function StateDonorsEvidence({ donors }: { donors: StateFinanceIndividualDonorRow[] }) {
  const [expanded, setExpanded] = useState(false)
  if (donors.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
        No donor data for this cycle.
      </div>
    )
  }
  const visible = expanded ? donors : donors.slice(0, INITIAL_ROW_COUNT)
  const hasMore = donors.length > INITIAL_ROW_COUNT
  return (
    <div data-testid="state-donors-evidence">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map(d => {
          const secondary = secondaryLine(d)
          return (
            <li key={d.rank} style={{
              padding: 8,
              borderTop: `1px solid ${COLORS.neutral.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, color: COLORS.brand.text }}>{d.donor_name}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: COLORS.brand.text }}>
                  {fmtAmount(Number(d.amount))}
                </span>
              </div>
              {secondary && (
                <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
                  {secondary}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 8, padding: '4px 10px', fontSize: 12,
            color: COLORS.brand.text, background: 'transparent',
            border: `1px solid ${COLORS.neutral.border}`, borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'show less' : `show more (${donors.length - INITIAL_ROW_COUNT} more)`}
        </button>
      )}
    </div>
  )
}
