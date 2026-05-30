'use client'

// Chiaro logo component. First consumer of slice-32 logoGeometry() helper.
//
// Geometry: two cascading squares with 4 L-shaped corner brackets at the
// overlap region. Web renders gradient fills via createElement escape hatch
// (RNW 0.19 strips CSS gradient strings from backgroundColor — Gotcha #19f).
// Native renders solid color fallback (alpha gradients aren't free in core RN).
//
// Source of truth: docs/superpowers/specs/2026-05-27-auth-brand-retrofit-design.md §4.2
// Geometry source: docs/brand-book.md §8

import { createElement } from 'react'
import { Platform, Text, View } from 'react-native'
import { BRAND_PALETTE, logoGeometry, LOGO_FILLS } from '@chiaro/ui-tokens'
import { useBrandTokens } from './brand-hooks.ts'

export interface LogoProps {
  /** Square side length S, in px. Defaults to 32 (Medium variant per brand book §8.2). */
  size?: number
  /** `'mark'` (default): 2-square cascade + 4 brackets. `'lockup'`: mark + CHIARO wordmark. */
  variant?: 'mark' | 'lockup'
  /** Optional tagline below wordmark (lockup variant only). */
  tagline?: string
  /** Defaults: `'Chiaro'` for mark, `'Chiaro logo'` for lockup. */
  accessibilityLabel?: string
  /** When provided, decouples wordmark size from mark size. Defaults to `size × 0.65`. */
  wordmarkSize?: number
}

export function Logo({
  size = 32,
  variant = 'mark',
  tagline,
  accessibilityLabel,
  wordmarkSize,
}: LogoProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const isWeb = Platform.OS === 'web'

  const label = accessibilityLabel ?? (variant === 'lockup' ? 'Chiaro logo' : 'Chiaro')

  // Below S=12: brackets are unreadable; fall back to single solid square.
  if (size < 12) {
    return renderFallback(size, label, isWeb)
  }

  const g = logoGeometry(size)
  const mark = renderMark(g, isWeb)

  if (variant === 'mark') {
    if (isWeb) {
      return createElement(
        'div',
        { 'aria-label': label, style: { display: 'inline-flex' } },
        mark,
      )
    }
    return <View accessibilityLabel={label}>{mark}</View>
  }

  // Lockup: mark + CHIARO wordmark (+ optional tagline)
  // wordmarkSize prop (slice 47) decouples wordmark from mark; falls back to brand book §8.3 default.
  const effectiveWordmarkSize = wordmarkSize ?? size * 0.65
  const wordmarkTracking = effectiveWordmarkSize >= 48 ? 0.06 : effectiveWordmarkSize >= 24 ? 0.07 : 0.08
  const gap = Math.max(size, effectiveWordmarkSize) * 0.4
  const taglineSize = effectiveWordmarkSize * 0.45
  const taglineGap = effectiveWordmarkSize * 0.13

  const wordmark = (
    <Text
      style={{
        fontWeight: '700',
        fontSize: effectiveWordmarkSize,
        color: semantic.text.primary,
        letterSpacing: wordmarkTracking * effectiveWordmarkSize,
      }}
    >
      CHIARO
    </Text>
  )

  const taglineNode = tagline ? (
    <Text
      style={{
        fontWeight: '400',
        fontSize: taglineSize,
        color: semantic.text.muted,
        letterSpacing: 0.02 * taglineSize,
        marginTop: taglineGap,
      }}
    >
      {tagline}
    </Text>
  ) : null

  if (isWeb) {
    return createElement(
      'div',
      {
        'aria-label': label,
        style: { display: 'inline-flex', alignItems: 'center', gap },
      },
      mark,
      createElement(
        'div',
        { style: { display: 'inline-flex', flexDirection: 'column' } },
        wordmark,
        taglineNode,
      ),
    )
  }

  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      {mark}
      <View>
        {wordmark}
        {taglineNode}
      </View>
    </View>
  )
}

