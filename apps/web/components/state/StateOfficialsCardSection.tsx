'use client'
import { useRouter } from 'next/navigation'
import { COLORS } from '@chiaro/ui-tokens'
import type { OfficialWithDistrict } from '@chiaro/officials'

function chamberLabelFor(o: OfficialWithDistrict): string {
  if (o.chamber === 'state_house') return 'State Representative'
  if (o.chamber === 'state_senate' || o.chamber === 'state_legislature') return 'State Senator'
  return o.title ?? 'State Legislator'
}

export function StateOfficialsCardSection({
  officials,
}: {
  officials: OfficialWithDistrict[]
}): React.JSX.Element | null {
  const router = useRouter()
  if (officials.length === 0) return null

  return (
    <section data-testid="state-section" style={{ marginTop: 24 }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: COLORS.neutral.textMuted,
          marginBottom: 12,
        }}
      >
        State
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {officials.map(o => (
          <button
            key={o.id}
            onClick={() => router.push(`/state-officials/${o.id}`)}
            style={{
              textAlign: 'left',
              padding: 12,
              border: `1px solid ${COLORS.neutral.border}`,
              borderRadius: 12,
              background: COLORS.neutral.surface,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              {chamberLabelFor(o)}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: COLORS.brand.text,
                marginTop: 2,
              }}
            >
              {o.full_name}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
