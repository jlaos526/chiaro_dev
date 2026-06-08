'use client'

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { AuthInput } from './AuthInput.tsx'
import { AuthCrossLink } from './AuthCrossLink.tsx'

export interface AuthFormProps {
  mode: 'sign-in' | 'sign-up'
  /**
   * Resolve with `{ notice }` to surface a neutral/success message (e.g. the
   * "check your email" confirmation path) in the status banner; resolve with
   * `void` for the silent happy path (caller navigates away). A thrown error
   * populates the red error banner.
   */
  onSubmit: (vals: { email: string; password: string }) => Promise<void | { notice: string }>
  onCrossLinkPress: () => void
  /** Web a11y: real `<a href>` on the cross-link. Native ignores. */
  crossLinkHref?: string
  /** Optional prefill for the email field (e.g. carry-over from sign-up → sign-in). */
  initialEmail?: string
  testID?: string
}

const COPY = {
  'sign-in': {
    headline: 'Sign in',
    subhead: 'to your Chiaro account',
    cta: 'Sign in',
    ctaLoad: 'Signing in…',
  },
  'sign-up': {
    headline: 'Create account',
    subhead: 'Track your reps, see your bills',
    cta: 'Create account',
    ctaLoad: 'Creating account…',
  },
}

/**
 * AuthForm — orchestrates AuthInput + AuthCrossLink for the sign-in / sign-up
 * screens.
 *
 * Behavior:
 *   - `mode` prop drives headline / subhead / CTA copy + 3rd input visibility
 *     (sign-up renders a "Confirm password" field).
 *   - Client-side validation on sign-up: password length >= 8 + confirm match.
 *     Validation failures set the form-level error banner (field-level errors
 *     deferred to a future polish slice; banner copy is precise per failure).
 *   - `onSubmit` is awaited in a try/catch — caught errors populate the
 *     form-level error banner with the thrown Error.message. A resolved
 *     `{ notice }` result instead populates the neutral status banner (e.g.
 *     the "check your email to confirm" sign-up path) — distinct from errors.
 *   - During submission, all inputs + CTA disable; CTA text swaps to the
 *     mode-specific loading copy.
 *
 * Three error UX levels per spec:
 *   1. Field-level (per-input `error` prop on AuthInput — currently unused
 *      in v1; reserved for future server-side per-field errors).
 *   2. Form-level banner (accessibilityRole="alert" → ARIA live region on web)
 *      for errors; a separate role="status" + aria-live="polite" banner for
 *      notices (announced politely, not as an alert).
 *   3. Disabled CTA + inputs during pending submission.
 */
export function AuthForm(props: AuthFormProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const [email, setEmail] = useState(props.initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(): Promise<void> {
    setError(null)
    setNotice(null)
    if (props.mode === 'sign-up') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }
    setSubmitting(true)
    try {
      const result = await props.onSubmit({ email, password })
      if (result && typeof result === 'object' && 'notice' in result) {
        setNotice(result.notice)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const copy = COPY[props.mode]

  return (
    <View style={styles.form} testID={props.testID}>
      <Text accessibilityRole="header" accessibilityLevel={1} style={[styles.headline, { color: semantic.text.primary }]}>
        {copy.headline}
      </Text>
      <Text style={[styles.subhead, { color: semantic.text.muted }]}>{copy.subhead}</Text>

      <AuthInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        type="email"
        autoComplete="email"
        disabled={submitting}
        testID="auth-email"
      />
      <AuthInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        type="password"
        autoComplete={props.mode === 'sign-in' ? 'current-password' : 'new-password'}
        disabled={submitting}
        {...(props.mode === 'sign-up' ? { placeholder: '8+ characters' } : {})}
        testID="auth-password"
      />
      {props.mode === 'sign-up' && (
        <AuthInput
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          type="password"
          autoComplete="new-password"
          disabled={submitting}
          placeholder="retype"
          testID="auth-confirm-password"
        />
      )}

      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: semantic.alert.danger.bg }]} accessibilityRole="alert">
          <Text style={[styles.errorBannerText, { color: semantic.alert.danger.fg }]}>{error}</Text>
        </View>
      ) : null}

      {notice ? (
        <View
          style={[
            styles.noticeBanner,
            { backgroundColor: semantic.alert.success.bg, borderColor: semantic.alert.success.border },
          ]}
          role="status"
          aria-live="polite"
          accessibilityLiveRegion="polite"
          testID="auth-notice"
        >
          <Text style={[styles.noticeBannerText, { color: semantic.alert.success.fg }]}>{notice}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={[styles.cta, { backgroundColor: semantic.accent.primary }, submitting ? styles.ctaDisabled : null]}
        accessibilityRole="button"
        accessibilityLabel={submitting ? copy.ctaLoad : copy.cta}
        testID="auth-submit"
      >
        <Text style={styles.ctaText}>{submitting ? copy.ctaLoad : copy.cta}</Text>
      </Pressable>

      <View style={styles.crossLinkWrap}>
        <AuthCrossLink
          mode={props.mode}
          onPress={props.onCrossLinkPress}
          {...(props.crossLinkHref ? { href: props.crossLinkHref } : {})}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 8, width: '100%' },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.22,
  },
  subhead: {
    fontSize: 12,
    marginBottom: 14,
  },
  // Slice 45 update: backgroundColor lifted to inline so it consumes
  // semantic.alert.danger.bg via useBrandTokens (mode-aware). The static
  // StyleSheet here keeps layout-only properties.
  errorBanner: {
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  errorBannerText: {
    fontSize: 12,
  },
  // Notice banner — neutral/success tone, distinct from the red error banner.
  // backgroundColor + borderColor lifted inline (mode-aware via useBrandTokens).
  noticeBanner: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  noticeBannerText: {
    fontSize: 12,
  },
  cta: {
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  crossLinkWrap: { marginTop: 12, alignItems: 'center' },
})
