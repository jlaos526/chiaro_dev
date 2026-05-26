'use client'

import { StyleSheet, View } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import { AuthForm, type AuthFormProps } from './AuthForm.tsx'
import { AuthWordmark } from './AuthWordmark.tsx'

export interface AuthScreenProps extends AuthFormProps {
  /** When true (default), render the AuthWordmark inside the card.
   *  Web typically passes false (page-chrome carries the wordmark). */
  showBranding?: boolean
}

export function AuthScreen({ showBranding = true, ...formProps }: AuthScreenProps): React.JSX.Element {
  return (
    <View style={styles.outer}>
      <View style={styles.card}>
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
    backgroundColor: COLORS.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.neutral.background,
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
