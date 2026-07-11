// Domain palette: per-district-tier accent colors for the map legend + polygon
// strokes/fills (web Leaflet + RN react-native-maps). Light values from the
// slice-2 location TIER_COLOR; dark variants (slice 60) lighten each hue for
// legibility on the dark map base (MAP_COLORS_DARK.districtFill #3a3e45).
// ui-tokens is a leaf package and cannot import @chiaro/location's DistrictTier,
// so it declares its own structurally-identical key union.
export type DistrictTierKey =
  | 'federal_house'
  | 'federal_senate'
  | 'state_senate'
  | 'state_house'
  | 'county'
  | 'place'

export const DISTRICT_TIER_COLOR: Record<DistrictTierKey, string> = {
  federal_house: '#5b6cff',
  federal_senate: '#1f9b88',
  state_senate: '#9c64b9',
  state_house: '#7e54a8',
  county: '#7a8d4b',
  place: '#c9a84c',
} as const

export const DISTRICT_TIER_COLOR_DARK: Record<DistrictTierKey, string> = {
  federal_house: '#8a96ff',
  federal_senate: '#4fc4b0',
  state_senate: '#c08fd9',
  state_house: '#a87fd0',
  county: '#a8bd75',
  place: '#e0c06a',
} as const
