'use client'

import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'

export interface AuthWordmarkProps {
  /** `sm` for desktop page-chrome; `md` for mobile in-card. Default `md`. */
  size?: 'sm' | 'md'
}

/**
 * CHIARO logo dot + wordmark. Used in:
 *   - AuthScreen (mobile, in-card, size="md")
 *   - AuthPageChrome (web, top-bar, size="sm")
 */
export function AuthWordmark({ size = 'md' }: AuthWordmarkProps): React.JSX.Element {
  const dot = size === 'md' ? 22 : 16
  const font = size === 'md' ? 12 : 10
  return (
    <View style={styles.row}>
      <View style={{ width: dot, height: dot, borderRadius: dot * 0.27, backgroundColor: COLORS.brand.primary }} />
      <Text style={{ fontSize: font, fontWeight: '600', color: COLORS.brand.text, letterSpacing: 0.08 * font }}>
        CHIARO
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
