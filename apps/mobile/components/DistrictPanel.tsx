import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getMyDistricts, TIER_LABEL, DISTRICT_GROUPS } from '@chiaro/location'
import { DistrictMap, type DistrictMapDistrict } from './DistrictMap'

export function DistrictPanel() {
  const [districts, setDistricts] = useState<DistrictMapDistrict[] | null>(null)
  const [homePoint, setHomePoint] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    getMyDistricts(supabase as never).then(rows => {
      setDistricts(rows.map(r => ({
        id: r.id, tier: r.tier, code: r.code, name: r.name,
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

  if (districts === null) return <Text>Loading districts…</Text>
  if (districts.length === 0) {
    return (
      <View style={styles.banner}>
        <Text>You haven't calibrated yet.</Text>
        <Link href="/calibrate"><Text style={styles.link}>Calibrate to see your reps</Text></Link>
      </View>
    )
  }
  return (
    <View>
      <Text style={styles.title}>Your districts</Text>
      {DISTRICT_GROUPS.map(group => {
        const inGroup = group.tiers.flatMap(tier =>
          districts.filter(d => d.tier === tier).sort((a, b) => a.code.localeCompare(b.code))
        )
        if (inGroup.length === 0) return null
        return (
          <View key={group.heading} style={styles.groupSection}>
            <Text style={styles.groupHeading}>{group.heading}</Text>
            {inGroup.map(d => (
              <Text key={d.id} style={styles.row}>
                <Text style={{ fontWeight: '700' }}>{TIER_LABEL[d.tier]}</Text> · {d.code} · {d.name}
              </Text>
            ))}
          </View>
        )
      })}
      <DistrictMap districts={districts} homePoint={homePoint} />
      <Link href="/settings/address"><Text style={styles.link}>Edit address</Text></Link>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  groupSection: { marginTop: 12 },
  groupHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: { marginVertical: 1 },
  link: { color: '#5b6cff' },
  banner: { padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8, gap: 8 },
})
