import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import type { ReactNode } from 'react'

/**
 * Native-only scroll + keyboard-avoidance wrapper for the vertically-centered
 * card shells (AuthScreen / CalibrateScreen / BrandFormScreen). Web keeps each
 * shell's original plain-View path byte-identical (the document body scrolls
 * there) — see audit U0/C8 (unreachable below-the-fold content) + U5
 * (keyboard covering inputs).
 *
 * - flexGrow:1 + justifyContent:'center' keeps the card vertically centered
 *   when content is shorter than the viewport, while still allowing scroll
 *   when the keyboard compresses the visible area.
 * - backgroundColor lives on the KeyboardAvoidingView AND the ScrollView so
 *   both keyboard-animation gaps and overscroll show the brand bg.
 * - keyboardShouldPersistTaps="handled" lets the CTA receive the tap that
 *   dismisses the keyboard.
 */
export function NativeFormShell({
  backgroundColor,
  children,
}: {
  backgroundColor: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor }]}
      {...(Platform.OS === 'ios' ? { behavior: 'padding' as const } : {})}
    >
      <ScrollView
        style={[styles.fill, { backgroundColor }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
})
