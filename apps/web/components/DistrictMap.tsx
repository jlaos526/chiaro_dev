'use client'
import { useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { DistrictTier } from '@chiaro/location'

export type DistrictMapDistrict = {
  id: string
  tier: DistrictTier
  name: string
  code: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
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

  // initial bounds = union of all polygons (geojson handles this when wrapped in GeoJSON)
  const bounds = computeBounds(districts)

  return (
    <div>
      <fieldset>
        <legend>Show on map</legend>
        {districts.map(d => (
          <label key={d.id} style={{ display: 'inline-flex', gap: 4, marginRight: 12 }}>
            <input
              type="checkbox"
              checked={!!enabled[d.id]}
              onChange={e => setEnabled(prev => ({ ...prev, [d.id]: e.target.checked }))}
            />
            <span style={{ color: TIER_COLOR[d.tier] }}>{d.tier}</span>
            <span>{d.code}</span>
          </label>
        ))}
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
            style={{ color: TIER_COLOR[d.tier], weight: 1.5, fillOpacity: 0.15 }}
          />
        ))}
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
