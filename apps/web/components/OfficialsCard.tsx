'use client'

import Link from 'next/link'
import {
  useMyOfficials,
  useOfficialScorecardRatings,
  useOfficialMetrics,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { DistrictBadge } from './cards/DistrictBadge'
import { AlignmentChip } from './cards/AlignmentChip'
import { selectTopAlignmentChips } from '@/lib/derivations/alignment'
import { groupOfficialsByLevel } from '@/lib/derivations/officials-by-level'
import { StateOfficialsCardSection } from './state/StateOfficialsCardSection'

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}

const client = createSupabaseBrowserClient()

// Parse "CA-12" → { districtNumber: 12, atLarge: false }
// Parse "WY-AL" → { districtNumber: null, atLarge: true }
// Parse "CA-S1" or null → { districtNumber: null, atLarge: false }
function parseDistrict(code: string | null | undefined): { districtNumber: number | null; atLarge: boolean } {
  if (!code) return { districtNumber: null, atLarge: false }
  const parts = code.split('-')
  const tail = parts[1]
  if (!tail) return { districtNumber: null, atLarge: false }
  if (tail === 'AL') return { districtNumber: null, atLarge: true }
  const n = parseInt(tail, 10)
  return { districtNumber: Number.isFinite(n) ? n : null, atLarge: false }
}

function OfficialRow({ o }: { o: OfficialWithDistrict }): React.JSX.Element {
  const scorecards = useOfficialScorecardRatings(client, o.id)
  const metrics = useOfficialMetrics(client, o.id)

  const stateName = STATE_NAMES[o.state] ?? o.state
  const chips = selectTopAlignmentChips(scorecards.data ?? [])
  const salaryRole = metrics.data?.salary_role
  const currentRole = salaryRole && salaryRole !== 'Member'
    ? salaryRole
    : o.chamber === 'federal_house' ? 'Representative' : 'Senator'
  const tenure = metrics.data?.tenure_years

  const { districtNumber, atLarge } = parseDistrict(o.district?.code)

  return (
    <li style={{ padding: 0, marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          padding: '12px 14px',
          border: '1px solid #d8d4c9',
          borderRadius: 6,
          background: '#fff',
        }}
      >
        <Link href={`/officials/${o.id}`} aria-label={`View ${o.full_name}`}>
          <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={44} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/officials/${o.id}`} style={{ textDecoration: 'none', color: '#1a1714' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{o.full_name}</div>
          </Link>
          <div style={{ marginTop: 2 }}>
            <DistrictBadge
              chamber={o.chamber as 'federal_house' | 'federal_senate'}
              stateName={stateName}
              stateAbbrev={o.state}
              districtNumber={o.chamber === 'federal_house' ? districtNumber : null}
              atLarge={o.chamber === 'federal_house' && atLarge}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#3a352b', marginTop: 0 }}>
            {currentRole} · {o.chamber === 'federal_house' ? 'House' : 'Senate'}
            {tenure != null && tenure > 0 ? ` · ${tenure} yr` : ''}
          </div>
          {chips.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {chips.map((c) => (
                <AlignmentChip
                  key={c.issueArea}
                  label={c.displayLabel}
                  tier={c.tier}
                  href={`/officials/${o.id}#issue-positions:${c.subCascadeSlug}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function OfficialsCard(): React.JSX.Element {
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) {
    return (
      <section aria-label="Your officials">
        <p>Loading your officials…</p>
      </section>
    )
  }
  if (error) {
    return (
      <section aria-label="Your officials">
        <p>Couldn&apos;t load officials.</p>
      </section>
    )
  }
  if (!data || data.length === 0) {
    return (
      <section aria-label="Your officials">
        <h2>Your officials</h2>
        <p><Link href="/calibrate">Calibrate your address</Link> to see your delegation.</p>
      </section>
    )
  }

  const { federal, state } = groupOfficialsByLevel(data)

  return (
    <section aria-label="Your officials" style={{ padding: 16, background: '#f7f5ef', borderRadius: 8 }}>
      <h2 style={{ margin: 0, marginBottom: 10, fontSize: '1rem', color: '#1a1714' }}>Your officials</h2>
      {federal.length > 0 && (
        <section data-testid="federal-section">
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#666',
              margin: 0,
              marginBottom: 12,
            }}
          >
            Federal
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {federal.map((o) => (
              <OfficialRow key={o.id} o={o} />
            ))}
          </ul>
        </section>
      )}
      <StateOfficialsCardSection officials={state} />
      <p style={{ margin: '10px 0 0 0' }}>
        <Link href="/officials" style={{ fontSize: '0.85rem', color: '#3b6ed1' }}>
          See all officials →
        </Link>
      </p>
    </section>
  )
}
