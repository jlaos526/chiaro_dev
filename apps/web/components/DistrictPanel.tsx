'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  TIER_LABEL,
  DISTRICT_GROUPS,
  useMyDistricts,
  useMyHomePoint,
} from '@chiaro/location'
import { useBrandTokens } from '@chiaro/officials-ui'
import type { DistrictMapDistrict } from './DistrictMap'

const client = createSupabaseBrowserClient()

// Defer Leaflet to client-only — react-leaflet 4 + React 19 strict-mode
// double-mount triggers "Map container is already initialized" otherwise.
const DistrictMap = dynamic(
  () => import('./DistrictMap').then(m => m.DistrictMap),
  { ssr: false, loading: () => <p>Loading map…</p> }
)

export function DistrictPanel() {
  const { semantic } = useBrandTokens()
  const districtsQ = useMyDistricts(client)
  const homePointQ = useMyHomePoint(client)

  if (districtsQ.isLoading) return <p>Loading districts…</p>
  if (districtsQ.error)     return <p>Couldn't load districts.</p>

  const rows = districtsQ.data ?? []
  if (rows.length === 0) {
    return (
      <section>
        <p>You haven't calibrated yet.</p>
        <Link href="/calibrate">Calibrate to see your reps</Link>
      </section>
    )
  }

  const districts: DistrictMapDistrict[] = rows.map(r => ({
    id: r.id,
    tier: r.tier,
    code: r.code,
    name: r.name,
    geometry: r.geometry as DistrictMapDistrict['geometry'],
  }))

  return (
    <section>
      <h2>Your districts</h2>
      {DISTRICT_GROUPS.map(group => {
        const inGroup = group.tiers.flatMap(tier =>
          districts.filter(d => d.tier === tier).sort((a, b) => a.code.localeCompare(b.code))
        )
        if (inGroup.length === 0) return null
        return (
          <section key={group.heading} style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: semantic.text.muted }}>
              {group.heading}
            </h3>
            <ul>
              {inGroup.map(d => (
                <li key={d.id}>
                  <strong>{TIER_LABEL[d.tier]}</strong> · {d.code} · {d.name}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <DistrictMap districts={districts} homePoint={homePointQ.data ?? null} />
      <p><Link href="/settings/address">Edit address</Link></p>
    </section>
  )
}
