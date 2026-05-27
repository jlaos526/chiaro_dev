import { createElement, useMemo } from 'react'
import { Image, Platform, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BioPortraitProps {
  fullName: string
  portraitUrl: string | null
  size: number
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0] ?? ''
  if (words.length === 1) return first.charAt(0).toUpperCase()
  const last = words[words.length - 1] ?? ''
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

export function BioPortrait({ fullName, portraitUrl, size }: BioPortraitProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const portraitSolid = semantic.link.fg
  const portraitGradient = useMemo(
    // #5b8de1 derived from link.fg; slice 38+ may centralize gradient derivation
    () => `linear-gradient(135deg, ${semantic.link.fg} 0%, #5b8de1 100%)`,
    [semantic.link.fg],
  )

  if (portraitUrl) {
    return (
      <Image
        source={{ uri: portraitUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={`${fullName} portrait`}
        // RN-web maps accessibilityLabel → alt; this keeps web a11y in sync.
      />
    )
  }

  // Pattern B (see MetricCardShell): on web, paint the gradient through a
  // raw <div> wrapper via the CSS `background` shorthand (RNW's StyleSheet
  // normalizer strips `linear-gradient(...)` from `backgroundColor`). The
  // inner View must be transparent for the gradient to show through. Native
  // keeps the solid color — gradient loss is intentional convergence
  // (officials-ui stays Expo-free; no `expo-linear-gradient` dep).
  const useWebGradient = Platform.OS === 'web'
  const innerBg = useWebGradient ? 'transparent' : portraitSolid

  const inner = (
    <View
      accessibilityLabel={`${fullName} portrait (initials)`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: innerBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: semantic.text.onAccent, fontWeight: '700', fontSize: size * 0.42 }}>
        {initials(fullName)}
      </Text>
    </View>
  )

  if (useWebGradient) {
    return createElement(
      'div',
      {
        style: {
          background: portraitGradient,
          borderRadius: size / 2,
          width: size,
          height: size,
        },
      },
      inner,
    )
  }

  return inner
}
