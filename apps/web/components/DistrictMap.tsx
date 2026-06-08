'use client'
import { useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { TIER_LABEL, DISTRICT_GROUPS, type DistrictTier } from '@chiaro/location'
import { useMapColors, useDistrictTierColors, useBrandTokens } from '@chiaro/officials-ui'

export type DistrictMapDistrict = {
  id: string
  tier: DistrictTier
  name: string
  code: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
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
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(districts.map(d => [d.id, d.tier !== 'federal_senate']))
  )

  if (districts.length === 0) return null

  // Initial view: zoom to the county boundary if present (most useful local
  // context). Falls back to the union of everything if no county was resolved.
  const countyDistricts = districts.filter(d => d.tier === 'county')
  const bounds = countyDistricts.length > 0
    ? computeBounds(countyDistricts)
    : computeBounds(districts)

  return (
    <div>
      <fieldset>
        <legend>Show on map</legend>
        {DISTRICT_GROUPS.map(group => {
          const inGroup = group.tiers.flatMap(tier =>
            districts.filter(d => d.tier === tier).sort((a, b) => a.code.localeCompare(b.code))
          )
          if (inGroup.length === 0) return null
          return (
            <div key={group.heading} style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '4px 0' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: semantic.text.muted,
                  minWidth: 56,
                }}
              >
                {group.heading}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                {inGroup.map(d => (
                  <label key={d.id} style={{ display: 'inline-flex', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={!!enabled[d.id]}
                      onChange={e => setEnabled(prev => ({ ...prev, [d.id]: e.target.checked }))}
                    />
                    <span style={{ color: tierColors[d.tier] }}>{TIER_LABEL[d.tier]}</span>
                    <span>{d.code}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </fieldset>
      <MapContainer
        bounds={bounds}
        style={{ height: 320, width: '100%', marginTop: 8 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.filter(d => enabled[d.id]).map(d => (
          <GeoJSON
            key={d.id}
            data={d.geometry as GeoJSON.GeoJsonObject}
            style={{ color: tierColors[d.tier], weight: 1.5, fillOpacity: 0.15 }}
          />
        ))}
        {homePoint && (
          <CircleMarker
            center={[homePoint.lat, homePoint.lng]}
            radius={6}
            pathOptions={{ color: mapColors.districtStroke, fillColor: mapColors.districtFill, weight: 2, fillOpacity: 1 }}
          >
            <Tooltip permanent={false} direction="top">Home</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  )
}

function computeBounds(districts: DistrictMapDistrict[]): [[number, number], [number, number]] {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const d of districts) {
    forEachCoord(d.geometry, (lng, lat) => {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    })
  }
  // fall back to a continental US bbox if degenerate
  if (minLat > maxLat) return [[24, -125], [49, -66]]
  return [[minLat, minLng], [maxLat, maxLng]]
}

function forEachCoord(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon, cb: (lng: number, lat: number) => void) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    for (const ring of poly) {
      for (const pt of ring) {
        const lng = pt[0]
        const lat = pt[1]
        if (typeof lng === 'number' && typeof lat === 'number') cb(lng, lat)
      }
    }
  }
}
