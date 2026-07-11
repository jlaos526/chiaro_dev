// Semantic brand tokens. Mode-agnostic names; mode-appropriate values.
// Source of truth: docs/superpowers/specs/2026-05-26-brand-design-design.md §4.3.

import { BRAND_PALETTE, type BrandMode } from './palette.ts'

const buildSemantic = (mode: BrandMode) => {
  const p = BRAND_PALETTE[mode]
  return {
    text: {
      primary: p.ink[1000],
      body: p.ink[700],
      muted: p.ink[500],
      disabled: p.ink[300],
      onAccent: mode === 'light' ? '#ffffff' : p.ink[1000],
    },
    bg: {
      app: p.surface.base,
      card: p.surface.card,
      elevated: p.surface.elevated,
      subtle: p.surface.subtle,
    },
    border: {
      default: p.border.default,
      strong: p.border.strong,
      focus: p.accent[500],
    },
    accent: {
      primary: p.accent[500],
      secondary: p.accent[400],
      pressed: p.accent[600],
      bg: p.accent[100],
    },
    alert: {
      danger: {
        fg: p.alert.danger.fg,
        bg: p.alert.danger.bg,
        border: p.alert.danger.border,
      },
      warning: {
        fg: p.alert.warning.fg,
        bg: p.alert.warning.bg,
        border: p.alert.warning.border,
      },
      success: {
        fg: p.alert.success.fg,
        bg: p.alert.success.bg,
        border: p.alert.success.border,
      },
      info: {
        fg: p.alert.info.fg,
        bg: p.alert.info.bg,
        border: p.alert.info.border,
      },
    },
    signal: {
      success: p.signal.success,
    },
    link: {
      fg: p.link.fg,
    },
    icon: {
      location: p.icon.location,
    },
    portrait: {
      gradient: { from: p.portrait.gradient.from, to: p.portrait.gradient.to },
      initials: p.portrait.initials,
    },
    scrim: p.scrim,
  } as const
}

export const BRAND_SEMANTIC = {
  light: buildSemantic('light'),
  dark: buildSemantic('dark'),
} as const

export type BrandSemantic = (typeof BRAND_SEMANTIC)['light']

export function getSemantic(mode: BrandMode): BrandSemantic {
  return BRAND_SEMANTIC[mode]
}
