export type CalibrateInput = { address: string } | { lat: number; lng: number }

export type DistrictTier =
  | 'federal_house'
  | 'federal_senate'
  | 'state_senate'
  | 'state_house'
  | 'county'
  | 'place'

export type ResolvedDistrict = {
  tier: DistrictTier
  code: string
  state: string
  name: string
}

export type GeocodioCandidate = {
  location: { lat: number; lng: number }
  fields?: {
    congressional_districts?: Array<{
      name: string
      district_number: number
      congress_number?: number
    }>
    state_legislative_districts?: {
      house?: Array<{ name: string; district_number: string }>
      senate?: Array<{ name: string; district_number: string }>
    }
    census?: Record<
      string,
      {
        county_fips?: string
        full_fips?: string
        place?: { name?: string; fips?: string }
      }
    >
  }
  address_components: { state: string }
}

export type GeocodioResponse = {
  results: GeocodioCandidate[]
}
