import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import MapView, { Polygon, PROVIDER_DEFAULT } from 'react-native-maps'
import type { DistrictTier } from '@chiaro/location'

export type DistrictMapDistrict = {
  id: string
  tier: DistrictTier
  name: string
  code: string
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
}

const TIER_COLOR: Record<DistrictTier, string> = {
  federal_house: '#5b6cff',
  federal_senate: '#1f9b88',
  state_senate: '#9c64b9',
  state_house: '#7e54a8',
  county: '#7a8d4b',
  place: '#c9a84c',
}

export function DistrictMap({ districts }: { districts: DistrictMapDistrict[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(districts.map(d => [d.id, true]))
  )
  if (districts.length === 0) return null

  const initialRegion = computeInitialRegion(districts)

  return (
    <View>
      <View style={styles.toggleRow}>
        {districts.map(d => (
          <Pressable
            key={d.id}
            style={[styles.toggle, enabled[d.id] && { backgroundColor: TIER_COLOR[d.tier] }]}
            onPress={() => setEnabled(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
          >
            <Text style={[styles.toggleText, enabled[d.id] && { color: 'white' }]}>
              {d.tier} {d.code}
            </Text>
          </Pressable>
        ))}
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
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#888' },
  toggleText: { fontSize: 11, fontWeight: '700' },
})
