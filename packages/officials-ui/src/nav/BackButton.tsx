'use client'

import { Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useBrandTokens } from '../brand-hooks.ts'

/**
 * Back-arrow button consumed by hidden-from-menu Drawer screens
 * (officials/[id], state-officials/[id], profile/edit, settings/address,
 * calibrate). React Navigation Drawer's default headerLeft is the hamburger
 * icon — for sub-routes reached via router.push, the hamburger is wrong;
 * BackButton replaces it via screen options `headerLeft: () => <BackButton />`.
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
      <Text style={{ color: semantic.accent.primary, fontSize: 17, fontWeight: '600' }}>←</Text>
    </Pressable>
  )
}
