import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
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
    getMyDistricts(supabase as never).then(rows => {
      setDistricts(rows.map(r => ({
        id: r.id, tier: r.tier, code: r.code, name: r.name,
        geometry: r.geometry as DistrictMapDistrict['geometry'],
      })))
    }).catch(() => setDistricts([]))
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
      {districts.map(d => (
        <Text key={d.id}>
          <Text style={{ fontWeight: '700' }}>{TIER_LABEL[d.tier]}</Text> · {d.code} · {d.name}
        </Text>
      ))}
      <DistrictMap districts={districts} />
      <Link href="/settings/address"><Text style={styles.link}>Edit address</Text></Link>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  link: { color: '#5b6cff' },
  banner: { padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8, gap: 8 },
})
