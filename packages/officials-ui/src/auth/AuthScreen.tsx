'use client'

import { StyleSheet, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { AuthForm, type AuthFormProps } from './AuthForm.tsx'
import { AuthWordmark } from './AuthWordmark.tsx'

export interface AuthScreenProps extends AuthFormProps {
  /** When true (default), render the AuthWordmark inside the card.
   *  Web typically passes false (page-chrome carries the wordmark). */
  showBranding?: boolean
}

export function AuthScreen({ showBranding = true, ...formProps }: AuthScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }]}>
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
