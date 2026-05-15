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
    border: '#e6e3df',
    mute: '#807a72',
  },
  signal: {
    error: '#c5364a',
    warning: '#d68a1f',
    success: '#1f9b88',
  },
} as const

export type BrandColor = typeof COLORS
