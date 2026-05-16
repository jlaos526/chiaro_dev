'use client'

import Link from 'next/link'
import {
  useMyOfficials,
  useOfficialScorecardRatings,
  useOfficialMetrics,
  useOfficialFinance,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OfficialAvatar } from './OfficialAvatar'
import { PartyBadge } from './PartyBadge'
import { OfficialMeta } from './OfficialMeta'

const client = createSupabaseBrowserClient()

function OfficialRow({ o }: { o: OfficialWithDistrict }) {
  const scorecards = useOfficialScorecardRatings(client, o.id)
  const metrics    = useOfficialMetrics(client, o.id)
  const finance    = useOfficialFinance(client, o.id, '2024')

  const top3        = (scorecards.data ?? []).slice(0, 3)
  const topIndustry = finance.data?.industries[0]?.industry
  const attendance  = metrics.data?.attendance_pct

  const hasStrip = top3.length > 0 || !!topIndustry || attendance != null

  return (
    <li>
      <Link
        href={`/officials/${o.id}`}
        style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
      >
        <OfficialAvatar fullName={o.full_name} portraitUrl={o.portrait_url} size={48} />
        <span style={{ flex: 1 }}>
          <strong>{o.full_name}</strong>{' '}
          <PartyBadge party={o.party as any} />
          <br />
          <small><OfficialMeta official={o} /></small>
          {hasStrip && (
            <div style={{ marginTop: 4, fontSize: '0.75rem', color: COLORS.neutral.mute }}>
              {top3.map((s) => (
                <span key={s.id} style={{ marginRight: 8 }}>
                  {s.org.slug.toUpperCase()} {s.score}
                </span>
              ))}
              {topIndustry && <span style={{ marginRight: 8 }}>· {topIndustry}</span>}
              {attendance != null && <span>· Att. {attendance}%</span>}
            </div>
          )}
        </span>
      </Link>
    </li>
  )
}

export function OfficialsCard() {
  const { data, isLoading, error } = useMyOfficials(client)

  if (isLoading) return <section aria-label="Your officials"><p>Loading your officials…</p></section>
  if (error)     return <section aria-label="Your officials"><p>Couldn't load officials.</p></section>
  if (!data || data.length === 0) {
    return (
      <section aria-label="Your officials">
        <h2>Your officials</h2>
        <p><Link href="/calibrate">Calibrate your address</Link> to see your delegation.</p>
      </section>
    )
  }

  return (
    <section aria-label="Your officials">
      <h2>Your officials</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {data.map((o) => (
          <OfficialRow key={o.id} o={o} />
        ))}
      </ul>
      <p><Link href="/officials">See all officials →</Link></p>
    </section>
  )
}
