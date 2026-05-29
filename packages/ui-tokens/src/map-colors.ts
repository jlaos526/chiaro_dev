// Domain-specific palette for the map components (web Leaflet + RN react-native-maps).
// Extracted from colors.ts (brand-design slice). Legacy export — kept stable for back-compat.

export const MAP_COLORS = {
  districtStroke: '#1a1714',   // matches brand.text
  districtFill:   '#f5f0e8',   // warm paper-tone fill
} as const

export type MapColor = typeof MAP_COLORS

// Slice 41: dark-mode districtFill cascades to cool slate (border.strong
// equivalent), replacing the slice 37 warm-brown anchor #3a2e26 that
// visibly clashed with slice 40's new cool slate page bg #16181c.
export const MAP_COLORS_DARK = {
  districtStroke: '#fdf8f3',   // bright paper-tone stroke (unchanged)
  districtFill:   '#3a3e45',   // cool slate (was warm '#3a2e26')
} as const
