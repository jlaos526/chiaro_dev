// Domain-specific palette for the map components (web Leaflet + RN react-native-maps).
// Extracted from colors.ts (brand-design slice). Legacy export — kept stable for back-compat.

export const MAP_COLORS = {
  districtStroke: '#1a1714',   // matches brand.text
  districtFill:   '#f5f0e8',   // warm paper-tone fill
} as const

export type MapColor = typeof MAP_COLORS

// Slice 37: dark-mode map palette. Inverts stroke/fill — paper-tone
// becomes the stroke (legible against deep surface) and the deep warm
// fill replaces the paper tone.
export const MAP_COLORS_DARK = {
  districtStroke: '#fdf8f3',   // bright paper-tone stroke
  districtFill:   '#3a2e26',   // deep warm fill
} as const
