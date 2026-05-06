'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getMyDistricts, type DistrictTier } from '@chiaro/location'
import { DistrictMap, type DistrictMapDistrict } from './DistrictMap'

const TIER_LABEL: Record<DistrictTier, string> = {
  federal_house: 'U.S. House',
  federal_senate: 'U.S. Senate',
  state_senate: 'State Senate',
  state_house: 'State House',
  county: 'County',
  place: 'City / Place',
}

export function DistrictPanel() {
  const [districts, setDistricts] = useState<DistrictMapDistrict[] | null>(null)

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
      <ul>
        {districts.map(d => (
          <li key={d.id}>
            <strong>{TIER_LABEL[d.tier]}</strong> · {d.code} · {d.name}
          </li>
        ))}
      </ul>
      <DistrictMap districts={districts} />
      <p><Link href="/settings/address">Edit address</Link></p>
    </section>
  )
}
