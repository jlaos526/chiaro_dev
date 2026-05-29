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
    portrait: {
      gradient: { from: '#c46a2a', to: '#e8a060' },
      initials: '#ffffff',
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
      base:     '#16181c',   // app background — slice 40 cool slate
      card:     '#1e2126',   // card / panel — slice 40 cool slate +luminance
      elevated: '#262a30',   // modal, popover — slice 40 cool slate ++luminance
      subtle:   '#1c1e2270', // sub-card / hover — 4-byte rgba over base
    },
    border: {
      default: '#2a2d33',   // slice 40 cool slate equivalent
      strong:  '#3a3e45',   // slice 40 cool slate equivalent
    },
    accent: {
      100: '#1a1f28',   // slice 40 slate-blue dark (accent.bg surface)
      200: '#232a36',
      400: '#2e405a',   // hover (darker than primary in dark mode)
      500: '#374f68',   // PRIMARY ACCENT in dark (CTA bg) — slice 40
      600: '#485e76',   // pressed (lighter than primary in dark mode)
      700: '#6a7d96',
      900: '#ced8e4',   // slice 40 slate-blue lightest (was warm cream)
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
    portrait: {
      gradient: { from: '#6b7a5d', to: '#9caa8e' },
      initials: '#fff0dc',
    },
  },
} as const

export type BrandMode = keyof typeof BRAND_PALETTE
export type BrandPalette = typeof BRAND_PALETTE
