import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import MapView, { Polygon, Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { TIER_LABEL, DISTRICT_GROUPS, type DistrictTier } from '@chiaro/location'
import { useMapColors, useDistrictTierColors, useBrandTokens } from '@chiaro/officials-ui'

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
  const tierColors = useDistrictTierColors()
  const { semantic } = useBrandTokens()
  // U.S. Senate tiers default to off — both seats represent the entire state,
  // so their boundaries dominate the view and obscure local context.
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => defaultEnabled(districts))
  // `districts` arrives async and can change in place on a TanStack background
  // refetch (isFetching, not isLoading — DistrictPanel doesn't remount us). The
  // lazy initializer only runs on mount, so re-seed the toggle map when the
  // district *set* changes; otherwise a new set renders with every polygon off
  // (enabled[id] === undefined). Same ids (e.g. a geometry-only refetch) keep
  // the user's current toggles. Adjust-state-during-render is flash-free vs an
  // effect and self-terminates once the signatures match.
  const [districtSig, setDistrictSig] = useState<string>(() => districtIdSignature(districts))
  const nextSig = districtIdSignature(districts)
  if (nextSig !== districtSig) {
    setDistrictSig(nextSig)
    setEnabled(defaultEnabled(districts))
  }
  // Slice 67 (audit C9): project every district's polygon rings ONCE per
  // districts change, not per render. A layer-toggle setState now just flips
  // which memoized polygons render instead of reallocating a fresh
  // {latitude,longitude} per vertex for every district on every press.
  const polysById = useMemo(() => {
    const m = new Map<string, Array<Array<{ latitude: number; longitude: number }>>>()
    for (const d of districts) m.set(d.id, polygonsFromGeometry(d))
    return m
  }, [districts])

  // Initial view: zoom to the county boundary (most useful local context).
  // Falls back to the union of everything if no county was resolved.
  const initialRegion = useMemo(() => {
    const countyDistricts = districts.filter(d => d.tier === 'county')
    return countyDistricts.length > 0
      ? computeInitialRegion(countyDistricts)
      : computeInitialRegion(districts)
  }, [districts])

  if (districts.length === 0) return null

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
              <Text style={[styles.groupHeading, { color: semantic.text.muted }]}>{group.heading}</Text>
              <View style={styles.toggleRow}>
                {inGroup.map(d => (
                  <Pressable
                    key={d.id}
                    style={[styles.toggle, { borderColor: semantic.border.default }, enabled[d.id] && { backgroundColor: tierColors[d.tier] }]}
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
      {/* Map gestures disabled: this instance lives inside the home screen's
          ScrollView (slice 65) — an interactive 320px map would be a scroll
          dead-zone on iOS and a gesture-contention flake on Android.
          Re-evaluate (tap-to-expand?) during on-device evaluation. */}
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        provider={PROVIDER_DEFAULT}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* Deferred (S67): senate S1/S2 share geometry; view simplify neutralizes the double-transfer */}
        {districts.filter(d => enabled[d.id]).flatMap(d => (polysById.get(d.id) ?? []).map((coords, i) => (
          <Polygon
            key={`${d.id}-${i}`}
            coordinates={coords}
            strokeColor={tierColors[d.tier]}
            strokeWidth={1.5}
            fillColor={tierColors[d.tier] + '26'}              // ~15% alpha
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

function defaultEnabled(districts: DistrictMapDistrict[]): Record<string, boolean> {
  return Object.fromEntries(districts.map(d => [d.id, d.tier !== 'federal_senate']))
}

// Stable identity of the district *set* (order-independent), used to detect when
// an in-place prop change warrants re-seeding the toggle defaults.
function districtIdSignature(districts: DistrictMapDistrict[]): string {
  return districts.map(d => d.id).sort().join(',')
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
    letterSpacing: 1,
    minWidth: 56,
    paddingTop: 6,
  },
  toggleRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  toggleText: { fontSize: 11, fontWeight: '700' },
})
