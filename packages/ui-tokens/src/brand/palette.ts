// Brand palette — light + dark color tables.
// Source of truth: docs/brand-book.md §3 and docs/superpowers/specs/2026-05-26-brand-design-design.md §4.

export const BRAND_PALETTE = {
  light: {
    ink: {
      1000: '#1a1714', // primary text, wordmark, headings
      700: '#3a322c', // body text
      500: '#6b5e52', // muted text, captions
      300: '#8a7a6a', // disabled text, helper text
      100: '#c8b9a8', // divider, subtle border
    },
    surface: {
      base: '#efece5', // app background (cooler than card)
      card: '#fdf8f3', // card / panel background
      elevated: '#ffffff', // modal, popover
      subtle: '#f7efe2', // sub-card, hover, table stripe
    },
    border: {
      default: '#e8d8c2',
      strong: '#d6c3a8',
    },
    accent: {
      100: '#fdf2e8',
      200: '#f7d9b8',
      400: '#e8a060',
      500: '#c46a2a', // PRIMARY ACCENT — logo border, focus ring, primary CTA
      600: '#a35621',
      700: '#82441a',
      900: '#4a2810',
    },
    alert: {
      // Slice 45 brand-family retune. Danger = burgundy (matches slice 42 ethics
      // family + slice 41 SUB_CASCADE light); warning = gold (slice 41 Service
      // Record family); success = emerald (slice 41 Finance family); info =
      // terracotta (slice 41 Community Presence family). Consumers of fg
      // automatically shift via brand-hooks. Replaces slice 32 generic
      // red/amber/teal/peach.
      danger: { fg: '#8a3a4d', bg: '#f8d8d0', border: '#e0928a' },
      warning: { fg: '#c89a4e', bg: '#f9e3b8', border: '#d6a85a' },
      success: { fg: '#1a8f5a', bg: '#c5e0d6', border: '#5fa897' },
      info: { fg: '#b86340', bg: '#f3d7b6', border: '#d6a474' },
    },
    signal: {
      success: '#3da75b', // finance "money in" / positive signal
    },
    link: {
      fg: '#3b6ed1', // inline link blue
    },
    icon: {
      // Slice 46: small "icon" namespace for graphical asset colors that don't
      // fit alert/signal/accent semantics. First key is map-pin location red
      // used by DistrictBadge. New icons of similar location-flavored intent
      // (compass markers, etc.) can extend this namespace; non-location icons
      // should NOT colonize.
      location: '#e74c3c', // signal red — map-pin
    },
    portrait: {
      gradient: { from: '#c46a2a', to: '#e8a060' },
      initials: '#ffffff',
    },
    // Slice 51: scrim opacity for modal/drawer overlays. 0.4 alpha on
    // light-mode app bg gives ~40% darkening which clearly indicates
    // background is interactive-blocked without losing surrounding context.
    scrim: 'rgba(0,0,0,0.4)',
  },
  dark: {
    ink: {
      1000: '#fdf8f3', // primary text (cream)
      700: '#e8d8c2', // body text
      500: '#8a7a6a', // muted text
      300: '#6b5e52', // disabled text
      100: '#3a322c', // divider
    },
    surface: {
      base: '#16181c', // app background — slice 40 cool slate
      card: '#1e2126', // card / panel — slice 40 cool slate +luminance
      elevated: '#262a30', // modal, popover — slice 40 cool slate ++luminance
      subtle: '#1c1e2270', // sub-card / hover — 4-byte rgba over base
    },
    border: {
      default: '#2a2d33', // slice 40 cool slate equivalent
      strong: '#3a3e45', // slice 40 cool slate equivalent
    },
    accent: {
      100: '#1a1f28', // slice 40 slate-blue dark (accent.bg surface)
      200: '#232a36',
      400: '#2e405a', // hover (darker than primary in dark mode)
      500: '#374f68', // PRIMARY ACCENT in dark (CTA bg) — slice 40
      600: '#485e76', // pressed (lighter than primary in dark mode)
      700: '#6a7d96',
      900: '#ced8e4', // slice 40 slate-blue lightest (was warm cream)
    },
    alert: {
      // Slice 45 dark-mode brand-family. fg uses SUB_CASCADE_ACCENT_DARK family
      // values for legibility against cool slate page bg #16181c. bg uses deep
      // hue-tinted slate; border picks up slice 41 family edge color.
      danger: { fg: '#c89aa8', bg: '#2a1820', border: '#5a2535' },
      warning: { fg: '#e1c896', bg: '#2e2516', border: '#7c5a1e' },
      success: { fg: '#7eb898', bg: '#162a1f', border: '#0f5a4f' },
      info: { fg: '#e0b8a0', bg: '#2a1f18', border: '#7a3e23' },
    },
    signal: {
      success: '#5dc97f', // finance "money in" / positive signal (dark)
    },
    link: {
      fg: '#7a98e1', // inline link blue (dark)
    },
    icon: {
      // Slice 46 dark-mode icon namespace. Coral red — brighter than light
      // signal red for legibility against cool slate page bg #16181c.
      location: '#f08074',
    },
    portrait: {
      gradient: { from: '#6b7a5d', to: '#9caa8e' },
      initials: '#fff0dc',
    },
    // Slice 51: dark scrim slightly heavier (0.55) since dark card bg
    // (#1e2126) is already low-luminance; a heavier scrim ensures the
    // overlayed surface still reads as "above" the dimmed content.
    scrim: 'rgba(0,0,0,0.55)',
  },
} as const

export type BrandMode = keyof typeof BRAND_PALETTE
export type BrandPalette = typeof BRAND_PALETTE
