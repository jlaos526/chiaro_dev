'use client'

import { Text, View } from 'react-native'
import { type ReactNode } from 'react'
import { CATEGORY_CARD_BG, CATEGORY_CARD_BG_DARK } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

export type BrandAlertSeverity = 'danger' | 'warning' | 'success' | 'info'

export interface BrandAlertProps {
  severity: BrandAlertSeverity
  title?: string
  children?: ReactNode
}

// SEVERITY_BANDS is intentionally not derived from semantic.alert.*.fg.
// Reviewed in slice 45 (final-review minor #4) and confirmed in slice 51 visual
// comparison (light + dark, all 4 severities, option A locked).
//
// - `band` stays CONSTANT across modes — the 7px vertical pill is the bold
//   visual signal of severity. Using the light alert.fg hex even in dark mode
//   keeps the band deeply saturated against the slate card bg; deriving from
//   semantic.alert.*.fg would shift dark-mode bands to lighter variants
//   (#c89aa8 etc), which read as "lighter accent" not "bold signal".
//
// - `titleLight` uses DARKER variants than alert.fg.light for legibility
//   against the cream `CATEGORY_CARD_BG`. semantic.alert.danger.fg is #8a3a4d
//   burgundy — sufficient against #fffaf2 card bg. But warning #c89a4e gold,
//   success #1a8f5a emerald, info #b86340 terracotta would all wash out as
//   title text; #7c5a1e / #0f5a4f / #7a3e23 are the contrast-tested darker
//   variants.
//
// - `titleDark` mirrors alert.fg.dark byte-for-byte (the slice 41
//   SUB_CASCADE_ACCENT_DARK family is already a legible-on-slate variant).
const SEVERITY_BANDS: Record<BrandAlertSeverity, { band: string; glyph: string; titleLight: string; titleDark: string }> = {
  danger:  { band: '#8a3a4d', glyph: '!', titleLight: '#8a3a4d', titleDark: '#c89aa8' },
  warning: { band: '#c89a4e', glyph: '!', titleLight: '#7c5a1e', titleDark: '#e1c896' },
  success: { band: '#1a8f5a', glyph: '✓', titleLight: '#0f5a4f', titleDark: '#7eb898' },
  info:    { band: '#b86340', glyph: 'i', titleLight: '#7a3e23', titleDark: '#e0b8a0' },
}

/**
 * Alert callout (P2 pill design, slice 45). 12px rounded card + 7px rounded
 * pill on left (6px inset) + 18px severity-colored icon circle + title + body.
 * 4 severities: danger (burgundy), warning (gold), success (emerald), info
 * (terracotta). Mode-aware via useBrandTokens(); card bg uses slice 43
 * universal CATEGORY_CARD_BG.
 */
export function BrandAlert({ severity, title, children }: BrandAlertProps): React.JSX.Element {
  const { mode, semantic } = useBrandTokens()
  const sev = SEVERITY_BANDS[severity]
  const cardBg = mode === 'dark' ? CATEGORY_CARD_BG_DARK : CATEGORY_CARD_BG
  const titleColor = mode === 'dark' ? sev.titleDark : sev.titleLight

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.strong,
        borderRadius: 12,
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'stretch',
      }}
    >
      <View style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 6, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 7,
            backgroundColor: sev.band,
            borderRadius: 999,
            alignSelf: 'stretch',
          }}
        />
      </View>
      <View style={{ flex: 1, paddingVertical: 10, paddingRight: 14, paddingLeft: 4, flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: sev.band,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 9,
            marginTop: 1,
          }}
        >
          <Text style={{ color: semantic.text.onAccent, fontSize: 11, fontWeight: '800' }}>{sev.glyph}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {title ? (
            <Text style={{ fontWeight: '700', fontSize: 12.5, color: titleColor, marginBottom: 1 }}>
              {title}
            </Text>
          ) : null}
          {children ? (
            <Text style={{ fontSize: 12.5, lineHeight: 12.5 * 1.5, color: semantic.text.body }}>
              {children}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}
