'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getMyDistricts, TIER_LABEL, DISTRICT_GROUPS } from '@chiaro/location'
import { COLORS } from '@chiaro/ui-tokens'
import type { DistrictMapDistrict } from './DistrictMap'

// Defer Leaflet to client-only — react-leaflet 4 + React 19 strict-mode
// double-mount triggers "Map container is already initialized" otherwise.
const DistrictMap = dynamic(
  () => import('./DistrictMap').then(m => m.DistrictMap),
  { ssr: false, loading: () => <p>Loading map…</p> }
)

export function DistrictPanel() {
  const [districts, setDistricts] = useState<DistrictMapDistrict[] | null>(null)
  const [homePoint, setHomePoint] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    getMyDistricts(supabase as never).then(rows => {
      setDistricts(rows.map(r => ({
        id: r.id,
        tier: r.tier,
        code: r.code,
        name: r.name,
        geometry: r.geometry as DistrictMapDistrict['geometry'],
      })))
    }).catch(() => setDistricts([]))

    // Pull home lat/lng out of the GeocodIO audit blob — PostgREST returns
    // the geography column as WKB hex, so the structured response is easier.
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('user_locations')
        .select('geocodio_response')
        .eq('id', data.user.id)
        .maybeSingle()
        .then(({ data: row }) => {
          const loc = (row?.geocodio_response as { location?: { lat?: number; lng?: number } } | null | undefined)?.location
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            setHomePoint({ lat: loc.lat, lng: loc.lng })
          }
        })
    })
  }, [])

  if (districts === null) return <p>Loading districts…</p>
  if (districts.length === 0) {
    return (
      <section>
        <p>You haven't calibrated yet.</p>
        <Link href="/calibrate">Calibrate to see your reps</Link>
      </section>
    )
  }

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
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.neutral.textMuted }}>
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
      <DistrictMap districts={districts} homePoint={homePoint} />
      <p><Link href="/settings/address">Edit address</Link></p>
    </section>
  )
}
