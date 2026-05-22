import { COLORS } from '@chiaro/ui-tokens'
import { ComingSoonCard, type ComingSoonCategory } from '@/components/cards/ComingSoonCard'
import type { OfficialWithDistrict } from '@chiaro/officials'
import type { Database } from '@chiaro/db'
import { StateServiceRecordCard } from './StateServiceRecordCard'
import { StateFinanceCard } from './StateFinanceCard'
import { StateIssuePositionsCard } from './StateIssuePositionsCard'
import { StateCommunityPresenceCard } from './StateCommunityPresenceCard'
import { StateFinancialActivityCard } from './StateFinancialActivityCard'
import { StateConductCard } from './StateConductCard'

type DistrictOffice = Database['public']['Tables']['district_offices']['Row']

// All 6 categories now have real cards backed by ingest data:
// Service Record, Finance, Issue Positions, Community Presence,
// Financial Activity, and Conduct & Sanctions. Slice 5I closes the redesign
// begun in slice 5C — no ComingSoonCard placeholders remain.
const PLACEHOLDER_CATEGORIES: ComingSoonCategory[] = []

function chamberLabel(chamber: OfficialWithDistrict['chamber']): string {
  if (chamber === 'state_house') return 'State Representative'
  // covers state_senate + state_legislature (Nebraska unicameral renders as Senate-shape)
  return 'State Senator'
}

export function StateOfficialDetailPage({
  official,
  offices,
}: {
  official: OfficialWithDistrict
  offices: DistrictOffice[]
}): React.JSX.Element {
  const districtCode = official.district?.code ?? official.district_code ?? ''
  const title = official.title ?? null

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {/* Bio header */}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: COLORS.brand.text, margin: 0 }}>
          {official.full_name}
        </h1>
        {title && (
          <div
            style={{
              fontSize: 13,
              color: COLORS.neutral.textMuted,
              marginTop: 4,
              fontStyle: 'italic',
            }}
            data-testid="official-title"
          >
            {title}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 8,
            flexWrap: 'wrap',
            fontSize: 14,
            color: COLORS.neutral.textMuted,
          }}
        >
          <span>{chamberLabel(official.chamber)}</span>
          <span aria-hidden="true">·</span>
          <span>{official.party}</span>
          <span aria-hidden="true">·</span>
          <span>{districtCode}</span>
        </div>
      </header>

      {/* Offices contact section — real data, between bio and placeholder cascade */}
      {offices.length > 0 && (
        <section style={{ marginBottom: 24 }} data-testid="offices-section">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: COLORS.brand.text }}>
            Offices
          </h2>
          {offices.map(office => (
            <div
              key={office.id}
              style={{
                padding: 12,
                border: `1px solid ${COLORS.neutral.border}`,
                borderRadius: 8,
                marginBottom: 8,
                background: COLORS.neutral.surface,
              }}
            >
              <div style={{ color: COLORS.brand.text }}>{office.address}</div>
              {office.phone && (
                <div style={{ marginTop: 4, color: COLORS.neutral.textMuted }}>{office.phone}</div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Category cascade — all 6 cards are real; 0 placeholders remain
          (slice 5I closes the redesign). */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <StateServiceRecordCard official={official} />
        <StateFinanceCard official={official} />
        <StateIssuePositionsCard officialId={official.id} />
        <StateCommunityPresenceCard officialId={official.id} />
        <StateFinancialActivityCard officialId={official.id} />
        <StateConductCard officialId={official.id} />
        {PLACEHOLDER_CATEGORIES.map(cat => <ComingSoonCard key={cat} category={cat} />)}
      </section>
    </main>
  )
}
