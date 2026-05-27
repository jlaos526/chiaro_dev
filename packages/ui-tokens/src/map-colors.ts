// Domain-specific palette for the map components (web Leaflet + RN react-native-maps).
// Extracted from colors.ts (brand-design slice). Legacy export — kept stable for back-compat.

export const MAP_COLORS = {
  districtStroke: '#1a1714',   // matches brand.text
  districtFill:   '#f5f0e8',   // warm paper-tone fill
} as const

export type MapColor = typeof MAP_COLORS