interface BracketSpec {
  left: number
  top: number
  borderLeft?: number
  borderRight?: number
  borderTop?: number
  borderBottom?: number
}

function renderMark(
  g: ReturnType<typeof logoGeometry>,
  isWeb: boolean,
): React.JSX.Element {
  // Solid color fallback for native (no alpha gradients in core RN).
  const backFill = isWeb ? LOGO_FILLS.backSquare : LOGO_FILLS.borderColor
  const frontFill = isWeb ? LOGO_FILLS.frontSquare : BRAND_PALETTE.light.accent[400]

  const backStyle = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: g.squareSize,
    height: g.squareSize,
    borderRadius: g.squareRadius,
    borderWidth: g.borderStroke,
    borderColor: LOGO_FILLS.borderColor,
  }
  const frontStyle = {
    position: 'absolute' as const,
    left: g.offsetX,
    top: g.offsetY,
    width: g.squareSize,
    height: g.squareSize,
    borderRadius: g.squareRadius,
    borderWidth: g.borderStroke,
    borderColor: LOGO_FILLS.borderColor,
  }

  // Bracket positions: 4 corners of the overlap rectangle.
  // Overlap rect: x ∈ [offsetX, squareSize], y ∈ [offsetY, squareSize]
  const overlapLeft = g.offsetX
  const overlapTop = g.offsetY
  const overlapRight = g.squareSize
  const overlapBottom = g.squareSize
  const arm = g.bracketArm
  const stroke = g.bracketStroke

  const brackets: BracketSpec[] = [
    { left: overlapLeft, top: overlapTop, borderLeft: stroke, borderTop: stroke }, // TL
    { left: overlapRight - arm, top: overlapTop, borderRight: stroke, borderTop: stroke }, // TR
    { left: overlapLeft, top: overlapBottom - arm, borderLeft: stroke, borderBottom: stroke }, // BL
    { left: overlapRight - arm, top: overlapBottom - arm, borderRight: stroke, borderBottom: stroke }, // BR
  ]

  if (isWeb) {
    return createElement(
      'div',
      {
        style: {
          position: 'relative',
          width: g.boundingWidth,
          height: g.boundingHeight,
        },
      },
      createElement('div', {
        style: { ...backStyle, background: backFill },
      }),
      createElement('div', {
        style: { ...frontStyle, background: frontFill },
      }),
      ...brackets.map((b, i) =>
        createElement('div', {
          key: `b${i}`,
          style: {
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: arm,
            height: arm,
            borderLeftWidth: b.borderLeft ?? 0,
            borderRightWidth: b.borderRight ?? 0,
            borderTopWidth: b.borderTop ?? 0,
            borderBottomWidth: b.borderBottom ?? 0,
            borderStyle: 'solid',
            borderColor: LOGO_FILLS.bracketColor,
          },
        }),
      ),
    )
  }

  // Native: View tree with solid backgrounds.
  return (
    <View style={{ position: 'relative', width: g.boundingWidth, height: g.boundingHeight }}>
      <View style={{ ...backStyle, backgroundColor: backFill }} />
      <View style={{ ...frontStyle, backgroundColor: frontFill }} />
      {brackets.map((b, i) => (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: arm,
            height: arm,
            borderLeftWidth: b.borderLeft ?? 0,
            borderRightWidth: b.borderRight ?? 0,
            borderTopWidth: b.borderTop ?? 0,
            borderBottomWidth: b.borderBottom ?? 0,
            borderColor: LOGO_FILLS.bracketColor,
          }}
        />
      ))}
    </View>
  )
}

function renderFallback(size: number, label: string, isWeb: boolean): React.JSX.Element {
  const style = {
    width: size,
    height: size,
    borderRadius: Math.max(1, size * 0.094),
    backgroundColor: LOGO_FILLS.borderColor,
  }
  if (isWeb) {
    return createElement('div', { 'aria-label': label, style })
  }
  return <View accessibilityLabel={label} style={style} />
}
