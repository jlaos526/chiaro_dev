// Brand palette — light + dark color tables.
// Source of truth: docs/brand-book.md §3 and docs/superpowers/specs/2026-05-26-brand-design-design.md §4.

export const BRAND_PALETTE = {
  light: {
    ink: {
      1000: '#1a1714',   // primary text, wordmark, headings
       700: '#3a322c',   // body text
       500: '#6b5e52',   // muted text, captions
       300: '#8a7a6a',   // disabled text, helper text
       100: '#c8b9a8',   // divider, subtle border
    },
    surface: {
      base:     '#efece5',   // app background (cooler than card)
      card:     '#fdf8f3',   // card / panel background
      elevated: '#ffffff',   // modal, popover
      subtle:   '#f7efe2',   // sub-card, hover, table stripe
    },
    border: {
      default: '#e8d8c2',
      strong:  '#d6c3a8',
    },
    accent: {
      100: '#fdf2e8',
      200: '#f7d9b8',
      400: '#e8a060',
      500: '#c46a2a',   // PRIMARY ACCENT — logo border, focus ring, primary CTA
      600: '#a35621',
      700: '#82441a',
      900: '#4a2810',
    },
    alert: {
      danger:  { fg: '#a83a3a', bg: '#fdf2f0', border: '#f5b8b0' },
      warning: { fg: '#d68a1f', bg: '#fef7e8', border: '#f5c878' },
      success: { fg: '#1f9b88', bg: '#e8f5f2', border: '#7fc5b5' },
    },
    signal: {
      success: '#3da75b',   // finance "money in" / positive signal
    },
    link: {
      fg: '#3b6ed1',         // inline link blue
    },
  },
  dark: {
    ink: {
      1000: '#fdf8f3',   // primary text (cream)
       700: '#e8d8c2',   // body text
       500: '#8a7a6a',   // muted text
       300: '#6b5e52',   // disabled text
       100: '#3a322c',   // divider
    },
    surface: {
      base:     '#1a1410',   // app background
      card:     '#2a221c',   // card / panel
      elevated: '#3a2e26',   // modal, popover
      subtle:   '#22191344', // sub-card / hover (rgba over base)
    },
    border: {
      default: '#3a2e26',
      strong:  '#4a3e35',
    },
    accent: {
      100: '#2a1808',
      200: '#5a3814',
      400: '#c46a2a',   // hover (light-mode primary moves here)
      500: '#e8a060',   // PRIMARY ACCENT in dark
      600: '#f0b380',
      700: '#fbe1c8',
      900: '#fff0dc',
    },
    alert: {
      danger:  { fg: '#d05050', bg: '#2a1414', border: '#6e2222' },
      warning: { fg: '#f0b558', bg: '#3a2a14', border: '#6e4a20' },
      success: { fg: '#4dbfb0', bg: '#1a302c', border: '#3a6e62' },
    },
    signal: {
      success: '#5dc97f',   // finance "money in" / positive signal (dark)
    },
    link: {
      fg: '#7a98e1',         // inline link blue (dark)
    },
  },
} as const

export type BrandMode = keyof typeof BRAND_PALETTE
export type BrandPalette = typeof BRAND_PALETTE
