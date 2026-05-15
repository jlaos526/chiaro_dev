// Brand colors lifted from existing inline hex values in slice 1/2 components.
// Migrating call sites is slice 3.5 cleanup; the constants live here.

export const COLORS = {
  brand: {
    primary: '#5b6cff',
    accent: '#1f9b88',
    text: '#1a1714',
  },
  neutral: {
    background: '#ffffff',
    surface: '#f7f6f4',
    surfaceAlt: '#f3f4f6',   // banner / card background variant (slice 2 DistrictPanel)
    border: '#e6e3df',
    mute: '#807a72',
    textMuted: '#666',       // muted label / hint text (slice 2 DistrictPanel/Map)
    outline: '#888',         // outline / divider (slice 2 DistrictMap toggle)
  },
  signal: {
    error: '#c5364a',
    warning: '#d68a1f',
    success: '#1f9b88',
  },
} as const

// Domain-specific palette for the map components (web Leaflet + RN react-native-maps).
export const MAP_COLORS = {
  districtStroke: '#1a1714',   // matches brand.text
  districtFill:   '#f5f0e8',   // warm paper-tone fill
} as const

export type BrandColor = typeof COLORS
export type MapColor = typeof MAP_COLORS
