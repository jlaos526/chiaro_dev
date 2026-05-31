'use client'

import { Pressable } from 'react-native'
import { Svg, Polyline } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useBrandTokens } from '../brand-hooks.ts'

/**
 * Back-arrow button consumed by hidden-from-menu Drawer screens
 * (officials/[id], state-officials/[id], profile/edit, settings/address,
 * calibrate). React Navigation Drawer's default headerLeft is the hamburger
 * icon — for sub-routes reached via router.push, the hamburger is wrong;
 * BackButton replaces it via screen options `headerLeft: () => <BackButton />`.
 *
 * Slice 51: SVG chevron-left replaces Unicode `←` for iOS-native feel. Single
 * visual across iOS + Android + web (cross-platform-uniform per slice 51
 * locked A). Stroke consumes semantic.accent.primary via useBrandTokens()
 * for mode-aware repaint.
 */
export function BackButton(): React.JSX.Element {
  const router = useRouter()
  const { semantic } = useBrandTokens()
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{ paddingHorizontal: 14, paddingVertical: 8 }}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Polyline
          points="15 6 9 12 15 18"
          stroke={semantic.accent.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  )
}
