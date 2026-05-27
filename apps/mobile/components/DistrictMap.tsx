import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import MapView, { Polygon, Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { TIER_COLOR, TIER_LABEL, DISTRICT_GROUPS, type DistrictTier } from '@chiaro/location'
import { useMapColors } from '@chiaro/officials-ui'
import { COLORS } from '@chiaro/ui-tokens'

export type DistrictMapDistrict = {
  id: string
  tier: DistrictTier
  name: string
  code: string
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
}

export function DistrictMap({
  districts,
  homePoint,
}: {
  districts: DistrictMapDistrict[]
  homePoint?: { lat: number; lng: number } | null
}) {
  const mapColors = useMapColors()
  // U.S. Senate tiers default to off — both seats represent the entire state,
  // so their boundaries dominate the view and obscure local context.
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(districts.map(d => [d.id, d.tier !== 'federal_senate']))
  )
  if (districts.length === 0) return null

  // Initial view: zoom to the county boundary (most useful local context).
  // Falls back to the union of everything if no county was resolved.
  const countyDistricts = districts.filter(d => d.tier === 'county')
  const initialRegion = countyDistricts.length > 0
    ? computeInitialRegion(countyDistricts)
    : computeInitialRegion(districts)

  return (
    <View>
      <View style={styles.toggleGroups}>
        {DISTRICT_GROUPS.map(group => {
          const inGroup = group.tiers.flatMap(tier =>
            districts.filter(d => d.tier === tier).sort((a, b) => a.code.localeCompare(b.code))
          )
          if (inGroup.length === 0) return null
          return (
            <View key={group.heading} style={styles.groupRow}>
              <Text style={styles.groupHeading}>{group.heading}</Text>
              <View style={styles.toggleRow}>
                {inGroup.map(d => (
                  <Pressable
                    key={d.id}
                    style={[styles.toggle, enabled[d.id] && { backgroundColor: TIER_COLOR[d.tier] }]}
                    onPress={() => setEnabled(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
                  >
                    <Text style={[styles.toggleText, enabled[d.id] && { color: 'white' }]}>
                      {TIER_LABEL[d.tier]} {d.code}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        })}
      </View>
      <MapView style={styles.map} initialRegion={initialRegion} provider={PROVIDER_DEFAULT}>
        {districts.filter(d => enabled[d.id]).flatMap(d => polygonsFromGeometry(d).map((coords, i) => (
          <Polygon
            key={`${d.id}-${i}`}
            coordinates={coords}
            strokeColor={TIER_COLOR[d.tier]}
            strokeWidth={1.5}
            fillColor={TIER_COLOR[d.tier] + '26'}              // ~15% alpha
          />
        )))}
        {homePoint && (
          <Marker
            coordinate={{ latitude: homePoint.lat, longitude: homePoint.lng }}
            title="Home"
            pinColor={mapColors.districtStroke}
          />
        )}
      </MapView>
    </View>
  )
}

function polygonsFromGeometry(d: DistrictMapDistrict): Array<Array<{ latitude: number; longitude: number }>> {
  const polys = d.geometry.type === 'Polygon'
    ? [d.geometry.coordinates as number[][][]]
    : (d.geometry.coordinates as number[][][][])
  return polys.flatMap(poly => poly.map(ring => ring.map(([lng, lat]) => ({ latitude: lat as number, longitude: lng as number }))))
}

function computeInitialRegion(districts: DistrictMapDistrict[]) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const d of districts) {
    for (const ring of polygonsFromGeometry(d)) {
      for (const p of ring) {
        if (p.latitude < minLat) minLat = p.latitude
        if (p.latitude > maxLat) maxLat = p.latitude
        if (p.longitude < minLng) minLng = p.longitude
        if (p.longitude > maxLng) maxLng = p.longitude
      }
    }
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.5, (maxLat - minLat) * 1.2),
    longitudeDelta: Math.max(0.5, (maxLng - minLng) * 1.2),
  }
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 320, marginTop: 8 },
  toggleGroups: { gap: 8 },
  groupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  groupHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.neutral.textMuted,
    letterSpacing: 1,
    minWidth: 56,
    paddingTop: 6,
  },
  toggleRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: COLORS.neutral.outline },
  toggleText: { fontSize: 11, fontWeight: '700' },
})
