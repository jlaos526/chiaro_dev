import { View, Text, StyleSheet } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { TIER_LABEL, DISTRICT_GROUPS, useMyDistricts, useMyHomePoint } from '@chiaro/location'
import { useBrandTokens } from '@chiaro/officials-ui'
import { DistrictMap, type DistrictMapDistrict } from './DistrictMap'

export function DistrictPanel() {
  const { semantic } = useBrandTokens()
  const districtsQ = useMyDistricts(supabase)
  const homePointQ = useMyHomePoint(supabase)

  if (districtsQ.isLoading) return <Text>Loading districts…</Text>
  if (districtsQ.error) return <Text>Couldn't load districts.</Text>

  const rows = districtsQ.data ?? []
  if (rows.length === 0) {
    return (
      <View style={[styles.banner, { backgroundColor: semantic.bg.subtle }]}>
        <Text>You haven't calibrated yet.</Text>
        <Link href="/calibrate">
          <Text style={[styles.link, { color: semantic.link.fg }]}>Calibrate to see your reps</Text>
        </Link>
      </View>
    )
  }

  const districts: DistrictMapDistrict[] = rows.map((r) => ({
    id: r.id,
    tier: r.tier,
    code: r.code,
    name: r.name,
    geometry: r.geometry as DistrictMapDistrict['geometry'],
  }))

  return (
    <View>
      <Text style={styles.title}>Your districts</Text>
      {DISTRICT_GROUPS.map((group) => {
        const inGroup = group.tiers.flatMap((tier) =>
          districts.filter((d) => d.tier === tier).sort((a, b) => a.code.localeCompare(b.code)),
        )
        if (inGroup.length === 0) return null
        return (
          <View key={group.heading} style={styles.groupSection}>
            <Text style={[styles.groupHeading, { color: semantic.text.muted }]}>
              {group.heading}
            </Text>
            {inGroup.map((d) => (
              <Text key={d.id} style={styles.row}>
                <Text style={{ fontWeight: '700' }}>{TIER_LABEL[d.tier]}</Text> · {d.code} ·{' '}
                {d.name}
              </Text>
            ))}
          </View>
        )
      })}
      <DistrictMap districts={districts} homePoint={homePointQ.data ?? null} />
      <Link href="/settings/address">
        <Text style={[styles.link, { color: semantic.link.fg }]}>Edit address</Text>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  groupSection: { marginTop: 12 },
  groupHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: { marginVertical: 1 },
  link: {},
  banner: { padding: 16, borderRadius: 8, gap: 8 },
})
