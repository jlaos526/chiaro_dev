export const DISTRICT_TIERS = [
  'federal_house',
  'federal_senate',
  'state_senate',
  'state_house',
  'county',
  'place',
] as const

export type DistrictTier = typeof DISTRICT_TIERS[number]

export type DistrictRow = {
  id: string
  tier: DistrictTier
  state: string
  code: string
  name: string
  geometry: GeoJSONGeometry
}

export type GeoJSONGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'Point'; coordinates: [number, number] }

export type UserLocationRow = {
  home_address_text: string
  home_location: GeoJSONGeometry & { type: 'Point' }
  calibrated_at: string
}

export type CalibrateResponse = {
  home_location: { lat: number; lng: number }
  districts: Array<{
    tier: DistrictTier
    code: string
    name: string
    state: string
  }>
}
