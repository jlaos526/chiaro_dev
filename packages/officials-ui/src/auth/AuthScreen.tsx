'use client'

import { Platform, StyleSheet, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { AuthForm, type AuthFormProps } from './AuthForm.tsx'
import { AuthWordmark } from './AuthWordmark.tsx'

export interface AuthScreenProps extends AuthFormProps {
  /** When true (default), render the AuthWordmark inside the card.
   *  Web typically passes false (page-chrome carries the wordmark). */
  showBranding?: boolean
}

// Web: parent <main>/<body>/<html> have no defined height by default, so the
// `flex: 1` on `outer` collapses and the card sits at the top of the viewport.
// minHeight: '100vh' fills the viewport so justifyContent: 'center' can do its
// job. Mobile (RN) already gets a flex-filled Screen wrapper from the navigator,
// so this is web-only.
// RN's DimensionValue type doesn't admit arbitrary CSS unit strings like '100vh'
// but RNW passes them through to CSS at runtime. Cast through `any` here so the
// strict-typecheck doesn't reject the value the runtime actually wants.
const WEB_VIEWPORT_FILL = Platform.OS === 'web' ? ({ minHeight: '100vh' as unknown as number }) : null

export function AuthScreen({ showBranding = true, ...formProps }: AuthScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <View style={[styles.card, { backgroundColor: semantic.bg.elevated }]}>
        {showBranding && (
          <View style={styles.wordmarkWrap}>
            <AuthWordmark size="md" />
          </View>
        )}
        <AuthForm {...formProps} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  wordmarkWrap: { marginBottom: 18 },
})
